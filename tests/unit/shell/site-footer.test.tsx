// @vitest-environment jsdom

import { readFileSync } from "node:fs";
import { join } from "node:path";

import { cleanup, render } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { SiteFooter } from "@/components/shell/SiteFooter";

/**
 * T3 (SHELL-COMPLETE §7) — the B4 footer, and the mechanical enforcement of
 * SG7's content fence.
 *
 * SG7 is an ALLOW-LIST, not a count. B4 cleared its gate as a source LINK
 * required by ADR-0001 (AGPL-3.0-or-later). Admitting a ToS link, a Privacy
 * link, legal prose, a cookie notice, or navigation would turn it into a
 * different surface — those are `LEGAL.1` / `UI.10` — and voids the gate
 * ruling. This test is the fence: the three required elements must be present
 * and the four forbidden tokens must be absent from BOTH the rendered text and
 * every href.
 *
 * The whitepaper link is PERMITTED by SG7 but conditional on a public URL
 * existing (Q1b), so it is asserted neither present nor absent. It was omitted
 * at execute — no URL was supplied — and recorded as a named deviation.
 */

afterEach(cleanup);

const FORBIDDEN = [/\bterms\b/i, /\bprivacy\b/i, /\bpolicy\b/i, /\btos\b/i];

describe("T3 — site footer content fence (SG7)", () => {
	it("renders-the-three-required-elements", () => {
		const { container } = render(<SiteFooter />);
		const footer = container.querySelector('[data-testid="site-footer"]');
		expect(footer).not.toBeNull();

		const text = footer?.textContent ?? "";

		// 1. The repo URL — the ADR-0001 source affordance, as a real link.
		expect(text).toContain("Source: github.com/zugzwang-foundation/experiment");
		const link = footer?.querySelector(
			'a[href="https://github.com/zugzwang-foundation/experiment"]',
		);
		expect(link).not.toBeNull();

		// 2. The SPDX licence identifier.
		expect(text).toContain("AGPL-3.0-or-later");

		// 3. The copyright line.
		expect(text).toContain("© 2026 The Zugzwang Authors");
	});

	it("admits-none-of-the-forbidden-content", () => {
		const { container } = render(<SiteFooter />);
		const footer = container.querySelector('[data-testid="site-footer"]');

		// Rendered text.
		const text = footer?.textContent ?? "";
		for (const pattern of FORBIDDEN) {
			expect(text).not.toMatch(pattern);
		}

		// Every href — a `/terms` link carrying innocuous label text would slip
		// past a text-only assertion.
		const hrefs = Array.from(footer?.querySelectorAll("a") ?? []).map(
			(a) => a.getAttribute("href") ?? "",
		);
		for (const href of hrefs) {
			for (const pattern of FORBIDDEN) {
				expect(href).not.toMatch(pattern);
			}
		}
	});

	it("is-mounted-by-both-group-layouts-after-main", () => {
		const read = (rel: string) =>
			readFileSync(join(process.cwd(), rel), "utf8");

		for (const rel of [
			"src/app/(public)/layout.tsx",
			"src/app/(auth)/layout.tsx",
		]) {
			const source = read(rel);
			expect(source).toContain("<SiteFooter />");
			// After `</main>`, never inside it, and never in the header.
			expect(source.indexOf("<SiteFooter />")).toBeGreaterThan(
				source.indexOf("</main>"),
			);
			// The wrapper carries `flex-1` so a short page pins the footer to the
			// bottom instead of floating it mid-viewport: `body` has `min-h-full`
			// but `height: auto`, and the wrapper is a flex item at the default
			// `flex: 0 1 auto`. (Reasoned from the CSS — the shell has never had a
			// footer. T8 is the browser confirmation on /sign-in.)
			expect(source).toContain('className="flex min-h-full flex-1 flex-col"');
		}
	});
});
