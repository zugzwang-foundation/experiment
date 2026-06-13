"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import {
	type ActionResult,
	adminSessionRequired,
	buildAdminMetadata,
	requireAdminSession,
	toActionError,
	validationError,
} from "@/server/admin/wire";
import {
	MARKET_DESCRIPTION_MAX_CHARS,
	MARKET_TITLE_MAX_CHARS,
} from "@/server/config/limits";
import { createMarket } from "@/server/markets/create";

// ENGINE.15 S2 — F-ADMIN-1 `createMarketAction` (D-15.a 8-step). The wire
// enforces the SA-L-1 title/description ceilings (the service validates
// presence only); slug format + deadline bounds are the service's typed errors
// (mapped in toActionError). No `eventId` is supplied — `createMarket` mints
// (SA-M-1). The clock is injected here (D-14.e: `now: new Date()`).
const createSchema = z.object({
	slug: z.string().min(1),
	title: z.string().max(MARKET_TITLE_MAX_CHARS),
	description: z.string().max(MARKET_DESCRIPTION_MAX_CHARS),
	resolutionDeadline: z.string().min(1),
});

/** A `datetime-local` value ("YYYY-MM-DDTHH:mm" ± ":ss") read as UTC. */
function parseDeadline(raw: string): Date | null {
	const match = /^(\d{4}-\d{2}-\d{2}T\d{2}:\d{2})(:\d{2})?$/.exec(raw);
	if (!match) return null;
	const parsed = new Date(`${match[1]}${match[2] ?? ":00"}.000Z`);
	return Number.isNaN(parsed.getTime()) ? null : parsed;
}

export async function createMarketAction(
	formData: FormData,
): Promise<ActionResult<{ marketId: string; slug: string }>> {
	if (!(await requireAdminSession())) return adminSessionRequired();

	const parsed = createSchema.safeParse({
		slug: String(formData.get("slug") ?? ""),
		title: String(formData.get("title") ?? ""),
		description: String(formData.get("description") ?? ""),
		resolutionDeadline: String(formData.get("resolutionDeadline") ?? ""),
	});
	if (!parsed.success) return validationError(parsed.error);

	const resolutionDeadline = parseDeadline(parsed.data.resolutionDeadline);
	if (!resolutionDeadline) {
		return {
			ok: false,
			error: {
				code: "validation_error",
				message: "One or more fields are invalid.",
				field_errors: { resolutionDeadline: ["Invalid date/time."] },
			},
		};
	}

	const metadata = await buildAdminMetadata({ flowId: "F-ADMIN-1" });
	try {
		const result = await createMarket({
			slug: parsed.data.slug,
			title: parsed.data.title,
			description: parsed.data.description,
			resolutionDeadline,
			now: new Date(),
			metadata,
		});
		revalidatePath("/admin/markets");
		revalidatePath("/admin/markets/[marketId]", "page");
		return { ok: true, data: { marketId: result.marketId, slug: result.slug } };
	} catch (error) {
		return toActionError(error, "F-ADMIN-1");
	}
}
