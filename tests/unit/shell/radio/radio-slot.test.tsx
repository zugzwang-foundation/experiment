// @vitest-environment jsdom

import { act, cleanup, fireEvent, render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type {
	YTPlayerConstructor,
	YTPlayerOptions,
} from "@/components/shell/radio/youtube-iframe-api";

/**
 * RADIO-1 — the header Radio: a link to the playlist on YouTube, and a
 * play/pause button that drives a hidden player (founder ruling, ADR-0062).
 *
 * The loader is mocked (its own suite is `youtube-iframe-api.test.ts`) so each
 * case decides when YouTube "arrives" or fails; `FakePlayer` stands in for
 * `YT.Player` and records every call. `NEXT_PUBLIC_RADIO_ENABLED` is set per
 * case. Plain-DOM assertions — there is no `jest-dom` here (AGENTS.md §9).
 */

const mocks = vi.hoisted(() => ({ load: vi.fn() }));

vi.mock(
	"@/components/shell/radio/youtube-iframe-api",
	async (importOriginal) => ({
		...(await importOriginal<
			typeof import("@/components/shell/radio/youtube-iframe-api")
		>()),
		loadYouTubeIframeApi: mocks.load,
	}),
);

import { RADIO_PLAYLIST_URL, RadioSlot } from "@/components/shell/RadioSlot";
import { RADIO_PLAYLIST_ID } from "@/components/shell/radio/playlist";
import { PLAYER_STATE } from "@/components/shell/radio/youtube-iframe-api";
import { HEADER_GLOSSARY } from "@/lib/copy/glossary";

class FakePlayer {
	static instances: FakePlayer[] = [];
	playVideo = vi.fn();
	pauseVideo = vi.fn();
	destroy = vi.fn();
	constructor(
		readonly element: HTMLElement,
		readonly options: YTPlayerOptions,
	) {
		FakePlayer.instances.push(this);
	}
	ready() {
		act(() => this.options.events.onReady?.({ target: this }));
	}
	state(data: number) {
		act(() => this.options.events.onStateChange?.({ data, target: this }));
	}
}

let phone = false;
const tierListeners = new Set<() => void>();

function setPhone(next: boolean) {
	phone = next;
	act(() => {
		for (const l of tierListeners) l();
	});
}

beforeEach(() => {
	process.env.NEXT_PUBLIC_RADIO_ENABLED = "true";
	mocks.load.mockReset();
	mocks.load.mockResolvedValue(FakePlayer as unknown as YTPlayerConstructor);
	FakePlayer.instances = [];
	phone = false;
	tierListeners.clear();
	// `useIsPhoneTier` memoises on `window.matchMedia`, so a fresh function per
	// case gives each case a fresh MediaQueryList.
	window.matchMedia = ((query: string) => ({
		media: query,
		get matches() {
			return phone;
		},
		addEventListener: (_: string, l: () => void) => tierListeners.add(l),
		removeEventListener: (_: string, l: () => void) => tierListeners.delete(l),
	})) as unknown as typeof window.matchMedia;
});

afterEach(() => {
	cleanup();
	Reflect.deleteProperty(process.env, "NEXT_PUBLIC_RADIO_ENABLED");
	Reflect.deleteProperty(window, "matchMedia");
});

const toggle = () =>
	document.querySelector<HTMLButtonElement>('[data-testid="radio-toggle"]');
const link = () =>
	document.querySelector<HTMLAnchorElement>('[data-testid="radio-link"]');
const hiddenHost = () =>
	document.querySelector<HTMLElement>('[data-testid="radio-hidden-player"]');

/** Press play and let the (mocked) loader resolve. */
async function pressPlay(): Promise<FakePlayer> {
	await act(async () => {
		fireEvent.click(toggle() as HTMLButtonElement);
	});
	const player = FakePlayer.instances.at(-1);
	if (!player) throw new Error("no YT.Player was built");
	return player;
}

describe("RADIO-1 — off unless NEXT_PUBLIC_RADIO_ENABLED is true", () => {
	it("unset: the old inert control, no link, no play button", () => {
		Reflect.deleteProperty(process.env, "NEXT_PUBLIC_RADIO_ENABLED");
		render(<RadioSlot />);
		const el = document.querySelector<HTMLButtonElement>(
			'button[aria-label="Radio"]',
		);
		expect(el?.disabled).toBe(true);
		expect(el?.title).toBe(HEADER_GLOSSARY.radio);
		expect(link()).toBeNull();
		expect(toggle()).toBeNull();
	});
});

describe("RADIO-1 — Radio opens the playlist on YouTube", () => {
	it("is a new-tab link to the playlist for a signed-in viewer", () => {
		render(<RadioSlot />);
		const a = link() as HTMLAnchorElement;
		expect(a.getAttribute("href")).toBe(
			`https://www.youtube.com/playlist?list=${RADIO_PLAYLIST_ID}`,
		);
		expect(RADIO_PLAYLIST_URL).toBe(a.getAttribute("href"));
		expect(a.getAttribute("target")).toBe("_blank");
		expect(a.getAttribute("rel")).toContain("noopener");
		expect(a.title).toBe(HEADER_GLOSSARY.radioLive);
	});

	it("clicking the link does not start the hidden player", () => {
		render(<RadioSlot />);
		fireEvent.click(link() as HTMLAnchorElement);
		expect(mocks.load).not.toHaveBeenCalled();
		expect(hiddenHost()).toBeNull();
	});
});

describe("signed out, the Radio plays like signed in (RADIO-SIGNIN removed 2026-10-02)", () => {
	it("the Radio pill is the YouTube link and play is a real play button", () => {
		render(<RadioSlot />);
		expect(link()?.getAttribute("href")).toBe(RADIO_PLAYLIST_URL);
		expect(
			document.querySelector('[data-testid="radio-signin-prompt"]'),
		).toBeNull();
		expect(toggle()?.getAttribute("aria-label")).toBe("Play radio");
	});
});

describe("RADIO-1 — nothing touches YouTube before the first play", () => {
	it("mounting injects and builds nothing", () => {
		render(<RadioSlot />);
		expect(toggle()?.disabled).toBe(false);
		expect(toggle()?.getAttribute("aria-label")).toBe("Play radio");
		expect(mocks.load).not.toHaveBeenCalled();
		expect(hiddenHost()).toBeNull();
		expect(document.querySelector("iframe")).toBeNull();
	});
});

describe("RADIO-1 — the hidden player", () => {
	it("play builds it in a transparent, click-through, inert host on body", async () => {
		render(<RadioSlot />);
		const player = await pressPlay();
		const host = hiddenHost() as HTMLElement;
		expect(host.parentElement).toBe(document.body);
		expect(host.style.opacity).toBe("0");
		expect(host.style.pointerEvents).toBe("none");
		expect(host.hasAttribute("inert")).toBe(true);
		// `YT.Player` gets a node React does not own, inside that host.
		expect(player.element.parentElement).toBe(host);
	});

	it("asks for the playlist, privacy-enhanced, inline, looping, with no autoplay var", async () => {
		render(<RadioSlot />);
		const { host, playerVars } = (await pressPlay()).options;
		expect(host).toBe("https://www.youtube-nocookie.com");
		expect(playerVars).toEqual({
			listType: "playlist",
			list: RADIO_PLAYLIST_ID,
			playsinline: 1,
			loop: 1,
		});
		expect("autoplay" in playerVars).toBe(false);
	});
});

describe("RADIO-1 — play and pause", () => {
	it("plays on ready; the icon and the equaliser follow YouTube, not the click", async () => {
		render(<RadioSlot />);
		const player = await pressPlay();
		expect(toggle()?.disabled).toBe(true); // loading
		player.ready();
		expect(player.playVideo).toHaveBeenCalledTimes(1);
		expect(toggle()?.disabled).toBe(false);
		// Asked to play is not playing.
		expect(toggle()?.getAttribute("aria-label")).toBe("Play radio");

		player.state(PLAYER_STATE.PLAYING);
		expect(toggle()?.getAttribute("aria-label")).toBe("Pause radio");
		expect(link()?.getAttribute("aria-label")).toMatch(/^On Air — /);
		expect(
			document.querySelector(".radio-eq")?.getAttribute("data-on-air"),
		).toBe("true");
	});

	it("pauses while On Air — including BUFFERING — and resumes when paused", async () => {
		render(<RadioSlot />);
		const player = await pressPlay();
		player.ready();
		player.state(PLAYER_STATE.BUFFERING);
		fireEvent.click(toggle() as HTMLButtonElement);
		expect(player.pauseVideo).toHaveBeenCalledTimes(1);

		player.state(PLAYER_STATE.PAUSED);
		expect(toggle()?.getAttribute("aria-label")).toBe("Play radio");
		expect(
			document.querySelector(".radio-eq")?.getAttribute("data-on-air"),
		).toBeNull();
		fireEvent.click(toggle() as HTMLButtonElement);
		expect(player.playVideo).toHaveBeenCalledTimes(2);
		// Asked to resume is not resumed: the label waits for YouTube.
		expect(toggle()?.getAttribute("aria-label")).toBe("Play radio");
	});

	it("a click while loading does nothing", async () => {
		let arrive: (P: YTPlayerConstructor) => void = () => {};
		mocks.load.mockReturnValue(
			new Promise<YTPlayerConstructor>((r) => {
				arrive = r;
			}),
		);
		render(<RadioSlot />);
		fireEvent.click(toggle() as HTMLButtonElement);
		fireEvent.click(toggle() as HTMLButtonElement);
		expect(mocks.load).toHaveBeenCalledTimes(1);
		await act(async () => {
			arrive(FakePlayer as unknown as YTPlayerConstructor);
		});
		expect(FakePlayer.instances).toHaveLength(1);
	});
});

describe("RADIO-1 — teardown", () => {
	it("unmounting (a route-group change) destroys the player and removes the host", async () => {
		const { unmount } = render(<RadioSlot />);
		const player = await pressPlay();
		unmount();
		expect(player.destroy).toHaveBeenCalledTimes(1);
		expect(hiddenHost()).toBeNull();
	});

	it("unmounting while YouTube is still loading means no player is ever built", async () => {
		let arrive: (P: YTPlayerConstructor) => void = () => {};
		mocks.load.mockReturnValue(
			new Promise<YTPlayerConstructor>((r) => {
				arrive = r;
			}),
		);
		const { unmount } = render(<RadioSlot />);
		fireEvent.click(toggle() as HTMLButtonElement);
		unmount();
		await act(async () => {
			arrive(FakePlayer as unknown as YTPlayerConstructor);
		});
		expect(FakePlayer.instances).toHaveLength(0);
		expect(hiddenHost()).toBeNull();
	});

	it("below 640px the player stops — the controls are hidden there — and stays stopped", async () => {
		render(<RadioSlot />);
		const player = await pressPlay();
		player.ready();
		player.state(PLAYER_STATE.PLAYING);
		setPhone(true);
		expect(player.destroy).toHaveBeenCalledTimes(1);
		expect(hiddenHost()).toBeNull();
		setPhone(false);
		expect(hiddenHost()).toBeNull();
		expect(FakePlayer.instances).toHaveLength(1);
		expect(toggle()?.getAttribute("aria-label")).toBe("Play radio");
	});

	it("a failed load returns to idle, and the next play retries", async () => {
		mocks.load.mockRejectedValueOnce(new Error("youtube_unavailable"));
		render(<RadioSlot />);
		await act(async () => {
			fireEvent.click(toggle() as HTMLButtonElement);
		});
		expect(hiddenHost()).toBeNull();
		expect(toggle()?.disabled).toBe(false);

		await pressPlay();
		expect(mocks.load).toHaveBeenCalledTimes(2);
		expect(FakePlayer.instances).toHaveLength(1);
	});
});

describe("RADIO-1 — the Radio pill never changes width", () => {
	it("the word and the equaliser share one cell in every state", async () => {
		render(<RadioSlot />);
		// ⚠ Invisible KEEPS its box; a display-none utility would drop it and
		// the pill would change width on every play and pause.
		const tokens = (selector: string) =>
			(document.querySelector(selector)?.className ?? "").split(/\s+/);
		const DROPS_BOX = ["hid", "den"].join("");
		const shape = () => ({
			off: tokens('[data-label="off"]'),
			on: tokens('[data-label="on"]'),
		});

		const idle = shape();
		expect(idle.off).not.toContain("invisible");
		expect(idle.on).toContain("invisible");

		const player = await pressPlay();
		player.ready();
		player.state(PLAYER_STATE.PLAYING);
		const onAir = shape();
		expect(onAir.off).toContain("invisible");
		expect(onAir.on).not.toContain("invisible");

		for (const node of [...Object.values(idle), ...Object.values(onAir)]) {
			expect(node.length, "node missing").toBeGreaterThan(1);
			expect(node).not.toContain(DROPS_BOX);
		}
	});
});
