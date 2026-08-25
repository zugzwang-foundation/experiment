import { readFile } from "node:fs/promises";
import { join } from "node:path";
import type { Metadata } from "next";
import { PageContainer } from "@/components/shell/PageContainer";
import {
	PRIVACY_VERSION_HASH,
	TOS_VERSION_HASH,
} from "@/server/auth/tos-versions";

// The legal documents, in full, on a page of their own — SPEC.1 §13 F-AUTH-4
// AMENDMENT 2026-08-25. The acceptance screen no longer renders the two bodies
// inline; its checkbox label links here, and this is where they render whole.
//
// ⛔ THE BYTES ARE READ, NEVER COPIED. `public/legal/{tos,privacy}.txt` are the
// versioned static documents the acceptance-evidence hashes name
// (`TOS_VERSION_HASH` / `PRIVACY_VERSION_HASH`, written into
// `users.tos_version_hash` / `users.privacy_version_hash` at F-AUTH-4). A
// second transcription of that text — in JSX, in MDX, anywhere — would be a
// document the hash does not describe, which is the one thing a version hash
// exists to make impossible. So this page reads the same files, and the footer
// states which version it just rendered.
//
// This read is the app's ONLY reader of those two files since the acceptance
// screen stopped rendering them. It is deliberately a plain `readFile` and not
// a shared helper: one call site, and the server tree is where a hashing
// producer would live if one is ever built (LEGAL.1), not here.
//
// ⚠ Do not write a doubled star after a slash anywhere in this file's comments.
// `tests/unit/design/side-pole-binding.test.ts` strips comments with a regex
// whose block-comment opener is `\/\*`, so a glob such as the server path
// written with two stars opens a comment span that runs to the next `*` `/` in
// the file — which lands mid-JSX and diverges its two strippers. Measured: it
// reddened `comment-stripping-is-line-preserving-and-equivalent` on this file.
//
// ⚠ MEASURED, not assumed: this route builds as `ƒ` (server-rendered per
// request), NOT `○`. This page reads no cookie and no header, but the
// `(public)` layout it renders inside reads both — so the whole route group is
// dynamic and a docblock claiming a prerender here would be describing a build
// output the build does not produce.

export const metadata: Metadata = {
	title: "Terms of Service and Privacy Policy — Zugzwang",
	description:
		"The Zugzwang Experiment's Terms of Service and Privacy Policy, in full.",
};

async function readLegalDoc(name: "tos" | "privacy"): Promise<string> {
	const path = join(process.cwd(), "public", "legal", `${name}.txt`);
	return readFile(path, "utf-8");
}

export default async function LegalPage(): Promise<React.ReactElement> {
	const [tosBody, privacyBody] = await Promise.all([
		readLegalDoc("tos"),
		readLegalDoc("privacy"),
	]);

	return (
		<PageContainer preset="reading" className="flex flex-col gap-8">
			<header className="flex flex-col gap-1">
				<h1 className="text-xl font-semibold text-ink">
					Terms of Service and Privacy Policy
				</h1>
				<p className="text-sm text-n5">
					The documents you accept when you join the experiment, in full.
				</p>
			</header>

			{/* Both bodies render whole — no scroller, no clamp, no "read more".
			    A page whose whole purpose is that the text is reachable must not
			    be the second place the text is hidden. */}
			<section className="flex flex-col gap-3">
				<h2 className="text-base font-medium text-ink">Terms of Service</h2>
				<pre className="font-sans text-sm whitespace-pre-wrap text-n6">
					{tosBody}
				</pre>
			</section>

			<section className="flex flex-col gap-3">
				<h2 className="text-base font-medium text-ink">Privacy Policy</h2>
				<pre className="font-sans text-sm whitespace-pre-wrap text-n6">
					{privacyBody}
				</pre>
			</section>

			{/* The colophon, and deliberately NOT a `<footer>` element. SPEC.1
			    1.0.26 withdrew the page-level footer product-wide, and
			    `tests/unit/shell/not-found.test.tsx` reads a `<footer>` that is
			    not nested in a content container as exactly that — it reddened
			    on this line before this note existed. The acceptance screen's
			    own version line IS a `<footer>` because it sits inside a
			    `<Card>`; here there is no card, so the element goes. */}
			<p className="pt-4 [border-top:var(--hairline)]">
				<small className="text-xs text-n5">
					ToS {TOS_VERSION_HASH} · Privacy {PRIVACY_VERSION_HASH}
				</small>
			</p>
		</PageContainer>
	);
}
