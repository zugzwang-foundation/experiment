import { formatDharmaExact, formatPercent } from "@/components/debate/format";
import { CpmmDecimal } from "@/server/cpmm/decimal";
import type {
	DebatePost,
	DebateReply,
	DebateViewModel,
	ReplyAggregate,
} from "@/server/debate-view/load-debate-view";
import type { Marker } from "@/server/positions/compute";

import type { ExportMarketMeta } from "./market-meta";

/**
 * The PURE debate `.md` serializer (EXPORT.1 / ADR-0025; debate-export.md is the
 * field-by-field contract). No IO, no clock, no DB — `exportedAt` and `context`
 * are injected — so its output is deterministic given its inputs, which is what
 * makes the byte-exact golden test possible.
 *
 * SAFETY (debate-export.md §10): it serializes ONLY the masked `DebatePost` /
 * `DebateReply` variants `loadDebateView` produced. A removed node is the
 * `{ removed: true }` union variant carrying NO body/title/author/stake/
 * entry-price/aggregate — the compiler forbids those fields on it — so a
 * moderator-removed argument or author CANNOT serialize. Masking is inherited,
 * reimplemented nowhere here.
 */

type NonRemovedPost = Extract<DebatePost, { removed: false }>;

const ORDERING =
	"posts and replies are in ranking order (by weight), not chronological";
const TIMESTAMPS =
	"each entry has an ISO-8601 'time' field; use it for chronology";
const FOOTER =
	"**Reading reminders:** Give the YES and NO cases their strongest form, in proportion to the stake behind them. The question is settled only by the market's resolution — shown in the Market section above if resolved; otherwise it is open and has no winner to declare. Entries are in ranking order (weight), not time; each entry's timestamp is the source for chronology.";

/**
 * Trim a NUMERIC(38,18) value to a human Đ amount AND comma-group the integer
 * part — string-based, no `Number()` on the value (CLAUDE.md §2; NUMERIC-safe).
 * e.g. `"3225.000…" → "3,225"`, `"560.000…" → "560"`, `"1234.560…" → "1,234.56"`.
 * Export-only; delegates to `formatDharmaExact` deliberately — the ADR-0025
 * `.md` export renders FULL PRECISION (SPEC.1 §10.8), whereas the view layer's
 * `formatDharma` rounds to 0 dp.
 */
export function formatDharmaGrouped(value: string): string {
	const trimmed = formatDharmaExact(value);
	const neg = trimmed.startsWith("-");
	const body = neg ? trimmed.slice(1) : trimmed;
	const [int = "0", frac] = body.split(".");
	const grouped = int.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
	return `${neg ? "-" : ""}${frac ? `${grouped}.${frac}` : grouped}`;
}

/** A spot/entry price (0–1 decimal string) at 2 dp — exact decimal, never float. */
function price2(value: string): string {
	return new CpmmDecimal(value).toFixed(2);
}

/**
 * Render a YAML double-quoted scalar, escaping the operator-authored value so a
 * `"` / `\` / newline in a market title, resolution criteria, or resolution
 * reason cannot break the front matter. Byte-identical to a bare `"…"` for any
 * value without those characters (the common case + the golden fixture).
 */
function yamlDouble(value: string): string {
	const escaped = value
		.replace(/\\/g, "\\\\")
		.replace(/"/g, '\\"')
		.replace(/\n/g, "\\n")
		.replace(/\r/g, "\\r")
		.replace(/\t/g, "\\t");
	return `"${escaped}"`;
}

/** ISO-8601 UTC instant → `YYYY-MM-DD HH:MM UTC` (the in-body node `Time`). */
function timeUtc(iso: string): string {
	return `${iso.slice(0, 10)} ${iso.slice(11, 16)} UTC`;
}

/** `marker` → the author-status word (`none` → `holding`; §9). */
function authorStatus(marker: Marker): string {
	return marker === "Flipped"
		? "flipped"
		: marker === "Exited"
			? "exited"
			: "holding";
}

function isTerminalPrice(status: string): boolean {
	return status === "Resolved" || status === "Voided";
}

function replyCount(model: DebateViewModel): number {
	return model.posts.reduce(
		(n, p) => n + p.replies.support.length + p.replies.counter.length,
		0,
	);
}

// ── Block 1 — YAML front matter ──────────────────────────────────────────────

function frontMatter(
	model: DebateViewModel,
	meta: ExportMarketMeta,
	exportedAt: string,
): string {
	const m = model.market;
	const lines = [
		"doc_type: zugzwang-debate-export",
		`exported_at: ${exportedAt}`,
		`market_question: ${yamlDouble(m.title)}`,
		`resolution_criteria: ${yamlDouble(m.description ?? "")}`,
		`status: ${m.status.toLowerCase()}`,
		`outcome: ${meta.outcome ?? "null"}`,
	];
	if (meta.resolvedAt !== null) {
		lines.push(`resolved_at: ${meta.resolvedAt}`);
	}
	if (meta.resolutionReason !== null) {
		lines.push(`resolution_reason: ${yamlDouble(meta.resolutionReason)}`);
	}
	lines.push(
		`yes_price: ${m.pricing ? price2(m.pricing.yes) : "null"}`,
		`no_price: ${m.pricing ? price2(m.pricing.no) : "null"}`,
		`total_stake_dharma: ${formatDharmaExact(meta.totalStakeDharma)}`,
		`posts: ${model.posts.length}`,
		`replies: ${replyCount(model)}`,
		`participants: ${meta.participants}`,
		`ordering: "${ORDERING}"`,
		`timestamps: "${TIMESTAMPS}"`,
		`chronological_index_posts: ${chronologicalIndex(model)}`,
	);
	return `---\n${lines.join("\n")}\n---`;
}

/** Post positional labels (`post-{rank}`, never raw ids — ADR-0016 §6) in
 * ascending `createdAt` order — the ranking-≠-chronology signal (§9). */
function chronologicalIndex(model: DebateViewModel): string {
	const labelled = model.posts.map((p, i) => ({
		label: `post-${i + 1}`,
		createdAt: p.createdAt,
	}));
	labelled.sort((a, b) => (a.createdAt < b.createdAt ? -1 : 1));
	return `[${labelled.map((x) => x.label).join(", ")}]`;
}

// ── Block 3a — Summary (deterministic, field-derived — debate-export.md §6) ───

function statusPhrase(status: string, outcome: string | null): string {
	switch (status.toLowerCase()) {
		case "open":
			return "open and unresolved";
		case "resolved":
			return `resolved ${outcome ?? ""}`.trim();
		case "voided":
			return "voided";
		case "resolving":
			return "resolving";
		case "closed":
			return "closed (awaiting resolution)";
		case "frozen":
			return "frozen";
		default:
			return status.toLowerCase();
	}
}

function summaryOrientation(
	model: DebateViewModel,
	meta: ExportMarketMeta,
): string {
	const m = model.market;
	const priceWord = isTerminalPrice(m.status) ? "final" : "current";
	const pricePhrase = m.pricing
		? `with the ${priceWord} price at ${formatPercent(m.pricing.yes)} YES / ${formatPercent(m.pricing.no)} NO`
		: "with no market price yet";
	return (
		`This debate asks: ${m.title} It is currently ${statusPhrase(m.status, meta.outcome)}, ${pricePhrase}. ` +
		`${meta.participants} participants have staked ${formatDharmaGrouped(meta.totalStakeDharma)} Đ across ${model.posts.length} posts and ${replyCount(model)} replies.`
	);
}

/** The single highest-ranked NON-removed post on a side, rendered by title +
 * pseudonym + stake; falls through on removal / absence (§6). */
function topArgumentSentence(
	model: DebateViewModel,
	side: "YES" | "NO",
): string {
	const onSide = model.posts.filter((p) => p.sideAtPostTime === side);
	if (onSide.length === 0) {
		return `No ${side} argument has been posted yet.`;
	}
	const top = onSide.find((p): p is NonRemovedPost => !p.removed);
	if (top === undefined) {
		return `The leading ${side} argument was removed by a moderator.`;
	}
	return `The most heavily backed ${side} argument is "${top.title}" (${top.author.pseudonym}, ${formatDharmaGrouped(top.authorStake)} Đ).`;
}

function summaryTopArguments(model: DebateViewModel): string {
	return `${topArgumentSentence(model, "YES")} ${topArgumentSentence(model, "NO")}`;
}

// ── Block 3b — Contents ──────────────────────────────────────────────────────

function contentsLine(post: DebatePost, rank: number): string {
	const head = `${rank}. Post ${rank} — ${post.sideAtPostTime} —`;
	if (post.removed) {
		return `${head} [removed by moderator]`;
	}
	return `${head} "${post.title}" (${post.author.pseudonym}, ${formatDharmaGrouped(post.authorStake)} Đ)`;
}

// ── Block 4 — Market header (7a) ─────────────────────────────────────────────

function inBodyStatus(status: string, meta: ExportMarketMeta): string {
	if (status === "Open") {
		return "Open (unresolved)";
	}
	if (status === "Resolved") {
		const reason = meta.resolutionReason ? ` — ${meta.resolutionReason}` : "";
		return `Resolved — outcome: ${meta.outcome ?? ""}${reason}`;
	}
	if (status === "Voided") {
		const reason = meta.resolutionReason ? ` — ${meta.resolutionReason}` : "";
		return `Voided${reason}`;
	}
	return status;
}

function marketHeader(model: DebateViewModel, meta: ExportMarketMeta): string {
	const m = model.market;
	const priceLabel = isTerminalPrice(m.status)
		? "Final price"
		: "Current price";
	const lines = [`- **Question:** ${m.title}`];
	if (m.description !== null) {
		lines.push(`- **Resolution criteria:** ${m.description}`);
	}
	lines.push(
		`- **Status:** ${inBodyStatus(m.status, meta)}`,
		m.pricing
			? `- **${priceLabel}:** ${formatPercent(m.pricing.yes)} YES / ${formatPercent(m.pricing.no)} NO`
			: `- **${priceLabel}:** not yet priced`,
		`- **Total staked:** ${formatDharmaGrouped(meta.totalStakeDharma)} Đ`,
		`- **Posts:** ${model.posts.length} · **Replies:** ${replyCount(model)} · **Participants:** ${meta.participants}`,
	);
	return lines.join("\n");
}

// ── Block 4 — Post / reply nodes (7c / 7d / 7e) ──────────────────────────────

function aggregateLine(agg: ReplyAggregate): string {
	const support =
		agg.supportCount > 0
			? `${agg.supportCount} support (${formatDharmaGrouped(agg.supportDharma)} Đ)`
			: `${agg.supportCount} support`;
	const counter =
		agg.counterCount > 0
			? `${agg.counterCount} counter (${formatDharmaGrouped(agg.counterDharma)} Đ)`
			: `${agg.counterCount} counter`;
	return `${support} · ${counter}`;
}

function rankInThread(group: "support" | "counter", index: number): string {
	if (index === 0) {
		return group === "support" ? "top support" : "top counter";
	}
	return `${group} reply ${index + 1}`;
}

function replyBlock(
	reply: DebateReply,
	parent: DebatePost,
	parentRank: number,
	n: number,
	group: "support" | "counter",
	index: number,
): string {
	const relation = reply.side === parent.sideAtPostTime ? "Support" : "Counter";
	const relationPhrase =
		relation === "Support"
			? "Support (same side as the post)"
			: "Counter (opposite side from the post)";
	const repliesTo = `Post ${parentRank}${parent.removed ? " (removed)" : ""}`;
	const common = [
		`- **Replies to:** ${repliesTo}`,
		`- **Side:** ${reply.side}`,
		`- **Relation:** ${relationPhrase}`,
		`- **Rank in thread:** ${rankInThread(group, index)}`,
	];
	if (reply.removed) {
		const heading = `#### Reply ${parentRank}.${n} — ${relation} (${reply.side}) — [removed by moderator]`;
		const bullets = [
			...common,
			"- **Status:** removed by moderator — argument text, author, and stake withheld",
			`- **Time:** ${timeUtc(reply.createdAt)}`,
		].join("\n");
		const note =
			"*[This reply was removed by a moderator. Its text, author, and stake are not shown.]*";
		return [heading, bullets, note].join("\n\n");
	}
	const heading = `#### Reply ${parentRank}.${n} — ${relation} (${reply.side}) — ${reply.author.pseudonym}`;
	const bullets = [
		...common,
		`- **Stake:** ${formatDharmaGrouped(reply.stake)} Đ`,
		`- **Entry price:** ${price2(reply.entryPrice)}`,
		`- **Author status:** ${authorStatus(reply.marker)}`,
		`- **Time:** ${timeUtc(reply.createdAt)}`,
	].join("\n");
	return [heading, bullets, reply.body].join("\n\n");
}

function postGroup(post: DebatePost, rank: number, totalPosts: number): string {
	const segments: string[] = [];
	if (post.removed) {
		segments.push(
			`### Post ${rank} — ${post.sideAtPostTime} — [removed by moderator]`,
			[
				`- **Rank:** ${rank} of ${totalPosts}`,
				`- **Side:** ${post.sideAtPostTime}`,
				"- **Status:** removed by moderator — argument text, author, and stake withheld",
				`- **Time:** ${timeUtc(post.createdAt)}`,
			].join("\n"),
			"*[This argument was removed by a moderator. Its text, author, and stake are not shown. The replies below remain part of the debate.]*",
		);
	} else {
		segments.push(
			`### Post ${rank} — ${post.sideAtPostTime} — ${post.title}`,
			[
				`- **Rank:** ${rank} of ${totalPosts}`,
				`- **Side:** ${post.sideAtPostTime}`,
				`- **Author:** ${post.author.pseudonym}`,
				`- **Stake:** ${formatDharmaGrouped(post.authorStake)} Đ`,
				`- **Entry price:** ${price2(post.entryPrice)}`,
				`- **Support / Counter:** ${aggregateLine(post.aggregate)}`,
				`- **Author status:** ${authorStatus(post.marker)}`,
				`- **Time:** ${timeUtc(post.createdAt)}`,
			].join("\n"),
			post.body,
		);
	}
	// Replies: Support group first, then Counter — continuous `{post}.{n}`.
	let n = 0;
	post.replies.support.forEach((reply, i) => {
		n += 1;
		segments.push(replyBlock(reply, post, rank, n, "support", i));
	});
	post.replies.counter.forEach((reply, i) => {
		n += 1;
		segments.push(replyBlock(reply, post, rank, n, "counter", i));
	});
	return segments.join("\n\n");
}

// ── Assembly ─────────────────────────────────────────────────────────────────

export function serializeDebateExport(input: {
	model: DebateViewModel;
	meta: ExportMarketMeta;
	context: string;
	exportedAt: string;
}): string {
	const { model, meta, context, exportedAt } = input;
	const totalPosts = model.posts.length;

	const parts: string[] = [
		frontMatter(model, meta, exportedAt),
		context,
		`# Debate — ${model.market.title}`,
		"## Summary",
		summaryOrientation(model, meta),
		summaryTopArguments(model),
		"## Contents",
		model.posts.map((p, i) => contentsLine(p, i + 1)).join("\n"),
		"## Market",
		marketHeader(model, meta),
	];

	model.posts.forEach((post, i) => {
		parts.push("---", postGroup(post, i + 1, totalPosts));
	});
	parts.push("---", FOOTER);

	return `${parts.join("\n\n")}\n`;
}
