// SPDX-License-Identifier: AGPL-3.0-or-later

import Link from "next/link";

/**
 * The ROOT 404 — deliberately NEUTRAL, and deliberately carrying no
 * `GlobalHeader`.
 *
 * ADR-0023's Option-2 verdict rejected root-mounted participant chrome
 * precisely because the root layout is shared with `(admin)`, which has no
 * layout at any depth. Mounting the participant header here would leak
 * participant chrome onto the two admin `notFound()` throws
 * (`admin/markets/[marketId]/page.tsx:33` · `server/admin/page-guards.ts:32`)
 * and onto anything unrouted. Root stays neutral; the branded variant lives at
 * `(public)/not-found.tsx`.
 *
 * Wordmark is PLAIN TEXT, not `BrandCluster` — that component is a client
 * boundary carrying the countdown timer, which this surface has no business
 * mounting. Copy is the plan §5 table verbatim.
 */
export default function RootNotFound(): React.JSX.Element {
	return (
		<div
			data-testid="root-not-found"
			className="mx-auto flex w-full max-w-3xl flex-1 flex-col items-center justify-center px-4 py-24 text-center"
		>
			<span className="font-extrabold text-ink text-sm tracking-[0.18em]">
				ZUGZWANG
			</span>
			<h1 className="mt-6 font-medium text-ink text-lg">Not found.</h1>
			<Link
				href="/"
				className="mt-6 inline-block font-medium text-ink text-sm underline-offset-4 outline-none hover:underline focus-visible:shadow-(--state-focus-ring)"
			>
				Go to Zugzwang
			</Link>
		</div>
	);
}
