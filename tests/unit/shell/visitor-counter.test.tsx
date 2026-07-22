// @vitest-environment jsdom

import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { StrictMode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// UI.13 — the client visitor-counter leaf (SPEC.1 §21.1, design-language
// §4.10 states + W2.11 P5). POST /api/visits on mount + navigation. Three
// states: loading (visitor-before-load) · value (number + eye) · P5 silent
// fallback (dash, never an error). The ref guard fires the POST exactly once
// per pathname even under React strict mode (no double-count).

vi.mock("next/navigation", () => ({ usePathname: () => "/" }));

import { VisitorCounter } from "@/components/shell/VisitorCounter";

const fetchMock = vi.fn();

function deferred<T>() {
	let resolve!: (v: T) => void;
	const promise = new Promise<T>((res) => {
		resolve = res;
	});
	return { promise, resolve };
}

beforeEach(() => {
	vi.stubGlobal("fetch", fetchMock);
	fetchMock.mockReset();
});
afterEach(() => {
	cleanup();
	vi.unstubAllGlobals();
});

describe("UI.13 VisitorCounter — three render states + strict-mode guard", () => {
	it("loading (visitor-before-load) before the POST resolves", () => {
		fetchMock.mockReturnValue(deferred<Response>().promise);
		render(<VisitorCounter />);
		const el = screen.getByTestId("visitor-counter");
		expect(el.getAttribute("data-state")).toBe("loading");
		expect(el.getAttribute("aria-busy")).toBe("true");
	});

	it("value state renders the grouped number + 'visitors' + eye glyph", async () => {
		fetchMock.mockResolvedValue(
			new Response(JSON.stringify({ total: 12480 }), { status: 200 }),
		);
		render(<VisitorCounter />);
		await waitFor(() =>
			expect(
				screen.getByTestId("visitor-counter").getAttribute("data-state"),
			).toBe("value"),
		);
		const el = screen.getByTestId("visitor-counter");
		expect(el.textContent).toContain("12,480");
		expect(el.textContent).toContain("visitors");
		// eye glyph is a decorative svg
		expect(el.querySelector("svg")).not.toBeNull();
	});

	it("P5 silent fallback: total null → '— visitors', never an error", async () => {
		fetchMock.mockResolvedValue(
			new Response(JSON.stringify({ total: null }), { status: 200 }),
		);
		render(<VisitorCounter />);
		await waitFor(() =>
			expect(
				screen.getByTestId("visitor-counter").getAttribute("data-state"),
			).toBe("fallback"),
		);
		const el = screen.getByTestId("visitor-counter");
		expect(el.textContent).toContain("—");
		expect(el.textContent).toContain("visitors");
	});

	it("fetch rejection renders P5, never throws", async () => {
		fetchMock.mockRejectedValue(new Error("network down"));
		render(<VisitorCounter />);
		await waitFor(() =>
			expect(
				screen.getByTestId("visitor-counter").getAttribute("data-state"),
			).toBe("fallback"),
		);
	});

	it("POST fires exactly once per pathname under StrictMode (ref guard)", async () => {
		fetchMock.mockResolvedValue(
			new Response(JSON.stringify({ total: 5 }), { status: 200 }),
		);
		render(
			<StrictMode>
				<VisitorCounter />
			</StrictMode>,
		);
		await waitFor(() =>
			expect(
				screen.getByTestId("visitor-counter").getAttribute("data-state"),
			).toBe("value"),
		);
		expect(fetchMock).toHaveBeenCalledTimes(1);
		expect(fetchMock).toHaveBeenCalledWith(
			"/api/visits",
			expect.objectContaining({ method: "POST" }),
		);
	});
});
