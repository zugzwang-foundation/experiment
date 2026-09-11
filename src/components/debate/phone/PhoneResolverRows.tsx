import { captureException } from "@sentry/nextjs";

import {
	getResolutionBlocks,
	type ResolutionBlockEntry,
} from "../resolution-block-data";
import type { DebateMarketHeader } from "../types";

/**
 * RF-7 — the four resolution facts, as label/value ROWS.
 *
 * ⛔⛔ A PHONE-ONLY LEAF, AND THE MEASUREMENT IS WHY IT EXISTS. `ResolverCards`
 * is `grid-cols-4` unconditionally, and its own docblock explains the choice:
 * below `lg` the headzone stacks and the column goes full width, so four across
 * is WIDER there than at 1440. That reasoning holds down to about 640px and
 * stops holding below it. MOBILE-2 RECON measured all four blocks at 375px:
 * 50px cells inside a 319px row, every label AND every value reporting
 * `scrollWidth > clientWidth` — `RESOL… / RESOL… / CLOSE… / FLAVO…` over
 * `GitHub / GitHub / 5 Nov … / Callout`. Not truncated; destroyed.
 *
 * ⇒ ADR-0050 D-2 permits a phone-only leaf exactly here: a desktop composition
 * with no phone shape, consuming only the read model, holding no write path, and
 * using no default-breakpoint variant. Four rows is not a narrower grid — it is
 * the other arrangement of the same four facts, and it is the one that fits.
 *
 * ⛔ THE THROW IS CAUGHT HERE FOR THE SAME REASON IT IS CAUGHT THERE, and this
 * is the part that must not be simplified away. `getResolutionBlocks` throws for
 * any slug outside BLOCK-1's eight. A joint @code-reviewer/@security-auditor
 * finding on `ResolverCards`' first cut was that letting it propagate took the
 * WHOLE `/m/[slug]` route down — unauthenticated, GET-triggerable, repeatably —
 * for a failure that only needs one row to degrade. A second component reading
 * the same map has the same exposure, so it carries the same posture: capture
 * once (still loud), render nothing for that market's resolution rows.
 */
const ROWS = [
	{ key: "resolution", label: "Resolution" },
	{ key: "resolver", label: "Resolver" },
	{ key: "closes", label: "Closes on" },
	// ⚠ `Flavour` is PROVISIONAL as a label and is not a copy-register entry —
	// carried verbatim from `ResolverCards`' own list so the two surfaces cannot
	// name the same four facts differently.
	{ key: "flavour", label: "Flavour" },
] as const;

export function PhoneResolverRows({ market }: { market: DebateMarketHeader }) {
	let blockData: ReturnType<typeof getResolutionBlocks> | null = null;
	try {
		blockData = getResolutionBlocks(market.slug);
	} catch (error) {
		captureException(error);
		return null;
	}
	return (
		<dl
			data-testid="phone-resolver-rows"
			className="flex flex-col rounded-(--r) [border:var(--hairline)]"
		>
			{ROWS.map(({ key, label }) => {
				const entry: ResolutionBlockEntry = blockData[key];
				return (
					<div
						key={key}
						data-testid={`phone-resolver-row-${key}`}
						className="flex items-baseline justify-between gap-3 px-3 py-2.5 not-last:[border-bottom:var(--hairline)]"
					>
						<dt className="shrink-0 text-[11px] font-extrabold tracking-[0.14em] text-n5 uppercase">
							{label}
						</dt>
						{/* ⚠ NO `truncate`. The whole point of the row form is that a value
						    which did not fit in a 50px cell fits in a 250px one; clipping it
						    again here would reproduce the defect in a different shape. */}
						<dd className="min-w-0 text-right text-[13px] leading-[1.4] font-semibold text-ink">
							{entry.href === null ? (
								entry.line1
							) : (
								<a href={entry.href} className="hover:underline">
									{entry.line1}
								</a>
							)}
						</dd>
					</div>
				);
			})}
		</dl>
	);
}
