import type { Metadata } from "next";

import { WarliHero } from "@/components/art/warli";

/**
 * WARLI-VIEW — a TEMPORARY viewer for the Warli-inspired hero.
 *
 * ⛔ THIS IS NOT THE MOUNT, AND IT MUST NOT BE READ AS ONE. The artwork's real
 * mount point is the auth surface, and that decision is still OPEN on a measured
 * cost: `WarliHero` is `"use client"` and produces ~82 KB of gzipped markup and
 * ~35 ms of server CPU per render, built once on the server and again at
 * hydration (WARLI-2 OWED-2, `docs/logs/WARLI-2.md`). That cost is the reason the
 * mount is a decision rather than three lines.
 *
 * **It does not apply here, and the reason is who visits.** This route exists so
 * one person can look at the composition in a browser; it is not linked from
 * anywhere, not indexed, and not on a path a participant reaches. The per-request
 * argument is about `/sign-in`, which every unauthenticated visitor hits.
 *
 * ⚠ DISPOSABLE. It is deployed to a preview and to staging and is deliberately
 * NOT intended to reach `main`. When it goes, one allow-list entry in
 * `tests/unit/art/art-layer-guards.test.ts` goes with it — that test names this
 * file explicitly for exactly that reason.
 *
 * ⚠ THE ROUTE GROUP BRINGS ITS OWN SHELL. `(public)/layout.tsx` renders
 * `GlobalHeader` above every child and mounts the onboarding deck beside it, so
 * "full bleed" here means edge-to-edge within the surface column, not the
 * viewport. That is a consequence of the path this route was asked to live at,
 * not a compromise chosen here.
 */
export const metadata: Metadata = {
	// A deployed preview and a staging domain are public URLs, and this repo
	// ships no `robots.txt` and no `app/robots.ts` — verified, not assumed
	// (SYNC-5). Absent a site-wide artifact, the per-route directive is the only
	// thing standing between a throwaway viewer and a search index.
	robots: { index: false, follow: false },
};

/** The auth card's real size — the number every ring radius is derived from. */
const CARD_W = 416;
const CARD_H = 480;

export default function WarliViewPage() {
	return (
		<div className="w-full overflow-x-auto bg-ground">
			{/*
			 * THE STAGE IS EXACTLY 1440 × 1000, NOT A SCALED BOX, and that is what
			 * makes the card placeholder mean anything. The hero's viewBox is
			 * 1440 × 1000 and the card is 416 × 480 CSS pixels against it; scale the
			 * stage and the card either scales with it (and stops being 416 wide) or
			 * does not (and sits at the wrong size over the artwork). At 1:1 both are
			 * their real sizes and the composition reads as it would behind a real
			 * sign-in card. Narrower viewports scroll horizontally — see the note.
			 */}
			<div className="relative mx-auto h-[1000px] w-[1440px]">
				<WarliHero
					className="absolute inset-0 h-full w-full"
					label="Warli-inspired hero — preview viewer"
				/>

				{/* The auth card's FOOTPRINT, not the card. It is a placeholder so the
				    negative space can be judged: the inner ring's radius exists to
				    clear this rectangle's corners, and that clearance is invisible
				    without something occupying them. */}
				<div
					aria-hidden="true"
					className="-translate-x-1/2 -translate-y-1/2 pointer-events-none absolute top-1/2 left-1/2 flex flex-col items-center justify-center gap-3 rounded-lg border border-n2 bg-n0"
					style={{ width: CARD_W, height: CARD_H }}
				>
					<div className="h-11 w-64 rounded border border-n2" />
					<div className="h-px w-64 bg-n2" />
					<div className="h-10 w-64 rounded border border-n2" />
					<div className="h-10 w-64 rounded border border-n2" />
					<span className="text-n5 text-xs">
						auth card placeholder — {CARD_W} × {CARD_H}
					</span>
				</div>
			</div>

			<p className="px-4 py-3 text-center text-n5 text-xs">
				Desktop 1440+ only — the hero is not responsive below that by scope.
				Temporary viewer; not indexed, not linked, not the mount.
			</p>
		</div>
	);
}
