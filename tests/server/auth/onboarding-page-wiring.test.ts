import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { ReactElement } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// UI-A7 — Auth skin (§9 TEST PLAN, surface 3). Tests-FIRST wiring + structure
// driver for the `/onboarding` skin, modeled on
// tests/server/discovery/page-wiring.test.ts (element-assertion law: NO jsdom,
// NO DOM render — call the async server component and assert on the returned
// React element tree by component reference + props).
//
// OnboardingPage() does cookies() → verifyOnboardingRef → users.findFirst →
// (maybe) redirect(...) → returns a tree. We mock every boundary EXCEPT the
// real tos-versions constants (imported below and asserted verbatim — the
// §3.3 verbatim guard).
//
//   LOGIC (redirect branches) — GREEN before AND after the skin: the gate
//     chain (§4) is untouched by a presentation swap, so the three redirects
//     still fire. This is part of the "gate provably intact" proof.
//   STRUCTURE (seam contract §3.3) — GREEN both ways: the tree still carries
//     the ToS-gate bindings (form action, accepted checkbox). ⚠ The version-hash
//     footer and the Cancel link were part of this contract until
//     ONBOARD-CARD-2; both rows are INVERTED below, not dropped.
//   DRIVER (RED pre-skin) — the tree contains a node whose `type === Card`.
//     Today's scaffold uses <section>s → RED; the skin swaps to <Card> → GREEN.
//
// ⚠ AMENDED AT ONBOARD-CARD (SPEC.1 §13 F-AUTH-4 AMENDMENT 2026-08-25). The
// seam contract used to include "REID verbatim in a role='alert'". The
// amendment supersedes that block and the two inline document bodies; the
// documents are reachable from the checkbox label as a link to /legal. So the
// REID row is INVERTED rather than deleted — it now asserts the warning is
// ABSENT from this tree — and a new row asserts the link that replaced it.
// Deleting the row would have left nothing on disk noticing if the block came
// back, which is the state that made a two-document acceptance screen possible
// to ship unremarked in the first place.
//
// ⛔ THE BODY-ABSENCE ROW READS THE REAL FILES rather than a literal. An
// assertion against a hardcoded snippet goes green the moment the placeholder
// text is replaced at LEGAL.1, while the page could be rendering the new
// bodies in full. `public/legal/{tos,privacy}.txt` are the same files /legal
// renders and the same ones the version hashes name.

const mocks = vi.hoisted(() => ({
	cookiePresent: true,
	verifyOnboardingRef: vi.fn(),
	findFirst: vi.fn(),
	// Mirror next/navigation's redirect: it throws to halt render. We tag the
	// throw so a test can catch and assert the destination.
	redirect: vi.fn((path: string) => {
		throw new Error(`REDIRECT:${path}`);
	}),
}));

vi.mock("next/headers", () => ({
	cookies: async () => ({
		get: (_name: string) =>
			mocks.cookiePresent ? { value: "ref-token" } : undefined,
	}),
}));

vi.mock("next/navigation", () => ({
	redirect: mocks.redirect,
}));

// next/image touches `document` at import time (deployment-id.ts) — undefined
// in the node test env, so importing the page collection-errors without this
// stub. The PFP <Image> is never rendered here (element-assertion only), so a
// pass-through component suffices; we never assert on the PFP node.
vi.mock("next/image", () => ({
	default: (props: Record<string, unknown>) => props.children ?? null,
}));

vi.mock("@/server/auth/onboarding-ref", () => ({
	verifyOnboardingRef: mocks.verifyOnboardingRef,
}));

vi.mock("@/db", () => ({
	db: { query: { users: { findFirst: mocks.findFirst } } },
}));

// tos-accept pulls a server-only DB graph (grant + events) — mock it so the
// inline server action wrapper resolves without that graph.
vi.mock("@/server/auth/tos-accept", () => ({
	acceptTosAction: vi.fn(),
}));

import OnboardingPage from "@/app/(auth)/onboarding/page";
import { Card } from "@/components/ui/card";
import {
	PRIVACY_VERSION_HASH,
	REID_WARNING_TEXT,
	TOS_VERSION_HASH,
} from "@/server/auth/tos-versions";

type WalkedElement = ReactElement<Record<string, unknown>>;

function isElement(node: unknown): node is WalkedElement {
	return (
		typeof node === "object" &&
		node !== null &&
		"type" in node &&
		"props" in node
	);
}

/** Flatten the returned tree into every React element, nesting-agnostic. */
function collectElements(root: unknown): WalkedElement[] {
	const out: WalkedElement[] = [];
	const visit = (node: unknown): void => {
		if (Array.isArray(node)) {
			for (const child of node) visit(child);
			return;
		}
		if (!isElement(node)) return;
		out.push(node);
		visit(node.props.children);
	};
	visit(root);
	return out;
}

/** Concatenate the string/number leaves in an element's subtree. */
function textOf(node: unknown): string {
	if (typeof node === "string") return node;
	if (typeof node === "number") return String(node);
	if (Array.isArray(node)) return node.map(textOf).join("");
	if (isElement(node)) return textOf(node.props.children);
	return "";
}

/** Call OnboardingPage and return the redirect destination it threw. */
async function expectRedirect(): Promise<string> {
	try {
		await OnboardingPage();
	} catch (err) {
		if (err instanceof Error && err.message.startsWith("REDIRECT:")) {
			return err.message.slice("REDIRECT:".length);
		}
		throw err;
	}
	throw new Error("expected a redirect, but OnboardingPage returned a tree");
}

beforeEach(() => {
	// Happy-path defaults; redirect tests override the single relevant boundary.
	mocks.cookiePresent = true;
	mocks.verifyOnboardingRef.mockReturnValue({ userId: "user-uuid-1" });
	mocks.findFirst.mockResolvedValue({
		pseudonym: "umber-falcon-31",
		pfpFilename: "pfp-placeholder.svg",
		tosAcceptedAt: null,
	});
});

afterEach(() => {
	mocks.redirect.mockClear();
	mocks.verifyOnboardingRef.mockReset();
	mocks.findFirst.mockReset();
});

describe("UI-A7 onboarding skin — redirect branches (LOGIC, green both ways)", () => {
	it("onboarding-skin::missing-ref-cookie-redirects-to-sign-in", async () => {
		mocks.cookiePresent = false;
		expect(await expectRedirect()).toBe("/sign-in");
	});

	it("onboarding-skin::invalid-ref-redirects-to-sign-in", async () => {
		mocks.verifyOnboardingRef.mockReturnValue(null);
		expect(await expectRedirect()).toBe("/sign-in");
	});

	it("onboarding-skin::already-accepted-tos-redirects-home", async () => {
		mocks.findFirst.mockResolvedValue({
			pseudonym: "umber-falcon-31",
			pfpFilename: "pfp-placeholder.svg",
			tosAcceptedAt: new Date("2026-07-01T00:00:00Z"),
		});
		expect(await expectRedirect()).toBe("/");
	});
});

describe("UI-A7 onboarding skin — seam contract (§3.3 STRUCTURE, green both ways)", () => {
	it("onboarding-skin::preserves-the-tos-gate-bindings", async () => {
		const el = await OnboardingPage();
		const elements = collectElements(el);

		// <form action={submitTosAcceptance}> — the action binding is a function.
		const form = elements.find((e) => e.type === "form");
		expect(form).toBeDefined();
		expect(typeof form?.props.action).toBe("function");

		// <input name="accepted" value="true" required> — the acceptance gate.
		const accepted = elements.find(
			(e) => e.type === "input" && e.props.name === "accepted",
		);
		expect(accepted).toBeDefined();
		expect(accepted?.props.value).toBe("true");
		expect(accepted?.props.required).toBe(true);

		// ⚠ INVERTED AT ONBOARD-CARD-2 (SPEC.1 §13 AMENDMENT 2026-08-25 (second)).
		// Two rows here used to assert PRESENCE — the source-hash footer, and the
		// Cancel link to `/`. Both are superseded, so both are turned over rather
		// than deleted: absence is now the contract, and an assertion is the only
		// thing that will notice either coming back.
		//
		// ⛔ THE VERSION LABEL IS NOT GONE FROM THE PRODUCT, it moved to `/legal`.
		// That is asserted at its destination in the row below, not merely implied
		// by its absence here — an absence test alone would stay green if the line
		// had been deleted outright, which is the one outcome the amendment
		// forbids.
		expect(elements.some((e) => e.type === "footer")).toBe(false);
		const rendered = textOf(el);
		expect(rendered).not.toContain(TOS_VERSION_HASH);
		expect(rendered).not.toContain(PRIVACY_VERSION_HASH);

		// No Cancel: no control on this card navigates to `/`. The only anchor
		// left is the `/legal` link inside the checkbox label.
		expect(elements.some((e) => e.type === "a" && e.props.href === "/")).toBe(
			false,
		);
	});
});

describe("ONBOARD-CARD-2 — one control, no version line (SPEC.1 §13, 2026-08-25 second)", () => {
	it("onboarding-skin::carries-exactly-one-control-labelled-enter-zugzwang", async () => {
		const el = await OnboardingPage();
		const elements = collectElements(el);

		// EXACTLY one <button>, and it is the form's submit. "Exactly" is the
		// assertion the amendment actually makes — a second control appearing
		// beside this one is the regression, and a `find`-and-assert row would
		// not see it.
		const buttons = elements.filter((e) => e.type === "button");
		expect(buttons).toHaveLength(1);
		expect(buttons[0]?.props.type).toBe("submit");
		expect(textOf(buttons[0])).toBe("Enter Zugzwang");

		// The submit still rides the same server-action form, and the checkbox
		// still gates it — the label changed, the binding did not.
		const form = elements.find((e) => e.type === "form");
		expect(typeof form?.props.action).toBe("function");
		expect(
			collectElements(form).some(
				(e) =>
					e.type === "input" &&
					e.props.name === "accepted" &&
					e.props.required === true,
			),
		).toBe(true);
	});

	it("legal-page::still-renders-the-version-colophon", async () => {
		// The destination half of the move. `/legal` is a server component that
		// reads two files and imports no request-scoped boundary, so it renders
		// here with no mocks at all — which makes this the cheapest possible
		// proof that the version label survived the removal above.
		const { default: LegalPage } = await import("@/app/(public)/legal/page");
		const legalText = textOf(await LegalPage());
		expect(legalText).toContain(TOS_VERSION_HASH);
		expect(legalText).toContain(PRIVACY_VERSION_HASH);
	});
});

describe("ONBOARD-CARD — the amended acceptance screen (SPEC.1 §13, 2026-08-25)", () => {
	it("onboarding-skin::links-the-documents-instead-of-rendering-them", async () => {
		const el = await OnboardingPage();
		const elements = collectElements(el);

		// The conspicuous link, inside the checkbox's own label. `target`/`rel`
		// are asserted together: a new tab without `noopener` hands the opened
		// document a live `window.opener` back to a form holding unsaved
		// acceptance state.
		const legal = elements.find(
			(e) => e.type === "a" && e.props.href === "/legal",
		);
		expect(legal).toBeDefined();
		expect(legal?.props.target).toBe("_blank");
		expect(legal?.props.rel).toBe("noopener noreferrer");
		expect(textOf(legal)).toBe("Terms of Service and Privacy Policy");

		// It is the LABEL's link, not a stray one elsewhere on the card: the
		// label subtree contains both the accepted checkbox and this anchor.
		const label = elements.find(
			(e) =>
				e.type === "label" &&
				collectElements(e).some(
					(c) => c.type === "input" && c.props.name === "accepted",
				),
		);
		expect(label).toBeDefined();
		expect(
			collectElements(label).some(
				(c) => c.type === "a" && c.props.href === "/legal",
			),
		).toBe(true);
	});

	it("onboarding-skin::renders-neither-document-body-nor-the-reid-block", async () => {
		const el = await OnboardingPage();
		const rendered = textOf(el);

		// The warning no longer renders here — it lands in the ToS body at
		// LEGAL.1. The constant itself is untouched and still exported.
		expect(rendered).not.toContain(REID_WARNING_TEXT);
		expect(collectElements(el).some((e) => e.props.role === "alert")).toBe(
			false,
		);

		// Neither document body reaches this screen. Read off the real files —
		// the same two /legal renders — so this row cannot go vacuously green
		// when the placeholder text is replaced.
		for (const name of ["tos", "privacy"] as const) {
			const body = readFileSync(
				join(process.cwd(), "public", "legal", `${name}.txt`),
				"utf-8",
			);
			// First non-empty line: distinctive, and present in any revision.
			const firstLine = body.split("\n").find((l) => l.trim().length > 0);
			expect(firstLine, `${name}.txt is empty`).toBeTruthy();
			expect(rendered).not.toContain(firstLine as string);
			// And the bulk of it, so a truncated inline render is caught too.
			expect(rendered.length).toBeLessThan(body.length);
		}
	});
});

describe("UI-A7 onboarding skin — branded presentation (DRIVER, RED pre-skin)", () => {
	it("onboarding-skin::renders-the-card-primitive", async () => {
		const el = await OnboardingPage();
		const elements = collectElements(el);
		// The scaffold uses bare <section>s; the skin swaps to <Card>. The tree
		// contains no node whose type === Card today → RED.
		expect(elements.some((e) => e.type === Card)).toBe(true);
	});
});
