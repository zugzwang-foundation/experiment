import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * LAUNCH-DB-COPY-1 — `scripts/aws-migration/launch-storage.cjs`
 * (`docs/plans/LAUNCH-DB-COPY-1.md` §3/§4, runbook step 8).
 *
 * ⛔ WRITTEN BEFORE THE TOOL EXISTS; the intended RED is `Cannot find module
 * …/launch-storage.cjs`.
 *
 * WHY THIS TOOL EXISTS AT ALL. Copying the database alone breaks every post
 * image: staging and production use DIFFERENT uploads buckets with no objects in
 * common, so a restored `image_uploads` row points at a key production has never
 * held. The same holds for avatars. The keys are therefore read from the STAGING
 * DUMP — the same archive the database is restored from — and not from a live
 * query, so the object list and the row list cannot disagree.
 *
 * WHY IT IS COPY-ONLY, STRUCTURALLY. Production's own 232 uploads stay in
 * `zugzwang-uploads` and become unreferenced the moment the restore commits.
 * `src/server/storage/sweep-orphans.ts` runs every six hours and deletes
 * unattached objects — so a tool that could delete, and a tool that could
 * overwrite, are both one mistake away from destroying the only copy of a real
 * participant's image. Hence: no delete call anywhere, and every write
 * conditional on `If-None-Match: *`.
 *
 * Resolutions this file makes where §4 is silent (the implementer follows
 * these):
 *   1. CONTRACT ADDITION — `BUCKETS` is EXPORTED: `{ uploads, pfp, marketMedia }`,
 *      each `{ source, target }`, with the literal names from §3. "Never writes
 *      to a staging bucket" is then a property of DATA a test can read, rather
 *      than a prose scan over call sites. This is the one export below that §4
 *      does not name.
 *   2. `extractCopyRows(sqlText, table)` matches the table EXACTLY as written
 *      against the COPY header's qualified name. An unqualified or partial name
 *      finds nothing and returns `[]`, like an absent block.
 *   3. `assertSafeKey` refuses any `..` ANYWHERE in the key, not only as a path
 *      segment. No key this product mints contains it (`u/<userId>/<id>.<ext>`,
 *      a bare pfp file name, `m/<marketId>/…`), so the blunt rule costs nothing
 *      and needs no parser to be right.
 *   4. `referencedObjects` drops empty strings along with nulls. A scrubbed
 *      `pfp_filename` is the reason nulls are dropped; `""` is the same
 *      condition serialised differently, and `assertSafeKey` would refuse it
 *      later as a confusing failure instead of a skipped row.
 *   5. ⛔ THE PLAN IS WRONG ABOUT ONE COLUMN NAME AND THE SCHEMA WINS. §3's
 *      table says `market_media` is referenced by a column called `key`; the
 *      built column is `r2_object_key` (`src/db/schema/markets.ts:91`, migration
 *      `0019_market_media`). ⚠ The failure mode is silent in the worst way: a
 *      tool reading `row.key` gets `undefined` for every row, `referencedObjects`
 *      drops it with the nulls, the market-media list comes back EMPTY, and the
 *      verification then reports every referenced object present — having checked
 *      none. The tests below pin `r2_object_key`.
 *   6. `copyDecision` CHECKS THE TARGET FIRST. If production already holds the
 *      object at the same size the work is done, whatever the source says —
 *      which is also how the shared market-media bucket reports (`source ===
 *      target`, so both flags are true). An object present in the target and
 *      absent from the source is `skip-present`: production can serve it, and
 *      nothing is left to copy.
 *
 * The column names are taken from the schema, not from the plan:
 * `image_uploads.r2_object_key`, `users.pfp_filename`,
 * `identity_pool.pfp_filename`, `market_media.r2_object_key`.
 */

const REPO_ROOT = join(__dirname, "..", "..", "..");
const SCRIPT = join(REPO_ROOT, "scripts/aws-migration/launch-storage.cjs");
const require = createRequire(import.meta.url);
// biome-ignore lint/suspicious/noExplicitAny: a CommonJS script without types.
const tool: any = require(SCRIPT);

/** Comment-stripped before every negative scan; see launch-dump.test.ts. */
function code(src: string): string {
	return src
		.replace(/\/\*[\s\S]*?\*\//g, (m) =>
			"\n".repeat((m.match(/\n/g) ?? []).length),
		)
		.replace(/(^|[^:])\/\/[^\n]*/g, "$1");
}

const SOURCE = readFileSync(SCRIPT, "utf8");
const CODE = code(SOURCE);

/**
 * A realistic fragment of what `pg_restore --data-only -f -` renders from the
 * staging dump: two blocks, the first of which has a name the second is a
 * prefix of. `\N` is the COPY-text NULL.
 */
const DUMP_SQL = [
	"SET statement_timeout = 0;",
	"SET session_replication_role = replica;",
	"--",
	"-- Data for Name: user_events; Type: TABLE DATA; Schema: public; Owner: -",
	"--",
	"",
	"COPY public.user_events (id, user_id, event_type) FROM stdin;",
	"01927000-0000-7000-8000-00000000e001\t01927000-0000-7000-8000-000000000001\tuser.onboarded",
	"\\.",
	"",
	"--",
	"-- Data for Name: image_uploads; Type: TABLE DATA; Schema: public; Owner: -",
	"--",
	"",
	"COPY public.image_uploads (id, user_id, r2_object_key, content_type, byte_size, terminal_state, terminal_at, created_at) FROM stdin;",
	[
		"01927000-0000-7000-8000-00000000a001",
		"01927000-0000-7000-8000-000000000001",
		"u/01927000-0000-7000-8000-000000000001/01927000-0000-7000-8000-00000000a001.webp",
		"image/webp",
		"20481",
		"committed",
		"2026-10-01 10:00:00+00",
		"2026-10-01 09:59:12.481+00",
	].join("\t"),
	[
		"01927000-0000-7000-8000-00000000a002",
		"01927000-0000-7000-8000-000000000002",
		"u/01927000-0000-7000-8000-000000000002/01927000-0000-7000-8000-00000000a002.png",
		"image/png",
		"88112",
		"\\N",
		"\\N",
		"2026-10-02 11:00:00+00",
	].join("\t"),
	"\\.",
	"",
	"ALTER TABLE public.image_uploads ENABLE TRIGGER USER;",
	"",
].join("\n");

describe("launch-storage::extract-copy-rows", () => {
	it("reads a COPY block into one object per row, keyed by the header", () => {
		const rows = tool.extractCopyRows(DUMP_SQL, "public.image_uploads");
		expect(rows).toHaveLength(2);
		expect(rows[0]).toEqual({
			id: "01927000-0000-7000-8000-00000000a001",
			user_id: "01927000-0000-7000-8000-000000000001",
			r2_object_key:
				"u/01927000-0000-7000-8000-000000000001/01927000-0000-7000-8000-00000000a001.webp",
			content_type: "image/webp",
			byte_size: "20481",
			terminal_state: "committed",
			terminal_at: "2026-10-01 10:00:00+00",
			created_at: "2026-10-01 09:59:12.481+00",
		});
	});

	it("reads \\N as null, not as the two characters", () => {
		const rows = tool.extractCopyRows(DUMP_SQL, "public.image_uploads");
		expect(rows[1].terminal_state).toBeNull();
		expect(rows[1].terminal_at).toBeNull();
		expect(rows[1].r2_object_key).toContain(".png");
	});

	it("stops at the block terminator, so no statement after it leaks in", () => {
		const rows = tool.extractCopyRows(DUMP_SQL, "public.image_uploads");
		expect(JSON.stringify(rows)).not.toContain("ENABLE TRIGGER");
		expect(JSON.stringify(rows)).not.toContain("\\.");
	});

	it("takes the block it was asked for, not one whose name it is part of", () => {
		// `public.user_events` comes FIRST in the archive and `public.users` is a
		// prefix of neither — but a `startsWith`/`includes` matcher pairs them, and
		// the pfp list would then be built out of event rows.
		expect(tool.extractCopyRows(DUMP_SQL, "public.user_events")).toHaveLength(
			1,
		);
		expect(tool.extractCopyRows(DUMP_SQL, "public.user")).toEqual([]);
		expect(tool.extractCopyRows(DUMP_SQL, "image_uploads")).toEqual([]);
	});

	it("returns [] when the table has no block at all", () => {
		expect(tool.extractCopyRows(DUMP_SQL, "public.market_media")).toEqual([]);
		expect(tool.extractCopyRows("", "public.image_uploads")).toEqual([]);
	});

	it("returns [] for an empty block rather than a row of nothing", () => {
		const empty = [
			"COPY public.market_media (id, market_id, r2_object_key, display_order, is_default, created_by, created_at) FROM stdin;",
			"\\.",
			"",
		].join("\n");
		expect(tool.extractCopyRows(empty, "public.market_media")).toEqual([]);
	});

	it("reads a CRLF archive, which is what a Windows redirect produces", () => {
		// `countJournalRows` in prod-restore.cjs carries the same tolerance, and
		// this tool reads its input through the same Docker-on-Windows path.
		const rows = tool.extractCopyRows(
			DUMP_SQL.replace(/\n/g, "\r\n"),
			"public.image_uploads",
		);
		expect(rows).toHaveLength(2);
		expect(rows[0].content_type).toBe("image/webp");
	});
});

describe("launch-storage::referenced-objects", () => {
	const input = {
		imageUploads: [
			{ r2_object_key: "u/user-2/b.png" },
			{ r2_object_key: "u/user-1/a.webp" },
			{ r2_object_key: "u/user-1/a.webp" },
		],
		users: [
			{ pfp_filename: "pfp-0042.png" },
			{ pfp_filename: null },
			{ pfp_filename: "pfp-0007.png" },
		],
		identityPool: [
			{ pfp_filename: "pfp-0007.png" },
			{ pfp_filename: "pfp-9001.png" },
			{ pfp_filename: "" },
		],
		// ⛔ `r2_object_key`, not `key` — resolution 5 in the header.
		marketMedia: [
			{ r2_object_key: "m/market-2/cover.webp" },
			{ r2_object_key: "m/market-1/cover.webp" },
		],
	};

	it("collects the three key families from the columns that carry them", () => {
		const r = tool.referencedObjects(input);
		expect(Object.keys(r).sort()).toEqual(["marketMedia", "pfp", "uploads"]);
		expect(r.uploads).toEqual(["u/user-1/a.webp", "u/user-2/b.png"]);
		expect(r.marketMedia).toEqual([
			"m/market-1/cover.webp",
			"m/market-2/cover.webp",
		]);
	});

	it("INCLUDES the identity pool's avatars, not only the assigned users'", () => {
		/**
		 * ⛔ The pool is copied with the dump, so production's pool rows name
		 * staging's avatar files. A signup after launch consumes a pool row and
		 * takes its `pfp_filename` — if that object was never copied, the first new
		 * participant gets a broken avatar and nothing in the launch verification
		 * would have looked at it, because no `users` row referenced it yet.
		 */
		const r = tool.referencedObjects(input);
		// ⚠ Corrected after `@code-reviewer` C-1: a PFP's object KEY is
		// `v1/<pfp_filename>` (ADR-0011's version sentinel; pfp-url.ts composes
		// `${base}/v1/${pfp_filename}`, verify-identity-pool.ts HEADs `v1/${f}`).
		// This assertion pinned the bare file name, which would have HEADed keys
		// that exist in neither bucket and refused the whole copy.
		expect(r.pfp).toContain("v1/pfp-9001.png");
		expect(r.pfp).toEqual([
			"v1/pfp-0007.png",
			"v1/pfp-0042.png",
			"v1/pfp-9001.png",
		]);
	});

	it("de-duplicates across users and the pool, and sorts", () => {
		const r = tool.referencedObjects(input);
		expect(new Set(r.pfp).size).toBe(r.pfp.length);
		expect([...r.pfp].sort()).toEqual(r.pfp);
		expect([...r.uploads].sort()).toEqual(r.uploads);
		expect([...r.marketMedia].sort()).toEqual(r.marketMedia);
	});

	it("drops a scrubbed value, whether it is null or empty", () => {
		const r = tool.referencedObjects(input);
		expect(r.pfp).not.toContain(null);
		expect(r.pfp).not.toContain("");
		// The prefix is added AFTER the drop, so a scrubbed value never becomes
		// the bare key "v1/".
		expect(r.pfp).not.toContain("v1/");
		expect(r.pfp).toHaveLength(3);
	});

	it("⛔ reads market media from r2_object_key, not from the plan's `key`", () => {
		// The row shape the plan's §3 implies contributes NOTHING, which is the
		// only way to tell "reads the right column" from "reads a column that is
		// always undefined and drops it with the nulls".
		expect(
			tool.referencedObjects({
				imageUploads: [],
				users: [],
				identityPool: [],
				marketMedia: [{ key: "m/market-1/cover.webp" }],
			}).marketMedia,
		).toEqual([]);
	});

	it("returns three empty lists for an empty database", () => {
		expect(
			tool.referencedObjects({
				imageUploads: [],
				users: [],
				identityPool: [],
				marketMedia: [],
			}),
		).toEqual({ uploads: [], pfp: [], marketMedia: [] });
	});
});

describe("launch-storage::pfp-key-prefix-and-failure-class", () => {
	it("prefixes every avatar key with the v1/ version sentinel", () => {
		expect(tool.PFP_KEY_PREFIX).toBe("v1/");
		const r = tool.referencedObjects({
			imageUploads: [],
			users: [{ pfp_filename: "cerulean-alpaca.webp" }],
			identityPool: [],
			marketMedia: [],
		});
		expect(r.pfp).toEqual(["v1/cerulean-alpaca.webp"]);
		expect(() => tool.assertSafeKey(r.pfp[0])).not.toThrow();
	});

	it("lists the avatar keys participants already show", () => {
		expect(
			tool.participantPfpKeys([
				{ pfp_filename: "b.webp" },
				{ pfp_filename: null },
				{ pfp_filename: "a.webp" },
				{ pfp_filename: "a.webp" },
			]),
		).toEqual(["v1/a.webp", "v1/b.webp"]);
	});

	it("⛔ a missing participant avatar, upload or market image stops the copy", () => {
		const participants = new Set(["v1/a.webp"]);
		expect(tool.isHardFailure("pfp", "v1/a.webp", participants)).toBe(true);
		expect(tool.isHardFailure("uploads", "u/x/y.png", participants)).toBe(true);
		expect(tool.isHardFailure("marketMedia", "m/x/y.webp", participants)).toBe(
			true,
		);
	});

	it("a missing UNASSIGNED pool avatar is only a warning", () => {
		// @code-reviewer H-4: one absent future avatar must not block the uploads
		// that copied participants depend on today.
		expect(tool.isHardFailure("pfp", "v1/never-assigned.webp", new Set())).toBe(
			false,
		);
	});
});

describe("launch-storage::assert-safe-key", () => {
	it.each([
		[
			"a post image",
			"u/01927000-0000-7000-8000-000000000001/01927000-0000-7000-8000-00000000a001.webp",
		],
		["an avatar file name", "pfp-0042.png"],
		["a market-media key", "m/01927000-0000-7000-8000-00000000m001/cover.webp"],
	])("accepts %s", (_label, key) => {
		expect(() => tool.assertSafeKey(key)).not.toThrow();
	});

	it.each([
		["a parent traversal", "u/../../etc/passwd"],
		["a bare traversal", ".."],
		["a traversal inside a name", "u/user-1/a..webp"],
		["an absolute key", "/u/user-1/a.webp"],
		["a backslash", "u\\user-1\\a.webp"],
		["a mixed separator", "u/user-1\\a.webp"],
		["nothing", ""],
		["null", null],
	])("refuses %s", (_label, key) => {
		expect(() => tool.assertSafeKey(key)).toThrow(/refusing/);
	});
});

describe("launch-storage::copy-decision", () => {
	it("skips an object production already holds at the same size", () => {
		expect(
			tool.copyDecision({
				inTarget: true,
				targetSize: 20481,
				inSource: true,
				sourceSize: 20481,
			}),
		).toBe("skip-present");
	});

	it("copies an object production does not hold", () => {
		expect(
			tool.copyDecision({
				inTarget: false,
				targetSize: 0,
				inSource: true,
				sourceSize: 20481,
			}),
		).toBe("copy");
	});

	it("fails a referenced key that is missing from the source", () => {
		expect(
			tool.copyDecision({
				inTarget: false,
				targetSize: 0,
				inSource: false,
				sourceSize: 0,
			}),
		).toBe("fail-missing-in-source");
	});

	it("fails rather than overwrite when the sizes disagree", () => {
		// The same key holding different bytes in the two buckets is the one case
		// where "copy if missing" is not enough information to act on: it is
		// either a real collision or a truncated upload, and both need a human.
		expect(
			tool.copyDecision({
				inTarget: true,
				targetSize: 10,
				inSource: true,
				sourceSize: 20481,
			}),
		).toBe("fail-size-conflict");
	});

	it("treats an object present only in the target as done (resolution 5)", () => {
		expect(
			tool.copyDecision({
				inTarget: true,
				targetSize: 20481,
				inSource: false,
				sourceSize: 0,
			}),
		).toBe("skip-present");
	});
});

describe("launch-storage::buckets", () => {
	it("names each family's source and target exactly as the plan does", () => {
		expect(tool.BUCKETS.uploads).toEqual({
			source: "zugzwang-staging-uploads",
			target: "zugzwang-uploads",
		});
		expect(tool.BUCKETS.pfp).toEqual({
			source: "zugzwang-staging-pfp",
			target: "zugzwang-pfp",
		});
		expect(tool.BUCKETS.marketMedia).toEqual({
			source: "zugzwang-market-media",
			target: "zugzwang-market-media",
		});
	});

	it("⛔ has no staging bucket as a TARGET", () => {
		for (const [family, b] of Object.entries(tool.BUCKETS) as [
			string,
			{ source: string; target: string },
		][]) {
			expect(b.target, family).not.toContain("staging");
			expect(b.target, family).toMatch(/^zugzwang-/);
		}
	});

	it("knows the market-media bucket is shared, so that family is verify-only", () => {
		expect(tool.BUCKETS.marketMedia.source).toBe(
			tool.BUCKETS.marketMedia.target,
		);
	});
});

describe("launch-storage::execution-safety", () => {
	it("the scanner can see the tokens it is looking for", () => {
		// POSITIVE CONTROL for the negative scans below: these patterns do match
		// the shapes they name, so an empty result means absence.
		expect(
			/DeleteObject|deleteObject/.test("new DeleteObjectCommand({})"),
		).toBe(true);
		expect(/staging/.test('Bucket: "zugzwang-staging-uploads"')).toBe(true);
		expect(CODE.length).toBeGreaterThan(0);
	});

	it("⛔ never deletes an object, by any route", () => {
		expect(CODE).not.toMatch(/DeleteObject|deleteObject|DeleteObjects/);
		expect(CODE).not.toMatch(/\bs3 rm\b|\bdelete-object\b|--delete\b/);
	});

	it("⛔ never writes without If-None-Match, so nothing existing is overwritten", () => {
		const writes =
			CODE.match(
				/new (PutObjectCommand|CopyObjectCommand)\(|"(put|copy)-object"/g,
			) ?? [];
		const guards = CODE.match(/IfNoneMatch|if-none-match/gi) ?? [];
		expect(writes.length).toBeGreaterThan(0);
		expect(guards.length).toBeGreaterThanOrEqual(writes.length);
		expect(CODE).toMatch(/IfNoneMatch:\s*"\*"|--if-none-match[\s="']+\*/);
	});

	it("⛔ names a staging bucket once at most — where BUCKETS declares it", () => {
		// A bucket name repeated at a call site is how a source becomes a
		// destination. Combined with the BUCKETS assertions above, this leaves no
		// route by which a write reaches a staging bucket.
		for (const name of ["zugzwang-staging-uploads", "zugzwang-staging-pfp"]) {
			expect(CODE.split(name).length - 1).toBeLessThanOrEqual(1);
		}
	});

	it("is check-only until --execute is given", () => {
		expect(CODE).toContain("--execute");
		expect(CODE).toMatch(/if\s*\(\s*!\s*[\w.]*execute\b/i);
	});

	it("validates every key before it is used", () => {
		expect(CODE).toContain("assertSafeKey");
	});

	it("only touches AWS or the network when executed directly", () => {
		// This file requires the module; without the guard, collecting it would
		// start listing buckets.
		expect(SOURCE).toContain("if (require.main === module)");
	});
});

describe("launch-storage::parsed-counts", () => {
	/**
	 * @security-auditor M-5. extractCopyRows returns [] for a block it cannot
	 * read; without a count check a parse divergence reported "0 referenced,
	 * 0 problems" and the copy succeeded having copied nothing.
	 */
	const rows = (n: number) => Array.from({ length: n }, () => ({}));
	const manifest = {
		"public.users": { count: 2, md5: "x" },
		"public.image_uploads": { count: "3", md5: "y" },
	};

	it("passes when every parsed table matches its manifest count", () => {
		expect(() =>
			tool.assertParsedCounts(
				{ "public.users": rows(2), "public.image_uploads": rows(3) },
				manifest,
			),
		).not.toThrow();
	});

	it("⛔ refuses a table that parsed to zero rows the manifest says exist", () => {
		expect(() =>
			tool.assertParsedCounts(
				{ "public.users": rows(2), "public.image_uploads": [] },
				manifest,
			),
		).toThrow(/parsed 0 public\.image_uploads rows .* manifest says 3/);
	});

	it("refuses a table the manifest has no count for", () => {
		expect(() =>
			tool.assertParsedCounts({ "public.market_media": [] }, manifest),
		).toThrow(/no count for public\.market_media/);
	});

	it("requires the manifest, and gates --execute on the launch window", () => {
		expect(CODE).toMatch(/manifest\.json not found/);
		expect(CODE).toMatch(/assertParsedCounts\(parsedRows, manifest\.tables\)/);
		expect(CODE).toMatch(/if \(execute\) assertLaunchWindow\(\)/);
	});
});
