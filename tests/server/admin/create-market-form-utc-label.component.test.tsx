// @vitest-environment jsdom

import { cleanup, render } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

/**
 * POLISH.8 S-7 (delta D20) — the resolution-deadline field states UTC.
 *
 * The PARSE is spec-ratified and is NOT touched here. SPEC.1 §15 F-ADMIN-1:
 * "The admin datetime-local input is minute-granular and parsed as UTC". The
 * defect was that the FORM never said so: a `datetime-local` widget presents
 * the operator's local wall clock, so an operator in IST typing 23:59 committed
 * a deadline 5h30m away from what they read back. Label-only fix.
 *
 * The assertion is on the RENDERED OUTPUT, not on a source grep — a source
 * match reads text ABOUT a file and false-alarms on correct code (V-4).
 */

vi.mock("@/server/admin/markets/create", () => ({
	createMarketAction: vi.fn(async () => ({ ok: true, data: {} })),
}));
vi.mock("next/navigation", () => ({
	useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
}));

import { CreateMarketForm } from "@/app/(admin)/admin/markets/new/create-market-form";

afterEach(() => {
	cleanup();
});

describe("CreateMarketForm — the deadline field states UTC (D20)", () => {
	it("renders the deadline input at all (N1 non-vacuity)", () => {
		const { container } = render(<CreateMarketForm />);
		// If the field did not render, the label assertion below would pass or
		// fail for the wrong reason.
		const input = container.querySelector(
			'input[name="resolutionDeadline"][type="datetime-local"]',
		);
		expect(input).not.toBeNull();
	});

	it("labels the deadline field UTC in the rendered output", () => {
		const { container } = render(<CreateMarketForm />);
		const input = container.querySelector(
			'input[name="resolutionDeadline"]',
		) as HTMLInputElement | null;
		expect(input).not.toBeNull();

		// The label is the <label> element wrapping the input — assert the UTC
		// marker sits on THAT label, not merely somewhere on the page.
		const label = input?.closest("label");
		expect(label).not.toBeNull();
		expect(label?.textContent).toContain("Resolution deadline");
		expect(label?.textContent).toContain("UTC");
	});

	it("POSITIVE CONTROL — the probe does not report UTC on a field that lacks it", () => {
		// The same closest("label") + textContent probe run against the SLUG
		// field, which legitimately carries no UTC marker. Without this, a probe
		// that matched the whole document would pass the assertion above even if
		// "UTC" appeared nowhere near the deadline field.
		const { container } = render(<CreateMarketForm />);
		const slug = container.querySelector('input[name="slug"]');
		expect(slug).not.toBeNull();
		expect(slug?.closest("label")?.textContent).not.toContain("UTC");
	});
});
