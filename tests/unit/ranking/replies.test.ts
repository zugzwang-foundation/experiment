import { describe, expect, it } from "vitest";
import type { RankedReplies, ReplySubstrate } from "@/lib/ranking";
import { rankReplies, twoSlot } from "@/lib/ranking";
import { DEFAULT_RANKING_CONFIG } from "@/lib/ranking.config";

// DEBATE.8 §5.6 tests-first (TDD RED) — reply ranking (RANKING.md §7,
// REPLY_DEPTH_MAX = 1). The value imports `rankReplies` / `twoSlot` WILL fail to
// resolve until `@/lib/ranking` lands — that RED state is the goal (plan scope
// item 7). One subject per file (AGENTS.md §9): this file = reply ordering
// (`rankReplies` partition+sort, `twoSlot` two-slot default).
//
// Asserts: §7 (partition Support/Counter relative to the PARENT side; stake
// descending within side; earlier-wins tie at equal stake), §7.1 (two-slot
// edges: one side empty → two from the other; single reply → it; zero → []).
//
// Decimal posture (CLAUDE.md §2): reply stake is a decimal STRING.

const CFG = DEFAULT_RANKING_CONFIG;

function reply(
	over: Partial<ReplySubstrate> & Pick<ReplySubstrate, "id">,
): ReplySubstrate {
	return {
		side: "YES",
		stake: "50",
		createdAt: new Date("2026-09-01T00:00:00.000Z"),
		priceAtBet: "0.5",
		...over,
	};
}

// ── Partition + stake-desc-within-side (§7) ──────────────────────────────────
describe("ranking::replies-partition-and-stake-desc (§7)", () => {
	it("partitions Support/Counter relative to the parent side and sorts stake desc", () => {
		// Parent side YES → a YES reply is Support, a NO reply is Counter.
		const sHi = reply({ id: "r-s-hi", side: "YES", stake: "300" });
		const sLo = reply({ id: "r-s-lo", side: "YES", stake: "100" });
		const cHi = reply({ id: "r-c-hi", side: "NO", stake: "500" });
		const cLo = reply({ id: "r-c-lo", side: "NO", stake: "200" });
		const ranked: RankedReplies = rankReplies([sLo, cHi, sHi, cLo], "YES", CFG);
		// Support = the YES replies, stake desc.
		expect(ranked.support.map((r) => r.id)).toEqual(["r-s-hi", "r-s-lo"]);
		// Counter = the NO replies, stake desc.
		expect(ranked.counter.map((r) => r.id)).toEqual(["r-c-hi", "r-c-lo"]);
	});

	it("inverts Support/Counter when the parent side is NO", () => {
		// Parent side NO → a NO reply is Support, a YES reply is Counter.
		const noReply = reply({ id: "r-no", side: "NO", stake: "300" });
		const yesReply = reply({ id: "r-yes", side: "YES", stake: "300" });
		const ranked = rankReplies([yesReply, noReply], "NO", CFG);
		expect(ranked.support.map((r) => r.id)).toEqual(["r-no"]);
		expect(ranked.counter.map((r) => r.id)).toEqual(["r-yes"]);
	});

	it("earlier-wins at equal stake (first-posted ranks higher)", () => {
		// Two YES replies at equal stake — earlier createdAt ranks higher; the
		// later one follows. (Uniform tiebreak with §3.4 — earlier-wins, never
		// newer-first.)
		const earlier = reply({
			id: "r-late-id",
			side: "YES",
			stake: "200",
			createdAt: new Date("2026-09-01T00:00:00.000Z"),
		});
		const later = reply({
			id: "r-early-id",
			side: "YES",
			stake: "200",
			createdAt: new Date("2026-09-02T00:00:00.000Z"),
		});
		const ranked = rankReplies([later, earlier], "YES", CFG);
		expect(ranked.support.map((r) => r.id)).toEqual([
			"r-late-id", // earlier createdAt wins despite the larger id
			"r-early-id",
		]);
	});
});

// ── Two-slot default + §7.1 edges ────────────────────────────────────────────
describe("ranking::replies-two-slot (§7.1)", () => {
	it("surfaces the best Support and the best Counter normally", () => {
		const sHi = reply({ id: "r-s-hi", side: "YES", stake: "300" });
		const sLo = reply({ id: "r-s-lo", side: "YES", stake: "100" });
		const cHi = reply({ id: "r-c-hi", side: "NO", stake: "500" });
		const cLo = reply({ id: "r-c-lo", side: "NO", stake: "200" });
		const ranked = rankReplies([sLo, cHi, sHi, cLo], "YES", CFG);
		// Best of each side: top Support + top Counter.
		expect(twoSlot(ranked).map((r) => r.id)).toEqual(["r-s-hi", "r-c-hi"]);
	});

	it("one side empty ⇒ renders the two best from the other side", () => {
		// No Counter replies → two best Support (by stake desc).
		const s1 = reply({ id: "r-1", side: "YES", stake: "300" });
		const s2 = reply({ id: "r-2", side: "YES", stake: "200" });
		const s3 = reply({ id: "r-3", side: "YES", stake: "100" });
		const ranked = rankReplies([s3, s1, s2], "YES", CFG);
		expect(twoSlot(ranked).map((r) => r.id)).toEqual(["r-1", "r-2"]);
	});

	it("a single reply ⇒ renders just that one (no expansion)", () => {
		const only = reply({ id: "r-only", side: "YES", stake: "100" });
		const ranked = rankReplies([only], "YES", CFG);
		expect(twoSlot(ranked).map((r) => r.id)).toEqual(["r-only"]);
	});

	it("zero replies ⇒ renders nothing", () => {
		const ranked = rankReplies([], "YES", CFG);
		expect(twoSlot(ranked)).toEqual([]);
	});
});
