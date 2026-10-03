"use client";

import { Pause, Play } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { useIsPhoneTier } from "@/components/debate/phone-tier";
import { HEADER_ICON_BUTTON } from "@/components/shell/header-control";
import {
	RADIO_PLAYER_HEIGHT,
	RADIO_PLAYER_WIDTH,
	RADIO_PLAYLIST_ID,
} from "@/components/shell/radio/playlist";
import {
	loadYouTubeIframeApi,
	PLAYER_STATE,
	type YTPlayer,
} from "@/components/shell/radio/youtube-iframe-api";
import { HEADER_GLOSSARY } from "@/lib/copy/glossary";
import { cn } from "@/lib/utils";

/**
 * The header Radio — RADIO-1 / ADR-0062 / D-54. Two controls, founder-ruled
 * 2026-09-26: **Radio** opens the playlist on YouTube in a new tab, and the
 * **play/pause** button beside it plays the playlist here, through a YouTube
 * player nobody sees.
 *
 * ⛔ THE PLAYER IS HIDDEN ON PURPOSE, AND THAT IS A KNOWN BREACH OF YOUTUBE'S
 * EMBED RULES, ACCEPTED BY THE FOUNDER. YouTube requires a visible, uncovered
 * player of at least 200×200 and forbids background players (Required Minimum
 * Functionality; Developer Policies §III.I items 7 and 9). A visible player
 * card was built first and rejected: "don't open in website". The risk is that
 * YouTube stops the player working on this site. ADR-0062 records it; do not
 * "fix" the hiding without a new ruling.
 *
 * ⛔ OFF UNLESS `NEXT_PUBLIC_RADIO_ENABLED === "true"` AT BUILD. Unset, the
 * control is exactly the old inert placeholder, so production is unchanged
 * until the variable is set in Doppler. Every jsdom render of `GlobalHeader`
 * sees it unset. Signed in or not, the controls behave the same: the
 * RADIO-SIGNIN sign-up / log-in prompt (founder ruling 2026-09-28) was removed
 * by founder ruling on 2026-10-02. ⚠ That reopens what the prompt existed for:
 * a signed-out visitor has not accepted the privacy policy (`tos_accepted_at`),
 * which YouTube's §III.A.2 asks of an embedding site — a risk accepted in the
 * same ruling, beside the hidden-player one above.
 *
 * ⛔ NOTHING TOUCHES YOUTUBE BEFORE THE FIRST PLAY CLICK. That click loads the
 * API, builds the hidden player and plays. After it, the button pauses and
 * resumes. The player lives until the page unmounts it (the `(public)` and
 * `(auth)` groups mount separate headers) or the viewport drops below 640px —
 * where these controls are hidden, so a player still playing there could not be
 * stopped.
 *
 * ⚠ NO `InfoTip`. On touch at ≥640px its Popover branch merges an `onClick`
 * toggle onto its child, so one tap would press the control AND open the gloss
 * (`info-tip.tsx` names that defect). Glosses ride `title`, as `RulesControl`'s
 * does.
 *
 * ⚠ THE RADIO PILL'S WIDTH IS STATE-INDEPENDENT BY CONSTRUCTION. The word
 * and the equaliser sit in one grid cell — the word idle, the equaliser in its
 * place while playing — so play and pause never move GitHub, X, the brand
 * cluster or the mark. The equaliser follows YouTube's own `onStateChange`,
 * never the click. (It used to sit BESIDE the word, which cost the header
 * ~33px of width at every state for something only meaningful while playing.)
 */
const BAR = "w-[3px] rounded-[1px] bg-ink";

const BOX =
	"flex h-[34px] shrink-0 items-center gap-2 rounded-(--r) bg-(--btn-fill) px-3 select-none [border:var(--hairline)]";

const LABEL = "text-[10px] font-bold tracking-[0.11em] uppercase";

/** Privacy-enhanced mode: YouTube does not personalise from views here. */
const PLAYER_HOST = "https://www.youtube-nocookie.com";

export const RADIO_PLAYLIST_URL = `https://www.youtube.com/playlist?list=${RADIO_PLAYLIST_ID}`;

/**
 * The hidden player's host, set as an inline style on a node appended to
 * `body` — busdriverplaylist.in's shape. Transparent, click-through, behind the
 * page, and `inert` so a keyboard or screen reader never lands in an iframe
 * nobody can see.
 */
const HIDDEN_HOST_STYLE = `position:fixed;right:0;bottom:0;width:${RADIO_PLAYER_WIDTH}px;height:${RADIO_PLAYER_HEIGHT}px;opacity:0;pointer-events:none;z-index:-1;overflow:hidden`;

function Bars({ onAir }: { onAir?: boolean }) {
	return (
		<span
			aria-hidden="true"
			data-on-air={onAir ? "true" : undefined}
			className="radio-eq flex h-4 items-end gap-[2.5px]"
		>
			<span className={`h-[30%] ${BAR}`} />
			<span className={`h-[30%] ${BAR}`} />
			<span className={`h-[30%] ${BAR}`} />
			<span className={`h-[30%] ${BAR}`} />
			<span className={`h-[30%] ${BAR}`} />
		</span>
	);
}

export function RadioSlot() {
	const enabled = process.env.NEXT_PUBLIC_RADIO_ENABLED === "true";
	const isPhone = useIsPhoneTier();

	const [active, setActive] = useState(false);
	const [ready, setReady] = useState(false);
	const [onAir, setOnAir] = useState(false);
	// Set only in `onReady`: the player's methods do not exist before it.
	const playerRef = useRef<YTPlayer | null>(null);

	// Build the hidden player on the first play; tear it down when `active` ends
	// (phone tier, a failed load) or the header unmounts.
	useEffect(() => {
		if (!active) return;
		let cancelled = false;
		let player: YTPlayer | null = null;
		const host = document.createElement("div");
		host.style.cssText = HIDDEN_HOST_STYLE;
		host.setAttribute("inert", "");
		host.dataset.testid = "radio-hidden-player";
		// `YT.Player` replaces the node it is given with its iframe.
		const target = document.createElement("div");
		host.appendChild(target);
		document.body.appendChild(host);
		loadYouTubeIframeApi().then(
			(Player) => {
				if (cancelled) return;
				player = new Player(target, {
					host: PLAYER_HOST,
					width: RADIO_PLAYER_WIDTH,
					height: RADIO_PLAYER_HEIGHT,
					playerVars: {
						listType: "playlist",
						list: RADIO_PLAYLIST_ID,
						playsinline: 1,
						loop: 1,
					},
					events: {
						onReady: ({ target: loaded }) => {
							if (cancelled) return;
							playerRef.current = loaded;
							setReady(true);
							loaded.playVideo();
						},
						onStateChange: ({ data }) => {
							if (cancelled) return;
							setOnAir(
								data === PLAYER_STATE.PLAYING ||
									data === PLAYER_STATE.BUFFERING,
							);
						},
					},
				});
			},
			// A failed load returns to idle, so the next click retries.
			() => {
				if (!cancelled) setActive(false);
			},
		);
		return () => {
			cancelled = true;
			playerRef.current = null;
			try {
				player?.destroy();
			} catch {
				// Already torn down by YouTube; nothing left to release.
			}
			host.remove();
			setReady(false);
			setOnAir(false);
		};
	}, [active]);

	// Below 640px these controls are hidden, so nothing may keep playing there.
	useEffect(() => {
		if (isPhone) setActive(false);
	}, [isPhone]);

	if (!enabled) {
		return (
			<button
				type="button"
				disabled
				aria-disabled="true"
				aria-label="Radio"
				title={HEADER_GLOSSARY.radio}
				className={cn(BOX, "opacity-(--state-disabled-opacity)")}
			>
				<span className={cn(LABEL, "text-n5")}>Radio</span>
			</button>
		);
	}

	const loading = active && !ready;
	const onToggle = () => {
		if (!active) {
			setActive(true);
			return;
		}
		const player = playerRef.current;
		if (player === null) return;
		if (onAir) player.pauseVideo();
		else player.playVideo();
	};
	const label = onAir ? "On Air" : "Radio";

	return (
		<>
			<a
				href={RADIO_PLAYLIST_URL}
				target="_blank"
				rel="noopener noreferrer"
				aria-label={`${label} — open the playlist on YouTube (opens in a new tab)`}
				title={HEADER_GLOSSARY.radioLive}
				data-testid="radio-link"
				className={cn(
					BOX,
					"outline-none [transition:all_var(--dur-hover)] hover:[border:1px_solid_var(--ring)] active:bg-(--state-pressed-fill) focus-visible:shadow-(--state-focus-ring)",
				)}
			>
				<span className={cn(LABEL, "grid items-center text-ink")}>
					<span
						data-label="off"
						className={cn("col-start-1 row-start-1", onAir && "invisible")}
					>
						Radio
					</span>
					<span
						data-label="on"
						className={cn(
							"col-start-1 row-start-1 flex justify-center",
							!onAir && "invisible",
						)}
					>
						<Bars onAir={onAir} />
					</span>
				</span>
			</a>
			<button
				type="button"
				onClick={onToggle}
				disabled={loading}
				aria-busy={loading || undefined}
				aria-label={onAir ? "Pause radio" : "Play radio"}
				data-testid="radio-toggle"
				className={HEADER_ICON_BUTTON}
			>
				{onAir ? <Pause aria-hidden="true" /> : <Play aria-hidden="true" />}
			</button>
		</>
	);
}
