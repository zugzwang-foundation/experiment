// SPDX-License-Identifier: AGPL-3.0-or-later
"use client";

import { Geist, Geist_Mono } from "next/font/google";

import "./globals.css";

/**
 * The last-resort error boundary. It REPLACES the root layout when the root
 * layout itself (or anything above the route boundaries) throws, so it inherits
 * nothing — not the `<html>`/`<body>` shell, not the fonts, not the stylesheet.
 * Next requires it to be a Client Component.
 *
 * THE FONT TRAP (plan Q3 / risk 2). `globals.css:154` sets
 * `--font-sans: var(--font-geist-sans)`, and `--font-geist-sans` is defined
 * NOWHERE in CSS — it is injected at runtime by `geistSans.variable` on `<html>`
 * in `layout.tsx:29`. Drop that className here and the page renders correctly
 * COLOURED (`:root` supplies ground + ink) but in Times New Roman, which reads
 * as "the error page isn't ours". Hence the re-instantiated fonts below; T2
 * pins both variables onto `<html>`.
 *
 * `import "./globals.css"` is EXPLICIT and deliberate: whether Next 16.2.4
 * serves the root layout's CSS chunk to `global-error` is not verifiable from
 * source, and the import is one line that makes the question moot.
 *
 * It imports NOTHING server-bound and nothing that can throw — no `@/server/**`,
 * no token/format helpers, no providers. This is the boundary of last resort;
 * anything it imports that fails defeats it. The two route-level boundaries
 * (`bookmarks/error.tsx`, `u/[pseudonym]/error.tsx`) are untouched and still
 * catch their own subtrees first.
 */

const geistSans = Geist({
	variable: "--font-geist-sans",
	subsets: ["latin"],
});

const geistMono = Geist_Mono({
	variable: "--font-geist-mono",
	subsets: ["latin"],
});

export default function GlobalError({
	reset,
}: {
	error: Error & { digest?: string };
	reset: () => void;
}): React.JSX.Element {
	return (
		<html
			lang="en"
			className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
		>
			<body className="min-h-full flex flex-col">
				<div
					data-testid="global-error"
					className="mx-auto flex w-full max-w-3xl flex-1 flex-col items-center justify-center px-4 py-24 text-center"
				>
					<h1 className="font-medium text-ink text-lg">Something broke.</h1>
					<p className="mt-2 text-n5 text-sm">
						An unexpected error stopped the page from loading.
					</p>
					<button
						type="button"
						onClick={reset}
						className="mt-6 inline-block font-medium text-ink text-sm underline-offset-4 outline-none hover:underline focus-visible:shadow-(--state-focus-ring)"
					>
						Try again
					</button>
				</div>
			</body>
		</html>
	);
}
