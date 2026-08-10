// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { EMPTY_COPY, EmptyState } from "@/components/discovery/EmptyState";
import { ERROR_COPY, ErrorState } from "@/components/discovery/ErrorState";
import {
	LOADING_COPY,
	LoadingSkeleton,
} from "@/components/discovery/LoadingSkeleton";
import { DISCOVERY_GRID_SIZE } from "@/server/config/limits";

/**
 * UI.A4 Slice 5 (plan §2 row 5 / §5 table) — the design-language §4.10 rule:
 * loading/empty/error ship WITH the surface, render-tested. Copy is the
 * OQ-6 web-authored batch, carried VERBATIM as exported consts on the
 * components; tests assert THROUGH the imported consts and never re-type a
 * final string (plan §6 — stable `data-testid` + const, no copy invention
 * in tests).
 */

afterEach(cleanup);

describe("UI.A4 §5 — surface states (OQ-6 copy verbatim)", () => {
	it("render::empty-state-copy", () => {
		render(<EmptyState />);
		expect(screen.getByTestId("discovery-empty")).toBeTruthy();
		// Title + body EXACTLY the exported OQ-6 copy (asserted via the
		// imported const — never re-typed here).
		expect(screen.getByText(EMPTY_COPY.title).textContent).toBe(
			EMPTY_COPY.title,
		);
		expect(screen.getByText(EMPTY_COPY.body).textContent).toBe(EMPTY_COPY.body);
	});

	it("render::loading-skeleton", () => {
		const { container } = render(<LoadingSkeleton />);
		expect(screen.getByTestId("discovery-loading")).toBeTruthy();
		// The OQ-6 loading line via the exported const (the U+2026 ellipsis
		// rides the const — this file never types it).
		expect(screen.getByText(LOADING_COPY).textContent).toBe(LOADING_COPY);
		// At least one shadcn Skeleton card placeholder (`data-slot` is the
		// shadcn primitive marker, AGENTS.md §8).
		expect(
			container.querySelectorAll('[data-slot="skeleton"]').length,
		).toBeGreaterThanOrEqual(1);
	});

	it("render::error-state-copy-and-reload", () => {
		// R4 (post-run web ruling, 2026-07-18): the action is LIVE — the
		// handler-less render (exactly how the page RSC mounts it) must
		// reload the page on click; the inert-button residual is discharged.
		// Observation seam: `window.location` AND its `reload` are
		// [LegacyUnforgeable] in jsdom (own, non-configurable — probed; no
		// spy can attach), so the pin observes the REAL call end-to-end:
		// jsdom's virtual console emits "Not implemented: navigation …" to
		// console.error when reload() actually fires. An inert button emits
		// nothing — the assertion discriminates.
		const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
		try {
			render(<ErrorState />);
			expect(screen.getByTestId("discovery-error")).toBeTruthy();
			expect(screen.getByText(ERROR_COPY.title).textContent).toBe(
				ERROR_COPY.title,
			);
			expect(screen.getByText(ERROR_COPY.body).textContent).toBe(
				ERROR_COPY.body,
			);
			// The reload button's ACCESSIBLE NAME is the action copy…
			const button = screen.getByRole("button", { name: ERROR_COPY.action });
			// …no navigation attempt before the click…
			const navAttempts = () =>
				errorSpy.mock.calls.filter((args) =>
					args.some((a) => String(a).includes("Not implemented: navigation")),
				).length;
			expect(navAttempts()).toBe(0);
			// …and clicking it invokes the real window.location.reload().
			fireEvent.click(button);
			expect(navAttempts()).toBe(1);
		} finally {
			errorSpy.mockRestore();
		}
	});
});

/**
 * DISCOVERY-COMPLETE C9 / founder ruling R9 — Empty and Error reconcile to the
 * W2.11 **P1** block, ONE shape for both
 * (`DESIGN_W2_11_state-kit_mockup-v0_1.html:80-86`).
 *
 * ⚠ Recorded, not silently resolved: W2.11 also lists "empty-Discovery" and
 * "per-surface error panels (T2)" under *Killed by ruling* (`:463`). SPEC.1 §22
 * MANDATES the Discovery empty state and the surface ships an error panel, so R9
 * — which reconciles both TO P1 rather than deleting them — supersedes that line
 * for Discovery, in the same motion R8 supersedes T1. Stated in the canon
 * amendment (C10) so the register is not left holding a contradiction.
 */
describe("V46 / R9 — Empty and Error are the same P1 block", () => {
	const P1 = [
		"min-h-[148px]",
		"rounded-[var(--r)]",
		"bg-n0",
		"gap-[10px]",
		"p-6",
		"[border:var(--hairline)]",
		"items-center",
		"justify-center",
		"text-center",
	];

	it("empty-adopts-the-P1-panel", () => {
		render(<EmptyState />);
		const cls =
			screen.getByTestId("discovery-empty").getAttribute("class") ?? "";
		for (const token of P1) {
			expect(cls).toContain(token);
		}
	});

	it("error-adopts-the-SAME-P1-panel", () => {
		render(<ErrorState />);
		const cls =
			screen.getByTestId("discovery-error").getAttribute("class") ?? "";
		for (const token of P1) {
			expect(cls).toContain(token);
		}
	});

	it("both-carry-the-same-msg-and-sub-type-tiers", () => {
		// `.msg` 13.5px n6 capped at 320px; `.sub` 12px n4.
		for (const [Comp, copy] of [
			[EmptyState, EMPTY_COPY],
			[ErrorState, ERROR_COPY],
		] as const) {
			render(<Comp />);
			const msg = screen.getByText(copy.title);
			expect(msg.getAttribute("class")).toContain("text-[13.5px]");
			expect(msg.getAttribute("class")).toContain("text-n6");
			expect(msg.getAttribute("class")).toContain("max-w-[320px]");
			const sub = screen.getByText(copy.body);
			expect(sub.getAttribute("class")).toContain("text-[12px]");
			expect(sub.getAttribute("class")).toContain("text-n4");
			cleanup();
		}
	});

	it("the-single-CTA-is-P1-shaped-and-keeps-its-V47-state-slots", () => {
		render(<ErrorState />);
		const cls =
			screen
				.getByRole("button", { name: ERROR_COPY.action })
				.getAttribute("class") ?? "";
		// P1's `.cta`.
		expect(cls).toContain("text-[12px]");
		expect(cls).toContain("font-semibold");
		expect(cls).toContain("bg-n0");
		expect(cls).toContain("rounded-(--r-chip)");
		expect(cls).toContain("px-[14px]");
		expect(cls).toContain("py-2");
		expect(cls).toContain("[border:1px_solid_var(--color-ink)]");
		// V47's ratified interaction slots survive the reshape — this is the only
		// keyboard-reachable control on the surface, so losing the focus ring
		// would be a regression, not a restyle.
		expect(cls).toContain("hover:bg-(--state-hover-fill)");
		expect(cls).toContain("focus-visible:shadow-(--state-focus-ring)");
		expect(cls).toContain("active:bg-(--state-pressed-fill)");
		// `--dur-hover` is a COMPOUND value, so it must ride the arbitrary
		// `[transition:…]` form — a `duration-*` utility emits an invalid
		// transition-duration.
		expect(cls).toContain("[transition:all_var(--dur-hover)]");
		expect(cls).not.toContain("duration-");
	});

	it("P7-block-count-is-sourced-from-DISCOVERY_GRID_SIZE", () => {
		// R8 / C10. The count was hard-coded to FOUR while the grid renders up to
		// EIGHT, so the skeleton was reserving space for a layout that does not
		// exist. Asserting against the imported constant — never a literal — is
		// what makes the two impossible to diverge again.
		const { container } = render(<LoadingSkeleton />);
		const blocks = container.querySelectorAll("[data-loading-block]");
		// One hero band + one block per grid slot.
		expect(blocks.length).toBe(DISCOVERY_GRID_SIZE + 1);
	});

	it("P7-blocks-keep-the-shadcn-skeleton-marker", () => {
		// `LoadingBlock` marks itself with `data-loading-block` rather than
		// overriding `data-slot`. The first draft DID override it, which silently
		// dropped `[data-slot="skeleton"]` from every block — caught by the
		// pre-existing assertion above, and pinned here so it cannot come back.
		const { container } = render(<LoadingSkeleton />);
		const blocks = [...container.querySelectorAll("[data-loading-block]")];
		expect(blocks.length).toBeGreaterThan(0);
		for (const block of blocks) {
			expect(block.getAttribute("data-slot")).toBe("skeleton");
		}
	});

	it("empty-has-NO-cta", () => {
		// P1's CTA is OPTIONAL, and zero open markets gives the visitor nothing
		// to act on — the copy says markets appear here as they open.
		const { container } = render(<EmptyState />);
		expect(container.querySelectorAll("button, a").length).toBe(0);
	});
});
