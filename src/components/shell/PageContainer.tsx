// SPDX-License-Identifier: AGPL-3.0-or-later

import type * as React from "react";

import { cn } from "@/lib/utils";

/**
 * The participant frame primitive — ONE owner for the three container axes
 * (max-width · horizontal inset · vertical padding) across every `(public)` and
 * `(auth)` surface. Before this, nine sites in seven files declared those axes
 * by hand, and `/m/[slug]`'s lived inside a COMPONENT (`DebateView`), which was
 * never a component's to own.
 *
 * PRESETS, NOT FREE VALUES. Callers name a preset; they never pass `maxW`, `px`
 * or `py`. Three free axes across nine sites is a config object, and the scatter
 * this primitive removes would come straight back as prop drift. Four presets,
 * one axis of variation.
 *
 * THIS COMMIT MOVES NOTHING. Each site kept its CURRENT values — the presets are
 * a transcription of what was already on disk, not a normalisation. Collapsing
 * the four to fewer is **D2b**, and it belongs to POLISH .2/.3/.5/.6: each of
 * those changes ONE preset in ONE place instead of hunting three files per
 * route. That is the whole point of doing this first.
 *
 * `className` carries per-site CONTENT layout (`flex`, `flex-col`, `gap-*`,
 * `text-center`) — deliberately NOT part of the container contract, because it
 * genuinely varies per surface while the box does not. Anything that sets a
 * container axis does not belong there.
 *
 * DISCOVERY (`/`) TAKES NO CONTAINER. Full-bleed is deliberate, not an
 * oversight — do not add one here or on that route.
 */
export const CONTAINER_PRESETS = {
	/** bookmarks + profile, all three route states each (sites 2–7) */
	reading: "mx-auto w-full max-w-3xl px-4 py-6",
	/** the debate surface `/m/[slug]` (site 9) — the only px-6 */
	debate: "mx-auto w-full max-w-5xl px-6 py-8",
	/** the three `(auth)` surfaces, via their shared layout (site 8) */
	auth: "mx-auto w-full max-w-md px-4 py-8",
	/** the branded `(public)` 404 (site 1) */
	notice: "mx-auto w-full max-w-3xl px-4 py-24",
	/**
	 * HTML-FINISH row 20 — the profile's two-band arena (`/u/[pseudonym]`, the
	 * page state only; its `loading`/`error` states stay on `reading`).
	 *
	 * ⚠ MINTED, NOT REUSED, AND THE CENSUS IS WHY. The widest existing preset is
	 * `debate` at `max-w-5xl` = 1024px. That is EXACTLY the viewport at which
	 * this surface's arena is allowed to become two columns (`lg`, ruled from
	 * the fixed-track measurement below), so adopting it would cap the container
	 * at the breakpoint: the two-column arena would render at its own minimum on
	 * every screen and never widen. The measured defect — "at 1440 the page
	 * measures two columns of 356px, IDENTICAL to 768" — would survive with the
	 * numbers merely shifted. So no existing preset gives this surface a usable
	 * width, and rule ⑵ applies.
	 *
	 * ⛔ THE VALUE IS BYTE-CARRIED, NOT CHOSEN. `max-w-[1440px]` AND `px-6` are
	 * lifted together from `src/components/shell/GlobalHeader.tsx:91` — the
	 * widest surface wrapper already on `main`, and the one this content sits
	 * directly beneath. Taking both is what makes the page align with its own
	 * chrome: the max-width alone would leave the body inset 8px wider than the
	 * header's on each side. `py-6` is `reading`'s, unchanged, so the vertical
	 * rhythm does not move. NOTHING is read off the mockup — it is a
	 * fixed-desktop light-mode prototype and declares no breakpoint at all.
	 *
	 * ⚠ ONE AXIS OF VARIATION, as the docblock above requires: against `reading`
	 * this moves max-width and the horizontal inset (the inset only because the
	 * source line carries it), and nothing else.
	 */
	wide: "mx-auto w-full max-w-[1440px] px-6 py-6",
} as const;

export type ContainerPreset = keyof typeof CONTAINER_PRESETS;

export function PageContainer({
	preset,
	className,
	...props
}: React.ComponentProps<"div"> & { preset: ContainerPreset }) {
	return (
		<div className={cn(CONTAINER_PRESETS[preset], className)} {...props} />
	);
}
