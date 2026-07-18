// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { EMPTY_COPY, EmptyState } from "@/components/discovery/EmptyState";
import { ERROR_COPY, ErrorState } from "@/components/discovery/ErrorState";
import {
	LOADING_COPY,
	LoadingSkeleton,
} from "@/components/discovery/LoadingSkeleton";

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
		const onReload = vi.fn();
		const withHandler = render(<ErrorState onReload={onReload} />);
		expect(screen.getByTestId("discovery-error")).toBeTruthy();
		expect(screen.getByText(ERROR_COPY.title).textContent).toBe(
			ERROR_COPY.title,
		);
		expect(screen.getByText(ERROR_COPY.body).textContent).toBe(ERROR_COPY.body);
		// The reload button's ACCESSIBLE NAME is the action copy…
		const button = screen.getByRole("button", { name: ERROR_COPY.action });
		// …and clicking it fires the wired handler exactly once.
		fireEvent.click(button);
		expect(onReload).toHaveBeenCalledTimes(1);
		withHandler.unmount();

		// `onReload` is optional — the state renders without it (no throw).
		render(<ErrorState />);
		expect(screen.getByTestId("discovery-error")).toBeTruthy();
		expect(
			screen.getByRole("button", { name: ERROR_COPY.action }),
		).toBeTruthy();
	});
});
