// SPDX-License-Identifier: AGPL-3.0-or-later

/**
 * The product's first footer (B4). Mounted after `</main>` by BOTH group
 * layouts — `(public)` and `(auth)` — never by the header and never at root
 * (root is shared with `(admin)`, ADR-0023 Option-2).
 *
 * WHY IT EXISTS: ADR-0001 (AGPL-3.0-or-later). The licence is what requires the
 * source affordance — this is a source LINK, not a compliance OFFER; a formal
 * §13 offer is `LEGAL.1`'s and is not built here. SPEC.1 also carries a live
 * footer commitment, so this is a specified-but-unbuilt surface rather than a
 * new mint.
 *
 * CONTENT FENCE (SG7) — an allow-list, not a count. Permitted: the repo URL,
 * the SPDX licence identifier, the copyright line, and the whitepaper link.
 * FORBIDDEN ABSOLUTELY: ToS links, Privacy links, legal prose, cookie notices,
 * navigation. Those are `LEGAL.1` / `UI.10`, and admitting any one of them
 * voids the B4 gate ruling. T3 enforces this mechanically.
 *
 * The whitepaper link is PERMITTED by SG7 and ships if a public URL exists
 * (Q1b). No URL was supplied at execute, so it is OMITTED and recorded as a
 * named deviation rather than invented — an omission on the record is
 * acceptable, an unrecorded one is not.
 *
 * Register: muted (`text-n5`), hairline top border, header band vocabulary
 * (same `max-w-[1440px]` / `px-6` gutter as `GlobalHeader`) so the two chrome
 * strips share one measure. Desktop-only per G1 — no breakpoints.
 */
export function SiteFooter(): React.JSX.Element {
	return (
		<footer data-testid="site-footer" className="border-t bg-n0">
			<div className="mx-auto flex w-full max-w-[1440px] items-center gap-4 px-6 py-4 text-n5 text-xs">
				<span>
					Source:{" "}
					<a
						href="https://github.com/zugzwang-foundation/experiment"
						className="underline-offset-4 outline-none hover:underline focus-visible:shadow-(--state-focus-ring)"
					>
						github.com/zugzwang-foundation/experiment
					</a>
				</span>
				<span>AGPL-3.0-or-later</span>
				<span>© 2026 The Zugzwang Authors</span>
			</div>
		</footer>
	);
}
