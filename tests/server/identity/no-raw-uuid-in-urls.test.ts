import { existsSync, readdirSync } from "node:fs";
import { join, relative, sep } from "node:path";
import { describe, expect, it } from "vitest";

// Per SCAFFOLD.3 plan §3 + §8 + plan Q8 — the URL-exposure rule per
// ADR-0016 D6 + SPEC.2 §8.9 + §16.
//
// SPEC.2 §8.9 + §16 acceptance test `id::raw-uuid-not-in-participant-urls`:
// asserts no participant-facing route file accepts a raw UUID as a
// path parameter. Participant URLs MUST use pseudonym slugs (e.g.
// `/profile/<pseudonym>`, `/u/<pseudonym>`) — never `/profile/<users.id>`.
// Admin routes under `/admin/*` MAY use raw UUIDs.
//
// FLIPPED at UI-A5 Slice 6 (plan §2 row 6, delta N-2): participant resource
// routes now exist — `(public)/m/[slug]` (SHELL/UI.0) and
// `(public)/u/[pseudonym]` (SPEC.1 §23, the A5 profile surface) — so the
// first marker below is a real walk over `src/app/`. The remaining two
// markers stay `it.todo` per the original maintenance contract.
//
// File path locked by SPEC.2 §8.10 line 948 + plan §3 file map.

const APP_DIR = join(process.cwd(), "src/app");

type DynamicSegment = {
	/** The directory basename, e.g. `[slug]`, `[pseudonym]`, `[...all]`. */
	segment: string;
	/** POSIX path relative to `src/app`, e.g. `(public)/m/[slug]`. */
	appPath: string;
};

/** Every dynamic-segment route folder under `dir`, recursively. */
function collectDynamicSegments(dir: string): DynamicSegment[] {
	const out: DynamicSegment[] = [];
	for (const entry of readdirSync(dir, { withFileTypes: true })) {
		if (!entry.isDirectory()) {
			continue;
		}
		const abs = join(dir, entry.name);
		if (entry.name.startsWith("[")) {
			out.push({
				segment: entry.name,
				appPath: relative(APP_DIR, abs).split(sep).join("/"),
			});
		}
		out.push(...collectDynamicSegments(abs));
	}
	return out;
}

describe("URL-exposure rule (id::raw-uuid-not-in-participant-urls)", () => {
	it("id::raw-uuid-not-in-participant-urls — participant (public) dynamic segments are pseudonym/slug forms; /u/[pseudonym] in the inventory (N-2); /admin/* exempt", () => {
		const all = collectDynamicSegments(APP_DIR);
		const participant = all.filter((s) => s.appPath.startsWith("(public)/"));

		// The D6 rule: every participant-facing dynamic segment is a
		// pseudonym/slug form — never a raw-UUID form.
		const ALLOWED = ["[slug]", "[pseudonym]"];
		const RAW_UUID_FORMS = [
			"[id]",
			"[userId]",
			"[uuid]",
			"[...uuid]",
			"[marketId]",
		];
		for (const s of participant) {
			expect(
				ALLOWED,
				`participant route segment ${s.appPath} must be a pseudonym/slug form`,
			).toContain(s.segment);
			expect(RAW_UUID_FORMS).not.toContain(s.segment);
		}

		// N-2: `/u/` joins the inventory — the profile route exists and its
		// segment is `[pseudonym]` (SPEC.1 §23 route law; raw UUIDs never
		// accepted).
		expect(
			existsSync(join(APP_DIR, "(public)/u/[pseudonym]/page.tsx")),
			"src/app/(public)/u/[pseudonym]/page.tsx must exist — the SPEC.1 §23 profile route (UI-A5 Slice 6)",
		).toBe(true);
		expect(
			participant.some((s) => s.appPath === "(public)/u/[pseudonym]"),
		).toBe(true);

		// The market debate route stays in the inventory, keyed by slug.
		expect(participant.some((s) => s.appPath === "(public)/m/[slug]")).toBe(
			true,
		);

		// `/admin/*` is EXEMPT (SPEC.2 §8.9 + ADR-0016 D6): raw-UUID segments
		// there — e.g. the built `(admin)/admin/markets/[marketId]` — are
		// permitted and are excluded from the participant inventory by scope.
		expect(participant.map((s) => s.segment)).not.toContain("[marketId]");
	});

	it.todo(
		"id::admin-routes-MAY-carry-raw-uuids — positive coverage that /admin/users/<uuid>, /admin/markets/<uuid> are explicitly permitted per SPEC.2 §8.9 + ADR-0016 D6",
	);

	it.todo(
		"id::dataset-release-carries-raw-uuids — the 2026-11-06 dataset export uses raw UUIDs as join keys per SPEC.1 §12.2 + SPEC.2 §8.9",
	);
});
