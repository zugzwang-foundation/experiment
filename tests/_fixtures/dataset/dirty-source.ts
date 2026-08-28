import { EVENT_TYPES, type EventType } from "@/server/events/schemas";

/**
 * DATASET.1 — the DIRTY fixture. Brief §3, and the whole of why it exists.
 *
 * > *"A guard that asserts 'no `ip` key survives the strip' proves nothing if
 * > the rows it ran over never carried an `ip` key. Against real data you
 * > cannot guarantee the forbidden key was present pre-strip, so the
 * > assertion is equally consistent with 'the strip worked' and 'there was
 * > nothing to strip'."*
 *
 * Every row below **deliberately carries the keys the strip must remove**,
 * so that an assertion of their absence afterwards is a claim about the
 * strip rather than a claim about the input. This is OVN-V1's positive
 * control and OVN-V3's *a control that cannot fire is not a control*, built
 * into the data instead of bolted onto the tests.
 *
 * It is a literal table — no RNG, no generator, no clock — following the
 * `tests/staging/fixtures.ts` precedent. A fixture that varies between runs
 * cannot be the baseline for a guard that must mean the same thing twice.
 *
 * ⚠ **The values here are deliberately distinctive** (`203.0.113.*` from
 * RFC 5737's TEST-NET-3, `@example.invalid` addresses from RFC 6761). Not
 * decoration: a value-based guard searches for these exact strings in the
 * output, so a needle that also occurs naturally in prose would produce
 * false hits, and a needle too short would match inside unrelated words.
 * Reserved-by-RFC values can never collide with real data either.
 */

// ── the identities ─────────────────────────────────────────────────────

/**
 * Raw `users.id` values. UUIDv7-shaped, since the export must not care.
 * These are THE forbidden values — the wall in brief §5 is about exactly
 * these strings appearing anywhere but the `users` table.
 */
export const FIXTURE_USER_IDS = {
	/** A participant with a full PII surface. */
	amber: "0192f3a4-1111-7000-8000-00000000a001",
	/** A second participant, so cross-user leakage is detectable. */
	basalt: "0192f3a4-2222-7000-8000-00000000b002",
	/** A participant whose H2 erasure has fired — NULL PII, row preserved. */
	cinder: "0192f3a4-3333-7000-8000-00000000c003",
} as const;

export const FIXTURE_PSEUDONYMS = {
	[FIXTURE_USER_IDS.amber]: "AmberOtter042",
	[FIXTURE_USER_IDS.basalt]: "BasaltHeron117",
	[FIXTURE_USER_IDS.cinder]: "CinderMarten903",
} as const;

/** The admin sentinel. Never pseudonymized (§19.5); ships verbatim. */
export const ADMIN_SENTINEL = "admin-singleton";
/** The gate's auto-action sentinel (Appendix B.10 `actor_id`). */
export const SYSTEM_SENTINEL = "system";

// ── the secrets, named once so tests assert against the same strings ───

export const FIXTURE_SECRET_VALUES = {
	ips: ["203.0.113.7", "203.0.113.42", "203.0.113.99"],
	userAgents: [
		"Mozilla/5.0 (FixtureBrowser/1.0; DATASET-1-CANARY)",
		"Mozilla/5.0 (SecondFixtureBrowser/2.0; DATASET-1-CANARY)",
	],
	googleIds: ["117000000000000000001", "117000000000000000002"],
	emails: ["amber@example.invalid", "basalt@example.invalid"],
	r2ObjectKeys: [
		`u/${FIXTURE_USER_IDS.amber}/0192f3a4-aaaa-7000-8000-0000000000u1.webp`,
		`u/${FIXTURE_USER_IDS.basalt}/0192f3a4-bbbb-7000-8000-0000000000u2.webp`,
		`m/0192f3a4-cccc-7000-8000-00000000m001/hero.webp`,
	],
	adminSessionIds: [
		"adm_sess_0192f3a4dddd7000800000000000s001",
		"adm_sess_0192f3a4eeee7000800000000000s002",
	],
} as const;

// ── metadata: the §3.7 seven-field set, dirty ──────────────────────────

/**
 * A full seven-field `metadata` object carrying BOTH strip keys.
 *
 * ⚠ `ip` and `user_agent` are always present here. A metadata fixture that
 * omitted them would let `assertNoStrippedMetadataKeys` pass against input
 * that never had them — the exact failure brief §3 was written to prevent.
 */
export function dirtyMetadata(opts: {
	userId: string | null;
	actorId: string;
	ip: string;
	userAgent: string;
	idempotencyKey?: string | null;
}): Record<string, unknown> {
	return {
		request_id: "req_0192f3a4-0000-7000-8000-00000000r001",
		flow_id: "F-BET-1",
		user_id: opts.userId,
		actor_id: opts.actorId,
		idempotency_key: opts.idempotencyKey ?? null,
		ip: opts.ip,
		user_agent: opts.userAgent,
	};
}

// ── one dirty events row per event type (brief §3, verbatim) ───────────

export interface DirtyEventRow {
	/**
	 * Index signature so a fixture row is assignable to the pipeline's
	 * `SourceRow` (`Record<string, unknown>`). The named fields below still
	 * type-check; this only says the shape is an object with string keys,
	 * which is what a row read from Postgres actually is.
	 */
	readonly [key: string]: unknown;
	readonly event_id: string;
	readonly event_type: EventType;
	readonly aggregate_type: string;
	readonly aggregate_id: string;
	readonly payload: Record<string, unknown>;
	readonly payload_version: number;
	readonly metadata: Record<string, unknown>;
	readonly created_at: string;
}

const [IP_A, IP_B, IP_C] = FIXTURE_SECRET_VALUES.ips;
const [UA_A, UA_B] = FIXTURE_SECRET_VALUES.userAgents;
const [GID_A, GID_B] = FIXTURE_SECRET_VALUES.googleIds;
const [EMAIL_A, EMAIL_B] = FIXTURE_SECRET_VALUES.emails;
const [R2_A, R2_B] = FIXTURE_SECRET_VALUES.r2ObjectKeys;
const [SESS_A, SESS_B] = FIXTURE_SECRET_VALUES.adminSessionIds;

const AMBER = FIXTURE_USER_IDS.amber;
const BASALT = FIXTURE_USER_IDS.basalt;
const MARKET_ID = "0192f3a4-cccc-7000-8000-00000000m001";
const BET_ID = "0192f3a4-dddd-7000-8000-00000000be01";
const COMMENT_ID = "0192f3a4-eeee-7000-8000-00000000cm01";
const UPLOAD_ID = "0192f3a4-ffff-7000-8000-00000000up01";
const AT = "2026-10-01T12:00:00.000Z";

/**
 * **One row per `EVENT_TYPES` member — all 24.** Each carries every key its
 * §19.4.1 rule strips, plus a full dirty `metadata`.
 *
 * The `market.*` rows have empty strip rules and so carry no payload
 * secrets — but they still carry dirty `metadata`, which is the point: the
 * metadata strip is cross-cutting and must fire on event types whose own
 * payload rule is `[]`. A fixture that gave the `market.*` rows clean
 * metadata would leave that path untested on seven of twenty-four types.
 */
export const DIRTY_EVENT_ROWS: readonly DirtyEventRow[] = [
	{
		event_id: "0192f3a4-0001-7000-8000-0000000000e1",
		event_type: "user.tos_accepted",
		aggregate_type: "user",
		aggregate_id: AMBER,
		payload: {
			userId: AMBER,
			ip: IP_A,
			user_agent: UA_A,
			tosVersionHash: "sha256:abc123",
			privacyVersionHash: "sha256:def456",
		},
		payload_version: 1,
		metadata: dirtyMetadata({
			userId: AMBER,
			actorId: AMBER,
			ip: IP_A,
			userAgent: UA_A,
		}),
		created_at: AT,
	},
	{
		event_id: "0192f3a4-0002-7000-8000-0000000000e2",
		event_type: "user.oauth_signed_in",
		aggregate_type: "user",
		aggregate_id: AMBER,
		payload: { userId: AMBER, googleId: GID_A },
		payload_version: 1,
		metadata: dirtyMetadata({
			userId: AMBER,
			actorId: AMBER,
			ip: IP_A,
			userAgent: UA_A,
		}),
		created_at: AT,
	},
	{
		event_id: "0192f3a4-0003-7000-8000-0000000000e3",
		event_type: "user.otp_signed_in",
		aggregate_type: "user",
		aggregate_id: BASALT,
		payload: { userId: BASALT, email: EMAIL_B },
		payload_version: 1,
		metadata: dirtyMetadata({
			userId: BASALT,
			actorId: BASALT,
			ip: IP_B,
			userAgent: UA_B,
		}),
		created_at: AT,
	},
	{
		event_id: "0192f3a4-0004-7000-8000-0000000000e4",
		event_type: "user.pseudonym_assigned",
		aggregate_type: "user",
		aggregate_id: AMBER,
		payload: { userId: AMBER, pseudonym: "AmberOtter042" },
		payload_version: 1,
		metadata: dirtyMetadata({
			userId: AMBER,
			actorId: AMBER,
			ip: IP_A,
			userAgent: UA_A,
		}),
		created_at: AT,
	},
	{
		event_id: "0192f3a4-0005-7000-8000-0000000000e5",
		event_type: "user.signed_out",
		aggregate_type: "user",
		aggregate_id: BASALT,
		payload: { userId: BASALT },
		payload_version: 1,
		metadata: dirtyMetadata({
			userId: BASALT,
			actorId: BASALT,
			ip: IP_B,
			userAgent: UA_B,
		}),
		created_at: AT,
	},
	{
		event_id: "0192f3a4-0006-7000-8000-0000000000e6",
		event_type: "image_upload.sign_requested",
		aggregate_type: "image_upload",
		aggregate_id: UPLOAD_ID,
		payload: { userId: AMBER, key: R2_A, uploadId: UPLOAD_ID },
		payload_version: 1,
		metadata: dirtyMetadata({
			userId: AMBER,
			actorId: AMBER,
			ip: IP_A,
			userAgent: UA_A,
		}),
		created_at: AT,
	},
	{
		event_id: "0192f3a4-0007-7000-8000-0000000000e7",
		event_type: "image_upload.committed",
		aggregate_type: "image_upload",
		aggregate_id: UPLOAD_ID,
		payload: { userId: AMBER, key: R2_A, uploadId: UPLOAD_ID },
		payload_version: 1,
		metadata: dirtyMetadata({
			userId: AMBER,
			actorId: AMBER,
			ip: IP_A,
			userAgent: UA_A,
		}),
		created_at: AT,
	},
	{
		event_id: "0192f3a4-0008-7000-8000-0000000000e8",
		event_type: "image_upload.blocked",
		aggregate_type: "image_upload",
		aggregate_id: UPLOAD_ID,
		payload: { userId: BASALT, key: R2_B, uploadId: UPLOAD_ID },
		payload_version: 1,
		metadata: dirtyMetadata({
			userId: BASALT,
			actorId: BASALT,
			ip: IP_B,
			userAgent: UA_B,
		}),
		created_at: AT,
	},
	{
		event_id: "0192f3a4-0009-7000-8000-0000000000e9",
		event_type: "image_upload.orphaned",
		aggregate_type: "image_upload",
		aggregate_id: UPLOAD_ID,
		// No `userId` — the sweep is system-actor. `uploadId` SHIPS.
		payload: { key: R2_B, uploadId: UPLOAD_ID },
		payload_version: 1,
		metadata: dirtyMetadata({
			userId: null,
			actorId: SYSTEM_SENTINEL,
			ip: IP_C,
			userAgent: UA_A,
		}),
		created_at: AT,
	},
	{
		event_id: "0192f3a4-0010-7000-8000-000000000e10",
		event_type: "moderation.blocked",
		aggregate_type: "mod_action",
		aggregate_id: "0192f3a4-9999-7000-8000-00000000ma01",
		// `reason` / `banned` / `uploadId` SHIP per §19.4.1 (AUDIT-FIX-B5).
		payload: {
			userId: BASALT,
			reason: "track_b_blocked",
			banned: false,
			uploadId: null,
		},
		payload_version: 1,
		metadata: dirtyMetadata({
			userId: BASALT,
			actorId: SYSTEM_SENTINEL,
			ip: IP_B,
			userAgent: UA_B,
		}),
		created_at: AT,
	},
	{
		event_id: "0192f3a4-0011-7000-8000-000000000e11",
		event_type: "admin.signed_in",
		aggregate_type: "admin_session",
		aggregate_id: SESS_A,
		payload: { sessionId: SESS_A, ip: IP_C },
		payload_version: 1,
		metadata: dirtyMetadata({
			userId: null,
			actorId: ADMIN_SENTINEL,
			ip: IP_C,
			userAgent: UA_A,
		}),
		created_at: AT,
	},
	{
		event_id: "0192f3a4-0012-7000-8000-000000000e12",
		event_type: "admin.signed_out",
		aggregate_type: "admin_session",
		aggregate_id: SESS_B,
		payload: { sessionId: SESS_B },
		payload_version: 1,
		metadata: dirtyMetadata({
			userId: null,
			actorId: ADMIN_SENTINEL,
			ip: IP_C,
			userAgent: UA_A,
		}),
		created_at: AT,
	},
	{
		event_id: "0192f3a4-0013-7000-8000-000000000e13",
		event_type: "dharma.credited",
		aggregate_type: "dharma_account",
		aggregate_id: AMBER,
		payload: { userId: AMBER, amount: "10.000000000000000000" },
		payload_version: 1,
		metadata: dirtyMetadata({
			userId: AMBER,
			actorId: AMBER,
			ip: IP_A,
			userAgent: UA_A,
		}),
		created_at: AT,
	},
	{
		event_id: "0192f3a4-0014-7000-8000-000000000e14",
		event_type: "dharma.granted",
		aggregate_type: "dharma_account",
		aggregate_id: BASALT,
		payload: { userId: BASALT, amount: "100.000000000000000000" },
		payload_version: 1,
		metadata: dirtyMetadata({
			userId: BASALT,
			actorId: BASALT,
			ip: IP_B,
			userAgent: UA_B,
		}),
		created_at: AT,
	},
	{
		event_id: "0192f3a4-0015-7000-8000-000000000e15",
		event_type: "bet.placed",
		aggregate_type: "bet",
		aggregate_id: BET_ID,
		// Research keys SHIP — K_eff(t) core per §19.6.
		payload: {
			userId: AMBER,
			marketId: MARKET_ID,
			commentId: COMMENT_ID,
			side: "YES",
			stake: "25.000000000000000000",
			price: "0.500000000000000000",
		},
		payload_version: 1,
		metadata: dirtyMetadata({
			userId: AMBER,
			actorId: AMBER,
			ip: IP_A,
			userAgent: UA_A,
			idempotencyKey: "idem_amber_001",
		}),
		created_at: AT,
	},
	{
		event_id: "0192f3a4-0016-7000-8000-000000000e16",
		event_type: "bet.sold",
		aggregate_type: "bet",
		aggregate_id: BET_ID,
		payload: {
			userId: BASALT,
			marketId: MARKET_ID,
			sharesSold: "5.000000000000000000",
			proceeds: "2.500000000000000000",
			price: "0.500000000000000000",
		},
		payload_version: 1,
		metadata: dirtyMetadata({
			userId: BASALT,
			actorId: BASALT,
			ip: IP_B,
			userAgent: UA_B,
			idempotencyKey: "idem_basalt_001",
		}),
		created_at: AT,
	},
	{
		event_id: "0192f3a4-0017-7000-8000-000000000e17",
		event_type: "comment.placed",
		aggregate_type: "comment",
		aggregate_id: COMMENT_ID,
		payload: {
			userId: AMBER,
			marketId: MARKET_ID,
			betId: BET_ID,
			commentId: COMMENT_ID,
			side: "YES",
			bodyLength: 142,
			uploadId: null,
		},
		payload_version: 1,
		metadata: dirtyMetadata({
			userId: AMBER,
			actorId: AMBER,
			ip: IP_A,
			userAgent: UA_A,
		}),
		created_at: AT,
	},
	// — the seven market.* rows: empty strip rule, dirty metadata —
	...(
		[
			"market.created",
			"market.opened",
			"market.closed",
			"market.resolving",
			"market.resolved",
			"market.corrected",
			"market.voided",
		] as const
	).map((event_type, i) => ({
		event_id: `0192f3a4-00${18 + i}-7000-8000-000000000f${i}0`,
		event_type,
		aggregate_type: "market",
		aggregate_id: MARKET_ID,
		payload: { marketId: MARKET_ID },
		payload_version: 1,
		metadata: dirtyMetadata({
			userId: null,
			actorId: ADMIN_SENTINEL,
			ip: IP_C,
			userAgent: UA_A,
		}),
		created_at: AT,
	})),
];

/**
 * ⚠ **Coverage is asserted, not assumed.** If `EVENT_TYPES` grows and this
 * fixture does not, every per-event-type guard silently stops covering the
 * new type while continuing to report success — the fixture becomes the
 * weakest link precisely because nothing points at it.
 *
 * Thrown at module load, so an incomplete fixture fails every suite that
 * imports it rather than one test somewhere.
 */
const covered = new Set(DIRTY_EVENT_ROWS.map((r) => r.event_type));
const missing = EVENT_TYPES.filter((t) => !covered.has(t));
if (missing.length > 0) {
	throw new Error(
		`dirty-source fixture is missing ${missing.length} event type(s): ${missing.join(", ")}`,
	);
}

// ── the dirty TABLE rows (§19.3's 16 shipped tables) ───────────────────

/**
 * One dirty row set per shipped table. Same contract as the events rows
 * above: every column Appendix B marks `STRIP` or `PSEUDO` is **populated
 * with a real forbidden value**, so that asserting its absence downstream is
 * a claim about the transform.
 *
 * ⚠ `cinder` is the H2-erased participant (§19.4's erasure interaction): PII
 * columns already NULL in source, `pfp_filename` nulled, row preserved. It is
 * here because a strip pass that assumes every row carries PII will throw or
 * silently skip on the erased one, and that row shape exists in production by
 * design rather than by accident.
 */
export const DIRTY_TABLE_ROWS = {
	users: [
		{
			id: FIXTURE_USER_IDS.amber,
			name: "Amber Real Name",
			email: EMAIL_A,
			email_verified: true,
			image: "https://lh3.googleusercontent.com/a/amber-avatar",
			pseudonym: "AmberOtter042",
			google_id: GID_A,
			pfp_filename: "amber-otter-042",
			tos_accepted_at: AT,
			tos_version_hash: "sha256:abc123",
			privacy_version_hash: "sha256:def456",
			tos_acceptance_ip: IP_A,
			tos_acceptance_user_agent: UA_A,
			last_allowance_accrued_at: AT,
			banned_at: null,
			created_at: AT,
			updated_at: AT,
		},
		{
			id: FIXTURE_USER_IDS.basalt,
			name: "Basalt Real Name",
			email: EMAIL_B,
			email_verified: true,
			image: "https://lh3.googleusercontent.com/a/basalt-avatar",
			pseudonym: "BasaltHeron117",
			google_id: GID_B,
			pfp_filename: "basalt-heron-117",
			tos_accepted_at: AT,
			tos_version_hash: "sha256:abc123",
			privacy_version_hash: "sha256:def456",
			tos_acceptance_ip: IP_B,
			tos_acceptance_user_agent: UA_B,
			last_allowance_accrued_at: AT,
			banned_at: null,
			created_at: AT,
			updated_at: AT,
		},
		{
			// H2-erased: PII already NULL in source, row preserved.
			id: FIXTURE_USER_IDS.cinder,
			name: null,
			email: null,
			email_verified: false,
			image: null,
			pseudonym: "CinderMarten903",
			google_id: null,
			pfp_filename: null,
			tos_accepted_at: AT,
			tos_version_hash: "sha256:abc123",
			privacy_version_hash: "sha256:def456",
			tos_acceptance_ip: null,
			tos_acceptance_user_agent: null,
			last_allowance_accrued_at: null,
			banned_at: null,
			created_at: AT,
			updated_at: AT,
		},
	],
	bets: [
		{
			id: BET_ID,
			user_id: FIXTURE_USER_IDS.amber,
			market_id: MARKET_ID,
			side: "YES",
			stake: "25.000000000000000000",
			share_quantity: "50.000000000000000000",
			price_at_bet: "0.500000000000000000",
			comment_id: COMMENT_ID,
			idempotency_key: "idem_amber_001",
			created_at: AT,
		},
	],
	comments: [
		{
			id: COMMENT_ID,
			user_id: FIXTURE_USER_IDS.amber,
			market_id: MARKET_ID,
			parent_comment_id: null,
			body: "The tunnelling is complete and trial runs began in August.",
			image_uploads_id: UPLOAD_ID,
			side_at_post_time: "YES",
			bet_id: BET_ID,
			created_at: AT,
		},
	],
	dharma_ledger: [
		{
			id: "0192f3a4-1a1a-7000-8000-00000000dl01",
			seq: 1,
			user_id: FIXTURE_USER_IDS.amber,
			bet_id: BET_ID,
			entry_type: "bet_stake",
			amount: "-25.000000000000000000",
			balance_after: "75.000000000000000000",
			created_at: AT,
		},
	],
	// ⚠ §19.5's bullet list does NOT name this table. Appendix B.4 does.
	positions: [
		{
			id: "0192f3a4-2b2b-7000-8000-00000000ps01",
			user_id: FIXTURE_USER_IDS.amber,
			market_id: MARKET_ID,
			side: "YES",
			quantity: "50.000000000000000000",
			created_at: AT,
			updated_at: AT,
		},
	],
	// ⚠ Likewise absent from §19.5's list; Appendix B.8 marks it PSEUDO.
	payout_events: [
		{
			id: "0192f3a4-3c3c-7000-8000-00000000pe01",
			bet_id: BET_ID,
			user_id: FIXTURE_USER_IDS.amber,
			market_id: MARKET_ID,
			resolution_event_id: "0192f3a4-4d4d-7000-8000-00000000re01",
			payout_type: "bet_payout",
			amount: "50.000000000000000000",
			created_at: AT,
		},
	],
	// ⚠ Likewise; Appendix B.12 marks user_id PSEUDO and actor_id PSEUDO.
	user_events: [
		{
			id: "0192f3a4-5e5e-7000-8000-00000000ue01",
			user_id: FIXTURE_USER_IDS.basalt,
			event_type: "user.tos_accepted",
			payload: { tosVersionHash: "sha256:abc123", ip: IP_B },
			metadata: dirtyMetadata({
				userId: FIXTURE_USER_IDS.basalt,
				actorId: FIXTURE_USER_IDS.basalt,
				ip: IP_B,
				userAgent: UA_B,
			}),
			created_at: AT,
		},
	],
	mod_actions: [
		{
			id: "0192f3a4-6f6f-7000-8000-00000000ma01",
			target_user_id: FIXTURE_USER_IDS.basalt,
			target_comment_id: null,
			target_bet_id: null,
			target_market_id: MARKET_ID,
			reason: "track_b_blocked",
			verdict: "track_b",
			categories: { harassment: 0.91 },
			// B.10 STRIP — absent from §19.4's ten-column table.
			blocked_text: "the rejected comment body, retained for ban review",
			// B.10 STRIP — an R2 key, and R2 keys embed the userId.
			image_r2_key: R2_B,
			actor_id: SYSTEM_SENTINEL,
			created_at: AT,
		},
	],
	image_uploads: [
		{
			id: UPLOAD_ID,
			user_id: FIXTURE_USER_IDS.amber,
			r2_object_key: R2_A,
			content_type: "image/webp",
			byte_size: 51234,
			terminal_state: "committed",
			terminal_at: AT,
			created_at: AT,
		},
	],
	admin_events: [
		{
			id: "0192f3a4-7a7a-7000-8000-00000000ae01",
			event_type: "admin.signed_in",
			payload: { sessionId: SESS_A, ip: IP_C },
			metadata: dirtyMetadata({
				userId: null,
				actorId: ADMIN_SENTINEL,
				ip: IP_C,
				userAgent: UA_A,
			}),
			created_at: AT,
		},
	],
	markets: [
		{
			id: MARKET_ID,
			slug: "mumbai-metro-line-3-open-by-5-nov-2026",
			title: "Will the Mumbai Metro Line 3 open by 5 Nov 2026?",
			description: "Full-line revenue service on the Aqua Line.",
			status: "Resolved",
			resolution_deadline: AT,
			resolved_at: AT,
			resolution_outcome: "YES",
			media_video_url: null,
			created_by: ADMIN_SENTINEL,
			created_at: AT,
		},
	],
	pools: [
		{
			id: "0192f3a4-8b8b-7000-8000-00000000pl01",
			market_id: MARKET_ID,
			yes_reserves: "1050.000000000000000000",
			no_reserves: "950.000000000000000000",
			created_at: AT,
		},
	],
	resolution_events: [
		{
			id: "0192f3a4-4d4d-7000-8000-00000000re01",
			market_id: MARKET_ID,
			event_kind: "resolve",
			outcome: "YES",
			corrects_event_id: null,
			reason: "Revenue service commenced 2026-10-04, criterion met.",
			created_at: AT,
		},
	],
	identity_pool: [
		{
			id: "0192f3a4-9c9c-7000-8000-00000000ip01",
			colour: "Amber",
			animal: "Otter",
			number: 42,
			pseudonym: "AmberOtter042",
			pfp_filename: "amber-otter-042",
			assigned_at: AT,
			created_at: AT,
		},
	],
	market_media: [
		{
			id: "0192f3a4-adad-7000-8000-00000000mm01",
			market_id: MARKET_ID,
			// B.16 — this r2_object_key SHIPS. Admin-curated public context in
			// the `m/<marketId>/` namespace: no user_id embedded, so it is NOT
			// the same class of value as `image_uploads.r2_object_key`.
			r2_object_key: "m/0192f3a4-cccc-7000-8000-00000000m001/hero.webp",
			display_order: 0,
			is_default: true,
			created_by: ADMIN_SENTINEL,
			created_at: AT,
		},
	],
	events: DIRTY_EVENT_ROWS,
} as const satisfies Record<string, readonly object[]>;
