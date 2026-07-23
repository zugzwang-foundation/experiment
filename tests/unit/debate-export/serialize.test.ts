import { readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";
import type { Side } from "@/lib/ranking";
import type { ExportMarketMeta } from "@/server/debate-export/market-meta";
import {
	formatDharmaGrouped,
	serializeDebateExport,
} from "@/server/debate-export/serialize";
import type {
	DebatePost,
	DebateReply,
	DebateViewModel,
} from "@/server/debate-view/load-debate-view";
import type { Marker } from "@/server/positions/compute";

import {
	mumbaiMetroMeta,
	mumbaiMetroModel,
} from "./_fixtures/mumbai-metro.input";

// EXPORT.1 §5.6 tests-first — the serializer is the identity-non-leak boundary
// (debate-export.md §10, SAFETY-CRITICAL). VALUE imports `serializeDebateExport`
// + `formatDharmaGrouped` resolve against the GREENFIELD `@/server/debate-export/
// serialize` (not built until the writer lands it) → RED at collection on the
// missing module, NOT on a fixture typo. PURE: no DB, no clock, no IO (the
// serializer takes `exportedAt` injected) — runnable as a unit test.

const HERE = fileURLToPath(new URL(".", import.meta.url));
const REPO_ROOT = join(HERE, "..", "..", "..");

// The committed byte-exact golden (v2) carries a `{{ZUGZWANG_MD_CONTEXT}}` token
// where the verbatim context block splices in. The expected output is the golden
// with that token replaced by the SAME `public/zugzwang.md` bytes handed to the
// serializer as `context` — byte-identical by construction iff the serializer
// neither trims nor re-indents the context and frames it with `\n\n` (Self-crit #1).
const ZUGZWANG_MD = readFileSync(
	join(REPO_ROOT, "public", "zugzwang.md"),
	"utf8",
);
const EXPECTED_TEMPLATE = readFileSync(
	join(HERE, "_fixtures", "mumbai-metro.expected.md"),
	"utf8",
);

// The "photograph of now" instant — INJECTED (the serializer reads no clock), so
// the golden is deterministic (Open Q golden / plan §3).
const EXPORTED_AT = "2026-06-29T12:00:00Z";

// ── Minimal typed builders for the non-golden scenarios ──────────────────────
// `entryPrice` is set on the NON-REMOVED variants — the field the writer ADDS to
// the read-model in this task. It type-errors today (TS2353), but esbuild strips
// types so these RUN; the RED is the missing serializer import above.

function mkReply(o: {
	id?: string;
	side: Side;
	body?: string;
	marker?: Marker;
	pseudonym?: string;
	pfpUrl?: string;
	stake?: string;
	entryPrice?: string;
	createdAt?: string;
}): DebateReply {
	return {
		removed: false,
		id: o.id ?? `reply-${o.pseudonym ?? "x"}`,
		side: o.side,
		createdAt: o.createdAt ?? "2026-05-20T08:00:00.000Z",
		body: o.body ?? "A staked reply argument.",
		marker: o.marker ?? "none",
		author: {
			pseudonym: o.pseudonym ?? "ReplyAuthor000",
			pfpUrl: o.pfpUrl ?? "/pfp-placeholder.svg",
		},
		stake: o.stake ?? "10.000000000000000000",
		entryPrice: o.entryPrice ?? "0.500000000000000000",
	};
}

function mkRemovedReply(o: {
	id?: string;
	side: Side;
	createdAt?: string;
}): DebateReply {
	return {
		removed: true,
		id: o.id ?? "reply-removed",
		side: o.side,
		createdAt: o.createdAt ?? "2026-05-20T08:00:00.000Z",
	};
}

function emptyGroups(): DebatePost["replies"] {
	return { support: [], counter: [], twoSlot: [] };
}

function mkPost(o: {
	id?: string;
	side: Side;
	title?: string;
	body?: string;
	marker?: Marker;
	pseudonym?: string;
	pfpUrl?: string;
	stake?: string;
	entryPrice?: string;
	imageUrl?: string | null;
	createdAt?: string;
	ordinal?: number;
	aggregate?: DebatePost["aggregate"];
	replies?: DebatePost["replies"];
}): DebatePost {
	return {
		removed: false,
		id: o.id ?? `post-${o.pseudonym ?? "x"}`,
		// UI.A2 additive field — NOT serialized (debate-export.md §10 field set).
		ordinal: o.ordinal ?? 1,
		sideAtPostTime: o.side,
		createdAt: o.createdAt ?? "2026-05-18T07:40:00.000Z",
		title: o.title ?? "A staked post argument",
		teaser: "",
		body: o.body ?? "A staked post argument body.",
		imageUrl: o.imageUrl ?? null,
		marker: o.marker ?? "none",
		badge: null,
		author: {
			pseudonym: o.pseudonym ?? "PostAuthor000",
			pfpUrl: o.pfpUrl ?? "/pfp-placeholder.svg",
		},
		authorStake: o.stake ?? "100.000000000000000000",
		entryPrice: o.entryPrice ?? "0.500000000000000000",
		aggregate: o.aggregate ?? {
			supportCount: 0,
			counterCount: 0,
			supportDharma: "0.000000000000000000",
			counterDharma: "0.000000000000000000",
		},
		replies: o.replies ?? emptyGroups(),
	};
}

function mkRemovedPost(o: {
	id?: string;
	side: Side;
	createdAt?: string;
	ordinal?: number;
	aggregate?: DebatePost["aggregate"];
	replies?: DebatePost["replies"];
}): DebatePost {
	return {
		removed: true,
		id: o.id ?? "post-removed",
		// UI.A2 additive field — NOT serialized (debate-export.md §10 field set).
		ordinal: o.ordinal ?? 1,
		sideAtPostTime: o.side,
		createdAt: o.createdAt ?? "2026-05-26T19:05:00.000Z",
		aggregate: o.aggregate ?? {
			supportCount: 0,
			counterCount: 0,
			supportDharma: "0.000000000000000000",
			counterDharma: "0.000000000000000000",
		},
		replies: o.replies ?? emptyGroups(),
	};
}

function mkModel(
	posts: DebatePost[],
	market?: Partial<DebateViewModel["market"]>,
): DebateViewModel {
	return {
		market: {
			id: "mkt-test",
			slug: "test-market",
			title: "Will the test pass before the freeze?",
			description: "Resolves YES if the suite is green.",
			status: "Open",
			pricing: { yes: "0.500000000000000000", no: "0.500000000000000000" },
			// UI.A2 additive header field — NOT serialized (debate-export.md §10).
			unitToWin: null,
			totals: {
				dharmaStaked: "0.000000000000000000",
				postCount: posts.length,
				replyCount: 0,
			},
			...market,
		},
		posts,
		priceChart: null,
	};
}

function mkMeta(o?: Partial<ExportMarketMeta>): ExportMarketMeta {
	return {
		outcome: null,
		resolvedAt: null,
		resolutionReason: null,
		participants: 1,
		totalStakeDharma: "100.000000000000000000",
		...o,
	};
}

function run(model: DebateViewModel, meta: ExportMarketMeta): string {
	return serializeDebateExport({
		model,
		meta,
		context: "ZCONTEXT",
		exportedAt: EXPORTED_AT,
	});
}

// ── 1. Byte-exact golden (the matched pair) — primary ────────────────────────

describe("serializeDebateExport — byte-exact Mumbai Metro golden", () => {
	it("debate-export::byte-exact-golden", () => {
		const expected = EXPECTED_TEMPLATE.replace(
			"{{ZUGZWANG_MD_CONTEXT}}",
			ZUGZWANG_MD,
		);
		const out = serializeDebateExport({
			model: mumbaiMetroModel,
			meta: mumbaiMetroMeta,
			context: ZUGZWANG_MD,
			exportedAt: EXPORTED_AT,
		});
		expect(out).toBe(expected);
	});
});

// ── 2. Masking placeholder (7e) — SAFETY-CRITICAL ────────────────────────────

describe("serializeDebateExport — removed node masking (7e)", () => {
	// A removed post carrying DISTINCTIVE aggregate values that MUST NOT render,
	// plus one surviving reply that MUST render (thread integrity).
	const model = mkModel([
		mkPost({
			id: "p-visible",
			side: "YES",
			title: "Visible YES post",
			body: "VISIBLE-POST-BODY",
			pseudonym: "VisibleAuthor",
			createdAt: "2026-05-10T00:00:00.000Z",
		}),
		mkRemovedPost({
			id: "p-removed",
			side: "NO",
			createdAt: "2026-05-26T19:05:00.000Z",
			aggregate: {
				supportCount: 7,
				counterCount: 8,
				supportDharma: "777.000000000000000000",
				counterDharma: "888.000000000000000000",
			},
			replies: {
				support: [
					mkReply({
						side: "NO",
						body: "SURVIVING-REPLY-BODY",
						pseudonym: "SurvivingReplier",
						stake: "55.000000000000000000",
						createdAt: "2026-05-27T07:15:00.000Z",
					}),
				],
				counter: [],
				twoSlot: [],
			},
		}),
	]);
	const out = () =>
		run(model, mkMeta({ totalStakeDharma: "935.000000000000000000" }));

	it("debate-export-masking::emits-7e-placeholder-keeping-rank-slot", () => {
		const o = out();
		expect(o).toContain("[removed by moderator]");
		expect(o).toContain(
			"removed by moderator — argument text, author, and stake withheld",
		);
		// Rank slot preserved: removed node is Post 2 of 2.
		expect(o).toMatch(/### Post 2 — NO — \[removed by moderator\]/);
	});

	it("debate-export-masking::never-emits-body-author-stake-aggregate-for-removed", () => {
		const o = out();
		// Scope to the removed post's header (before its first surviving reply).
		const header = o.slice(o.indexOf("### Post 2"), o.indexOf("#### Reply"));
		expect(header).toContain("**Status:**");
		expect(header).toContain("**Rank:**");
		expect(header).toContain("**Side:**");
		expect(header).toContain("**Time:**");
		// None of the non-removed fields appear on the removed node.
		expect(header).not.toContain("**Author:**");
		expect(header).not.toContain("**Stake:**");
		expect(header).not.toContain("**Entry price:**");
		expect(header).not.toContain("**Support / Counter:**");
		// The masked aggregate values NEVER leak anywhere.
		expect(o).not.toContain("777");
		expect(o).not.toContain("888");
		expect(o).not.toContain("7 support");
		expect(o).not.toContain("8 counter");
	});

	it("debate-export-masking::surviving-replies-serialize-and-flag-removed-parent", () => {
		const o = out();
		expect(o).toContain("SURVIVING-REPLY-BODY");
		expect(o).toContain("SurvivingReplier");
		// 7d: a reply under a removed parent appends "(removed)" to Replies-to.
		expect(o).toMatch(/\*\*Replies to:\*\* Post 2 \(removed\)/);
	});

	it("debate-export-masking::removed-reply-is-structural-placeholder", () => {
		// A removed REPLY (the `{ removed: true }` DebateReply variant) under a
		// VISIBLE post. The removal writer isn't built, so this guards the path via
		// an injected fixture (plan doctrine: removed-node masking is TESTED, never
		// safe-by-absence) — and pins that a future widening of the removed-reply
		// variant cannot silently start emitting stake/price/author.
		const model = mkModel([
			mkPost({
				id: "p-host",
				side: "YES",
				title: "Host post",
				pseudonym: "HostAuthor",
				createdAt: "2026-05-10T00:00:00.000Z",
				replies: {
					support: [
						mkRemovedReply({
							id: "r-removed",
							side: "YES",
							createdAt: "2026-05-11T00:00:00.000Z",
						}),
						mkReply({
							side: "YES",
							body: "SURVIVING-SIBLING-BODY",
							pseudonym: "SiblingAuthor",
							stake: "33.000000000000000000",
						}),
					],
					counter: [],
					twoSlot: [],
				},
			}),
		]);
		const o = run(model, mkMeta());
		// Reply 1.1 (the removed one) is a structural placeholder only.
		expect(o).toMatch(
			/#### Reply 1\.1 — Support \(YES\) — \[removed by moderator\]/,
		);
		const block = o.slice(
			o.indexOf("#### Reply 1.1"),
			o.indexOf("#### Reply 1.2"),
		);
		expect(block).toContain("**Status:** removed by moderator");
		expect(block).toContain("**Time:**");
		expect(block).not.toContain("**Stake:**");
		expect(block).not.toContain("**Entry price:**");
		expect(block).not.toContain("**Author status:**");
		// The surviving sibling (another user's staked argument) still renders.
		expect(o).toContain("SURVIVING-SIBLING-BODY");
		expect(o).toContain("SiblingAuthor");
	});
});

// ── 3. §10.5 totals-verbatim (removal hides voice, not balance) ───────────────

describe("serializeDebateExport — totals read from meta verbatim (§10.5)", () => {
	// Visible node stakes sum to 300 (100 + 200); meta deliberately exceeds it.
	const model = mkModel([
		mkPost({
			id: "p1",
			side: "YES",
			pseudonym: "AuthorOne",
			stake: "100.000000000000000000",
			createdAt: "2026-05-10T00:00:00.000Z",
		}),
		mkPost({
			id: "p2",
			side: "NO",
			pseudonym: "AuthorTwo",
			stake: "200.000000000000000000",
			createdAt: "2026-05-11T00:00:00.000Z",
		}),
	]);
	const meta = mkMeta({
		participants: 42,
		totalStakeDharma: "5000.000000000000000000",
	});

	it("debate-export-totals::front-matter-uses-meta-not-node-sum", () => {
		const o = run(model, meta);
		expect(o).toContain("total_stake_dharma: 5000");
		expect(o).toContain("participants: 42");
		// The node-stake sum (300) is NEVER used as the document total.
		expect(o).not.toContain("total_stake_dharma: 300");
	});

	it("debate-export-totals::body-and-summary-use-meta-grouped", () => {
		const o = run(model, meta);
		// Market 7a + Summary both render the grouped META value.
		expect(o).toContain("**Total staked:** 5,000 Đ");
		expect(o).toContain("42 participants have staked 5,000 Đ");
		expect(o).toContain("**Participants:** 42");
	});
});

// ── 4. Summary fall-through (the golden does NOT exercise this) ───────────────

describe("serializeDebateExport — Summary top-argument fall-through (§6)", () => {
	it("debate-export-summary::top-side-post-removed-falls-through-to-next", () => {
		// Top YES (rank 1) is removed → Summary quotes the next non-removed YES.
		const model = mkModel([
			mkRemovedPost({
				id: "p-rm",
				side: "YES",
				createdAt: "2026-05-10T00:00:00.000Z",
			}),
			mkPost({
				id: "p-backup",
				side: "YES",
				title: "Backup YES wins the slot",
				pseudonym: "BackupYesAuthor",
				stake: "120.000000000000000000",
				createdAt: "2026-05-11T00:00:00.000Z",
			}),
			mkPost({
				id: "p-no",
				side: "NO",
				title: "The NO case",
				pseudonym: "NoAuthor",
				stake: "90.000000000000000000",
				createdAt: "2026-05-12T00:00:00.000Z",
			}),
		]);
		const o = run(model, mkMeta());
		expect(o).toContain(
			'The most heavily backed YES argument is "Backup YES wins the slot" (BackupYesAuthor, 120 Đ).',
		);
	});

	it("debate-export-summary::all-posts-on-a-side-removed", () => {
		const model = mkModel([
			mkRemovedPost({
				id: "p-rm1",
				side: "YES",
				createdAt: "2026-05-10T00:00:00.000Z",
			}),
			mkRemovedPost({
				id: "p-rm2",
				side: "YES",
				createdAt: "2026-05-11T00:00:00.000Z",
			}),
			mkPost({
				id: "p-no",
				side: "NO",
				title: "The NO case",
				pseudonym: "NoAuthor",
				createdAt: "2026-05-12T00:00:00.000Z",
			}),
		]);
		const o = run(model, mkMeta());
		expect(o).toContain("The leading YES argument was removed by a moderator.");
	});

	it("debate-export-summary::side-with-no-posts", () => {
		// Only YES posts exist → the NO side has none.
		const model = mkModel([
			mkPost({
				id: "p-yes",
				side: "YES",
				title: "Lonely YES",
				pseudonym: "YesAuthor",
				createdAt: "2026-05-12T00:00:00.000Z",
			}),
		]);
		const o = run(model, mkMeta());
		expect(o).toContain("No NO argument has been posted yet.");
	});
});

// ── 5. Text-only (imageUrl / pfpUrl never appear) ────────────────────────────

describe("serializeDebateExport — text-only (drops image + PFP URLs)", () => {
	it("debate-export-textonly::never-emits-imageurl-or-pfpurl", () => {
		const model = mkModel([
			mkPost({
				id: "p-img",
				side: "YES",
				pseudonym: "ImageAuthor",
				imageUrl: "https://r2.example/SHOULD-NOT-APPEAR.jpg",
				pfpUrl: "https://r2.example/PFP-SHOULD-NOT-APPEAR.png",
				createdAt: "2026-05-10T00:00:00.000Z",
				replies: {
					support: [
						mkReply({
							side: "YES",
							pseudonym: "ReplyImageAuthor",
							pfpUrl: "https://r2.example/REPLY-PFP-NOPE.png",
						}),
					],
					counter: [],
					twoSlot: [],
				},
			}),
		]);
		const o = run(model, mkMeta());
		expect(o).not.toContain("SHOULD-NOT-APPEAR");
		expect(o).not.toContain("PFP-SHOULD-NOT-APPEAR");
		expect(o).not.toContain("REPLY-PFP-NOPE");
		expect(o).not.toContain("https://r2.example");
		// The Mumbai golden likewise never leaks the placeholder PFP path.
		const golden = serializeDebateExport({
			model: mumbaiMetroModel,
			meta: mumbaiMetroMeta,
			context: ZUGZWANG_MD,
			exportedAt: EXPORTED_AT,
		});
		expect(golden).not.toContain("/pfp-placeholder.svg");
	});
});

// ── 6. Front matter (keys, ordering, constants, status lowercasing) ──────────

describe("serializeDebateExport — front matter", () => {
	const golden = () =>
		serializeDebateExport({
			model: mumbaiMetroModel,
			meta: mumbaiMetroMeta,
			context: ZUGZWANG_MD,
			exportedAt: EXPORTED_AT,
		});

	it("debate-export-frontmatter::constants-and-injected-fields", () => {
		const o = golden();
		expect(o).toContain("doc_type: zugzwang-debate-export");
		expect(o).toContain("exported_at: 2026-06-29T12:00:00Z");
		expect(o).toContain(
			'ordering: "posts and replies are in ranking order (by weight), not chronological"',
		);
		expect(o).toContain(
			"timestamps: \"each entry has an ISO-8601 'time' field; use it for chronology\"",
		);
		expect(o).toContain("posts: 6");
		expect(o).toContain("replies: 10");
		expect(o).toContain("participants: 11");
	});

	it("debate-export-frontmatter::status-lowercased", () => {
		// model.market.status is "Open" → front matter `status: open`.
		expect(golden()).toContain("status: open");
		expect(golden()).not.toContain("status: Open");
	});

	it("debate-export-frontmatter::chronological-index-is-createdAt-ascending", () => {
		// Post createdAt asc → post-{rank} (rank = array position): P3 (05-15) is
		// oldest, P6 (06-09) newest. Pins ranking-order ≠ chronology.
		expect(golden()).toContain(
			"chronological_index_posts: [post-3, post-1, post-2, post-4, post-5, post-6]",
		);
	});

	it("debate-export-frontmatter::labels-are-positional-never-raw-ids", () => {
		const o = golden();
		// ADR-0016 §6 — posts are `post-{rank}`, never `posts.id`.
		expect(o).not.toContain("cmt-p");
		expect(o).not.toContain("cmt-r");
	});
});

// ── 7. Resolved state (structure, NOT byte-exact) ────────────────────────────

describe("serializeDebateExport — resolved market", () => {
	const model = mkModel(
		[
			mkPost({
				id: "p-yes",
				side: "YES",
				title: "The YES case",
				pseudonym: "YesAuthor",
				createdAt: "2026-05-10T00:00:00.000Z",
			}),
		],
		{ status: "Resolved" },
	);
	const meta = mkMeta({
		outcome: "YES",
		resolvedAt: "2026-07-01T00:00:00.000Z",
		resolutionReason: "Criterion met per MMRC figures.",
	});

	it("debate-export-resolved::front-matter-final-state-fields", () => {
		const o = run(model, meta);
		expect(o).toContain("status: resolved");
		expect(o).toContain("outcome: YES");
		expect(o).toContain("resolved_at: 2026-07-01T00:00:00.000Z");
		expect(o).toContain('resolution_reason: "Criterion met per MMRC figures."');
	});

	it("debate-export-resolved::in-body-final-price-and-summary-outcome", () => {
		const o = run(model, meta);
		// "Final price" (not "Current price") once resolved.
		expect(o).toContain("Final price");
		expect(o).not.toContain("Current price");
		// Summary status phrase: "resolved {outcome}".
		expect(o).toContain("resolved YES");
	});
});

// ── 8. No pool (null prices) ─────────────────────────────────────────────────

describe("serializeDebateExport — market with no pool", () => {
	const model = mkModel(
		[
			mkPost({
				id: "p-yes",
				side: "YES",
				title: "The YES case",
				pseudonym: "YesAuthor",
				createdAt: "2026-05-10T00:00:00.000Z",
			}),
		],
		{ pricing: null },
	);

	it("debate-export-nopool::front-matter-prices-null", () => {
		const o = run(model, mkMeta());
		expect(o).toContain("yes_price: null");
		expect(o).toContain("no_price: null");
	});

	it("debate-export-nopool::summary-drops-yes-no-clause", () => {
		const o = run(model, mkMeta());
		// Spec §6: "with no market price yet", and NO "X% YES / Y% NO" clause.
		expect(o).toContain("with no market price yet");
		expect(o).not.toMatch(/\d+% YES \/ \d+% NO/);
	});
});

// ── 9. Formatter units — `formatDharmaGrouped` (string-based, NUMERIC-safe) ───

describe("formatDharmaGrouped — export-only thousands grouping", () => {
	it("debate-export-formatter::groups-integer-thousands", () => {
		expect(formatDharmaGrouped("3225.000000000000000000")).toBe("3,225");
		expect(formatDharmaGrouped("560.000000000000000000")).toBe("560");
		expect(formatDharmaGrouped("1234567.000000000000000000")).toBe("1,234,567");
	});

	it("debate-export-formatter::sub-thousand-unchanged", () => {
		expect(formatDharmaGrouped("0.000000000000000000")).toBe("0");
		expect(formatDharmaGrouped("999.000000000000000000")).toBe("999");
	});

	it("debate-export-formatter::keeps-trimmed-fractional-remainder", () => {
		// Grouped integer part + trailing-zero-trimmed fraction (mirrors the live
		// `format.ts::formatDharma`, but with comma grouping). See @test-writer
		// return: the fractional contract was UNDERSPECIFIED in the plan — this
		// asserts the formatDharma-consistent interpretation; confirm at review.
		expect(formatDharmaGrouped("1234.560000000000000000")).toBe("1,234.56");
	});
});
