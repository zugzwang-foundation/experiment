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
		seedAmount: "500",
		deadlineOffsetMs: LONG_DEADLINE_MS,
		terminal: "none",
		serves:
			"Open, heavily active — the primary POLISH.3 subject (Slice C fills §2.3)",
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

export interface PostFixture {
	readonly market: MarketKey;
	readonly author: ParticipantRole;
	readonly side: "YES" | "NO";
	/** LITERAL. Every stake is >= BET_MIN_STAKE_POST; the generator asserts it
	 *  with the REAL `assertStakeFloor` rather than trusting this comment. */
	readonly stake: string;
	readonly body: string;
}

/**
 * ONE post per open market, except M4.
 *
 * ⚠ ORDER IS LOAD-BEARING, TWICE.
 *
 * 1 · P-owner's M7 bet must come FIRST. `accrueDailyCredit` fires inside
 *     `place()` once per UTC day, so P-owner's first bet opens at 1010 Đ
 *     (1000 grant + 10 credit). The 1000 Đ M7 stake fits only while that
 *     credit is unspent. It runs down to 10 Đ, the M2 post spends it, and the
 *     M7 settlement then pays the four-digit balance back.
 * 2 · P-owner must hold YES on M2 (manifest Q4) so the NO composer renders
 *     `oppositeHeld`-disabled for the owner viewer. Not arbitrary — it is the
 *     fixture for that rule.
 *
 * ⚠ P-EMPTY APPEARS NOWHERE. It is defined by never betting; a single post
 * would move its balance off exactly 1000 and destroy manifest §0 B7's carrier.
 *
 * ⚠ ADMIN APPEARS NOWHERE. Manifest §1.6 — the seeding admin holds no position
 * and authors no comment. Every post below is attributed to a pooled
 * participant.
 */
export const POSTS: readonly PostFixture[] = [
	{
		market: "M7",
		author: "P-owner",
		side: "YES",
		stake: "1000",
		body: "PLACEHOLDER staging fixture argument. This four-digit stake exists so a settled position carries a four-digit realised P/L on the profile tiles.",
	},
	{
		market: "M2",
		author: "P-owner",
		side: "YES",
		stake: "10",
		body: "PLACEHOLDER staging fixture argument on the heavily-active market. The owner holds YES here so the NO composer renders opposite-side-disabled.",
	},
	{
		market: "M3",
		author: "P-crowd-1",
		side: "YES",
		stake: "10",
		body: "PLACEHOLDER staging fixture argument on the lightly-active market. Deliberately below every lane floor so no badge renders.",
	},
	{
		market: "M5",
		author: "P-crowd-2",
		side: "NO",
		stake: "20",
		body: "PLACEHOLDER staging fixture argument on the market that closes. Its position must remain visible after the close with the sell affordance hidden.",
	},
	{
		market: "M6",
		author: "P-crowd-3",
		side: "YES",
		stake: "20",
		body: "PLACEHOLDER staging fixture argument on the market that enters Resolving. Read-only once the trigger fires.",
	},
	{
		market: "M8",
		author: "P-flipped",
		side: "NO",
		stake: "15",
		body: "PLACEHOLDER staging fixture argument on the market that voids. The void refunds this stake through void_refund.",
	},
	{
		market: "M10",
		author: "P-visitor-target",
		side: "YES",
		stake: "25",
		body: "PLACEHOLDER staging fixture argument. Populates the visitor-target profile so the visitor DTO split has something to hide.",
	},
	{
		market: "M11",
		author: "P-visitor-target",
		side: "NO",
		stake: "15",
		body: "PLACEHOLDER staging fixture argument on a second market, so the visitor-target profile shows more than one position.",
	},
	{
		market: "M12",
		author: "P-exited",
		side: "YES",
		stake: "30",
		body: "PLACEHOLDER staging fixture argument. Slice C sells this position out in full to produce the Exited marker.",
	},
	{
		market: "M13",
		author: "P-removed",
		side: "YES",
		stake: "12",
		body: "PLACEHOLDER staging fixture argument. Slice C removes one of this author's comments and leaves this one standing.",
	},
	{
		market: "M14",
		author: "P-banned",
		side: "NO",
		stake: "18",
		body: "PLACEHOLDER staging fixture argument. Slice C bans this author AFTER the content exists, so the content survives the ban.",
	},
	{
		market: "M15",
		author: "P-crowd-1",
		side: "NO",
		stake: "14",
		body: "PLACEHOLDER staging fixture argument. Crowd volume on a filler market.",
	},
	{
		market: "M16",
		author: "P-crowd-2",
		side: "YES",
		stake: "16",
		body: "PLACEHOLDER staging fixture argument. Crowd volume on a filler market.",
	},
];

/** The mandatory, immutable criterion-met note settle/void record (R-9.1). */
export const RESOLVE_REASON =
	"PLACEHOLDER staging fixture settlement note — criterion met per the fixture table. Not a real resolution.";
export const VOID_REASON =
	"PLACEHOLDER staging fixture void note — voided by the fixture generator. Not a real void.";
