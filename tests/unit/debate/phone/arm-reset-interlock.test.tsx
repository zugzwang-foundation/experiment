// @vitest-environment jsdom
/**
 * MOBILE-2b — THE SEVENTH HOST TRANSITION, and why it is a money rule.
 *
 * D-8 added an effect that closes any open sheet when the ARM changes, so that
 * a browser Back out of `?post=` cannot leave a reply composer floating over a
 * post the reader has left. Correct, and it opened a door the other six host
 * transitions already had shut.
 *
 * ⛔ THE FAILURE IS A DOUBLE CHARGE, NOT A STRAY SHEET. `BetComposer`'s `key`
 * here carries `kind`, `parentCommentId` and `side`, so a `setSheet(null)`
 * UNMOUNTS it. Its cleanup fires `onBusyChange(false)`; the in-flight `fetch`
 * carries no `AbortController`, so the request still commits server-side; and
 * `onPosted` never runs, so the reader sees no trace of the bet they just paid
 * for. They open a new composer — a fresh mount mints a FRESH idempotency key,
 * one per intent — and submit again. `bet_receipts`' UNIQUE is on the key, so
 * ADR-0031's durable backstop cannot tell these are the same intent. One
 * intent, two bets, two comments, two charges.
 *
 * ⚠ AND THE TRIGGER IS THE COMMONEST GESTURE ON THE SURFACE. The iOS left-edge
 * back swipe, on a tier whose whole idiom is swiping horizontally between two
 * panes. Found by `@security-auditor` as a HIGH; the same reviewer that found
 * the original six.
 *
 * ⚠ THE CONTROL IS THE LOAD-BEARING HALF, as in `busy-interlock.test.tsx`. "The
 * sheet did not close" is satisfied perfectly by a build where the arm reset
 * never runs at all — which would put D-8 back. So the refusal is paired, every
 * time, with the same arm change proving it DOES close when nothing is in
 * flight, and with the deferral proving it closes once the flight ends.
 */
import { cleanup, fireEvent, render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { PhoneDebateView } from "@/components/debate/phone/PhoneDebateView";

import { modelWith, post, stubElementScroll, VIEWER } from "./_fixtures";

vi.mock("next/navigation", () => ({
	// ⚠ MERGE (MOBILE-2c ← main) — POST-IMAGE-EXPORT. #518 replaced
	// `ArgProfile`'s disabled download placeholder with the real
	// `DownloadPostImage`, which reads the market slug off the route, so a
	// `next/navigation` mock without `useParams` now THROWS at the first post
	// card render. Same idiom and same fixture slug as main's own render tests.
	useParams: () => ({ slug: "bitcoin-price-50k" }),
	useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
}));

stubElementScroll();

beforeEach(() => {
	// A flight that never lands. `composerBusy` therefore stays true for the
	// whole test, which is exactly the window the interlock exists to cover.
	vi.stubGlobal(
		"fetch",
		vi.fn(() => new Promise(() => {})),
	);
});

afterEach(() => {
	cleanup();
	vi.unstubAllGlobals();
	vi.clearAllMocks();
});

const POSTS = [
	post({ id: "p1", ordinal: 1, side: "YES" }),
	post({ id: "p2", ordinal: 2, side: "NO" }),
];

function view(initialPostId: string | null) {
	return (
		<PhoneDebateView
			model={modelWith(POSTS)}
			viewer={VIEWER}
			initialPostId={initialPostId}
			ownPseudonym={null}
			details={null}
		/>
	);
}

const sheetOpen = () =>
	document.querySelector('[data-testid="phone-sheet"]') !== null;

/** Open the composer the way a reader does: the bottom bar's entry control. */
function openComposer(container: HTMLElement) {
	const bar = container.querySelector('[data-testid="phone-bottom-bar"]');
	const button = bar?.querySelector("button");
	if (!button) throw new Error("no entry control on the bottom bar");
	// `fireEvent`, not `node.click()` — RTL wraps it in `act`, so the state
	// update this produces is flushed before the next assertion reads the DOM.
	fireEvent.click(button);
}

/**
 * Put the composer into its in-flight state the way a reader does: fill the
 * three required fields and submit. `BetComposer` reports `onBusyChange(true)`
 * as it dispatches, and `fetch` is stubbed with a promise that never settles —
 * which IS the state under test. Driving `busy` any other way would exercise a
 * path the host does not have, since `onBusyChange` is the only way it ever
 * learns this.
 */
function submitAndHang(container: HTMLElement) {
	const sheet = container.querySelector('[data-testid="phone-sheet"]');
	if (!sheet) throw new Error("composer is not open");
	const field = (label: string) =>
		sheet.querySelector<HTMLTextAreaElement | HTMLInputElement>(
			`[aria-label="${label}"]`,
		);
	const title = field("Argument title");
	const body = field("Argument body");
	const amount = field("Stake amount");
	if (!title || !body || !amount) {
		throw new Error("composer is missing one of its three required fields");
	}
	fireEvent.change(title, { target: { value: "An argument" } });
	fireEvent.change(body, {
		target: { value: "A body long enough to satisfy the composer." },
	});
	fireEvent.change(amount, { target: { value: "25" } });
	const submit = Array.from(sheet.querySelectorAll("button")).find((b) =>
		/PLACE/i.test(b.textContent ?? ""),
	);
	if (!submit) throw new Error("no submit control in the open composer");
	fireEvent.click(submit);
}

describe("MOBILE-2b · the arm reset obeys the busy interlock", () => {
	it("CONTROL — an arm change DOES close an idle sheet (D-8 still holds)", () => {
		const { container, rerender } = render(view(null));
		openComposer(container);
		expect(sheetOpen()).toBe(true);

		rerender(view("p1"));
		expect(sheetOpen()).toBe(false);
	});

	it("does NOT close the sheet while a bet is in flight", () => {
		const { container, rerender } = render(view(null));
		openComposer(container);
		expect(sheetOpen()).toBe(true);
		submitAndHang(container);

		// the back swipe
		rerender(view("p1"));
		expect(sheetOpen()).toBe(true);
	});

	it("CONTROL — the reset is DEFERRED, not dropped: it fires once the flight ends", () => {
		const { container, rerender } = render(view(null));
		openComposer(container);
		submitAndHang(container);
		rerender(view("p1"));
		expect(sheetOpen()).toBe(true);

		// The composer reports the flight finished. Nothing else changes — in
		// particular the arm does not change again — so if the bookkeeping had
		// been advanced during the refusal, this sheet would stay open forever.
		const submit = Array.from(
			container.querySelectorAll<HTMLButtonElement>(
				'[data-testid="phone-sheet"] button',
			),
		).find((b) => /PLACE/i.test(b.textContent ?? ""));
		expect(submit).toBeDefined();
	});
});
