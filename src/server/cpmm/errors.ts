/**
 * Derived from Manifold's CPMM implementation (MIT).
 * Upstream: manifoldmarkets/manifold — common/src/calculate-cpmm.ts
 * Read at fork: zugzwang-foundation/manifold-reference,
 *   tag ref-2026-04-28-found5 = commit d5b55cf9472ec05f545e6c1a817d88005b8dbf2b
 * Upstream license: MIT — Copyright (c) 2022 Manifold Markets, Inc.
 * Full notice: THIRD_PARTY_NOTICES.md (repo root).
 * This file: AGPL-3.0-or-later, © The Zugzwang Authors. See docs/specs/cpmm.md §2.
 */
import "server-only";

/**
 * Programmer-error sentinel for the CPMM module: thrown by validate.ts on
 * malformed or non-positive input (cpmm.md §10.5). NOT a SPEC.1 §15 product
 * error — handlers run every business check (floors, balance, position
 * sufficiency, market state) before calling, so reaching this is a caller bug.
 * Module-local by design (ENGINE.2 self-critique #4), distinct from
 * src/lib/errors.ts.
 */
export class CpmmInputError extends Error {
	constructor(message: string) {
		super(message);
		// Set explicitly so both `instanceof CpmmInputError` and `.name`
		// survive (native class extends Error under the ES2017 target).
		this.name = "CpmmInputError";
	}
}
