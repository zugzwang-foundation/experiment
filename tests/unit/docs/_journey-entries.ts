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
 *   ### <Title>                     <- the entry's own delimiter
 *   `<abridged subject>` · <date> · week <N>
 *   <!-- TIER: LANDMARK -->         <- metadata, added without touching prose
 *
 *   <prose, one to three paragraphs, blank-line separated>
 *
 *   | a table |                     <- Landmark furniture, not prose
 *   |---|---|
 *
 *   ---                             <- entry separator
 *
 * ⚠ THE TIER MARKER IS AN HTML COMMENT ON ITS OWN LINE, AFTER THE MONO LINE,
 * and both halves of that are load-bearing. It is a comment because these are
 * 340 published records and a marker that renders would change what a reader
 * meets. It sits AFTER the mono line because the mono line's position — always
 * the line immediately following its heading — is what every existing reader
 * of this corpus assumes, including the pass that verified the numbering.
 */

export type Tier = "LANDMARK" | "CHAPTER" | "GROUNDWORK" | "UNKNOWN";

export const CEILINGS: Record<Exclude<Tier, "UNKNOWN">, number> = {
	LANDMARK: 200,
	CHAPTER: 90,
	GROUNDWORK: 40,
};

export type Entry = {
	file: string;
	line: number;
	title: string;
	mono: string;
	tier: Tier | null;
	/** Prose lines only — no heading, mono line, marker, table row or rule. */
	prose: string[];
	/** Every line a reader sees below the mono line, tables included. */
	visible: string[];
	words: number;
};

const TIER_MARKER =
	/^<!--\s*TIER:\s*(LANDMARK|CHAPTER|GROUNDWORK|UNKNOWN)\s*-->$/;

/**
 * A word is a run of letters or digits (style spec §3). Not `split(" ")`:
 * an em-dash pivot glued to its neighbours — like this — would otherwise count
 * as one word, and this corpus uses that construction constantly.
 */
export const countWords = (text: string): number =>
	(text.match(/[A-Za-z0-9]+/g) ?? []).length;

export const journeyDir = (): string => join(process.cwd(), "docs", "journey");

/** The act files, in reading order. `README.md` is the index, not an act. */
export const actFiles = (): string[] =>
	readdirSync(journeyDir())
		.filter((f) => /^\d{2}-.*\.md$/.test(f))
		.sort();

export const parseEntries = (): Entry[] => {
	const out: Entry[] = [];
	for (const file of actFiles()) {
		const lines = readFileSync(join(journeyDir(), file), "utf8").split("\n");
		for (let i = 0; i < lines.length; i++) {
			if (!lines[i].startsWith("### ")) continue;
			const title = lines[i].slice(4).trim();
			const mono = lines[i + 1] ?? "";
			const prose: string[] = [];
			const visible: string[] = [];
			let tier: Tier | null = null;
			let j = i + 2;
			for (; j < lines.length && !lines[j].startsWith("### "); j++) {
				const raw = lines[j];
				const t = raw.trim();
				if (t === "" || t === "---") continue;
				const marker = TIER_MARKER.exec(t);
				if (marker) {
					tier = marker[1] as Tier;
					continue;
				}
				visible.push(raw);
				if (t.startsWith("|")) continue;
				prose.push(raw);
			}
			out.push({
				file,
				line: i + 1,
				title,
				mono,
				tier,
				prose,
				visible,
				words: countWords(prose.join("\n")),
			});
			i = j - 1;
		}
	}
	return out;
};
