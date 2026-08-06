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
 * and takes P-owner (the owner arm of Profile, positions and bookmarks). The
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
		serves: "owner arm of Profile / positions / bookmarks; Q4 holds YES on M2",
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
			"zero posts / replies / positions / bookmarks — every empty state at once. NEVER BETS, so its balance stays exactly 1000 (manifest §0 B7)",
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
	/** Raw seed; the generator canonicalises it with the REAL `canonicalizeAmount18`. */
	readonly seedAmount: string;
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
	 */
	readonly deadlineOffsetMs: number;
	readonly terminal: TerminalAction;
	readonly serves: string;
}

/** A deadline far enough out that an Open market never reads as expired. */
const LONG_DEADLINE_MS = 60 * 24 * 60 * 60 * 1000; // 60 days
/** Just past `now`, so the close call in the same run is legal. */
const SHORT_DEADLINE_MS = 60 * 1000; // 1 minute

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
		seedAmount: "100",
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
		seedAmount: "5000",
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
		seedAmount: "100",
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
		seedAmount: "100",
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
		seedAmount: "100",
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
		seedAmount: "100",
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
		seedAmount: "5000",
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
		seedAmount: "100",
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
		seedAmount: "100",
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
		seedAmount: "100",
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
		seedAmount: "100",
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
		seedAmount: "100",
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
		seedAmount: "100",
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
		seedAmount: "100",
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
		seedAmount: "100",
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
	// — LIFETIME, not per-market. A lone 1000 Đ winning stake CANNOT make it
	// four-digit, and the arithmetic says so rather than the fixture: a CPMM buy
	// of S into a pool at price p yields S/p shares, and at a fair p = 0.5 with
	// any finite depth that is strictly under 2S. So the realised gain is
	// strictly under S — under 1000 — no matter how generous the seed is.
	// (Measured: seed 5000 -> 833.33 gain; seed 100000 -> 990.10. The ceiling is
	// approached, never crossed.)
	//
	// The lever is the ENTRY PRICE, not the seed. This 900 Đ NO bet lands first
	// and moves YES to ~0.47, so P-owner's 1000 Đ buys 2126.89 shares instead of
	// 1833.33 and the settlement clears four digits. Nothing here is contrived
	// for the gate: an opposing bet arriving before yours is the ordinary case,
	// and it is the ONLY case in which a winning position is worth writing home
	// about.
	{
		key: "M7-P1",
		market: "M7",
		author: "P-crowd-1",
		side: "NO",
		stake: "900",
		phase: "main",
		body: "PLACEHOLDER staging fixture argument on the losing side of the market that resolves YES. It settles to a total loss, which is what a resolved market has to be able to show.",
		serves:
			"the losing side of M7 (a settled position worth zero); and it is what makes G5.6's four-digit P/L reachable at all — see the block above",
	},
	{
		key: "M7-P2",
		market: "M7",
		author: "P-owner",
		side: "YES",
		stake: "1000",
		phase: "main",
		body: "PLACEHOLDER staging fixture argument. This four-digit stake exists so a settled position carries a four-digit realised P/L on the profile tiles.",
		serves: "G5.3 positions staked >= 1000; G5.6 four-digit lifetime net P/L",
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
	{
		key: "M2-P3-R1",
		parent: "M2-P3",
		author: "P-removed",
		side: "NO",
		stake: "500",
		phase: "main",
		body: "PLACEHOLDER Support reply carrying real weight. Attracted Dharma, not reply count, is what fires the value lane.",
		serves: "C3 Highest Stakes",
	},
	{
		key: "M2-P3-R2",
		parent: "M2-P3",
		author: "P-banned",
		side: "NO",
		stake: "500",
		phase: "main",
		body: "PLACEHOLDER Support reply, second of the heavy pair. Two replies keep n at 3 — well under the traction floor.",
		serves: "C3 Highest Stakes; holds M2-P3 OFF the traction lane",
	},
	{
		key: "M2-P3-R3",
		parent: "M2-P3",
		author: "P-owner",
		side: "YES",
		stake: "1500",
		phase: "after-settlement",
		body: "PLACEHOLDER Counter reply funded by the M7 settlement. Its size is what makes an open four-digit holding representable at all.",
		serves:
			"G5.5 header Portfolio >= 1000 (P-owner's OPEN M2 YES holding); deepens C3 Highest Stakes",
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

// ═══════════════════════════════════════════════════════════════════════════
// BOOKMARKS — §2.4 B1/B2
//
// `addBookmarkAction` rejects a self-bookmark (`self_bookmark_forbidden`), so
// the acting VIEWER must differ from the target's author. B2 (zero bookmarks)
// is P-empty, and it is satisfied by absence — nothing below names it.
// ═══════════════════════════════════════════════════════════════════════════

export interface BookmarkFixture {
	readonly viewer: ParticipantRole;
	/** A post key or a reply key — the two arms B1 requires. */
	readonly target: string;
	readonly targetKind: "post" | "reply";
	readonly serves: string;
}

export const BOOKMARKS: readonly BookmarkFixture[] = [
	{
		viewer: "P-owner",
		target: "M2-P2",
		targetKind: "post",
		serves:
			"B1 — a bookmark on ANOTHER's POST (author P-crowd-1); Staked/Current are the bookmarked author's figures",
	},
	{
		viewer: "P-owner",
		target: "M2-P2-R2",
		targetKind: "reply",
		serves: "B1 — a bookmark on ANOTHER's REPLY (author P-crowd-3)",
	},
];

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
