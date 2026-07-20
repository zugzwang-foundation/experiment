// @vitest-environment jsdom

import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { IdentityCluster } from "@/components/shell/IdentityCluster";

/**
 * UI.A5 Slice 8 (plan §2 row 8 / §1c) — A4 follow-up #2, seam 2: the
 * signed-in identity chip activates from the LINK-INERT v1 span
 * (`aria-disabled`, `title="Profile — coming soon"`) to the viewer's OWN
 * SPEC.1 §23 profile route `/u/[pseudonym]`, keyed `identity-chip-link`;
 * the inert affordance is dropped. Signed-out keeps the existing JOIN
 * entry UNCHANGED; a null pseudonym (the throwaway-header guard edge)
 * keeps the non-linked chip — no profile URL exists without a pseudonym,
 * so no dead link. The literal "Profile — coming soon" string appears here
 * ONLY to assert its REMOVAL (the kickoff-carved exception to
 * data-testid keying).
 */

afterEach(cleanup);

const PSEUDONYM = "RedFox001";

describe("UI.A5 §2 row 8 — identity chip → own /u/[pseudonym] (A4 follow-up #2)", () => {
	it("chip-links-to-own-profile", () => {
		const { container } = render(
			<IdentityCluster viewer={{ pseudonym: PSEUDONYM }} />,
		);
		const link = screen.getByTestId("identity-chip-link");
		// The activation: a real anchor onto the viewer's own profile.
		expect(link.tagName).toBe("A");
		expect(link.getAttribute("href")).toBe(`/u/${PSEUDONYM}`);
		// The chip still carries the identity content (pseudonym text).
		expect(link.textContent).toContain(PSEUDONYM);
		// The inert v1 affordance is GONE: no "coming soon" title anywhere,
		// no aria-disabled anywhere.
		expect(
			container.querySelector('[title="Profile — coming soon"]'),
		).toBeNull();
		expect(container.querySelector('[aria-disabled="true"]')).toBeNull();
	});

	it("signed-out-renders-join", () => {
		const { container } = render(<IdentityCluster viewer={null} />);
		// The existing JOIN entry, UNCHANGED by the activation.
		const join = container.querySelector('a[href="/sign-in"]');
		expect(join).not.toBeNull();
		expect(join?.textContent).toBe("JOIN");
		// No identity chip link for a signed-out viewer.
		expect(screen.queryByTestId("identity-chip-link")).toBeNull();
	});

	it("null-pseudonym-no-link", () => {
		// The §6 throwaway-header guard edge: post-onboarding pseudonym is
		// NOT NULL, but a leaked null must not build a profile URL — the
		// non-linked chip stays, and the render must not crash.
		const { container } = render(
			<IdentityCluster viewer={{ pseudonym: null }} />,
		);
		expect(screen.queryByTestId("identity-chip-link")).toBeNull();
		expect(container.querySelector('a[href^="/u/"]')).toBeNull();
		// Positive half: the non-linked chip DID render (a <span>, not an
		// anchor, not nothing) — the null branch is a chip, not empty.
		expect(container.firstElementChild).not.toBeNull();
		expect(container.firstElementChild?.tagName).not.toBe("A");
	});
});
