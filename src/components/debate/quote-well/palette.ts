/**
 * UIR-9 — THE SIXTEEN FILLS a text-only post's picture is drawn on, and the
 * pick that gives each post its one. Each entry is a fill and the tint of the
 * two quotation marks drawn on it; the title on every fill stays
 * `--color-ink`.
 *
 * ⛔⛔ COLOUR IN A MONOCHROME PRODUCT, BY RULING, AND ONLY HERE. The founder
 * reopened design-language §1 constraints 2 and 4, and constraint 9's "no
 * accent" line, on 2026-09-29 for this card's fill alone: these sixteen are the
 * only colours that reopening admits, and nothing else may borrow them.
 * ⚠ `tests/unit/design/no-raw-hex-view-layer.test.ts` scans this directory for
 * hex literals and predates the ruling; this file is what it will flag.
 */
export const QUOTE_FILLS = [
	{ name: "Petrol", fill: "#0b425c", mark: "#93b7cd" },
	{ name: "Lagoon", fill: "#235972", mark: "#9bc1d5" },
	{ name: "Slate", fill: "#536067", mark: "#c6cfd4" },
	{ name: "Azure", fill: "#136397", mark: "#b3d2ed" },
	{ name: "Steel", fill: "#3a495d", mark: "#9db3d1" },
	{ name: "Denim", fill: "#334478", mark: "#a4b1d2" },
	{ name: "Navy", fill: "#1b3370", mark: "#a2b1d2" },
	{ name: "Dusk", fill: "#49567f", mark: "#b7c3e5" },
	{ name: "Periwinkle", fill: "#565399", mark: "#c5c7eb" },
	{ name: "Indigo", fill: "#432d70", mark: "#b3abce" },
	{ name: "Heather", fill: "#503d66", mark: "#b8aacb" },
	{ name: "Grape", fill: "#673e7d", mark: "#c3afcf" },
	{ name: "Aubergine", fill: "#472b4f", mark: "#bfa8c6" },
	{ name: "Orchid", fill: "#784784", mark: "#d6bddc" },
	{ name: "Mauve", fill: "#5f4a64", mark: "#c9b1cf" },
	{ name: "Smoke", fill: "#433a43", mark: "#b5afb5" },
] as const;

export type QuoteFill = (typeof QUOTE_FILLS)[number];

/**
 * A post's entry: the 32-bit FNV-1a hash of its id, modulo 16. No randomness,
 * no clock, no state and no storage, so the same post draws the same fill on
 * every surface, every visit and every poll, and the server's render and the
 * client's agree. The id is a UUIDv7 string, so its UTF-16 code units are the
 * bytes the hash is defined over.
 */
export function quoteFill(postId: string): QuoteFill {
	let hash = 0x811c9dc5;
	for (let i = 0; i < postId.length; i++) {
		hash ^= postId.charCodeAt(i);
		hash = Math.imul(hash, 0x01000193);
	}
	return QUOTE_FILLS[(hash >>> 0) % QUOTE_FILLS.length];
}
