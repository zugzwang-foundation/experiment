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

import type Decimal from "decimal.js";

import { numericString } from "@/server/events/schemas";
import { CpmmDecimal } from "./decimal";
import { CpmmInputError } from "./errors";

/**
 * The module's input gate (cpmm.md §10.5). Validates one decimal-string
 * quantity and returns it as a single CpmmDecimal instance the callers reuse
 * (no double-parsing). Reaching a throw is a programmer error — handlers run
 * every business check (floors, balance, position sufficiency, market state)
 * before calling.
 *
 * `numericString` is the live ENGINE.0 boundary validator, reused verbatim
 * (never redefined, never `z.number()`); its regex is the only shape gate.
 * Strict positivity is layered on top because `numericString` is SIGNED — it
 * admits "0" and a leading "-", which CPMM curve inputs must not be.
 *
 * @param value the raw decimal string (a seed, stake, shares, or reserve)
 * @param label the quantity name, for a debuggable error message
 */
export function requirePositive(value: string, label: string): Decimal {
	if (!numericString.safeParse(value).success) {
		throw new CpmmInputError(
			`${label} must be a NUMERIC(38,18) decimal string, received ${JSON.stringify(value)}`,
		);
	}

	// Anything passing numericString's regex is a valid decimal.js literal, so
	// construction cannot throw after the safeParse gate.
	const d = new CpmmDecimal(value);

	if (!d.gt(0)) {
		throw new CpmmInputError(
			`${label} must be strictly positive (> 0), received ${JSON.stringify(value)}`,
		);
	}

	return d;
}
