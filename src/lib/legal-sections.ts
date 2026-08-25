/**
 * Split a legal document into its numbered sections, LOSSLESSLY.
 *
 * `/legal` renders each section in its own positioned wrapper so a margin
 * figure can sit beside it. That is the only reason this exists: the documents
 * are one flat `.txt` each, and a figure needs an anchor.
 *
 * ⛔ THE ROUND TRIP IS THE CONTRACT. `split(source).join("\n") === source`,
 * byte for byte — no trimming, no normalising, no dropping of blank lines. The
 * text on screen has to be the text that was signed off and, at LEGAL.1, the
 * text a version hash will describe; a renderer that quietly reflows it would
 * make the displayed document and the recorded one two different things.
 * `tests/unit/legal/sections.test.ts` asserts the round trip against the real
 * files on disk rather than a fixture, so swapping in a new revision cannot
 * make it pass vacuously.
 *
 * A heading is a line that begins `<digits>. ` — the shape both documents use
 * and nothing else in them does. The text before the first heading (title,
 * version line, preamble) comes back as the first chunk and carries no figure.
 *
 * ⚠ If a document ever opened with a heading on line 1 the leading chunk would
 * be empty and the join would gain a newline the source never had. Neither
 * document does, and the round-trip test is what would catch it if one ever
 * did — stated here so the assumption is visible rather than buried.
 */

const HEADING = /^\d+\. \S/;

export function splitLegalSections(source: string): string[] {
	const lines = source.split("\n");
	const starts: number[] = [];
	for (const [index, line] of lines.entries()) {
		if (HEADING.test(line)) starts.push(index);
	}
	if (starts.length === 0) return [source];

	const chunks: string[] = [lines.slice(0, starts[0]).join("\n")];
	for (const [n, start] of starts.entries()) {
		const end = starts[n + 1] ?? lines.length;
		chunks.push(lines.slice(start, end).join("\n"));
	}
	return chunks;
}
