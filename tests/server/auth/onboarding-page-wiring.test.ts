import type { ReactElement } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// UI-A7 — Auth skin (§9 TEST PLAN, surface 3). Tests-FIRST wiring + structure
// driver for the `/onboarding` skin, modeled on
// tests/server/discovery/page-wiring.test.ts (element-assertion law: NO jsdom,
// NO DOM render — call the async server component and assert on the returned
// React element tree by component reference + props).
//
// OnboardingPage() does cookies() → verifyOnboardingRef → users.findFirst →
// (maybe) redirect(...) → readLegalDoc(fs) → returns a tree. We mock every
// boundary EXCEPT the real `readLegalDoc` (it reads the checked-in
// public/legal/{tos,privacy}.txt — deterministic) and the real tos-versions
// constants (imported below and asserted verbatim — the §3.3 verbatim guard).
//
//   LOGIC (redirect branches) — GREEN before AND after the skin: the gate
//     chain (§4) is untouched by a presentation swap, so the three redirects
//     still fire. This is part of the "gate provably intact" proof.
//   STRUCTURE (seam contract §3.3) — GREEN both ways: the tree still carries
//     the ToS-gate bindings (form action, accepted checkbox, REID verbatim in
//     a role="alert", the version-hash footer, the Cancel link to /).
//   DRIVER (RED pre-skin) — the tree contains a node whose `type === Card`.
//     Today's scaffold uses <section>s → RED; the skin swaps to <Card> → GREEN.

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

		// The re-id warning renders REID_WARNING_TEXT verbatim inside role="alert".
		const alert = elements.find((e) => e.props.role === "alert");
		expect(alert).toBeDefined();
		expect(textOf(alert)).toContain(REID_WARNING_TEXT);

		// The source-hash footer carries both version constants verbatim.
		const footer = elements.find((e) => e.type === "footer");
		expect(footer).toBeDefined();
		const footerText = textOf(footer);
		expect(footerText).toContain(TOS_VERSION_HASH);
		expect(footerText).toContain(PRIVACY_VERSION_HASH);

		// Cancel link → home.
		const cancel = elements.find((e) => e.type === "a" && e.props.href === "/");
		expect(cancel).toBeDefined();
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
