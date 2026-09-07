// STAGING-PARITY Slice B — THE LITERAL FIXTURE TABLE.
// Manifest §1.3 (B4) + plan Q4. NEVER import this from src/**.
//
// ═══════════════════════════════════════════════════════════════════════════
// NO RNG. ANYWHERE.
//
// Manifest §1.3 permits a seeded RNG; B4 records that a hand-written table is
// STRICTLY STRONGER — there is no seed to lose and no generator version to
// reproduce. Every stake, side, slug, seed amount and body string below is a
// literal. `Math.random` does not appear in this file or in the generator.
//
// WHAT IS *NOT* DETERMINISTIC, and why that is accepted (Q4): UUIDv7 primary
// keys and all timestamps. Those are the engine's, not ours, and working around
// them would mean writing values the engine cannot produce — which is what
// P-10 forbids. The consequence is bounded: SLUGS are literals, so `/m/<slug>`
// is stable across runs, and pseudonyms are stable because the reset truncates
// and re-seeds `identity_pool`, restoring the FIFO consume order.
//
// ⚠ P-8 — PLACEHOLDER MARKET QUESTIONS ONLY. Nothing here comes from CONTENT.1.
// CONTENT.1 is founder-serial and unlaunched; burning real questions into a
// shared pre-launch environment leaks them and wastes founder work. Every title
// and body below announces itself as a fixture.
//
// ⚠ SLICE C EXTENDS THIS FILE, IT DOES NOT REWRITE IT. The shapes below carry
// only what Slice B produces: participants, markets, one post per active
// market, and the four lifecycle terminals. Slice C adds REPLIES, the C1–C11
// content shapes on M2, the flip/exit sequences, bookmarks and moderation by
// APPENDING rows and a `replies` table — never by re-keying what is here.

import { FREEZE_INSTANT_UTC } from "@/server/markets/create";

/** Roles, per manifest §2.2. Ten participants. */
export type ParticipantRole =
	| "P-owner"
	| "P-visitor-target"
	| "P-empty"
	| "P-flipped"
	| "P-exited"
	| "P-removed"
	| "P-banned"
	| "P-crowd-1"
	| "P-crowd-2"
	| "P-crowd-3";

/** Market keys. M9 is DELIBERATELY ABSENT — see MARKETS below. */
export type MarketKey =
	| "M1"
	| "M2"
	| "M3"
	| "M4"
	| "M5"
	| "M6"
	| "M7"
	| "M8"
	| "M10"
	| "M11"
	| "M12"
	| "M13"
	| "M14"
	| "M15"
	| "M16";

// ═══════════════════════════════════════════════════════════════════════════
// ToS EVIDENCE — manifest §1.7 (B5), Ratification Record §5 W-C
//
// `acceptTosAction` writes these two columns from mocked `headers()`. They land
// in a database PUBLISHED ON 2026-11-06. The rule is fixed, obviously-synthetic
// literals — unmistakably generated on sight. Never a plausible IP, never a
// real user-agent string.
//
// So the "IP" is deliberately NOT AN IP ADDRESS AT ALL. Both columns are
// `text`, so nothing forces IP shape, and a documentation-range address like
// 203.0.113.4 would still READ as an address to anyone scanning the published
// dataset. A value that cannot be parsed as an address cannot be mistaken for
// one — which is the whole requirement.
// ═══════════════════════════════════════════════════════════════════════════

export const SYNTHETIC_TOS_IP = "SYNTHETIC-FIXTURE-NO-IP-WAS-RECORDED";
export const SYNTHETIC_TOS_USER_AGENT =
	"SYNTHETIC-FIXTURE-NO-USER-AGENT-WAS-RECORDED (ZugzwangStagingFixtureGenerator)";

/** The synthetic e-mail domain. RFC 2606 reserves `example.com` forever. */
const FIXTURE_EMAIL_DOMAIN = "staging-fixture.example.com";

export interface ParticipantFixture {
	readonly role: ParticipantRole;
	/**
	 * Index into the captured Google identities when this role must reuse a REAL
	 * account (manifest §2.2 P-owner + the two other Google-linked accounts —
	 * all three carry the `users_email_idx` collision hazard). `null` for a
	 * fully synthetic participant.
	 */
	readonly capturedIdentityIndex: number | null;
	/** Used only when `capturedIdentityIndex` is null. */
	readonly syntheticEmailLocal: string;
	/** Better Auth `user.name`. Never rendered — the pseudonym is the public face. */
	readonly displayName: string;
	/** Why this role exists, so an inspector reading the table knows. */
	readonly serves: string;
}

/**
 * The ten participants, in creation order.
 *
 * ⚠ CREATION ORDER IS LOAD-BEARING. `consumeIdentityPoolTuple` allocates FIFO
 * by `created_at`, so this order fixes which pseudonym each role receives —
 * which is what makes `/u/<pseudonym>` stable across rebuilds (Q4).
 *
 * ⚠ THE THREE CAPTURED IDENTITIES. Index 0 is the operator's primary account
 * and takes P-owner (the owner arm of Profile and positions). The
 * two others take P-visitor-target and P-empty — the roles an operator most
 * wants to be able to SIGN IN AS during inspection: one well-populated profile
 * and one showing every empty state at once. Class-1 decision, Slice B.
 */
export const PARTICIPANTS: readonly ParticipantFixture[] = [
	{
		role: "P-owner",
		capturedIdentityIndex: 0,
		syntheticEmailLocal: "p-owner",
		displayName: "Staging Fixture Owner",
		serves: "owner arm of Profile / positions; Q4 holds YES on M2",
	},
	{
		role: "P-visitor-target",
		capturedIdentityIndex: 1,
		syntheticEmailLocal: "p-visitor-target",
		displayName: "Staging Fixture Visitor Target",
		serves:
			"a well-populated profile viewed as a VISITOR — proves the DTO split",
	},
	{
		role: "P-empty",
		capturedIdentityIndex: 2,
		syntheticEmailLocal: "p-empty",
		displayName: "Staging Fixture Empty",
		serves:
			"zero posts / replies / positions — every empty state at once. NEVER BETS, so its balance stays exactly 1000 (manifest §0 B7)",
	},
	{
		role: "P-flipped",
		capturedIdentityIndex: null,
		syntheticEmailLocal: "p-flipped",
		displayName: "Staging Fixture Flipped",
		serves: "Slice C: buy YES -> sell ALL YES -> buy NO (the Flipped marker)",
	},
	{
		role: "P-exited",
		capturedIdentityIndex: null,
		syntheticEmailLocal: "p-exited",
		displayName: "Staging Fixture Exited",
		serves: "Slice C: fully sold out (the Exited marker); must not re-enter",
	},
	{
		role: "P-removed",
		capturedIdentityIndex: null,
		syntheticEmailLocal: "p-removed",
		displayName: "Staging Fixture Removed",
		serves:
			"Slice C: one removed comment and one surviving — masking without a ban",
	},
	{
		role: "P-banned",
		capturedIdentityIndex: null,
		syntheticEmailLocal: "p-banned",
		displayName: "Staging Fixture Banned",
		serves:
			"Slice C: banned AFTER content exists — ADR-0021, ban removes voice, not past content",
	},
	{
		role: "P-crowd-1",
		capturedIdentityIndex: null,
		syntheticEmailLocal: "p-crowd-1",
		displayName: "Staging Fixture Crowd One",
		serves: "volume for lane dominance, reply counts and the interleave",
	},
	{
		role: "P-crowd-2",
		capturedIdentityIndex: null,
		syntheticEmailLocal: "p-crowd-2",
		displayName: "Staging Fixture Crowd Two",
		serves: "volume for lane dominance, reply counts and the interleave",
	},
	{
		role: "P-crowd-3",
		capturedIdentityIndex: null,
		syntheticEmailLocal: "p-crowd-3",
		displayName: "Staging Fixture Crowd Three",
		serves: "volume for lane dominance, reply counts and the interleave",
	},
];

/** The e-mail a synthetic participant is created with. */
export function syntheticEmail(local: string): string {
	return `${local}@${FIXTURE_EMAIL_DOMAIN}`;
}

/** What Slice B does to a market after opening it. */
export type TerminalAction =
	| "none"
	| "close"
	| "resolving"
	| "resolve-yes"
	| "void";

export interface MarketFixture {
	readonly key: MarketKey;
	/** LITERAL — this is what makes `/m/<slug>` stable across rebuilds (Q4). */
	readonly slug: string;
	readonly title: string;
	readonly description: string;
	/** `false` for M1 only — the Draft market, which is never opened. */
	readonly open: boolean;
	/**
	 * The ADR-0047 open: a YES price strictly inside (0,1) and a tank of Đ.
	 * Raw; the generator canonicalises both with the REAL
	 * `canonicalizeAmount18`, exactly as the admin wire does.
	 *
	 * Uniform across the table at 0.10 / 100,000 ⇒ 90,000 YES / 10,000 NO,
	 * which is what the 7-day soak needs to exercise: a symmetric fixture set
	 * would leave every asymmetric code path — the void cross-assert, the
	 * settle residual, the chart's seed — unexercised on staging while
	 * looking like a full rehearsal. The former per-market seeds (100, and
	 * 5000 on M7 and M10) are gone with the single-scalar shape.
	 */
	readonly openingPriceYes: string;
	readonly tank: string;
	/**
	 * Milliseconds after the generation instant at which `resolution_deadline`
	 * falls.
	 *
	 * THE ONE RELATIVE VALUE IN THIS TABLE, and it is forced rather than chosen.
	 * `createMarket` refuses a deadline that is not strictly after `now`, and
	 * `closeMarket` refuses one that has not been reached — so a market that must
	 * end this run needs a deadline BETWEEN those two instants. A literal
	 * calendar date cannot satisfy both for a run whose `now` moves. It is the
	 * same class as the UUIDv7 and timestamp non-determinism Q4 already accepts,
	 * and it is NOT backdating: every stored `created_at` is the engine's own.
	 *
	 * ⚠ NEVER ADD THIS TO `now` YOURSELF — call `resolutionDeadlineFor(m, now)`.
	 * The raw offset walks past the conclusion freeze, and the ceiling clamp
	 * that keeps it legal lives in that function.
	 */
	readonly deadlineOffsetMs: number;
	readonly terminal: TerminalAction;
	readonly serves: string;
}

/**
 * A deadline far enough out that an Open market never reads as expired.
 *
 * ⚠ 60 days ago passed the conclusion freeze on 2026-09-06, so from that date
 * onward this offset alone produces an ILLEGAL deadline. It is not lowered,
 * because "far enough out that an Open market never reads as expired" is the
 * property the fixture set needs and a shorter offset would break it sooner in
 * a quieter way. The ceiling is enforced by `resolutionDeadlineFor` instead.
 */
export const LONG_DEADLINE_MS = 60 * 24 * 60 * 60 * 1000; // 60 days
/** Just past `now`, so the close call in the same run is legal. */
export const SHORT_DEADLINE_MS = 60 * 1000; // 1 minute

/**
 * How far short of `FREEZE_INSTANT_UTC` a clamped deadline lands.
 *
 * `createMarket` accepts `deadline == FREEZE_INSTANT_UTC` (SPEC.1 §12.1 reads
 * "≤"), so zero margin would be legal. An hour is taken anyway: a deadline
 * sitting exactly on the freeze instant is indistinguishable from a fixture
 * that MEANT to sit there, and the one hour makes the clamp legible in the
 * data — a staging market whose deadline is 22:59 on 5 November is one this
 * function moved.
 */
export const DEADLINE_CEILING_MARGIN_MS = 60 * 60 * 1000; // 1 hour

/**
 * A fixture's `resolution_deadline`, CLAMPED to the freeze ceiling.
 *
 * ⚠ THE CLAMP LIVES HERE, AT THE SOURCE, AND NOT AT THE CALLER. Every deadline
 * in this table is an offset from the run instant (see `deadlineOffsetMs`), so
 * every one of them walks toward `FREEZE_INSTANT_UTC` as the experiment
 * approaches its conclusion and eventually crosses it. `createMarket` rejects
 * that with `MarketDeadlineCeilingError`, which is correct behaviour by the
 * engine and a broken fixture table by us — and it broke on 2026-09-06, the
 * day `now + LONG_DEADLINE_MS` first passed 2026-11-05T23:59Z.
 *
 * A caller-side `Math.min` would have fixed the one call site that failed and
 * left `SHORT_DEADLINE_MS`, and every offset added later, to fail the same way
 * on its own schedule. Routing every deadline through one function means the
 * next offset added to this table inherits the ceiling without anyone
 * remembering it exists.
 *
 * ⚠ RESIDUAL, stated rather than defended: inside the final
 * `DEADLINE_CEILING_MARGIN_MS` before the freeze, the clamped deadline is no
 * longer after `now`, and `createMarket` then raises
 * `MarketDeadlineInPastError`. Generating fixtures in the last hour before the
 * conclusion freeze is not a thing this repo needs to support, and a fixture
 * run at that moment SHOULD fail loudly.
 */
export function resolutionDeadlineFor(
	fixture: Pick<MarketFixture, "deadlineOffsetMs">,
	now: Date,
): Date {
	const ceilingMs = FREEZE_INSTANT_UTC.getTime() - DEADLINE_CEILING_MARGIN_MS;
	return new Date(
		Math.min(now.getTime() + fixture.deadlineOffsetMs, ceilingMs),
	);
}

/**
 * FIFTEEN markets — created in this order, M1 alone left in Draft.
 *
 * ⚠ THERE IS NO M9, AND THERE NEVER WILL BE. M9 is the Frozen market, and
 * manifest §1.8 / §3 make it PERMANENTLY unreachable: no freeze write path
 * exists in `src/`, and `system_state.frozen_at` is a one-shot trigger-enforced
 * transition that bricks staging read-only if set. The label is left vacant so
 * a later reader cannot mistake a filler market for the state that was ruled
 * out. Slice B therefore runs M1–M8 and M10–M16.
 *
 * ⚠ M4 CARRIES NO POST, BY DESIGN. Manifest §2.1 defines M4 as "Open, brand
 * new … zero posts" — it is the fixture for BOTH `EmptySideCTA` slots. So the
 * "one post per open market" rule has exactly one exception, and it is a
 * manifest requirement rather than an omission.
 */
export const MARKETS: readonly MarketFixture[] = [
	{
		key: "M1",
		slug: "sp-m1-draft",
		title: "Staging fixture M1 — placeholder draft question",
		description:
			"PLACEHOLDER resolution criterion for a Draft staging fixture. Not real market content.",
		open: false,
		openingPriceYes: "0.10",
		tank: "100000",
		deadlineOffsetMs: LONG_DEADLINE_MS,
		terminal: "none",
		serves: "Draft — admin surface; /m/sp-m1-draft must 404 for participants",
	},
	{
		key: "M2",
		slug: "sp-m2-active",
		title: "Staging fixture M2 — placeholder heavily-active question",
		description:
			"PLACEHOLDER resolution criterion for the primary POLISH.3 subject. Not real market content.",
		open: true,
		// ⚠ RAISED 500 -> 5000 AT SLICE C, and it is forced rather than chosen.
		// Đb — the header Portfolio figure and the §23 Positions "Current" column —
		// is `computeSell(quantity).proceeds` against the LIVE pool, impact-inclusive
		// (`header-portfolio.ts:18–24`; SPEC.1 §10.8 rejects mark-to-market outright).
		// M2 carries ~4300 Đ of flow once §2.3 lands, so against a 500 seed the
		// impact would be so large that a four-digit holding cannot be REPRESENTED
		// at all — gate 5's G5.5 would be unsatisfiable for a reason that is a
		// fixture choice, not a product fact. 5000 keeps prices in a sane band while
		// still moving them enough for C11's multi-point chart.
		openingPriceYes: "0.10",
		tank: "100000",
		deadlineOffsetMs: LONG_DEADLINE_MS,
		terminal: "none",
		serves:
			"Open, heavily active — the primary POLISH.3 subject; carries all of §2.3",
	},
	{
		key: "M3",
		slug: "sp-m3-light",
		title: "Staging fixture M3 — placeholder lightly-active question",
		description:
			"PLACEHOLDER resolution criterion for the graceful-degradation case. Not real market content.",
		open: true,
		openingPriceYes: "0.10",
		tank: "100000",
		deadlineOffsetMs: LONG_DEADLINE_MS,
		terminal: "none",
		serves:
			"Open, lightly active — no post clears k_lane, so NO badges render and Top falls back to closest-to-landslide",
	},
	{
		key: "M4",
		slug: "sp-m4-new",
		title: "Staging fixture M4 — placeholder brand-new question",
		description:
			"PLACEHOLDER resolution criterion for a market with no activity. Not real market content.",
		open: true,
		openingPriceYes: "0.10",
		tank: "100000",
		deadlineOffsetMs: LONG_DEADLINE_MS,
		terminal: "none",
		serves: "Open, brand new — ZERO posts, both EmptySideCTA slots",
	},
	{
		key: "M5",
		slug: "sp-m5-closed",
		title: "Staging fixture M5 — placeholder closed question",
		description:
			"PLACEHOLDER resolution criterion for the Closed state. Not real market content.",
		open: true,
		openingPriceYes: "0.10",
		tank: "100000",
		deadlineOffsetMs: SHORT_DEADLINE_MS,
		terminal: "close",
		serves: "Closed — read-only; write affordances gated",
	},
	{
		key: "M6",
		slug: "sp-m6-resolving",
		title: "Staging fixture M6 — placeholder resolving question",
		description:
			"PLACEHOLDER resolution criterion for the Resolving state. Not real market content.",
		open: true,
		openingPriceYes: "0.10",
		tank: "100000",
		deadlineOffsetMs: SHORT_DEADLINE_MS,
		terminal: "resolving",
		serves: "Resolving — read-only; distinct badge",
	},
	{
		key: "M7",
		slug: "sp-m7-resolved",
		title: "Staging fixture M7 — placeholder resolved question",
		description:
			"PLACEHOLDER resolution criterion for the Resolved state, settled YES. Not real market content.",
		open: true,
		// Deliberately generous: `settleMarket` pays winners 1 Đ per share, so a
		// 1000 Đ YES post into a 5000 seed returns a FOUR-DIGIT payout. That is
		// gate 5's G5.6 carrier, and M7 is terminal in THIS slice — a magnitude
		// not placed here can never be placed later.
		openingPriceYes: "0.10",
		tank: "100000",
		deadlineOffsetMs: SHORT_DEADLINE_MS,
		terminal: "resolve-yes",
		serves:
			"Resolved (YES) — settled positions on the Profile side; the gate-5 four-digit P/L carrier",
	},
	{
		key: "M8",
		slug: "sp-m8-voided",
		title: "Staging fixture M8 — placeholder voided question",
		description:
			"PLACEHOLDER resolution criterion for the Voided state. Not real market content.",
		open: true,
		openingPriceYes: "0.10",
		tank: "100000",
		// `voidMarket` accepts Open or Closed, so no deadline pressure.
		deadlineOffsetMs: LONG_DEADLINE_MS,
		terminal: "void",
		serves: "Voided — the void path differs from resolve (void_refund refunds)",
	},
	// M9 — Frozen. PERMANENTLY UNREACHABLE. Never mint it. See the block above.
	{
		key: "M10",
		slug: "sp-m10-fill",
		title: "Staging fixture M10 — placeholder filler question",
		description:
			"PLACEHOLDER resolution criterion for Discovery filler. Not real market content.",
		open: true,
		openingPriceYes: "0.10",
		tank: "100000",
		deadlineOffsetMs: LONG_DEADLINE_MS,
		terminal: "none",
		serves:
			"Open filler — Discovery hero + full grid (DISCOVERY_GRID_SIZE + 1)",
	},
	{
		key: "M11",
		slug: "sp-m11-fill",
		title: "Staging fixture M11 — placeholder filler question",
		description:
			"PLACEHOLDER resolution criterion for Discovery filler. Not real market content.",
		open: true,
		openingPriceYes: "0.10",
		tank: "100000",
		deadlineOffsetMs: LONG_DEADLINE_MS,
		terminal: "none",
		serves: "Open filler",
	},
	{
		key: "M12",
		slug: "sp-m12-fill",
		title: "Staging fixture M12 — placeholder filler question",
		description:
			"PLACEHOLDER resolution criterion for Discovery filler. Not real market content.",
		open: true,
		openingPriceYes: "0.10",
		tank: "100000",
		deadlineOffsetMs: LONG_DEADLINE_MS,
		terminal: "none",
		serves: "Open filler",
	},
	{
		key: "M13",
		slug: "sp-m13-fill",
		title: "Staging fixture M13 — placeholder filler question",
		description:
			"PLACEHOLDER resolution criterion for Discovery filler. Not real market content.",
		open: true,
		openingPriceYes: "0.10",
		tank: "100000",
		deadlineOffsetMs: LONG_DEADLINE_MS,
		terminal: "none",
		serves: "Open filler",
	},
	{
		key: "M14",
		slug: "sp-m14-fill",
		title: "Staging fixture M14 — placeholder filler question",
		description:
			"PLACEHOLDER resolution criterion for Discovery filler. Not real market content.",
		open: true,
		openingPriceYes: "0.10",
		tank: "100000",
		deadlineOffsetMs: LONG_DEADLINE_MS,
		terminal: "none",
		serves: "Open filler",
	},
	{
		key: "M15",
		slug: "sp-m15-fill",
		title: "Staging fixture M15 — placeholder filler question",
		description:
			"PLACEHOLDER resolution criterion for Discovery filler. Not real market content.",
		open: true,
		openingPriceYes: "0.10",
		tank: "100000",
		deadlineOffsetMs: LONG_DEADLINE_MS,
		terminal: "none",
		serves: "Open filler",
	},
	{
		key: "M16",
		slug: "sp-m16-fill",
		title: "Staging fixture M16 — placeholder filler question",
		description:
			"PLACEHOLDER resolution criterion for Discovery filler. Not real market content.",
		open: true,
		openingPriceYes: "0.10",
		tank: "100000",
		deadlineOffsetMs: LONG_DEADLINE_MS,
		terminal: "none",
		serves: "Open filler",
	},
];

/**
 * WHEN a write runs, relative to the two irreversible events in the DAG.
 *
 * Slice B needed no phases — every post ran in one pass. Slice C has two writes
 * that CANNOT run in that pass, and both are forced by engine semantics rather
 * than chosen:
 *
 * - `after-flip` — P-flipped's NO post on M2. `sell` must unwind the ENTIRE YES
 *   holding first; a NO buy while YES is still held raises
 *   `OppositeSideHeldError`. So the NO post is not "a later post", it is a post
 *   that is illegal until the sell commits.
 * - `after-settlement` — P-owner's 1500 Đ reply on M2. P-owner is at 0 Đ from
 *   the moment its 1000 Đ M7 post lands until M7 settles. The Dharma that funds
 *   this reply does not EXIST before the settlement.
 *
 * Everything else is `main`. The generator runs the phases in order and asserts
 * each is non-empty, so a phase that silently loses its rows is not a green run.
 */
export type FixturePhase = "main" | "after-flip" | "after-settlement";

/**
 * A stable handle for a post, so replies, bookmarks and moderation name their
 * target instead of indexing into an array. UUIDv7 ids are minted by the engine
 * and differ every run (Q4), so a literal key is the only cross-reference that
 * survives a rebuild.
 */
export type PostKey = string;

export interface PostFixture {
	readonly key: PostKey;
	readonly market: MarketKey;
	readonly author: ParticipantRole;
	readonly side: "YES" | "NO";
	/** LITERAL. Every stake is >= BET_MIN_STAKE_POST; the generator asserts it
	 *  with the REAL `assertStakeFloor` rather than trusting this comment. */
	readonly stake: string;
	readonly body: string;
	readonly phase: FixturePhase;
	/**
	 * C7 — this post carries a real R2 image. The generator runs the full
	 * participant chain: `signUploadAndInsert` -> a real presigned PUT ->
	 * `verifyUploadedObject` -> `place({ image })`. ⚠ It NEVER hand-INSERTs an
	 * `image_uploads` row; that is the same P-2/P-3 prohibition every other row
	 * in this file is under.
	 */
	readonly image?: true;
	readonly serves: string;
}

/** C8 — long enough to trip the "Read more" affordance. `COMMENT_MAX_LENGTH`
 *  is 5000, so this sits comfortably inside the engine's own limit while being
 *  far past any render-side clamp. Built by repetition so it announces itself
 *  as generated rather than reading as real argument (P-8). */
const TRUNCATING_BODY = `PLACEHOLDER staging fixture argument, deliberately long. ${(
	"This sentence is repeated purely to push the body past the render-side " +
		"clamp so the Read more affordance has something to clamp. It carries no " +
		"argument and no market content whatsoever. "
).repeat(9)}End of the PLACEHOLDER truncation fixture.`;

/**
 * EVERY post in the fixture set. Slice B placed one per open market; Slice C
 * fills M2 to the §2.3 shape and gives M3 a second voice.
 *
 * ⚠ ORDER IS LOAD-BEARING, THREE TIMES.
 *
 * 1 · P-owner's M7 bet must come FIRST. `accrueDailyCredit` fires inside
 *     `place()` once per UTC day, so P-owner's first bet opens at 1010 Đ
 *     (1000 grant + 10 credit). The 1000 Đ M7 stake fits only while that
 *     credit is unspent. It runs down to 10 Đ, the M2 post spends it, and the
 *     M7 settlement then pays the four-digit balance back.
 * 2 · P-owner must hold YES on M2 (manifest Q4) so the NO composer renders
 *     `oppositeHeld`-disabled for the owner viewer. Not arbitrary — it is the
 *     fixture for that rule.
 * 3 · P-flipped's two M2 posts straddle the sell. `M2-P10` is the YES post
 *     whose `side_at_post_time` must SURVIVE the flip — that is the INV-3
 *     proof, and it is only visible because both posts sit on the market an
 *     inspector actually opens. `M2-P11` is `after-flip` because it is illegal
 *     until the YES holding is fully unwound.
 *
 * ⚠ M2 CARRIES EXACTLY 12 POSTS — `latestInterleaveInterval` (10) + 2, so the
 * P2 latest-interleave fires at least twice (C2). The constant is READ from
 * `ranking.config.ts`, never restated here — `tests/unit/staging/fixture-table.test.ts`
 * pins the count against it, so a fixture edit that breaks C2 fails in CI
 * rather than on staging.
 *
 * ⚠ P-EMPTY APPEARS NOWHERE. It is defined by never betting; a single post
 * would move its balance off exactly 1000 and destroy manifest §0 B7's carrier.
 *
 * ⚠ ADMIN APPEARS NOWHERE. Manifest §1.6 — the seeding admin holds no position
 * and authors no comment. Every post below is attributed to a pooled
 * participant.
 *
 * ⚠ ONE HELD SIDE PER (USER, MARKET) — `I-SINGLE-SIDE-001`. Every author and
 * every replier below is on ONE side of any given market, P-flipped excepted
 * (which is the exception by construction). This is not a style preference: a
 * second side raises `OppositeSideHeldError` and aborts the run.
 */
export const POSTS: readonly PostFixture[] = [
	// ⚠ M7-P1 RUNS BEFORE M7-P2, AND THE ORDER IS THE WHOLE POINT.
	//
	// The §23 net-P/L tile is `(wallet + Σ Đb over OPEN holdings) − Σ issuance`
	// — LIFETIME, not per-market. What makes it four-digit is the ENTRY PRICE:
	// an opposing bet landing first makes the winning side cheaper, so the same
	// stake buys more shares and the settlement pays more. Nothing here is
	// contrived for the gate — an opposing bet arriving before yours is the
	// ordinary case, and it is the only case in which a winning position is
	// worth writing home about.
	//
	// ⚠ THIS BLOCK'S FIGURES DESCRIBED A DIFFERENT MARKET, AND THEY ARE
	// REPLACED RATHER THAN ANNOTATED. `O-5`: an appendix reverses nothing a
	// reader reaches first, so a correction written underneath the superseded
	// text is not a correction. What stood here argued from a fair p = 0.5 on a
	// 5,000 seed and quoted "2126.89 shares instead of 1833.33". M7 opens at
	// `openingPriceYes` 0.10 into a `tank` of 100,000, so the pool starts
	// yes 90,000 / no 10,000 and the NO bet moves YES DOWN to ~0.098 rather than
	// up to ~0.47. Measured through the shipped `computeBuy` at LIQ-1-FIX-2:
	//
	//     P-crowd-1's  900 Đ NO   →   999.009900990099009898 shares
	//     P-owner's   1000 Đ YES  →  9338.692098092643051767 shares
	//     final pool   yes 82561.307901907356948233
	//                  no  10900.990099009900990102
	//
	// ⛔ AND THE OPPOSING BET IS NO LONGER LOAD-BEARING FOR G5.6. At p = 0.5 it
	// was — a lone winning stake could not clear 1000. At 0.10 it can: 1000 Đ
	// alone into (90000, 10000) buys 9181.82 shares. The M7-P1 rows still carry
	// the losing side of a settled market, which is their real job; they are not
	// what makes the four-digit P/L reachable, and a later reader must not
	// re-scope them on a reason that has expired.
	//
	// ⚠ IT IS FOUR BETS, NOT ONE, AND THAT IS THE PARITY FIX (L-6). ADR-0047
	// capped a single bet at `BET_MAX_STAKE` = 250, so a lone 900 Đ stake is a
	// position no participant can now build through the product — on a replica
	// whose entire purpose is to look like production. The generator never saw
	// it because the cap lives at the place route's step 5d and the generator
	// drives the SERVICE, so the fixture landed happily and lied quietly.
	//
	// ⚠ SPLITTING COSTS ALMOST NOTHING, AND THE "ALMOST" IS THE PART WORTH
	// WRITING DOWN. In exact arithmetic it costs nothing: a CPMM buy adds the
	// stake to both reserves and removes shares from one, so after a stake M the
	// long reserve is `y + M` and the short is `k / (y + M)` — both functions of
	// the TOTAL only — and the shares telescope, each step's `k/(y+…)` term
	// cancelling the next step's to leave `n + M − k/(y + M)`.
	//
	// ⛔ BUT THE SHIPPED BUY FLOORS, AND THIS FILE SAID "IDENTICAL" UNTIL
	// `@code-reviewer` CHECKED. `calculate.ts` takes `shares = floor18(sExact)`
	// and then `aPrime = a + S − shares`, so every step leaves up to 1e-18 of
	// dust in the bought reserve and the next step inherits it. Measured, the
	// same totals down both paths:
	//
	//                    split (4+4 bets)            single (1+1 bets)
	//     pool yes   82561.307901907356948233   82561.307901907356948230
	//     pool no    10900.990099009900990102   10900.990099009900990100
	//     NO shares    999.009900990099009898     999.009900990099009900
	//     YES shares  9338.692098092643051767    9338.692098092643051770
	//
	// The divergence is bounded by (#steps) × 1e-18 and is MONOTONE IN THE
	// POOL'S FAVOUR — a participant receives fewer shares, never more, so INV-C2
	// (`k` only grows) holds by construction. That bound is the thing to
	// re-check if a step count ever grows; "identical" told a later reader there
	// was nothing to check, which is the more expensive kind of wrong.
	//
	// What else changes is the number of ARGUMENTS, which is the honest part:
	// the product makes you say four things to stake 900 Đ.
	{
		key: "M7-P1a",
		market: "M7",
		author: "P-crowd-1",
		side: "NO",
		stake: "250",
		phase: "main",
		body: "PLACEHOLDER staging fixture argument opening the losing side of the market that resolves YES. It settles to a total loss, which is what a resolved market has to be able to show.",
		serves:
			"the losing side of M7 — a settled position worth zero, which is what a resolved market has to be able to show. ⚠ It used to say this bet is what makes G5.6's four-digit P/L reachable AT ALL; that was true at p = 0.5 and is false at M7's 0.10 — see the block above",
	},
	{
		key: "M7-P1b",
		market: "M7",
		author: "P-crowd-1",
		side: "NO",
		stake: "250",
		phase: "main",
		body: "PLACEHOLDER staging fixture argument, the second of four adding to the same NO position. A participant who wants depth on one side now has to argue for it more than once.",
		serves:
			"the 900 Đ NO position, step 2 of 4 (L-6: every step <= BET_MAX_STAKE)",
	},
	{
		key: "M7-P1c",
		market: "M7",
		author: "P-crowd-1",
		side: "NO",
		stake: "250",
		phase: "main",
		body: "PLACEHOLDER staging fixture argument, the third of four adding to the same NO position. Each step moves the price, which is what makes M7 carry a multi-point chart rather than a single tick.",
		serves: "the 900 Đ NO position, step 3 of 4",
	},
	{
		key: "M7-P1d",
		market: "M7",
		author: "P-crowd-1",
		side: "NO",
		stake: "150",
		phase: "main",
		body: "PLACEHOLDER staging fixture argument closing out the 900 Đ NO position. The last step is smaller than the cap because the total is what was calibrated, not the step count.",
		serves:
			"the 900 Đ NO position, step 4 of 4 — 250+250+250+150; the remainder is deliberate and still clears BET_MIN_STAKE_POST",
	},
	// ⚠ FOUR BETS, FOUR LOTS, AND G5.3 SURVIVES BECAUSE OF THE SECOND HALF.
	// The §23 Positions "Staked" column is Đa = Σ `lots.surviving_basis`
	// (`src/server/lots/basis.ts`), so each 250 Đ step mints its own lot at
	// basis 250 and P-owner — who never sells M7 — carries 1000 exactly, as it
	// did when this was a single bet. Had the reader taken the LAST bet's stake
	// instead, this split would have dropped G5.3 to 250, which is why the
	// reader was read rather than assumed.
	//
	// ⚠ THE READER NAMED HERE WAS THE SUPERSEDED ONE UNTIL `@code-reviewer`
	// CHECKED. This said "the final SideEpisode's `stakedBasis`" and pointed at
	// `episodes.ts` — the authority until LOTS-1 / ADR-0039, and
	// `profile/positions.ts` says so in as many words. The conclusion was right
	// and the citation was not, which is `O-3`: a true finding reported with a
	// wrong cause is still a defect, because the next reader follows the cause.
	{
		key: "M7-P2a",
		market: "M7",
		author: "P-owner",
		side: "YES",
		stake: "250",
		phase: "main",
		body: "PLACEHOLDER staging fixture argument opening the winning side of M7. The position it starts is what carries a four-digit realised P/L onto the profile tiles.",
		serves:
			"G5.3 positions staked >= 1000 (Đa over the whole episode); G5.6 four-digit lifetime net P/L",
	},
	{
		key: "M7-P2b",
		market: "M7",
		author: "P-owner",
		side: "YES",
		stake: "250",
		phase: "main",
		body: "PLACEHOLDER staging fixture argument, the second of four building the winning M7 position. Four steps of 250 reach the same 1000 Đ basis a single bet used to.",
		serves:
			"the 1000 Đ YES position, step 2 of 4 (L-6: every step <= BET_MAX_STAKE)",
	},
	{
		key: "M7-P2c",
		market: "M7",
		author: "P-owner",
		side: "YES",
		stake: "250",
		phase: "main",
		body: "PLACEHOLDER staging fixture argument, the third of four building the winning M7 position. The daily credit accrues on the first of these only, so the 1010 Đ opening balance still runs down to 10.",
		serves: "the 1000 Đ YES position, step 3 of 4",
	},
	{
		key: "M7-P2d",
		market: "M7",
		author: "P-owner",
		side: "YES",
		stake: "250",
		phase: "main",
		body: "PLACEHOLDER staging fixture argument completing the winning M7 position. Its settlement is what funds the after-settlement replies further down this table.",
		serves:
			"the 1000 Đ YES position, step 4 of 4; the payout that funds the after-settlement phase",
	},
	{
		key: "M2-P1",
		market: "M2",
		author: "P-owner",
		side: "YES",
		stake: "10",
		phase: "main",
		body: "PLACEHOLDER staging fixture argument on the heavily-active market. The owner holds YES here so the NO composer renders opposite-side-disabled.",
		serves: "Q4 — owner holds YES on M2; C1 both slots populated",
	},
	{
		key: "M2-P2",
		market: "M2",
		author: "P-crowd-1",
		side: "YES",
		stake: "40",
		phase: "main",
		body: "PLACEHOLDER staging fixture argument that attracts the most replies on M2. Its reply volume is what makes it the traction-lane carrier.",
		serves:
			"C3 Most Debated (traction n, SOLE floor-clearer) + C5 many replies on both sides",
	},
	{
		key: "M2-P3",
		market: "M2",
		author: "P-crowd-2",
		side: "NO",
		stake: "35",
		phase: "main",
		body: "PLACEHOLDER staging fixture argument that attracts the most Dharma on M2. Its attracted stake is what makes it the value-lane carrier.",
		serves: "C3 Highest Stakes (stake D, ratio >= kLane)",
	},
	{
		key: "M2-P4",
		market: "M2",
		author: "P-crowd-3",
		side: "YES",
		stake: "30",
		phase: "main",
		body: "PLACEHOLDER staging fixture argument that draws an evenly split reply set. The even split is what makes it the contestation-lane carrier.",
		serves: "C3 Contested (n^b, SOLE floor-clearer)",
	},
	{
		key: "M2-P5",
		market: "M2",
		author: "P-visitor-target",
		side: "YES",
		stake: "25",
		phase: "main",
		body: "PLACEHOLDER staging fixture argument that nobody replies to. It renders the empty reply state inside a populated market.",
		serves: "C6 — zero replies",
	},
	{
		key: "M2-P6",
		market: "M2",
		author: "P-visitor-target",
		side: "YES",
		stake: "20",
		phase: "main",
		image: true,
		body: "PLACEHOLDER staging fixture argument carrying an attached image. The image exercises the in-card clip and the whole-render pop-up.",
		serves: "C7 — attached image, real R2 object",
	},
	{
		key: "M2-P7",
		market: "M2",
		author: "P-removed",
		side: "NO",
		stake: "20",
		phase: "main",
		body: TRUNCATING_BODY,
		serves:
			"C8 — truncating length; also P-removed's SURVIVING comment (masking without a ban)",
	},
	{
		key: "M2-P8",
		market: "M2",
		author: "P-removed",
		side: "NO",
		stake: "20",
		phase: "main",
		body: "PLACEHOLDER staging fixture argument that is removed by a moderator. Its replies were authored BEFORE the removal and must survive it.",
		serves: "C9 + X1 — a removed POST whose replies survive",
	},
	{
		key: "M2-P9",
		market: "M2",
		author: "P-banned",
		side: "NO",
		stake: "20",
		phase: "main",
		body: "PLACEHOLDER staging fixture argument by an author who is later banned. ADR-0021: the ban removes voice, not past content, so this survives.",
		serves:
			"C10 host (a PRESENT post carrying a removed reply) + X3 ban target",
	},
	{
		key: "M2-P10",
		market: "M2",
		author: "P-flipped",
		side: "YES",
		stake: "20",
		phase: "main",
		body: "PLACEHOLDER staging fixture argument posted while holding YES. Its side_at_post_time stays YES after the flip — that is the INV-3 proof.",
		serves: "INV-3 — a YES comment that survives its author flipping to NO",
	},
	{
		key: "M2-P11",
		market: "M2",
		author: "P-flipped",
		side: "NO",
		stake: "20",
		phase: "after-flip",
		body: "PLACEHOLDER staging fixture argument posted after the flip. Same author, same market, opposite side — and the YES comment above did not move.",
		serves: "the NO half of the flip; illegal until the YES holding is unwound",
	},
	{
		key: "M2-P12",
		market: "M2",
		author: "P-crowd-1",
		side: "YES",
		stake: "15",
		phase: "main",
		body: "PLACEHOLDER staging fixture argument. Volume so the majority of M2's posts dominate no lane at all.",
		serves: "C4 — the majority-carry-no-badge criterion",
	},
	{
		key: "M3-P1",
		market: "M3",
		author: "P-crowd-1",
		side: "YES",
		stake: "10",
		phase: "main",
		body: "PLACEHOLDER staging fixture argument on the lightly-active market. Deliberately below every lane floor so no badge renders.",
		serves: "M3 graceful degradation",
	},
	{
		key: "M3-P2",
		market: "M3",
		author: "P-crowd-2",
		side: "NO",
		stake: "12",
		phase: "main",
		body: "PLACEHOLDER staging fixture argument giving the lightly-active market a second voice, so Top has something to order and still renders no badge.",
		serves: "M3 — two posts, so Top falls back to closest-to-landslide",
	},
	{
		key: "M5-P1",
		market: "M5",
		author: "P-crowd-2",
		side: "NO",
		stake: "20",
		phase: "main",
		body: "PLACEHOLDER staging fixture argument on the market that closes. Its position must remain visible after the close with the sell affordance hidden.",
		serves: "Q2 — a position on a terminal market",
	},
	{
		key: "M6-P1",
		market: "M6",
		author: "P-crowd-3",
		side: "YES",
		stake: "20",
		phase: "main",
		body: "PLACEHOLDER staging fixture argument on the market that enters Resolving. Read-only once the trigger fires.",
		serves: "M6 Resolving — read-only with a distinct badge",
	},
	{
		key: "M8-P1",
		market: "M8",
		author: "P-flipped",
		side: "NO",
		stake: "15",
		phase: "main",
		body: "PLACEHOLDER staging fixture argument on the market that voids. The void refunds this stake through void_refund.",
		serves: "M8 Voided — the void path differs from resolve",
	},
	{
		key: "M10-P1",
		market: "M10",
		author: "P-visitor-target",
		side: "YES",
		stake: "25",
		phase: "main",
		body: "PLACEHOLDER staging fixture argument. Populates the visitor-target profile so the visitor DTO split has something to hide.",
		serves: "P-visitor-target's profile body of work",
	},
	{
		key: "M11-P1",
		market: "M11",
		author: "P-visitor-target",
		side: "NO",
		stake: "15",
		phase: "main",
		body: "PLACEHOLDER staging fixture argument on a second market, so the visitor-target profile shows more than one position.",
		serves: "Q1 — an open sellable position",
	},
	{
		key: "M12-P1",
		market: "M12",
		author: "P-exited",
		side: "YES",
		stake: "30",
		phase: "main",
		body: "PLACEHOLDER staging fixture argument. This position is sold out in full to produce the Exited marker; the author never re-enters.",
		serves: "the buy half of P-exited; G5.2's carrier after the round trip",
	},
	{
		key: "M13-P1",
		market: "M13",
		author: "P-removed",
		side: "YES",
		stake: "12",
		phase: "main",
		body: "PLACEHOLDER staging fixture argument. A second surviving comment by the author whose M2 post is removed.",
		serves: "P-removed's untouched content",
	},
	{
		key: "M14-P1",
		market: "M14",
		author: "P-banned",
		side: "NO",
		stake: "18",
		phase: "main",
		body: "PLACEHOLDER staging fixture argument by the banned author on a second market. It survives the ban, as ADR-0021 requires.",
		serves: "X3 — surviving content on a second market",
	},
	{
		key: "M15-P1",
		market: "M15",
		author: "P-crowd-1",
		side: "NO",
		stake: "14",
		phase: "main",
		body: "PLACEHOLDER staging fixture argument. Crowd volume on a filler market.",
		serves: "Discovery filler content",
	},
	{
		key: "M16-P1",
		market: "M16",
		author: "P-crowd-2",
		side: "YES",
		stake: "16",
		phase: "main",
		body: "PLACEHOLDER staging fixture argument. Crowd volume on a filler market.",
		serves: "Discovery filler content",
	},
];

// ═══════════════════════════════════════════════════════════════════════════
// REPLIES — §2.3 C3/C4/C5/C9/C10 and the C.2 LANE CALIBRATION
//
// ⚠ THESE NUMBERS ARE CALIBRATED, NOT DECORATIVE. Read `ranking.ts` before
// changing one. The badge model (RANKING.md §5, `badgeFor`) reads THREE lanes
// over the per-post reply aggregate — and the aggregate is built from the
// REPLIES, never from the post's own stake:
//
//     n     = supportCount + counterCount        floor 5
//     D     = supportDharma + counterDharma      floor 200
//     n^b   where b = min(S,C)/max(S,C)          floor 3
//
// A post is badged iff it DOMINATES a lane: either it is the SOLE floor-clearer
// (SENTINEL_MAX, which outranks every finite ratio) or its ratio to the
// second-place clearer is >= kLane (3). It wears exactly ONE badge — its
// highest-margin lane. Constants live in `ranking.config.ts`, are flagged
// "pre-tuning placeholder — pins 2026-09-01", and are RATIFIED: this table
// moves, they do not.
//
// The shape, and why each lane resolves the way it does:
//
//   M2-P2  n=5  D=280   n^b=5^0.25=1.495   -> SOLE n-clearer      Most Debated
//   M2-P3  n=3  D=2500  n^b=3^0.5 =1.732   -> D 2500/280 = 8.93   Highest Stakes
//   M2-P4  n=4  D=215   n^b=4^1   =4       -> SOLE n^b-clearer    Contested
//   every other post: below all three floors                      no badge
//
// The entanglement that makes this non-obvious, and which three calibration
// passes were spent on: a post clearing the n floor (>= 5 replies) AUTOMATICALLY
// clears the D floor, because `BET_MIN_STAKE_REPLY` is 50 and 5 x 50 = 250 > 200.
// So the three carriers cannot simply be "the biggest of each" — M2-P4 is held
// UNDER the n floor at 4 replies precisely so M2-P2 is the sole traction
// clearer, and M2-P2 is held one-sided enough (4:1) that its n^b stays under 3.
// ═══════════════════════════════════════════════════════════════════════════

export interface ReplyFixture {
	readonly key: string;
	/** The top-level post this replies to. Depth is 1 and flat (REPLY_DEPTH_MAX). */
	readonly parent: PostKey;
	readonly author: ParticipantRole;
	readonly side: "YES" | "NO";
	/** LITERAL, and >= BET_MIN_STAKE_REPLY (50) — asserted with the real
	 *  `assertStakeFloor`, which takes the REPLY floor when a parent is present. */
	readonly stake: string;
	readonly body: string;
	readonly phase: FixturePhase;
	readonly serves: string;
}

export const REPLIES: readonly ReplyFixture[] = [
	// ── M2-P2 · the traction carrier. 4 support + 1 counter = n 5, D 280. ──
	{
		key: "M2-P2-R1",
		parent: "M2-P2",
		author: "P-crowd-3",
		side: "YES",
		stake: "50",
		phase: "main",
		body: "PLACEHOLDER Support reply. Reply volume on this post is what fires the traction lane.",
		serves: "C3 traction; C5 support-side stake ordering",
	},
	{
		key: "M2-P2-R2",
		parent: "M2-P2",
		author: "P-crowd-3",
		side: "YES",
		stake: "55",
		phase: "main",
		body: "PLACEHOLDER Support reply, staked above its sibling so the within-side stake ordering is observable.",
		serves: "C5 — reply stake-ordering within side",
	},
	{
		key: "M2-P2-R3",
		parent: "M2-P2",
		author: "P-visitor-target",
		side: "YES",
		stake: "60",
		phase: "main",
		body: "PLACEHOLDER Support reply from a third voice, so the expanded support pool has more than two entries.",
		serves: "C5 — ReplyPreview expand",
	},
	{
		key: "M2-P2-R4",
		parent: "M2-P2",
		author: "P-visitor-target",
		side: "YES",
		stake: "65",
		phase: "main",
		body: "PLACEHOLDER Support reply, the highest-staked on its side, so it takes the Support slot.",
		serves: "C5 — the two-slot default picks the best Support",
	},
	{
		key: "M2-P2-R5",
		parent: "M2-P2",
		author: "P-banned",
		side: "NO",
		stake: "50",
		phase: "main",
		body: "PLACEHOLDER Counter reply. One counter against four support keeps n^b at 1.495 — under the contestation floor, by design.",
		serves: "C5 both sides populated; holds M2-P2 OFF the Contested lane",
	},

	// ── M2-P3 · the value carrier. D 2500 against a second place of 280. ──
	// ⚠ THE THREE HEAVY REPLIES BELOW ARE TEN BETS SINCE L-6, AND THE LANE
	// CALIBRATION IS UNMOVED. The shipped aggregate
	// (`debate-view/ranking-substrate.ts`) counts `COUNT(DISTINCT rc.user_id)`
	// per side (RANK-3 R-2) and sums `COALESCE(rl.surviving_basis, rb.stake)`
	// for the Dharma fields (ADR-0039 R4+R5) — so splitting a reply into
	// same-author, same-side steps changes neither. M2-P3 still reads n = 3,
	// D = 2500, n^b = 1.732, and still fires the one Highest Stakes badge.
	//
	// ⚠ THE D HALF HOLDS ONLY WHILE NOBODY SELLS AGAINST THESE REPLIES, and
	// this comment said "the SUM of reply stakes" until `@code-reviewer`
	// checked. Surviving basis and frozen stake coincide here because `SELLS`
	// states no sell against a reply's own entry bet — the same condition
	// `fixture-table.test.ts` already knew it had to state, and this block did
	// not. A future fixture that sells one down moves D and moves the lane.
	//
	// Had `n` still counted REPLIES, this split would have pushed M2-P3 to
	// n = 10 and over `floor_lane(n) = 5` — inventing a Most Debated badge on
	// the post whose whole job is to carry the STAKE lane. RANK-3's redefinition
	// is what makes the split free, and the fixture-table test is what proves it
	// rather than this comment.
	//
	// ⚠ `supportCountTotal` / `counterCountTotal` DO move, 3 → 10, and they are
	// not inert: `discovery/hero.ts` renders `replyCount = supportCountTotal +
	// counterCountTotal`, so M2-P3's Discovery card will read "Replies · 10".
	// No gate moves — the badge model never reads them — but an inspector's
	// expectation does, which is worth knowing before someone files it as a
	// bug.
	{
		key: "M2-P3-R1a",
		parent: "M2-P3",
		author: "P-removed",
		side: "NO",
		stake: "250",
		phase: "main",
		body: "PLACEHOLDER Support reply carrying real weight. Attracted Dharma, not reply count, is what fires the value lane.",
		serves: "C3 Highest Stakes",
	},
	{
		key: "M2-P3-R1b",
		parent: "M2-P3",
		author: "P-removed",
		side: "NO",
		stake: "250",
		phase: "main",
		body: "PLACEHOLDER Support reply, the second half of the same 500 Đ backing. Same author and same side, so the distinct-person count the lanes read is unchanged.",
		serves: "C3 Highest Stakes — the 500 Đ backing, step 2 of 2 (L-6)",
	},
	{
		key: "M2-P3-R2a",
		parent: "M2-P3",
		author: "P-banned",
		side: "NO",
		stake: "250",
		phase: "main",
		body: "PLACEHOLDER Support reply, second of the heavy pair. Two PEOPLE keep n at 3 — well under the traction floor, however many times each of them speaks.",
		serves: "C3 Highest Stakes; holds M2-P3 OFF the traction lane",
	},
	{
		key: "M2-P3-R2b",
		parent: "M2-P3",
		author: "P-banned",
		side: "NO",
		stake: "250",
		phase: "main",
		body: "PLACEHOLDER Support reply, the second half of the heavy pair's backing. A third distinct person would move the lane; a second argument from the same one does not.",
		serves: "C3 Highest Stakes — the second 500 Đ backing, step 2 of 2 (L-6)",
	},
	// ⚠ THE AFTER-SETTLEMENT BUDGET IS NOW A TOTAL, NOT A ROW. When this was
	// one 1500 Đ reply, `fixture-table.test.ts` bounded it per row against the
	// M7 payout. Six rows of 250 each pass that bound trivially while the sum
	// they add up to is unchecked — so the assertion was moved to a per-author
	// TOTAL in the same commit. A split that silently disarms the test guarding
	// it is not a fix.
	{
		key: "M2-P3-R3a",
		parent: "M2-P3",
		author: "P-owner",
		side: "YES",
		stake: "250",
		phase: "after-settlement",
		body: "PLACEHOLDER Counter reply funded by the M7 settlement. The holding these six steps build is what makes an open four-digit position representable at all.",
		serves:
			"G5.5 header Portfolio >= 1000 (P-owner's OPEN M2 YES holding); deepens C3 Highest Stakes",
	},
	{
		key: "M2-P3-R3b",
		parent: "M2-P3",
		author: "P-owner",
		side: "YES",
		stake: "250",
		phase: "after-settlement",
		body: "PLACEHOLDER Counter reply, the second of six. The payout arrived as one number; the product makes spending it an argument at a time.",
		serves: "the 1500 Đ after-settlement holding, step 2 of 6 (L-6)",
	},
	{
		key: "M2-P3-R3c",
		parent: "M2-P3",
		author: "P-owner",
		side: "YES",
		stake: "250",
		phase: "after-settlement",
		body: "PLACEHOLDER Counter reply, the third of six. Every step is a separate bet against the same pool, so each writes its own price point.",
		serves: "the 1500 Đ after-settlement holding, step 3 of 6",
	},
	{
		key: "M2-P3-R3d",
		parent: "M2-P3",
		author: "P-owner",
		side: "YES",
		stake: "250",
		phase: "after-settlement",
		body: "PLACEHOLDER Counter reply, the fourth of six. Six steps of 250 reach the 1500 Đ this position was calibrated at.",
		serves: "the 1500 Đ after-settlement holding, step 4 of 6",
	},
	{
		key: "M2-P3-R3e",
		parent: "M2-P3",
		author: "P-owner",
		side: "YES",
		stake: "250",
		phase: "after-settlement",
		body: "PLACEHOLDER Counter reply, the fifth of six. One author on one side, so the counter-side person count the lanes read stays at one.",
		serves: "the 1500 Đ after-settlement holding, step 5 of 6",
	},
	{
		key: "M2-P3-R3f",
		parent: "M2-P3",
		author: "P-owner",
		side: "YES",
		stake: "250",
		phase: "after-settlement",
		body: "PLACEHOLDER Counter reply, the last of six. Together they are the OPEN M2 YES holding the header Portfolio figure is measured on.",
		serves:
			"the 1500 Đ after-settlement holding, step 6 of 6 — 6 x 250, the same total the single bet carried",
	},

	// ── M2-P4 · the contestation carrier. 2 support + 2 counter = n^b 4. ──
	{
		key: "M2-P4-R1",
		parent: "M2-P4",
		author: "P-visitor-target",
		side: "YES",
		stake: "50",
		phase: "main",
		body: "PLACEHOLDER Support reply on the evenly-contested post.",
		serves: "C3 Contested",
	},
	{
		key: "M2-P4-R2",
		parent: "M2-P4",
		author: "P-visitor-target",
		side: "YES",
		stake: "60",
		phase: "main",
		body: "PLACEHOLDER Support reply, staked above its sibling so this side also orders by stake.",
		serves: "C3 Contested; within-side ordering",
	},
	{
		key: "M2-P4-R3",
		parent: "M2-P4",
		author: "P-crowd-2",
		side: "NO",
		stake: "50",
		phase: "main",
		body: "PLACEHOLDER Counter reply. The even 2:2 split is the whole point — b = 1, so n^b = 4.",
		serves: "C3 Contested",
	},
	{
		key: "M2-P4-R4",
		parent: "M2-P4",
		author: "P-removed",
		side: "NO",
		stake: "55",
		phase: "main",
		body: "PLACEHOLDER Counter reply completing the even split. Four replies keep n at 4 — one under the traction floor, deliberately.",
		serves: "C3 Contested; holds M2-P4 OFF the traction lane",
	},

	// ── M2-P8 · replies that must SURVIVE their parent's removal (C9). ──
	{
		key: "M2-P8-R1",
		parent: "M2-P8",
		author: "P-crowd-2",
		side: "NO",
		stake: "50",
		phase: "main",
		body: "PLACEHOLDER Support reply authored BEFORE the parent post is removed. Thread integrity means it is still here afterwards.",
		serves: "C9 — a surviving reply under a removed post",
	},
	{
		key: "M2-P8-R2",
		parent: "M2-P8",
		author: "P-crowd-3",
		side: "YES",
		stake: "50",
		phase: "main",
		body: "PLACEHOLDER Counter reply authored BEFORE the removal, on the opposite side, so the split bar still has both arms.",
		serves: "C9 — surviving replies on both sides",
	},

	// ── M2-P9 · the reply that is itself removed (C10). ──
	{
		key: "M2-P9-R1",
		parent: "M2-P9",
		author: "P-crowd-2",
		side: "NO",
		stake: "50",
		phase: "main",
		body: "PLACEHOLDER Support reply that a moderator removes. Its parent post stays present — this is the reply-level masked variant.",
		serves: "C10 + X2 — a removed REPLY under a present post",
	},

	// ── M3 · light activity that clears NO floor. The ceiling constraint. ──
	{
		key: "M3-P1-R1",
		parent: "M3-P1",
		author: "P-crowd-3",
		side: "YES",
		stake: "50",
		phase: "main",
		body: "PLACEHOLDER Support reply on the lightly-active market. One reply is four short of the traction floor and 150 short of the value floor.",
		serves: "M3 — activity that fires no lane",
	},
	{
		key: "M3-P2-R1",
		parent: "M3-P2",
		author: "P-crowd-3",
		side: "YES",
		stake: "50",
		phase: "main",
		body: "PLACEHOLDER Counter reply on the lightly-active market's second post. Still below every floor.",
		serves: "M3 — no post clears k_lane, so Top degrades gracefully",
	},
];

// ═══════════════════════════════════════════════════════════════════════════
// SELLS — §2.4 the Flipped and Exited markers
//
// `sell` takes SHARES, not Dharma, and the share count is the engine's — so the
// generator READS `positions.quantity` and unwinds exactly that. A partial sell
// followed by an opposite-side buy raises `OppositeSideHeldError`, which is why
// `sellAll` is the only mode here.
// ═══════════════════════════════════════════════════════════════════════════

export interface SellFixture {
	readonly key: string;
	readonly seller: ParticipantRole;
	readonly market: MarketKey;
	/** Always the full held quantity — see the block comment. */
	readonly mode: "all";
	readonly serves: string;
}

export const SELLS: readonly SellFixture[] = [
	{
		key: "SELL-exited",
		seller: "P-exited",
		market: "M12",
		mode: "all",
		serves:
			"P-exited's Exited marker; G6.3 (a position legitimately reaches quantity 0); G5.2 — M12 carries no other bet, so the fee-less round trip returns the stake exactly and P-exited rests at 1010",
	},
	{
		key: "SELL-flip",
		seller: "P-flipped",
		market: "M2",
		mode: "all",
		serves:
			"the unwind half of the flip — M2-P11 (NO) is illegal until this commits",
	},
];

// UNWIRE-1 — the BOOKMARKS fixture table (§2.4 B1/B2) and the BookmarkFixture
// type are removed: the bookmark module is unwired product-wide, so the
// generator no longer drives addBookmarkAction and has nothing left to seed
// the `bookmarks` table with. The table itself stays untouched (no DDL).

// ═══════════════════════════════════════════════════════════════════════════
// MODERATION — §2.5 X1/X2/X3, all through the real `moderateComment`
//
// ⚠ ORDER: every ban runs AFTER that author's content exists. ADR-0021 — a ban
// removes voice, not past content — is only DEMONSTRABLE if there is past
// content to survive it. X4 (audit-feed pagination) is manifest §3, not built.
// ═══════════════════════════════════════════════════════════════════════════

export interface ModerationFixture {
	readonly key: string;
	/** A post key or a reply key. */
	readonly target: string;
	readonly targetKind: "post" | "reply";
	readonly action: "remove" | "ban";
	readonly serves: string;
}

export const MODERATION: readonly ModerationFixture[] = [
	{
		key: "X1",
		target: "M2-P8",
		targetKind: "post",
		action: "remove",
		serves:
			"X1 — one content_removed on a POST; feeds C9 and the audit surface",
	},
	{
		key: "X2",
		target: "M2-P9-R1",
		targetKind: "reply",
		action: "remove",
		serves: "X2 — one content_removed on a REPLY; feeds C10",
	},
	{
		key: "X3",
		target: "M2-P9",
		targetKind: "post",
		action: "ban",
		serves:
			"X3 — bans P-banned AFTER its content exists; the content survives (ADR-0021)",
	},
];

// ═══════════════════════════════════════════════════════════════════════════
// C7 · THE IMAGE
//
// A 1x1 PNG, inlined as base64 so the fixture set needs no binary asset in the
// repo and no network fetch. The generator PUTs these exact bytes to the
// presigned URL `mintPutUrl` returns, then HeadObjects them back through
// `verifyUploadedObject`. Slice B's STEP 8b probe proved the whole chain works
// against staging's R2 credentials.
// ═══════════════════════════════════════════════════════════════════════════

/** The smallest valid PNG: 1x1, fully transparent. */
export const FIXTURE_IMAGE_BASE64 =
	"iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==";
export const FIXTURE_IMAGE_CONTENT_TYPE = "image/png";

/** The mandatory, immutable criterion-met note settle/void record (R-9.1). */
export const RESOLVE_REASON =
	"PLACEHOLDER staging fixture settlement note — criterion met per the fixture table. Not a real resolution.";
export const VOID_REASON =
	"PLACEHOLDER staging fixture void note — voided by the fixture generator. Not a real void.";
