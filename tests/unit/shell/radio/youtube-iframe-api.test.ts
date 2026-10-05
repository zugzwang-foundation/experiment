// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * RADIO-1 G1 — the YouTube IFrame API loader.
 *
 * YouTube's real scripts cannot run under jsdom, so each case plays their part
 * by hand: `iframe_api` is modelled as "a `<script>` appeared", the widget stage
 * as "`window.YT` gained a `Player`", and readiness as the global callback being
 * called — which is exactly the seam the real scripts use.
 *
 * ⛔ THE TWO-STAGE HANG IS THE CASE THIS FILE EXISTS FOR. `iframe_api` sets a
 * `{ loading: 1, loaded: 0 }` stub and injects a second script; if that one
 * never arrives, no error event reaches the page. A Turnstile-shaped loader
 * hangs forever there, and a retry that only re-injects `iframe_api` does
 * nothing because the stub's `loading` latch is already set.
 */

type Loader = typeof import("@/components/shell/radio/youtube-iframe-api");

let api: Loader;

const SRC = "https://www.youtube.com/iframe_api";

function apiScripts(): HTMLScriptElement[] {
	return Array.from(
		document.querySelectorAll<HTMLScriptElement>(`script[src="${SRC}"]`),
	);
}

class FakePlayer {}

async function settledState(p: Promise<unknown>): Promise<string> {
	let state = "pending";
	p.then(
		() => {
			state = "resolved";
		},
		() => {
			state = "rejected";
		},
	);
	await Promise.resolve();
	await Promise.resolve();
	return state;
}

beforeEach(async () => {
	vi.resetModules();
	vi.useFakeTimers();
	window.YT = undefined;
	window.onYouTubeIframeAPIReady = undefined;
	for (const s of Array.from(document.querySelectorAll("script"))) s.remove();
	api = await import("@/components/shell/radio/youtube-iframe-api");
});

afterEach(() => {
	vi.useRealTimers();
	window.YT = undefined;
	window.onYouTubeIframeAPIReady = undefined;
});

describe("RADIO-1 G1 — loadYouTubeIframeApi", () => {
	it("resolves at once, injecting nothing, when YT.Player already exists", async () => {
		window.YT = { Player: FakePlayer as never, loaded: 1 };
		await expect(api.loadYouTubeIframeApi()).resolves.toBe(FakePlayer);
		expect(apiScripts()).toHaveLength(0);
	});

	it("injects iframe_api exactly once, however many callers ask", async () => {
		const a = api.loadYouTubeIframeApi();
		const b = api.loadYouTubeIframeApi();
		expect(a).toBe(b);
		expect(apiScripts()).toHaveLength(1);
		expect(apiScripts()[0]?.async).toBe(true);
	});

	it("does NOT resolve on the YT stub alone — only on the ready callback with a Player", async () => {
		const p = api.loadYouTubeIframeApi();
		// Stage one: iframe_api ran and left its stub.
		window.YT = { loading: 1, loaded: 0 };
		apiScripts()[0]?.dispatchEvent(new Event("load"));
		expect(await settledState(p)).toBe("pending");

		// Stage two: the widget script defined the API and called back.
		window.YT = { Player: FakePlayer as never, loading: 1, loaded: 1 };
		window.onYouTubeIframeAPIReady?.();
		await expect(p).resolves.toBe(FakePlayer);
	});

	it("chains a callback somebody else registered, and restores it afterwards", async () => {
		const previous = vi.fn();
		window.onYouTubeIframeAPIReady = previous;
		const p = api.loadYouTubeIframeApi();
		expect(window.onYouTubeIframeAPIReady).not.toBe(previous);

		window.YT = { Player: FakePlayer as never, loaded: 1 };
		window.onYouTubeIframeAPIReady?.();
		await expect(p).resolves.toBe(FakePlayer);
		expect(previous).toHaveBeenCalledTimes(1);
		expect(window.onYouTubeIframeAPIReady).toBe(previous);
	});

	it("the two-stage hang: times out, removes BOTH scripts, drops the stub, and the next call re-injects", async () => {
		const previous = vi.fn();
		window.onYouTubeIframeAPIReady = previous;
		const p = api.loadYouTubeIframeApi();
		const caught = p.catch((e: unknown) => e);

		window.YT = { loading: 1, loaded: 0 };
		const widget = document.createElement("script");
		widget.id = "www-widgetapi-script";
		document.head.appendChild(widget);

		vi.advanceTimersByTime(api.LOAD_TIMEOUT_MS - 1);
		expect(await settledState(p)).toBe("pending");
		vi.advanceTimersByTime(1);

		expect(await caught).toBeInstanceOf(Error);
		expect(apiScripts()).toHaveLength(0);
		expect(document.getElementById("www-widgetapi-script")).toBeNull();
		expect(window.YT).toBeUndefined();
		expect(window.onYouTubeIframeAPIReady).toBe(previous);

		// The cached rejection is forgotten: a retry really fetches again.
		api.loadYouTubeIframeApi().catch(() => {});
		expect(apiScripts()).toHaveLength(1);
	});

	it("a network error on iframe_api rejects, and the next call re-injects", async () => {
		const p = api.loadYouTubeIframeApi();
		const caught = p.catch((e: unknown) => e);
		apiScripts()[0]?.dispatchEvent(new Event("error"));
		expect(await caught).toBeInstanceOf(Error);
		expect(apiScripts()).toHaveLength(0);

		api.loadYouTubeIframeApi().catch(() => {});
		expect(apiScripts()).toHaveLength(1);
	});

	it("keeps a stub that YouTube marked loaded (it is not ours to drop)", async () => {
		const p = api.loadYouTubeIframeApi();
		const caught = p.catch((e: unknown) => e);
		window.YT = { loading: 1, loaded: 1 };
		vi.advanceTimersByTime(api.LOAD_TIMEOUT_MS);
		expect(await caught).toBeInstanceOf(Error);
		expect(window.YT).toEqual({ loading: 1, loaded: 1 });
	});
});
