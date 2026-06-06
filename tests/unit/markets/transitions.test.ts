import { describe, expect, it } from "vitest";

import { marketStatusEnum } from "@/db/schema/markets";
import type { MarketStatus } from "@/server/markets/transitions";
import {
	assertDeadlineNotExtended,
	canTransition,
	closeOnDeadline,
	transition,
} from "@/server/markets/transitions";

// ENGINE.4 §5.6 tests-first (TDD RED) — the market state-machine contract.
// Greenfield value imports from `@/server/markets/transitions` WILL fail to
// resolve until the module lands; that unresolved-import RED state is the goal
// (plan §7, execution-checklist step 2). `import type { MarketStatus }` is
// stripped by esbuild, so it does not soften the RED — the value imports
// (`canTransition`/`transition`/`closeOnDeadline`/`assertDeadlineNotExtended`)
// are what fire it.
//
// One subject per file: this file = the transition module (AGENTS.md §9
// `<subject>.test.ts`).
//
// The legal set is an INDEPENDENT transcription of the SPEC.1 §6.1 charter —
// exactly 8 directed edges (LEGAL_EDGES below). It is hardcoded here, NOT
// derived from the implementation (deriving would be circular). The matrix
// asserts `canTransition` over the full 7×7 = 49 ordered-pair domain: true for
// exactly those 8 edges, false for all 41 others. This is the ENTIRE input
// domain enumerated — strictly stronger than fast-check sampling, which would
// only re-draw from the same 49 pairs (plan §7 rules fast-check OUT; the domain
// is finite and tiny).
//
// Critical rejects pinned by the matrix: Resolving→Voided is FALSE (the only
// exit from Resolving is Resolved); Frozen is absorbing (out-degree 0).

// The runtime status universe, mirrored from the built DB pgEnum so the test's
// status set stays locked to `market_status` (cannot silently drift). The 7
// PascalCase values: Draft, Open, Closed, Resolving, Resolved, Voided, Frozen.
const STATUSES: readonly MarketStatus[] = marketStatusEnum.enumValues;

// Independent ground truth — the 8 legal directed edges of SPEC.1 §6.1, hand
// transcribed. Order matters; [from, to].
const LEGAL_EDGES: readonly (readonly [MarketStatus, MarketStatus])[] = [
	["Draft", "Open"], // 1
	["Open", "Closed"], // 2
	["Open", "Voided"], // 3
	["Closed", "Resolving"], // 4
	["Closed", "Voided"], // 5
	["Resolving", "Resolved"], // 6
	["Resolved", "Frozen"], // 7
	["Voided", "Frozen"], // 8
];

const isLegalEdge = (from: MarketStatus, to: MarketStatus): boolean =>
	LEGAL_EDGES.some(([f, t]) => f === from && t === to);

// Three distinct UTC instants around the fixed deadline, for the clock-guard
// boundary: BEFORE < DEADLINE == AT < AFTER. AT_DEADLINE is a separate Date
// object at the same instant, so the == boundary exercises value (getTime)
// equality, not reference equality.
const DEADLINE = new Date("2026-11-05T23:59:00.000Z");
const BEFORE_DEADLINE = new Date("2026-11-05T23:58:00.000Z");
const AT_DEADLINE = new Date("2026-11-05T23:59:00.000Z");
const AFTER_DEADLINE = new Date("2026-11-06T00:00:00.000Z");

describe("matrix › legal set equals §6.1", () => {
	for (const from of STATUSES) {
		for (const to of STATUSES) {
			const expected = isLegalEdge(from, to);
			it(`canTransition ${from}→${to} === ${expected}`, () => {
				expect(canTransition(from, to)).toBe(expected);
			});
		}
	}
});

describe("legal", () => {
	it("Draft→Open", () => {
		expect(transition("Draft", "Open")).toEqual({ ok: true, to: "Open" });
	});

	it("Open→Closed", () => {
		expect(transition("Open", "Closed")).toEqual({
			ok: true,
			to: "Closed",
		});
	});

	it("Open→Voided", () => {
		expect(transition("Open", "Voided")).toEqual({
			ok: true,
			to: "Voided",
		});
	});

	it("Closed→Resolving", () => {
		expect(transition("Closed", "Resolving")).toEqual({
			ok: true,
			to: "Resolving",
		});
	});

	it("Closed→Voided", () => {
		expect(transition("Closed", "Voided")).toEqual({
			ok: true,
			to: "Voided",
		});
	});

	it("Resolving→Resolved", () => {
		expect(transition("Resolving", "Resolved")).toEqual({
			ok: true,
			to: "Resolved",
		});
	});

	it("Resolved→Frozen", () => {
		expect(transition("Resolved", "Frozen")).toEqual({
			ok: true,
			to: "Frozen",
		});
	});

	it("Voided→Frozen", () => {
		expect(transition("Voided", "Frozen")).toEqual({
			ok: true,
			to: "Frozen",
		});
	});
});

describe("closeOnDeadline", () => {
	it("now ≥ deadline closes", () => {
		expect(
			closeOnDeadline({
				status: "Open",
				now: AFTER_DEADLINE,
				resolutionDeadline: DEADLINE,
			}),
		).toEqual({ ok: true, to: "Closed" });
	});

	it("now == deadline closes", () => {
		expect(
			closeOnDeadline({
				status: "Open",
				now: AT_DEADLINE,
				resolutionDeadline: DEADLINE,
			}),
		).toEqual({ ok: true, to: "Closed" });
	});

	it("now < deadline → deadline_not_reached", () => {
		expect(
			closeOnDeadline({
				status: "Open",
				now: BEFORE_DEADLINE,
				resolutionDeadline: DEADLINE,
			}),
		).toEqual({ ok: false, reason: "deadline_not_reached" });
	});

	it("non-Open → illegal_edge", () => {
		for (const status of STATUSES) {
			if (status === "Open") {
				continue;
			}
			expect(
				closeOnDeadline({
					status,
					now: AFTER_DEADLINE,
					resolutionDeadline: DEADLINE,
				}),
			).toEqual({ ok: false, reason: "illegal_edge" });
		}
	});
});

describe("named negatives :228–232", () => {
	it("rejects Resolved→Open", () => {
		expect(transition("Resolved", "Open")).toEqual({
			ok: false,
			reason: "illegal_edge",
		});
	});

	it("rejects Frozen→Open", () => {
		expect(transition("Frozen", "Open")).toEqual({
			ok: false,
			reason: "illegal_edge",
		});
	});

	it("rejects Voided→Resolved", () => {
		expect(transition("Voided", "Resolved")).toEqual({
			ok: false,
			reason: "illegal_edge",
		});
	});

	it("rejects Open→Resolved", () => {
		expect(transition("Open", "Resolved")).toEqual({
			ok: false,
			reason: "illegal_edge",
		});
	});

	it("rejects Closed→Resolved", () => {
		expect(transition("Closed", "Resolved")).toEqual({
			ok: false,
			reason: "illegal_edge",
		});
	});

	it("rejects Draft→Voided", () => {
		expect(transition("Draft", "Voided")).toEqual({
			ok: false,
			reason: "illegal_edge",
		});
	});
});

describe("B8 deadline extension", () => {
	it("rejects deadline extension", () => {
		expect(
			assertDeadlineNotExtended({
				current: DEADLINE,
				proposed: AFTER_DEADLINE,
			}),
		).toEqual({ ok: false, reason: "deadline_extension" });
	});

	it("allows non-extension", () => {
		// proposed < current (shrink) — allowed.
		expect(
			assertDeadlineNotExtended({
				current: DEADLINE,
				proposed: BEFORE_DEADLINE,
			}),
		).toEqual({ ok: true });
		// proposed == current (unchanged) — allowed.
		expect(
			assertDeadlineNotExtended({
				current: DEADLINE,
				proposed: AT_DEADLINE,
			}),
		).toEqual({ ok: true });
	});
});

describe("structure", () => {
	it("Frozen absorbing", () => {
		for (const to of STATUSES) {
			expect(canTransition("Frozen", to)).toBe(false);
		}
	});

	it("every non-terminal has ≥1 out-edge", () => {
		for (const from of STATUSES) {
			if (from === "Frozen") {
				continue;
			}
			const hasOutEdge = STATUSES.some((to) => canTransition(from, to));
			expect(hasOutEdge).toBe(true);
		}
	});

	it("legal-edge count == 8", () => {
		let count = 0;
		for (const from of STATUSES) {
			for (const to of STATUSES) {
				if (canTransition(from, to)) {
					count += 1;
				}
			}
		}
		expect(count).toBe(8);
	});
});

describe("totality", () => {
	it("no throw over all 49 typed pairs", () => {
		for (const from of STATUSES) {
			for (const to of STATUSES) {
				expect(() => transition(from, to)).not.toThrow();
			}
		}
	});

	it("transition(f,t).ok === canTransition(f,t) across all 49", () => {
		for (const from of STATUSES) {
			for (const to of STATUSES) {
				expect(transition(from, to).ok).toBe(canTransition(from, to));
			}
		}
	});
});
