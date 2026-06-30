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
import { isUuidV7 } from "@/server/markets/media";

// ENGINE.15 S2 — F-ADMIN-1 `createMarketAction` (D-15.a 8-step). The wire
// enforces the SA-L-1 title/description ceilings (the service validates
// presence only); slug format + deadline bounds are the service's typed errors
// (mapped in toActionError). No `eventId` is supplied — `createMarket` mints
// (SA-M-1). The clock is injected here (D-14.e: `now: new Date()`).
//
// MEDIA.1: the wire also carries `marketId` (the client-pre-generated UUIDv7
// PK), the `media` manifest (a JSON string from the client uploader), and the
// optional `mediaVideoUrl`. The wire validates SHAPE only (UUIDv7 form, array
// element types); the §15 media INVARIANT (≥1 image, exactly one default) and
// the video-URL validity are the service's typed errors (`media_required` /
// `default_media_required` / `video_url_invalid`, mapped in toActionError) —
// mirroring how `content_required` is service-thrown, not zod.
const mediaItemSchema = z.object({
	mediaId: z.string().refine(isUuidV7, "mediaId must be a UUIDv7"),
	key: z.string().min(1),
	displayOrder: z.number().int().nonnegative(),
	isDefault: z.boolean(),
});

const createSchema = z.object({
	slug: z.string().min(1),
	title: z.string().max(MARKET_TITLE_MAX_CHARS),
	description: z.string().max(MARKET_DESCRIPTION_MAX_CHARS),
	resolutionDeadline: z.string().min(1),
	marketId: z.string().refine(isUuidV7, "marketId must be a UUIDv7"),
	media: z.array(mediaItemSchema),
	mediaVideoUrl: z.string().optional(),
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

	// MEDIA.1: the media manifest arrives as a JSON string (the client uploader
	// tracks `{ mediaId, key, displayOrder, isDefault }` per image). Parse it
	// before zod-validating the shape; a malformed JSON / non-array fails the
	// `media` array schema → validation_error.
	let parsedMedia: unknown;
	try {
		parsedMedia = JSON.parse(String(formData.get("media") ?? "null"));
	} catch {
		parsedMedia = undefined;
	}
	const rawVideoUrl = formData.get("mediaVideoUrl");

	const parsed = createSchema.safeParse({
		slug: String(formData.get("slug") ?? ""),
		title: String(formData.get("title") ?? ""),
		description: String(formData.get("description") ?? ""),
		resolutionDeadline: String(formData.get("resolutionDeadline") ?? ""),
		marketId: String(formData.get("marketId") ?? ""),
		media: parsedMedia,
		mediaVideoUrl: rawVideoUrl == null ? undefined : String(rawVideoUrl),
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
			marketId: parsed.data.marketId,
			slug: parsed.data.slug,
			title: parsed.data.title,
			description: parsed.data.description,
			resolutionDeadline,
			media: parsed.data.media,
			mediaVideoUrl: parsed.data.mediaVideoUrl ?? null,
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
