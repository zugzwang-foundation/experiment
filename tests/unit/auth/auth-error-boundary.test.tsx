// @vitest-environment jsdom

import { readFileSync } from "node:fs";
import { join } from "node:path";

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import AuthError from "@/app/(auth)/error";

/**
 * POLISH.7a D20 (R-C) — the `(auth)` route-group error boundary.
 *
 * Two properties are pinned, and the second is the one that matters on a
 * signed-out auth surface: NOTHING from the thrown error reaches the DOM. The
 * value can carry a DB error, a cookie-verification detail or a Better Auth
 * internal, and a boundary that renders `error.message` "to be helpful" is how
 * that leaks. `not.toContain` alone would pass vacuously if the render broke,
 * so each absence assertion sits beside a positive control that proves the
 * render happened and the probe strings were reachable (§8.1 N3).
 */

const read = (rel: string) => readFileSync(join(process.cwd(), rel), "utf8");

afterEach(cleanup);

function thrown() {
	const err = new Error("SECRET_DB_DETAIL_pg_connection_refused") as Error & {
		digest?: string;
	};
	err.digest = "SECRET_DIGEST_9f2c1a";
	err.stack = "SECRET_STACK_FRAME at onboarding/page.tsx:55";
	err.cause = "SECRET_CAUSE_onboarding_ref_invalid";
	return err;
}

describe("(auth) error boundary — D20", () => {
	it("renders the family's copy and the reset affordance", () => {
		render(<AuthError error={thrown()} reset={() => {}} />);
		const root = screen.getByTestId("auth-error");
		expect(root.querySelector("h1")?.textContent).toBe("Something went wrong.");
		expect(root.querySelector("p")?.textContent).toBe(
			"An unexpected error stopped this page from loading.",
		);
		expect(root.querySelector("button")?.textContent).toBe("Try again");
	});

	it("calls reset when the affordance is used", () => {
		const reset = vi.fn();
		render(<AuthError error={thrown()} reset={reset} />);
		fireEvent.click(screen.getByText("Try again"));
		expect(reset).toHaveBeenCalledTimes(1);
	});

	it("leaks NOTHING from the error — message, digest, stack or cause", () => {
		const { container } = render(
			<AuthError error={thrown()} reset={() => {}} />,
		);
		const html = container.innerHTML;

		// Positive control first: the render really produced content, so the four
		// absence assertions below are not passing on an empty string.
		expect(html).toContain("Something went wrong.");
		expect(html.length).toBeGreaterThan(100);

		for (const secret of [
			"SECRET_DB_DETAIL_pg_connection_refused",
			"SECRET_DIGEST_9f2c1a",
			"SECRET_STACK_FRAME",
			"SECRET_CAUSE_onboarding_ref_invalid",
		]) {
			expect(html).not.toContain(secret);
		}
		// And the second control: those strings ARE distinctive enough to have
		// been found if they had been rendered.
		expect(thrown().message).toContain("SECRET_DB_DETAIL");
	});

	it("declares no container of its own — the (auth) layout owns the box", () => {
		// It renders INSIDE `(auth)/layout.tsx`, which already wraps children in
		// `PageContainer preset="auth"`. A second container here would double the
		// max-width and the padding, and the box is POLISH.1's, not .7a's.
		//
		// ⚠ Asserted on the RENDER, not on the source (§8.1 N4). The first draft
		// of this test grepped the file for "PageContainer" and "max-w-" and went
		// RED on correct code, because the component's own DOCSTRING names both
		// while explaining why it uses neither. A source match cannot tell prose
		// about a container from a container.
		render(<AuthError error={thrown()} reset={() => {}} />);
		const cls = screen.getByTestId("auth-error").getAttribute("class") ?? "";
		for (const axis of [
			/\bmx-auto\b/,
			/\bmax-w-/,
			/\bpx-\d/,
			/\bpy-\d/,
			/\bw-full\b/,
		]) {
			expect(cls, `container axis leaked: ${axis}`).not.toMatch(axis);
		}
		// Positive control: the element really was found and really has classes,
		// so the five absence assertions above are not reading an empty string.
		expect(cls.length).toBeGreaterThan(0);
		// Next requires a Client Component for error.tsx — a genuine source fact
		// with no render-side observable, so it stays a source assertion.
		expect(read("src/app/(auth)/error.tsx")).toContain('"use client"');
	});

	it("no loading.tsx landed beside it — R-C, asserted not assumed", () => {
		// A route-group loading.tsx would blanket the two client pages that render
		// instantly. The omission is a ruling, so it is pinned rather than left to
		// be re-litigated by the next reader.
		expect(() => read("src/app/(auth)/loading.tsx")).toThrow();
	});
});
