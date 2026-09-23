// @vitest-environment jsdom
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { act, cleanup, fireEvent, render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * MIRROR-1 · RF-8 / G7 — THE PHONE TIER'S COMPOSER RENDERS EXACTLY AS BEFORE.
 *
 * `PhoneDebateView` mounts the SAME `BetComposer` the desktop does, so the phone
 * cannot be protected by leaving its files alone: the component it mounts is the
 * one MIRROR-1 changes. The Mirror layout is therefore opt-in by prop from the two
 * desktop mounts, and the phone mount — which passes no such prop — must keep
 * rendering today's markup. This file is that claim, stated as bytes.
 *
 * ⛔ THE FIXTURE IS CAPTURED FROM PURE `origin/main` — NEVER FROM THIS BRANCH — by
 * rendering each scenario below and recording `container.innerHTML`. It is compared
 * by EQUALITY. There is no update mode in this file on purpose: a baseline that
 * can be regenerated from the code under test certifies nothing.
 *
 * ⚠ CAPTURED TWICE, AND THE SECOND IS THE ONE IN FORCE. First at `b4d1f512`, before
 * any MIRROR-1 change. Then FF-1 (#568/#569) merged to `main` mid-run and changed
 * this very render — its switch joined the classic header row — so "the phone
 * renders exactly as today" had a new "today". The fixture was re-captured from
 * pure `main` @ `44573547` (a detached worktree carrying no MIRROR-1 code), and the
 * old one, run against that `main`, reddened on all six scenarios: the positive
 * control that this comparison can see a real change.
 *
 * The scenarios render `BetComposer` exactly as `PhoneDebateView.tsx` does — no
 * layout prop — across both kinds, both sides, the masked-parent header, the C2
 * floor-above-balance state, and an attached image (the preview + filename row).
 */

vi.mock("next/navigation", () => ({
	useRouter: () => ({
		refresh: () => undefined,
		push: () => undefined,
		replace: () => undefined,
		back: () => undefined,
		forward: () => undefined,
		prefetch: () => undefined,
	}),
}));

import { BetComposer } from "@/components/debate/composer/BetComposer";

import { EXTENDED, MARKET_ID, SLUG, TITLE, VIEWER } from "./_harness";

const FIXTURE = join(__dirname, "_classic-layout-baseline.json");

const urlStatics = URL as unknown as {
	createObjectURL?: (blob: Blob) => string;
	revokeObjectURL?: (url: string) => void;
};

beforeEach(() => {
	vi.stubGlobal(
		"fetch",
		vi.fn(async (input: RequestInfo | URL) => {
			const url = String(input);
			if (url === "/api/uploads/sign") {
				return new Response(
					JSON.stringify({
						ok: true,
						data: {
							uploadId: "0190c0de-0000-7000-8000-0000000000b8",
							putUrl: "https://r2.example.invalid/put/b8",
						},
					}),
					{ status: 200, headers: { "content-type": "application/json" } },
				);
			}
			return new Response(JSON.stringify({}), { status: 200 });
		}),
	);
	urlStatics.createObjectURL = () => "blob:baseline/preview";
	urlStatics.revokeObjectURL = () => undefined;
});

afterEach(() => {
	cleanup();
	vi.unstubAllGlobals();
	urlStatics.createObjectURL = undefined;
	urlStatics.revokeObjectURL = undefined;
});

async function settle() {
	for (let i = 0; i < 25; i++) {
		await act(async () => {
			await Promise.resolve();
		});
	}
}

const base = {
	marketId: MARKET_ID,
	slug: SLUG,
	viewer: VIEWER,
	onClose: () => undefined,
	onPosted: () => undefined,
	onSuspended: () => undefined,
	onBusyChange: () => undefined,
};

type Scenario = {
	name: string;
	run: () => Promise<string>;
};

const SCENARIOS: Scenario[] = [
	{
		name: "post-yes-idle",
		run: async () => {
			const { container } = render(
				<BetComposer {...base} side="YES" kind="post" />,
			);
			await settle();
			return container.innerHTML;
		},
	},
	{
		name: "post-no-idle",
		run: async () => {
			const { container } = render(
				<BetComposer {...base} side="NO" kind="post" />,
			);
			await settle();
			return container.innerHTML;
		},
	},
	{
		name: "reply-support-yes",
		run: async () => {
			const { container } = render(
				<BetComposer
					{...base}
					side="YES"
					kind="reply"
					parentCommentId="cmt-p1"
					replyContext={{
						relation: "support",
						authorPseudonym: "AmberFinch404",
					}}
				/>,
			);
			await settle();
			return container.innerHTML;
		},
	},
	{
		name: "reply-counter-masked-parent",
		run: async () => {
			const { container } = render(
				<BetComposer
					{...base}
					side="NO"
					kind="reply"
					parentCommentId="cmt-p1"
					replyContext={{ relation: "counter", authorPseudonym: null }}
				/>,
			);
			await settle();
			return container.innerHTML;
		},
	},
	{
		name: "post-c2-floor-above-balance",
		run: async () => {
			const { container } = render(
				<BetComposer
					{...base}
					viewer={{ ...VIEWER, balance: "5", spendableToday: "5" }}
					side="YES"
					kind="post"
				/>,
			);
			await settle();
			return container.innerHTML;
		},
	},
	{
		name: "post-typed-and-image-attached",
		run: async () => {
			const { container, getByLabelText } = render(
				<BetComposer {...base} side="YES" kind="post" />,
			);
			fireEvent.change(getByLabelText("Argument title"), {
				target: { value: TITLE },
			});
			fireEvent.change(getByLabelText("Argument body"), {
				target: { value: EXTENDED },
			});
			const input = container.querySelector('input[type="file"]');
			if (!(input instanceof HTMLInputElement)) {
				throw new Error("no file input");
			}
			await act(async () => {
				fireEvent.change(input, {
					target: {
						files: [new File(["b"], "chart.png", { type: "image/png" })],
					},
				});
			});
			await settle();
			return container.innerHTML;
		},
	},
];

describe("MIRROR-1 RF-8 — the default (phone) composer render is byte-identical to baseline", () => {
	const baseline = JSON.parse(readFileSync(FIXTURE, "utf8")) as Record<
		string,
		string
	>;

	it("classic-baseline::the-fixture-covers-every-scenario", () => {
		// Positive control: the fixture is not empty and names exactly these.
		expect(Object.keys(baseline).sort()).toEqual(
			SCENARIOS.map((s) => s.name).sort(),
		);
		for (const html of Object.values(baseline)) {
			expect(html).toContain("Argument title");
		}
	});

	for (const s of SCENARIOS) {
		it(`classic-baseline::${s.name}`, async () => {
			expect(await s.run()).toBe(baseline[s.name]);
		});
	}
});
