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
		/**
		 * ⛔⛔ MOBILE-2h · R-2 — THE PHONE'S SNAP TYPE LIVES HERE BECAUSE THE
		 * DOCUMENT IS THE SCROLLER, AND A SCROLLER CAN ONLY BE ARMED ON ITSELF.
		 *
		 * `/u/[pseudonym]`'s position tiles are one viewport tall below 640px and
		 * snap to their own top edge. A snap alignment resolves against the nearest
		 * scroll-container ANCESTOR, and MEASURED at 360/390/430 that ancestor — once
		 * the positions panel and its body release their own `overflow` at phone
		 * width — is the viewport. The viewport's snap type is set on the root
		 * element and nowhere else: `<body>` does not propagate it, and no descendant
		 * can reach up to it. So the tokens are here, in the file that owns `<html>`.
		 *
		 * ⚠ IT IS GLOBAL AND IT IS INERT EVERYWHERE ELSE, WHICH IS WHY `proximity`
		 * AND NOT `mandatory`. A snap container with no snap targets does nothing at
		 * all, and the only `scroll-snap-align` in the tree outside the position tile
		 * is on `PhoneFeedTrack`'s two panes — whose own nearest scroll container is
		 * that track's horizontal scroller, so the viewport never sees them.
		 * `tests/unit/design/phone-position-tile.test.ts` pins that set, so a
		 * third snap target anywhere reddens rather than inheriting this quietly.
		 * ⚠ `mandatory` would additionally forbid resting between targets, which on a
		 * page whose top half (identity card, six tiles) is deliberately NOT a snap
		 * target would make that half unreadable.
		 *
		 * ⚠ DESKTOP IS UNTOUCHED BY CONSTRUCTION: a `max-mobile:` token cannot match
		 * at or above 640px.
		 */
		<html
			lang="en"
			className={`${geistSans.variable} ${geistMono.variable} h-full antialiased max-mobile:snap-y max-mobile:snap-proximity`}
		>
			<body className="min-h-full flex flex-col">
				<PostHogProvider>{children}</PostHogProvider>
			</body>
		</html>
	);
}
