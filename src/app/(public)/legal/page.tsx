import { readFile } from "node:fs/promises";
import { join } from "node:path";
import type { Metadata } from "next";
import {
	LegalFigure,
	type LegalFigureName,
} from "@/components/legal/LegalFigure";
import { PageContainer } from "@/components/shell/PageContainer";
import { splitLegalSections } from "@/lib/legal-sections";
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

/**
 * The figure for each numbered section, in document order — Terms 1–12, then
 * Privacy 1–5. Names index `LegalFigure`'s registry; `envelope-open` appears in
 * both lists because both documents end on Contact, and drawing it once is the
 * point of having a registry.
 *
 * ⚠ A LIST, NOT A MAP KEYED BY SECTION NUMBER. The section order is the
 * document's own, and the render walks the two in step — so a document that
 * gains a section gets `undefined` here and renders with no figure, rather than
 * silently handing section 13 the envelope that belonged to section 12.
 */
const TOS_FIGURES: readonly LegalFigureName[] = [
	"hourglass-dates",
	"threshold-crossed",
	"tile-circle",
	"coin-struck",
	"paths-converging",
	"boundary-gap",
	"sieve-caught",
	"page-arrows-out",
	"tag-thread",
	"umbrella",
	"branching-graph",
	"envelope-open",
];

const PRIVACY_FIGURES: readonly LegalFigureName[] = [
	"four-boxes",
	"hub-spokes",
	"token-alone",
	"hourglass-run-out",
	"envelope-open",
];

export default async function LegalPage(): Promise<React.ReactElement> {
	const [tosBody, privacyBody] = await Promise.all([
		readLegalDoc("tos"),
		readLegalDoc("privacy"),
	]);

	const documents = [
		{ title: "Terms of Service", body: tosBody, figures: TOS_FIGURES },
		{ title: "Privacy Policy", body: privacyBody, figures: PRIVACY_FIGURES },
	];

	// Sides alternate down the PAGE, not within a document — Privacy §1 picks up
	// where Terms §12 left off, so the rhythm does not stutter at the seam.
	let placed = 0;

	return (
		<PageContainer preset="reading">
			{/* ⛔ THE CONTAINER WAS ALREADY CENTRED. MEASURED, at a pinned
			    1440×900 against the compiled build: container `w=768 L=336
			    R=336`, its `<h1>` and both `<pre>`s at `L=352 R=352`. Every box
			    on the page was symmetric to the pixel — so the `reading` preset
			    is NOT the defect, and it is shared with `/u/[pseudonym]`'s
			    loading and error states, which a preset edit would have moved
			    for no reason.

			    WHAT IS OFF-CENTRE IS THE INK, and only above the fold-out width.
			    `whitespace-pre-wrap` honours the `.txt` files' own hard wraps at
			    ~70 characters, so the text's max-content is 495.4px (ToS) and
			    494.3px (Privacy) inside a 736px content box. It sat flush-left in
			    a centred box: inked left margin 352px, inked right margin 592.6px
			    — 240.6px of asymmetry, which is exactly the "sits left of centre"
			    a reader sees. At 390 and 320 the box is narrower than the natural
			    measure, the text fills it, and the asymmetry was already nil
			    (−1.5px / −1.8px).

			    ⇒ `w-fit` on ONE inner wrapper. `fit-content` resolves to
			    min(max-content, available), so this column is the documents' own
			    measure where that is narrower than the box, and the full box
			    where it is not — `mx-auto` then centres whichever it took. No
			    magic number is read off today's placeholder text: swap in a
			    document whose lines run long and this widens to the container by
			    the same rule. Headings, bodies and colophon share the one measure,
			    so the page reads as a single column rather than a centred box with
			    left-hugging text. */}
			<div className="mx-auto flex w-fit flex-col gap-8">
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
				    be the second place the text is hidden.

				    ⛔ ONE `<pre>` PER SECTION, NOT ONE PER DOCUMENT, and the split is
				    LOSSLESS — `splitLegalSections` guarantees the chunks re-join to
				    the file byte for byte, asserted against the real files on disk.
				    The only reason to split at all is that a margin figure needs an
				    anchor: each chunk gets a `relative` wrapper, and its figure hangs
				    off that wrapper's edge.

				    ⚠ NO GAP BETWEEN THE CHUNKS. The documents supply their own blank
				    lines between sections, and `whitespace-pre-wrap` renders them; a
				    flex `gap` here would add a second helping of space to every seam
				    and the page would read as though it had been double-spaced. The
				    heading keeps its `gap-3` from the body — that one is the page's,
				    not the document's. */}
				{documents.map((doc) => (
					<section key={doc.title} className="flex flex-col gap-3">
						<h2 className="text-base font-medium text-ink">{doc.title}</h2>
						<div>
							{splitLegalSections(doc.body).map((chunk, index) => {
								// Chunk 0 is the preamble — title, version line, the
								// sentence pointing at the sibling document. It is not a
								// numbered section and takes no figure.
								const figure = index === 0 ? null : doc.figures[index - 1];
								// The counter advances ONLY where a figure is actually
								// placed. Advancing it on the figure-less preamble would
								// spend a side on nothing and invert the alternation for
								// every section after it.
								const side: "left" | "right" = figure
									? placed++ % 2 === 0
										? "left"
										: "right"
									: "left";
								return (
									<div
										// biome-ignore lint/suspicious/noArrayIndexKey: the chunk list is derived from a static file read at render; position IS the identity here, and two sections could legitimately carry identical text.
										key={`${doc.title}-${index}`}
										className="relative"
									>
										{figure ? <LegalFigure name={figure} side={side} /> : null}
										<pre className="font-sans text-sm whitespace-pre-wrap text-n6">
											{chunk}
										</pre>
									</div>
								);
							})}
						</div>
					</section>
				))}

				{/* The colophon, and deliberately NOT a `<footer>` element. SPEC.1
				    1.0.26 withdrew the page-level footer product-wide, and
				    `tests/unit/shell/not-found.test.tsx` reads a `<footer>` that is
				    not nested in a content container as exactly that — it reddened
				    on this line before this note existed.

				    ⚠ IT IS ALSO NOW THE PRODUCT'S ONLY VERSION LABEL. The
				    acceptance screen carried one until ONBOARD-CARD-2 moved it
				    here, beneath the documents it identifies — so this line is
				    load-bearing rather than decorative, and removing it would take
				    the version label out of the product entirely. */}
				<p className="pt-4 [border-top:var(--hairline)]">
					{/* `break-all`: since LEGAL.1 each identifier is a 64-character
					    SHA-256 with no break opportunity, which would overflow the
					    column on a phone. */}
					<small className="text-xs break-all text-n5">
						ToS {TOS_VERSION_HASH} · Privacy {PRIVACY_VERSION_HASH}
					</small>
				</p>
			</div>
		</PageContainer>
	);
}
