// SEED-1-DUMMY — generate a seed table (SEED-1 §4.4). PURE and SEEDED: the same
// options produce the same table byte-for-byte, so a regenerated table is the
// same table and its keys resume rather than duplicate.
// NEVER import this from src/**.

import {
	AUTHOR_SPEND_CAP,
	rowKey,
	type SeedKind,
	type SeedRow,
	type SeedSide,
	type SeedTable,
	validateTable,
} from "./table";

export interface GenerateOptions {
	readonly runId: string;
	readonly markets: readonly string[];
	/** Account budget. Every label is used before any is reused. */
	readonly users: number;
	readonly postsPerMarket: number;
	/** Share of posts that get one support + one counter (SEED-1 D3). */
	readonly coverage: number;
	/** Share of posts on YES (SEED-1 §4.4 step 1). */
	readonly yesRatio: number;
	/** Share of posts that carry an image (SEED-1 D10). */
	readonly imageRatio: number;
	readonly imageExt: string;
	/** 0 = every row due immediately; otherwise rows are spread over this window. */
	readonly windowMs: number;
	readonly seed: number;
}

/** SEED-1 §4.4 step 2 — most participants bet the floor; a few bet more. */
const POST_STAKE_LADDER = [10, 10, 15, 20, 25, 40] as const;
/** SEED-1 §4.4 step 3 — reply stakes drawn by SIDE, not by role. */
const REPLY_STAKE_BAND: Record<SeedSide, readonly [number, number]> = {
	NO: [90, 130],
	YES: [50, 80],
};

/** mulberry32 — small, seedable, deterministic. Not for anything secret. */
function rng(seed: number): () => number {
	let a = seed >>> 0;
	return () => {
		a = (a + 0x6d2b79f5) >>> 0;
		let t = a;
		t = Math.imul(t ^ (t >>> 15), t | 1);
		t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
		return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
	};
}

function shuffle<T>(items: T[], rand: () => number): T[] {
	for (let i = items.length - 1; i > 0; i--) {
		const j = Math.floor(rand() * (i + 1));
		[items[i], items[j]] = [items[j] as T, items[i] as T];
	}
	return items;
}

function intIn(rand: () => number, lo: number, hi: number): number {
	return lo + Math.floor(rand() * (hi - lo + 1));
}

function body(kind: SeedKind, postNo: number, side: SeedSide): string {
	if (kind === "post") {
		return `[DUMMY SEED] Post ${postNo} on this market (${side}). Dummy seed content, listed in the seed manifest.`;
	}
	const role = kind === "support" ? "Support" : "Counter";
	return `[DUMMY SEED] ${role} on post ${postNo} (${side}). Dummy seed content, listed in the seed manifest.`;
}

interface Slot {
	readonly market: string;
	readonly marketIdx: number;
	readonly kind: SeedKind;
	readonly postNo: number;
	/** 0..1 position within its market's timeline. */
	readonly t: number;
}

export function generateTable(opts: GenerateOptions): SeedTable {
	const rand = rng(opts.seed);

	// ── Per-market timelines, then one global interleave (§4.4 step 6) ─────
	const slots: Slot[] = [];
	const postSide = new Map<string, SeedSide>();
	const postImage = new Set<string>();

	opts.markets.forEach((market, marketIdx) => {
		const n = opts.postsPerMarket;
		const indices = () => Array.from({ length: n }, (_, i) => i + 1);
		const yes = new Set(
			shuffle(indices(), rand).slice(0, Math.round(n * opts.yesRatio)),
		);
		const covered = new Set(
			shuffle(indices(), rand).slice(0, Math.round(n * opts.coverage)),
		);
		for (const p of shuffle(indices(), rand).slice(
			0,
			Math.round(n * opts.imageRatio),
		)) {
			postImage.add(`${market}|${p}`);
		}

		const local: { kind: SeedKind; postNo: number; pos: number }[] = [];
		for (let postNo = 1; postNo <= n; postNo++) {
			postSide.set(`${market}|${postNo}`, yes.has(postNo) ? "YES" : "NO");
			// A post's birth position, and its replies a randomised gap later —
			// some answered quickly, some waiting a long time.
			const birth = postNo * 10 + rand() * 10;
			local.push({ kind: "post", postNo, pos: birth });
			if (covered.has(postNo)) {
				local.push({ kind: "support", postNo, pos: birth + 5 + rand() * 300 });
				local.push({ kind: "counter", postNo, pos: birth + 5 + rand() * 300 });
			}
		}
		local.sort((a, b) => a.pos - b.pos);
		const max = local[local.length - 1]?.pos ?? 1;
		for (const s of local) {
			slots.push({
				market,
				marketIdx,
				kind: s.kind,
				postNo: s.postNo,
				t: s.pos / max,
			});
		}
	});
	// Stable sort: ties keep market order, and within a market the local order.
	slots.sort((a, b) => a.t - b.t);

	// ── Due offsets (sorted, so execution order is due order) ──────────────
	const offsets =
		opts.windowMs > 0
			? slots
					.map(() => Math.floor(rand() * opts.windowMs))
					.sort((a, b) => a - b)
			: slots.map(() => 0);

	// ── Authors (§4.4 step 5) ──────────────────────────────────────────────
	const width = Math.max(4, String(opts.users).length);
	const unused = shuffle(
		Array.from(
			{ length: opts.users },
			(_, i) => `A${String(i + 1).padStart(width, "0")}`,
		),
		rand,
	);
	const used: string[] = [];
	const spend = new Map<string, number>();
	const held = new Map<string, SeedSide>();
	const postAuthor = new Map<string, string>();
	const postKey = new Map<string, string>();
	const seqByMarket = new Map<string, number>();
	let lastAuthor: string | null = null;

	const rows: SeedRow[] = slots.map((slot, i) => {
		const id = `${slot.market}|${slot.postNo}`;
		const parentSide = postSide.get(id) as SeedSide;
		const side: SeedSide =
			slot.kind === "counter"
				? parentSide === "YES"
					? "NO"
					: "YES"
				: parentSide;
		const [lo, hi] = REPLY_STAKE_BAND[side];
		const stake =
			slot.kind === "post"
				? POST_STAKE_LADDER[Math.floor(rand() * POST_STAKE_LADDER.length)]
				: intIn(rand, lo, hi);

		const eligible = (a: string) =>
			a !== lastAuthor &&
			(spend.get(a) ?? 0) + stake <= AUTHOR_SPEND_CAP &&
			(held.get(`${a}|${slot.market}`) ?? side) === side &&
			(slot.kind === "post" || postAuthor.get(id) !== a);

		let author = unused.length > 0 ? (unused.pop() as string) : null;
		if (author !== null) used.push(author);
		for (let tries = 0; author === null && tries < 64; tries++) {
			const pick = used[Math.floor(rand() * used.length)] as string;
			if (eligible(pick)) author = pick;
		}
		author ??= used.find(eligible) ?? null;
		if (author === null) {
			throw new Error(
				`not enough authors: row ${i} (${slot.market} post ${slot.postNo} ${slot.kind}) has no eligible account — raise --users`,
			);
		}

		spend.set(author, (spend.get(author) ?? 0) + stake);
		held.set(`${author}|${slot.market}`, side);
		lastAuthor = author;

		const seq = (seqByMarket.get(slot.market) ?? 0) + 1;
		seqByMarket.set(slot.market, seq);
		const key = rowKey(opts.runId, slot.marketIdx, seq);
		if (slot.kind === "post") {
			postAuthor.set(id, author);
			postKey.set(id, key);
		}

		return {
			key,
			market: slot.market,
			seq,
			postNo: slot.postNo,
			kind: slot.kind,
			side,
			stake: String(stake),
			author,
			body: body(slot.kind, slot.postNo, side),
			parentKey: slot.kind === "post" ? null : (postKey.get(id) as string),
			image:
				slot.kind === "post" && postImage.has(id)
					? `${slot.market}_p${String(slot.postNo).padStart(3, "0")}.${opts.imageExt}`
					: null,
			dueOffsetMs: offsets[i] as number,
		};
	});

	const table: SeedTable = {
		runId: opts.runId,
		markets: [...opts.markets],
		rows,
	};
	const errors = validateTable(table);
	if (errors.length > 0) {
		throw new Error(
			`generated table failed validation (${errors.length}):\n  ${errors.slice(0, 20).join("\n  ")}`,
		);
	}
	return table;
}
