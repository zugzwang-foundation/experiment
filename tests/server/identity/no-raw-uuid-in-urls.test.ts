import { describe, it } from "vitest";

// Per SCAFFOLD.3 plan §3 + §8 + plan Q8 — placeholder `it.todo` test file
// for the URL-exposure rule per ADR-0016 D6 + SPEC.2 §8.9 + §16.
//
// SPEC.2 §8.9 + §16 acceptance test `id::raw-uuid-not-in-participant-urls`:
// regex-asserts no participant-facing route file accepts a raw UUID as a
// path parameter. Participant URLs MUST use pseudonym slugs (e.g.
// `/profile/<pseudonym>`, `/u/<pseudonym>`) — never `/profile/<users.id>`.
// Admin routes under `/admin/*` MAY use raw UUIDs.
//
// Plan Q8 resolution: meaningful only AFTER participant resource routes
// exist. SCAFFOLD.3 doesn't ship `/profile/:pseudonym`, `/u/:pseudonym`,
// `/m/<market-slug>`, etc. — those land at DEBATE.* / DESIGN.* tasks.
//
// Maintenance contract: when participant resource routes ship, flip these
// `it.todo` markers to real `it(...)` regex-walks over `src/app/`. The
// test should fail if any participant-facing route folder contains a
// `[...uuid]` or `[id]` segment that accepts a raw UUID.
//
// File path locked by SPEC.2 §8.10 line 948 + plan §3 file map.

describe("URL-exposure rule (id::raw-uuid-not-in-participant-urls)", () => {
	it.todo(
		"id::raw-uuid-not-in-participant-urls — meaningful only once participant resource routes (e.g. /profile/:pseudonym, /u/:pseudonym, /m/<market-slug>) exist; per plan Q8 deferred until DEBATE.* / DESIGN.* tasks ship those routes",
	);

	it.todo(
		"id::admin-routes-MAY-carry-raw-uuids — positive coverage that /admin/users/<uuid>, /admin/markets/<uuid> are explicitly permitted per SPEC.2 §8.9 + ADR-0016 D6",
	);

	it.todo(
		"id::dataset-release-carries-raw-uuids — the 2026-11-06 dataset export uses raw UUIDs as join keys per SPEC.1 §12.2 + SPEC.2 §8.9",
	);
});
