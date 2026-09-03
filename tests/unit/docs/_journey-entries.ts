import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * ONE PARSER FOR THE THREE JOURNEY DRIFT GUARDS.
 *
 * `docs/journey/` is written by hand, entry by entry, and its defence against
 * drift used to be a human holding the voice in context across hundreds of
 * them. A single unattended pass has no such reader, so the defence has to be
 * mechanical — which means all three guards need the same idea of where an
 * entry starts, what counts as its prose, and which tier's ceiling applies.
 * Three private parsers would drift apart from each other, which is the exact
 * failure they exist to catch, one level up.
 *
 * The shape they parse, fixed by the corpus rather than chosen here:
 *
 *   # Act <ROMAN> — <Title>
 *   *n<A>–<B> · <dates>*
 *   <bridge prose>              <- BRIDGE: everything before the first entry
 *
 *   ### <Title>                 <- the entry's own delimiter
 *   `<abridged subject>` · <date> · week <N>
 *   <!-- TIER: LANDMARK -->     <- metadata, added without touching prose
 *
 *   <prose, one to three paragraphs, blank-line separated>
 *
 *   | a table |                 <- Landmark furniture, not prose
 *   |---|---|
 *
 *   ---                         <- entry separator
 *
 * ⚠ THE TIER MARKER IS AN HTML COMMENT ON ITS OWN LINE, AFTER THE MONO LINE,
 * and both halves of that are load-bearing. It is a comment because these are
 * published records and a marker that renders would change what a reader meets.
 * It sits AFTER the mono line because the mono line's position — always the
 * line immediately following its heading — is what every existing reader of
 * this corpus assumes, including the pass that verified the numbering.
 *
 * ⚠ `actFiles()` MATCHES `NN-*.md` AND THAT IS NOT COSMETIC. Two other markdown
 * files live in this directory and neither is an act: `README.md` is the index,
 * and `STYLE.md` — the ratified style spec, which has lived here since this
 * guard family landed — carries **21 `### ` headings of its own**, being its
 * own section headings. Widening this pattern would pull all 21 into the entry
 * set, into the title-collision guard, and into the word ceilings, where they
 * have no tier and no meaning. The guards assert the exact file list rather
 * than trusting this regex, because a file that stops matching it disappears
 * from all three guards in silence.
 */

export type Tier = "LANDMARK" | "CHAPTER" | "GROUNDWORK" | "UNKNOWN";

export const CEILINGS: Record<Exclude<Tier, "UNKNOWN">, number> = {
	LANDMARK: 200,
	CHAPTER: 90,
	GROUNDWORK: 40,
};

/** The nine act files, pinned. A tenth is a decision; a missing one is a defect. */
export const EXPECTED_ACT_FILES = [
	"01-before-anything.md",
	"02-the-ground.md",
	"03-the-engine.md",
	"04-the-argument.md",
	"05-the-audit.md",
	"06-the-face.md",
	"07-the-last-mile.md",
	"08-the-instruments.md",
	"09-the-window.md",
] as const;

export type Entry = {
	file: string;
	line: number;
	title: string;
	mono: string;
	/** Whether the mono line has the shape `\`subject\` · <date> · week <N>`. */
	monoOk: boolean;
	tier: Tier | null;
	/** Every tier marker found. More than one is contradictory metadata. */
	markers: Tier[];
	/** Prose lines only — no heading, mono line, marker, table row or rule. */
	prose: string[];
	/**
	 * The prose as a reader meets it, paragraph breaks preserved. `prose` drops
	 * blank lines because a word count does not want them; anything comparing an
	 * entry to a copy of itself does. Reconstructing with `join("\n")` silently
	 * welds a three-paragraph entry into one — green for the single-paragraph
	 * entries that happen to exist today, red on the next multi-paragraph one,
	 * and the natural repair is to loosen the comparison, which would destroy
	 * the byte-identity the notes ref's whole review argument rests on.
	 */
	proseText: string;
	/** Every line a reader sees below the mono line, tables included. */
	visible: string[];
	tableRows: number;
	words: number;
};

/** An act file's bridge: every non-blank line before its first entry. */
export type Bridge = { file: string; lines: string[]; words: number };

const TIER_MARKER =
	/^<!--\s*TIER:\s*(LANDMARK|CHAPTER|GROUNDWORK|UNKNOWN)\s*-->$/;

/** `\`subject\` · 3 September 2026 · week 20` */
const MONO_SHAPE = /^`.+`\s·\s.+\s·\sweek\s\d+$/;

/**
 * A word is a run of letters or digits (style spec §3). Not `split(" ")`:
 * an em-dash pivot glued to its neighbours — like this — would otherwise count
 * as one word, and this corpus uses that construction constantly.
 */
export const countWords = (text: string): number =>
	(text.match(/[A-Za-z0-9]+/g) ?? []).length;

export const journeyDir = (): string => join(process.cwd(), "docs", "journey");

/** The act files, in reading order. See the docblock: `README.md` and `STYLE.md` are not acts. */
export const actFiles = (): string[] =>
	readdirSync(journeyDir())
		.filter((f) => /^\d{2}-.*\.md$/.test(f))
		.sort();

/**
 * How many entries the directory contains, counted WITHOUT the act-file regex —
 * every `### ` heading in every `.md` here except the index and the spec. It is
 * the independent control on `actFiles()`: if a file stops matching `NN-*.md`
 * its entries vanish from `parseEntries()` but not from this, and the two
 * numbers separate.
 */
export const headingCountAcrossDir = (): number => {
	let n = 0;
	for (const f of readdirSync(journeyDir())) {
		if (!f.endsWith(".md")) continue;
		if (f === "README.md" || f === "STYLE.md") continue;
		for (const line of readFileSync(join(journeyDir(), f), "utf8").split(
			"\n",
		)) {
			if (line.startsWith("### ")) n++;
		}
	}
	return n;
};

/**
 * Titles compared for collision are normalised: case-folded, punctuation
 * stripped, whitespace collapsed. Read cold as a git note — the surface that
 * makes a collision unrecoverable — `Green And Gone` and `green and gone` are
 * the same title, and a byte comparison would let the second one through.
 */
export const normaliseTitle = (t: string): string =>
	t
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, " ")
		.trim();

/**
 * The bridge is the PROSE at the head of an act — not its title, not its front
 * matter, and not the machinery block. All three sit in the same region and all
 * three would distort a word count and a shorthand scan if swept in: the front
 * matter is `*n347–433 · dates*`, which is technical by design, and Act VIII's
 * front matter carries a multi-line HTML comment recording the date basis, the
 * week formula and the count that named the act. Act I has no bridge at all —
 * its first entry is four lines in — so it correctly measures zero.
 */
export const parseBridges = (): Bridge[] =>
	actFiles().map((file) => {
		const lines = readFileSync(join(journeyDir(), file), "utf8").split("\n");
		const out: string[] = [];
		let inComment = false;
		for (const raw of lines) {
			if (raw.startsWith("### ")) break;
			const t = raw.trim();
			if (inComment) {
				if (t.includes("-->")) inComment = false;
				continue;
			}
			if (t.startsWith("<!--")) {
				if (!t.includes("-->")) inComment = true;
				continue;
			}
			if (t === "" || t === "---") continue;
			if (t.startsWith("#")) continue; // the act's own title
			if (/^\*.*\*$/.test(t)) continue; // the front-matter span line
			out.push(raw);
		}
		return { file, lines: out, words: countWords(out.join("\n")) };
	});

export const parseEntries = (): Entry[] => {
	const out: Entry[] = [];
	for (const file of actFiles()) {
		const lines = readFileSync(join(journeyDir(), file), "utf8").split("\n");
		for (let i = 0; i < lines.length; i++) {
			if (!lines[i].startsWith("### ")) continue;
			const title = lines[i].slice(4).trim();
			const mono = lines[i + 1] ?? "";
			const prose: string[] = [];
			const proseParas: string[] = [];
			const visible: string[] = [];
			const markers: Tier[] = [];
			let tableRows = 0;
			let gap = false;
			let j = i + 2;
			for (; j < lines.length && !lines[j].startsWith("### "); j++) {
				const raw = lines[j];
				const t = raw.trim();
				if (t === "") {
					if (prose.length > 0) gap = true;
					continue;
				}
				if (t === "---") continue;
				const marker = TIER_MARKER.exec(t);
				if (marker) {
					markers.push(marker[1] as Tier);
					continue;
				}
				visible.push(raw);
				if (t.startsWith("|")) {
					tableRows++;
					continue;
				}
				if (gap) proseParas.push("");
				gap = false;
				prose.push(raw);
				proseParas.push(raw);
			}
			out.push({
				file,
				line: i + 1,
				title,
				mono,
				monoOk: MONO_SHAPE.test(mono.trim()),
				tier: markers.length === 1 ? markers[0] : null,
				markers,
				prose,
				proseText: proseParas.join("\n"),
				visible,
				tableRows,
				words: countWords(prose.join("\n")),
			});
			i = j - 1;
		}
	}
	return out;
};
