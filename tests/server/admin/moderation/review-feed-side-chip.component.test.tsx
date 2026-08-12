// @vitest-environment jsdom

import { cleanup, render } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

/**
 * POLISH.8 S-2 (delta D28 / CC-9) — PIN the hand-rolled side chip in the admin
 * review feed. This test does NOT consolidate it and must never be "fixed" by
 * wiring `SideBadge` in: the chip STAYS hand-rolled by founder ruling, and
 * PRIMITIVES-2 D5's zero-call-sites guard depends on it staying unwired
 * (H-P8-2). This file is the thing that makes the duplication safe to keep.
 *
 * WHY IT EXISTS. `tests/unit/design/side-pole-binding.test.ts` carries a
 * DECLARED EXCLUSION for `src/app/(admin)/**`, so the participant pole guard
 * cannot see this chip. It is the THIRD surviving side-chip implementation and
 * the one the operator reads sides from while moderating — correct today, with
 * nothing on disk going red if it drifts. Two of the three participant
 * hand-rolls had already INVERTED the pole on live surfaces before
 * DISCOVERY-COMPLETE C4/C4b caught them, so drift here is a demonstrated
 * failure mode, not a hypothetical one.
 *
 * BOTH POLES ARE ASSERTED, deliberately. A YES-only test passes on an inverted
 * NO panel — that is exactly how the last live INV-3 inversion survived a full
 * PR with tests. Each case additionally asserts the OPPOSITE pole is ABSENT, so
 * a chip that renders one pole for both sides cannot pass either — and, since
 * @code-reviewer M-1, the FOREGROUND token too: pinning only the background let
 * a black-on-black chip pass green.
 *
 * The REAL `ReviewFeed` is rendered — never a reassembled lookalike (V-1).
 * Harness precedent: `review-feed.component.test.tsx` in this directory (jsdom
 * + @testing-library/react; NO @testing-library/jest-dom, so assertions are
 * plain DOM). ReviewFeed's two runtime deps are mocked: the "use server"
 * `moderateComment` and `next/navigation`'s `useRouter`. `formatDharma` is left
 * REAL — it is a pure formatter and re-hand-rolling Đ would fail
 * `no-raw-dharma-render.test.ts`, which does scan `(admin)`.
 */

vi.mock("@/server/admin/moderation/act", () => ({
	moderateComment: vi.fn(async () => ({ ok: true, data: {} })),
}));
vi.mock("next/navigation", () => ({
	useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
}));

import {
	ReviewFeed,
	type ReviewFeedRowView,
} from "@/app/(admin)/admin/moderation/_components/ReviewFeed";

const BODY = "the argument body that proves the row actually rendered";

function makeRow(side: "YES" | "NO"): ReviewFeedRowView {
	return {
		// Distinct per side so a mixed feed carries no duplicate React key.
		id:
			side === "YES"
				? "00000000-0000-0000-0000-000000000001"
				: "00000000-0000-0000-0000-000000000002",
		kind: "post",
		parent: null,
		marketSlug: "a-market",
		marketStatus: "Open",
		side,
		body: BODY,
		imageUrl: null,
		hasImage: false,
		authorPseudonym: "somebody",
		authorDharma: "100.000000000000000000",
		authorBanned: false,
		priorFlagCount: 0,
		createdAt: "2026-08-12T00:00:00.000Z",
		categoryScores: [],
	};
}

afterEach(() => {
	cleanup();
});

describe("ReviewFeed side chip — pole binding (D28 / CC-9)", () => {
	it("renders a non-empty row before anything is asserted about it (N1)", () => {
		const { container } = render(<ReviewFeed rows={[makeRow("YES")]} />);
		// Non-vacuity: if the component rendered nothing, every pole assertion
		// below would pass by absence rather than by correctness.
		expect(container.textContent).toContain(BODY);
		expect(container.querySelectorAll("article").length).toBe(1);
	});

	it("binds YES to bg-yes, and renders no NO pole", () => {
		const { container } = render(<ReviewFeed rows={[makeRow("YES")]} />);

		const yesChip = container.querySelector(".bg-yes");
		expect(yesChip).not.toBeNull();
		expect(yesChip?.textContent?.trim()).toBe("YES");
		// The FOREGROUND pole, not only the background. A chip whose text token
		// matches its own surface renders invisibly — the same defect class S-1
		// fixed one directory away, and this guard was demonstrated GREEN on it
		// before this assertion existed (@code-reviewer M-1).
		expect(yesChip?.className).toContain("text-no");

		// The opposite pole must be ABSENT — this is what fails a chip that
		// hard-codes one pole for both sides.
		expect(container.querySelector(".bg-no")).toBeNull();
	});

	it("binds NO to bg-no, and renders no YES pole", () => {
		const { container } = render(<ReviewFeed rows={[makeRow("NO")]} />);

		const noChip = container.querySelector(".bg-no");
		expect(noChip).not.toBeNull();
		expect(noChip?.textContent?.trim()).toBe("NO");
		expect(noChip?.className).toContain("text-yes");

		expect(container.querySelector(".bg-yes")).toBeNull();
	});

	it("keeps the two poles distinct across a mixed feed", () => {
		// A swap mutation that inverted BOTH branches symmetrically would still
		// satisfy a per-row count; this pins WHICH label sits on WHICH pole when
		// both are on screen at once.
		const { container } = render(
			<ReviewFeed rows={[makeRow("YES"), makeRow("NO")]} />,
		);

		expect(container.querySelector(".bg-yes")?.textContent?.trim()).toBe("YES");
		expect(container.querySelector(".bg-no")?.textContent?.trim()).toBe("NO");
	});
});
