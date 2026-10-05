/**
 * RADIO-1 / ADR-0062 — the YouTube IFrame Player API loader.
 *
 * No npm dependency and no `@types/youtube`: the API is five calls wide here
 * (`new Player`, `playVideo`, `pauseVideo`, `destroy`, two events), which does
 * not justify one (AGENTS.md §11, adding a dependency is ask-first). Shape
 * follows `TurnstileWidget`'s loader — one module-level promise, forgotten on
 * failure so the next click fetches again.
 *
 * ⛔ IT IS NOT TURNSTILE'S LOADER, AND COPYING THAT ONE LITERALLY HANGS. YouTube
 * loads in TWO stages. `iframe_api` does not define the API: it sets
 * `window.YT = { loading: 0, loaded: 0 }`, latches `YT.loading = 1`, and injects
 * a second script (`www-widgetapi.js`, `#www-widgetapi-script`) that we never
 * see. So:
 *   - `window.YT` existing proves nothing — readiness is `YT.Player` being a
 *     function, and the only signal is the global `onYouTubeIframeAPIReady`;
 *   - if the SECOND script fails (network, content blocker) no error event
 *     reaches us and the callback never fires — hence the timeout;
 *   - and a retry that merely re-injects `iframe_api` does nothing, because the
 *     stub's `if (!YT.loading)` is already false. A failure therefore removes
 *     BOTH scripts and drops the stub, so the next attempt really re-fetches.
 */

export const IFRAME_API_SRC = "https://www.youtube.com/iframe_api";
const WIDGET_SCRIPT_ID = "www-widgetapi-script";

/** How long a click waits for YouTube before the card says it is unavailable. */
export const LOAD_TIMEOUT_MS = 15_000;

/** `YT.PlayerState` — the values `onStateChange` reports. */
export const PLAYER_STATE = {
	UNSTARTED: -1,
	ENDED: 0,
	PLAYING: 1,
	PAUSED: 2,
	BUFFERING: 3,
	CUED: 5,
} as const;

export type YTPlayer = {
	playVideo(): void;
	pauseVideo(): void;
	destroy(): void;
};

export type YTPlayerOptions = {
	host: string;
	width: number;
	height: number;
	playerVars: Record<string, string | number>;
	events: {
		onReady?: (event: { target: YTPlayer }) => void;
		onStateChange?: (event: { data: number; target: YTPlayer }) => void;
	};
};

export type YTPlayerConstructor = new (
	element: HTMLElement,
	options: YTPlayerOptions,
) => YTPlayer;

declare global {
	interface Window {
		YT?: { Player?: YTPlayerConstructor; loaded?: number; loading?: number };
		onYouTubeIframeAPIReady?: () => void;
	}
}

let loader: Promise<YTPlayerConstructor> | null = null;

function readyPlayer(): YTPlayerConstructor | null {
	const Player = window.YT?.Player;
	return typeof Player === "function" ? Player : null;
}

export function loadYouTubeIframeApi(): Promise<YTPlayerConstructor> {
	const ready = readyPlayer();
	if (ready) return Promise.resolve(ready);
	if (loader) return loader;
	loader = new Promise<YTPlayerConstructor>((resolve, reject) => {
		// Chained, never overwritten: YouTube calls exactly one global, so
		// replacing another caller's would silently strand it.
		const previous = window.onYouTubeIframeAPIReady;
		const script = document.createElement("script");
		let settled = false;
		let timer: ReturnType<typeof setTimeout> | undefined;

		const settle = () => {
			settled = true;
			clearTimeout(timer);
			window.onYouTubeIframeAPIReady = previous;
		};
		const fail = () => {
			if (settled) return;
			settle();
			loader = null;
			script.remove();
			document.getElementById(WIDGET_SCRIPT_ID)?.remove();
			if (!window.YT?.loaded) window.YT = undefined;
			reject(new Error("youtube_unavailable"));
		};

		window.onYouTubeIframeAPIReady = () => {
			previous?.();
			if (settled) return;
			const Player = readyPlayer();
			if (!Player) {
				fail();
				return;
			}
			settle();
			resolve(Player);
		};
		timer = setTimeout(fail, LOAD_TIMEOUT_MS);
		script.src = IFRAME_API_SRC;
		script.async = true;
		script.onerror = fail;
		document.head.appendChild(script);
	});
	return loader;
}
