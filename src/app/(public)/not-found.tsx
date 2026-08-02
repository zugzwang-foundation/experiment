// SPDX-License-Identifier: AGPL-3.0-or-later

import Link from "next/link";

/**
 * The `(public)` 404 — BRANDED: it renders inside the route-group layout and so
 * inherits `GlobalHeader`. (There is no footer to inherit — the page-level
 * footer is retired by founder ruling 2026-08-02.) Catches the three
 * participant page `notFound()` throws (`u/[pseudonym]/page.tsx:52,56` ·
 * `m/[slug]/page.tsx:46`), the last being ADR-0023's ratified "unknown or
 * `Draft` slug → `notFound()`" — so a Draft market is indistinguishable from a
 * nonexistent one here, which is the point.
 *
 * Presentation of ratified behaviour, NOT a product surface: no search, no
 * suggestions, no report affordance. Copy is the plan §5 table verbatim; any
 * string beyond it trips B10's content fence.
 *
 * The three Route Handler `notFound()` calls (`m/[slug]/quote/route.ts:95,104`
 * · `m/[slug]/export/route.ts:39`) render no layout — `notFound()` there
 * returns a bare 404 response and is unaffected by this file.
 */
export default function PublicNotFound(): React.JSX.Element {
	return (
		<div
			data-testid="public-not-found"
			className="mx-auto w-full max-w-3xl px-4 py-24 text-center"
		>
			<h1 className="font-medium text-ink text-lg">Not found.</h1>
			<p className="mt-2 text-n5 text-sm">
				This page doesn't exist, or the market isn't public yet.
			</p>
			<Link
				href="/"
				className="mt-6 inline-block font-medium text-ink text-sm underline-offset-4 outline-none hover:underline focus-visible:shadow-(--state-focus-ring)"
			>
				Back to markets
			</Link>
		</div>
	);
}
