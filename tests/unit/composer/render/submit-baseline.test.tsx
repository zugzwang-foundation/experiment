// @vitest-environment jsdom
import {
	act,
	cleanup,
	fireEvent,
	render,
	screen,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * MIRROR-1 · A4 — THE SUBMIT BASELINE. Written against `origin/main` @
 * `b4d1f512` BEFORE any MIRROR-1 change, and NOT EDITED for the rest of the run.
 *
 * ⛔ WHAT IT PINS: the exact request the composer sends for three fixed input
 * sets — the URL, the method, the content type, an idempotency key being present,
 * and the BODY BYTES (key order included). MIRROR-1 is presentation only; this
 * file is the proof that nothing it did reached the wire.
 *
 * ⚠⚠ IT MOUNTS THE HOST (`DebateView`), NOT `BetComposer`, AND THAT IS THE WHOLE
 * DESIGN. The Mirror layout is selected by the DESKTOP host's mounts. A test that
 * rendered the composer bare would keep exercising the old layout forever and
 * certify nothing about the new one; this one drives whatever layout the host
 * renders, through accessible names only (`Argument title`, `Argument body`,
 * `Stake amount`, the file input, `PLACE Đ BET`), so the same unedited file runs
 * against the old layout at baseline and against the new one after the switch.
 *
 * The three sets (kickoff A4): (a) a post with title + detail + image + amount;
 * (b) a Support reply; (c) a Counter reply. `cmt-p1` is a YES parent, so Support
 * bets YES and Counter bets NO (`deriveReplySide`).
 */

const { routerMock } = vi.hoisted(() => ({
	routerMock: {
		refresh: () => undefined,
		push: () => undefined,
		replace: () => undefined,
		back: () => undefined,
		forward: () => undefined,
		prefetch: () => undefined,
	},
}));

vi.mock("next/navigation", () => ({
	useParams: () => ({ slug: "bitcoin-price-50k" }),
	useRouter: () => routerMock,
	usePathname: () => "/m/bitcoin-price-50k",
	useSearchParams: () => new URLSearchParams(),
}));

import { DebateView } from "@/components/debate/DebateView";
import type { DebateViewModel } from "@/components/debate/types";
import { IDEMPOTENCY_HEADER_NAME } from "@/server/idempotency/types";

import { baseModel, placeOk } from "../../debate/render/_posted-fixtures";
import { EXTENDED, TITLE, VIEWER } from "./_harness";

const PARENT_ID = "cmt-p1";
const UPLOAD_ID = "0190c0de-0000-7000-8000-00000000a4a4";
const PUT_URL = "https://r2.example.invalid/put/a4";
const UUIDISH =
	/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

type Captured = {
	url: string;
	method: string | undefined;
	headers: Record<string, string>;
	body: string;
};

let placed: Captured[] = [];
let versionTick = 0;

/**
 * The wire, stubbed at `fetch` — the submit action's only exit. The image rides
 * the real `attachImage` (sign → PUT), so an image that never reaches `attached`
 * would drop `imageUploadsId` and redden (a) rather than pass silently.
 */
function stubWire() {
	const stub = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
		const url = String(input);
		if (url === "/api/bets/place") {
			placed.push({
				url,
				method: init?.method,
				headers: { ...(init?.headers as Record<string, string>) },
				body: String(init?.body),
			});
			return new Response(JSON.stringify(placeOk("cmt-a4").body), {
				status: 200,
				headers: { "content-type": "application/json" },
			});
		}
		if (url === "/api/uploads/sign") {
			return new Response(
				JSON.stringify({
					ok: true,
					data: { uploadId: UPLOAD_ID, putUrl: PUT_URL },
				}),
				{ status: 200, headers: { "content-type": "application/json" } },
			);
		}
		if (url === PUT_URL) {
			return new Response(null, { status: 200 });
		}
		if (/\/m\/[^/]+\/version$/.test(url)) {
			versionTick += 1;
			return new Response(JSON.stringify({ v: `v${versionTick}` }), {
				status: 200,
				headers: { "content-type": "application/json" },
			});
		}
		// The quote GET degrades to "—" on an off-shape answer (quote-reader law).
		return new Response(JSON.stringify({}), { status: 200 });
	});
	vi.stubGlobal("fetch", stub);
	return stub;
}

/**
 * jsdom has no `URL.createObjectURL` — the local preview needs one. Added and
 * removed as own properties so the global `URL` constructor is left intact (the
 * `attach-preview.test.tsx` pattern and its reason).
 */
const urlStatics = URL as unknown as {
	createObjectURL?: (blob: Blob) => string;
	revokeObjectURL?: (url: string) => void;
};

beforeEach(() => {
	placed = [];
	versionTick = 0;
	stubWire();
	urlStatics.createObjectURL = () => "blob:a4/preview";
	urlStatics.revokeObjectURL = () => undefined;
	window.scrollTo = () => undefined;
	Object.defineProperty(document, "hidden", {
		configurable: true,
		get: () => false,
	});
});

afterEach(() => {
	cleanup();
	vi.unstubAllGlobals();
	urlStatics.createObjectURL = undefined;
	urlStatics.revokeObjectURL = undefined;
	Reflect.deleteProperty(document, "hidden");
	history.replaceState(null, "", "/");
});

function view(model: DebateViewModel, initialPostId: string | null = null) {
	return (
		<DebateView
			model={model}
			viewer={VIEWER}
			initialPostId={initialPostId}
			ownPseudonym={null}
		/>
	);
}

/** Let the attach chain (sign → PUT) and React settle. No timer is involved. */
async function settle() {
	for (let i = 0; i < 25; i++) {
		await act(async () => {
			await Promise.resolve();
		});
	}
}

function type(label: string, value: string) {
	fireEvent.change(screen.getByLabelText<HTMLInputElement>(label), {
		target: { value },
	});
}

async function submit() {
	await act(async () => {
		fireEvent.click(screen.getByRole("button", { name: "PLACE Đ BET" }));
	});
	await settle();
}

/** The one place request of a scenario, with its idempotency key checked and set aside. */
function onlyPlace(): Omit<Captured, "headers"> & { contentType: string } {
	expect(placed).toHaveLength(1);
	const [req] = placed;
	const { [IDEMPOTENCY_HEADER_NAME]: key, ...rest } = req.headers;
	expect(key).toMatch(UUIDISH);
	return {
		url: req.url,
		method: req.method,
		contentType: rest["content-type"],
		body: req.body,
	};
}

describe("MIRROR-1 A4 — the composer submits exactly what it submitted before", () => {
	it("a4::a-post-with-title-detail-image-and-amount", async () => {
		render(view(baseModel()));
		fireEvent.click(screen.getByLabelText("Buy YES"));
		type("Argument title", TITLE);
		type("Argument body", EXTENDED);
		type("Stake amount", "25");
		const input = document.querySelector('input[type="file"]');
		if (!(input instanceof HTMLInputElement)) {
			throw new Error("A4: no file input in the open composer");
		}
		await act(async () => {
			fireEvent.change(input, {
				target: {
					files: [new File(["a4-bytes"], "chart.png", { type: "image/png" })],
				},
			});
		});
		await settle();
		await submit();

		expect(onlyPlace()).toEqual({
			url: "/api/bets/place",
			method: "POST",
			contentType: "application/json",
			body: '{"marketId":"mkt-mumbai-metro","side":"YES","stake":"25","body":"The base rate argument.\\n\\nThe extended argument, first paragraph.","imageUploadsId":"0190c0de-0000-7000-8000-00000000a4a4"}',
		});
	});

	it("a4::b-support-reply", async () => {
		render(view(baseModel(), PARENT_ID));
		fireEvent.click(screen.getByLabelText("Support — bet YES"));
		type("Argument title", TITLE);
		type("Stake amount", "75");
		await submit();

		expect(onlyPlace()).toEqual({
			url: "/api/bets/place",
			method: "POST",
			contentType: "application/json",
			body: '{"marketId":"mkt-mumbai-metro","side":"YES","stake":"75","body":"The base rate argument.","parentCommentId":"cmt-p1"}',
		});
	});

	it("a4::c-counter-reply", async () => {
		render(view(baseModel(), PARENT_ID));
		fireEvent.click(screen.getByLabelText("Counter — bet NO"));
		type("Argument title", TITLE);
		type("Argument body", EXTENDED);
		await submit();

		expect(onlyPlace()).toEqual({
			url: "/api/bets/place",
			method: "POST",
			contentType: "application/json",
			body: '{"marketId":"mkt-mumbai-metro","side":"NO","stake":"50","body":"The base rate argument.\\n\\nThe extended argument, first paragraph.","parentCommentId":"cmt-p1"}',
		});
	});
});
