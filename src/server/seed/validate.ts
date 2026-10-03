// SEED-STAGING-1 — every rule a sheet must pass before anything is written.
//
// Pure: no database, no clock. The caller supplies which market slugs are
// Open. The rules mirror what the bet route and `place()` would refuse, so a
// sheet that validates here does not fail half-way through the engine on a
// rule we could have told the operator about up front. The engine still
// re-checks everything; this is the frontstop, not the guarantee.
//
// One deliberate difference from the route: a stake above BET_MAX_STAKE is an
// ERROR here, where the route clamps it. Clamping a hand-written sheet would
// silently change the operator's numbers.

import type Decimal from "decimal.js";
import {
	BET_MAX_STAKE,
	BET_MIN_STAKE_POST,
	BET_MIN_STAKE_REPLY,
	COMMENT_MAX_LENGTH,
	INITIAL_USER_DHARMA,
} from "@/server/config/limits";
import { CpmmDecimal } from "@/server/cpmm/decimal";

import type { RawSeedRow, SeedRow, SeedRowError } from "./types";

export const SEED_LABEL_RE = /^[A-Za-z0-9_-]{1,40}$/;

const STAKE_RE = /^\d+(?:\.\d{1,18})?$/;
const ROW_REF_RE = /^\d+$/;

export function validateSeedRows(
	rows: readonly RawSeedRow[],
	ctx: { acceptedMarketSlugs: ReadonlySet<string> },
): { rows: SeedRow[]; errors: SeedRowError[] } {
	// Row numbers key everything downstream — validity, the idempotency key,
	// an unlabelled participant's email, a reply's parent. The parser numbers
	// them densely and in order, but /admin/seed/run receives them from the
	// browser, so the property is CHECKED here rather than inherited: two rows
	// sharing a number would share one key, and the second would be reported
	// "already posted" without ever having been posted.
	for (let i = 0; i < rows.length; i++) {
		if (i > 0 && rows[i].rowNumber <= rows[i - 1].rowNumber) {
			return {
				rows: [],
				errors: [
					{
						rowNumber: 0,
						message: `row numbers must be unique and ascending (row ${rows[i].rowNumber} follows row ${rows[i - 1].rowNumber})`,
					},
				],
			};
		}
	}

	const errors: SeedRowError[] = [];
	const byNumber = new Map<number, RawSeedRow>();
	for (const raw of rows) byNumber.set(raw.rowNumber, raw);

	// Pass 1 — each row on its own. A row that fails here can't be a parent.
	const rowValid = new Map<number, boolean>();
	for (const raw of rows) {
		const before = errors.length;
		const fail = (message: string) =>
			errors.push({ rowNumber: raw.rowNumber, message });

		if (!ctx.acceptedMarketSlugs.has(raw.market)) {
			fail(
				raw.market === ""
					? "market is required"
					: `market "${raw.market}" is not an Open market`,
			);
		}
		const side = raw.side.toUpperCase();
		if (side !== "YES" && side !== "NO") {
			fail(`side must be YES or NO (got "${raw.side}")`);
		}
		if (raw.user !== "" && !SEED_LABEL_RE.test(raw.user)) {
			fail(`user label "${raw.user}" must be 1-40 letters, digits, "-" or "_"`);
		}
		if (raw.argument.trim() === "") {
			fail("argument is empty");
		} else if (raw.argument.length > COMMENT_MAX_LENGTH) {
			fail(
				`argument is ${raw.argument.length} characters (max ${COMMENT_MAX_LENGTH})`,
			);
		}
		if (raw.replyTo !== "" && !ROW_REF_RE.test(raw.replyTo)) {
			fail(`reply_to must be a row number (got "${raw.replyTo}")`);
		}
		const isReply = raw.replyTo !== "";
		if (!STAKE_RE.test(raw.stake)) {
			fail(
				`stake must be a positive number with at most 18 decimals (got "${raw.stake}")`,
			);
		} else {
			const stake = new CpmmDecimal(raw.stake);
			const floor = isReply ? BET_MIN_STAKE_REPLY : BET_MIN_STAKE_POST;
			if (stake.lessThan(floor)) {
				fail(
					`stake ${raw.stake} is below the ${isReply ? "reply" : "post"} minimum of ${floor}`,
				);
			} else if (stake.greaterThan(BET_MAX_STAKE)) {
				fail(`stake ${raw.stake} is above the maximum of ${BET_MAX_STAKE}`);
			}
		}
		rowValid.set(raw.rowNumber, errors.length === before);
	}

	// Pass 2 — rules that relate rows to each other. Labels compare
	// case-insensitively: `seedParticipantEmail` lowercases them, so "U1" and
	// "u1" are one participant and must be judged as one.
	const label = (raw: RawSeedRow) => raw.user.toLowerCase();
	const sideByLabelMarket = new Map<string, { side: string; row: number }>();
	const stakeByLabel = new Map<string, Decimal>();
	for (const raw of rows) {
		if (!rowValid.get(raw.rowNumber)) continue;
		const fail = (message: string) => {
			errors.push({ rowNumber: raw.rowNumber, message });
			rowValid.set(raw.rowNumber, false);
		};

		if (raw.replyTo !== "") {
			const parentNumber = Number(raw.replyTo);
			const parent = byNumber.get(parentNumber);
			if (!parent || parentNumber >= raw.rowNumber) {
				fail(`reply_to ${raw.replyTo} must name an earlier row`);
			} else if (parent.market !== raw.market) {
				fail(
					`reply_to ${raw.replyTo} is in market "${parent.market}", not "${raw.market}"`,
				);
			} else if (parent.replyTo !== "") {
				fail(
					`reply_to ${raw.replyTo} is itself a reply (replies are one level deep)`,
				);
			} else if (!rowValid.get(parentNumber)) {
				fail(`reply_to ${raw.replyTo} has errors of its own`);
			} else if (raw.user !== "" && label(raw) === label(parent)) {
				fail(`user "${raw.user}" cannot reply to their own argument`);
			}
		}
		if (!rowValid.get(raw.rowNumber) || raw.user === "") continue;

		const key = `${label(raw)}\u0000${raw.market}`;
		const side = raw.side.toUpperCase();
		const held = sideByLabelMarket.get(key);
		if (held && held.side !== side) {
			fail(
				`user "${raw.user}" already argues ${held.side} in "${raw.market}" (row ${held.row}); one side per market`,
			);
			continue;
		}
		if (!held) sideByLabelMarket.set(key, { side, row: raw.rowNumber });

		const total = (stakeByLabel.get(label(raw)) ?? new CpmmDecimal(0)).plus(
			raw.stake,
		);
		if (total.greaterThan(INITIAL_USER_DHARMA)) {
			fail(
				`user "${raw.user}" would stake ${total.toString()} in total, more than the ${INITIAL_USER_DHARMA} a new participant holds`,
			);
			continue;
		}
		stakeByLabel.set(label(raw), total);
	}

	const valid: SeedRow[] = [];
	for (const raw of rows) {
		if (!rowValid.get(raw.rowNumber)) continue;
		valid.push({
			rowNumber: raw.rowNumber,
			marketSlug: raw.market,
			userLabel: raw.user === "" ? null : raw.user,
			side: raw.side.toUpperCase() as "YES" | "NO",
			stake: raw.stake,
			body: raw.argument,
			replyToRow: raw.replyTo === "" ? null : Number(raw.replyTo),
		});
	}
	errors.sort((a, b) => a.rowNumber - b.rowNumber);
	return { rows: valid, errors };
}
