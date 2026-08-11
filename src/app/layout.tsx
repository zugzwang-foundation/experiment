import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { PostHogProvider } from "@/lib/posthog/provider";

const geistSans = Geist({
	variable: "--font-geist-sans",
	subsets: ["latin"],
});

const geistMono = Geist_Mono({
	variable: "--font-geist-mono",
	subsets: ["latin"],
});

export const metadata: Metadata = {
	title: "Zugzwang",
	description: "The world's reputation market.",
};

export default function RootLayout({
	children,
}: Readonly<{
	children: React.ReactNode;
}>) {
	return (
		<html
			lang="en"
			className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
		>
			{/* POLISH.7a D19 (R-A) — `min-h-full` → `h-full`, ONE node, and the only
			    change this surface makes above its own route group.

			    THE DEFECT. `min-height:100%` resolves against the containing block's
			    SPECIFIED height, and `<body>`'s specified height was `auto`. So the
			    `min-h-full` on the `(auth)` and `(public)` wrapper divs resolved to
			    nothing, every wrapper collapsed to content height, `<main flex-1>`
			    had no free space to claim, and `my-auto` on the sign-in and otp
			    Cards computed to ZERO. Measured pre-fix at 1440×900: the `(auth)`
			    wrapper was 316px inside a 900px viewport and the Card sat at
			    top:94px instead of centred. `docs/logs/POLISH-1b.md:92` measured the
			    same collapse independently and assigned it here.

			    WHY THIS NODE. `<html>` is already `h-full`, so giving `<body>` a
			    definite height is the one edit that makes the percentage resolvable
			    for every descendant. The alternative — swapping the `(auth)`
			    wrapper's `min-h-full` for a viewport unit — is one node too and has
			    no reach outside this route group, but `(auth)/layout.tsx` is
			    POLISH.1's file and POLISH.7a halt P3 forbids it; `src/app/layout.tsx`
			    is the single ratified exception. Recorded so the rejected option is
			    visible rather than rediscovered.

			    ⚠ `flex flex-col` IS UNTOUCHED, and no `flex-1` anywhere is removed
			    (K2). Flatten either node to a block context and `margin-block:auto`
			    computes to zero forever, and the repair needs two fixes instead of
			    one. `tests/unit/shell/page-container.test.ts` pins the chain by name.

			    Content taller than the viewport still scrolls: `<body>`'s overflow is
			    visible and propagates to the viewport, which is the standard
			    `html,body{height:100%}` behaviour. Verified by measurement on all
			    seven route families, before and after — see the commit body. */}
			<body className="h-full flex flex-col">
				<PostHogProvider>{children}</PostHogProvider>
			</body>
		</html>
	);
}
