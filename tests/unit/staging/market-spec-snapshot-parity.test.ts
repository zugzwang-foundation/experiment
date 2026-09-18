import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

// ═══════════════════════════════════════════════════════════════════════════
// D-50 · THE CHAIN OF CUSTODY FROM THE FOUNDER'S SPEC TO THE COMMITTED ROW.
//
// ⛔⛔ THIS GUARD EXISTS BECAUSE THE LINK IT CHECKS WAS THE ONLY UNGUARDED ONE,
// AND IT IS THE LINK THAT DECIDES WHAT PRODUCTION SAYS.
//
// `scripts/apply-v3-market-specs.ts` asserts, inside its own transaction, that
// the database ends byte-equal to `docs/data/<env>-markets-snapshot.json`. D-50
// ruling 3 says: "The spec files are the source; the committed market snapshots
// record the result." So the snapshot is a MIDDLEMAN — and nothing compared it
// against `docs/markets/MKT-*.md`.
//
// The consequence of that gap is specific and quiet: a transcription slip in
// either snapshot would be written to production with a GREEN postcondition (it
// only ever compares the DB to the snapshot), a GREEN
// `content-markets-source.test.ts` (it checks shape, ids, deadlines and
// description LENGTHS, never the words), and a GREEN
// `resolution-block-data.test.ts` (it checks slugs and CLOSES dates, never the
// title or criterion). Every gate would pass and the market would ask the wrong
// question. `apply-v3-market-specs.ts`'s own header names that outcome: "drift
// in market copy is a resolution dispute."
//
// ⛔ AND THE SECOND HALF IS LITERALLY RULING 3's TEXT. "Both environments carry
// identical v3.0 wording afterwards" is a property OF THE PAIR OF SNAPSHOTS, and
// no test compared them to each other. `bitcoin-price-50k` is excluded BY NAME,
// because ruling 4 leaves MKT-BTC-01 at v2.2 and its two environments have
// genuinely divergent copy (prod 2 457 characters against staging 3 795) —
// excluding it by name rather than by "skip anything that differs" is what keeps
// this assertion from going vacuous the moment a second market drifts.
//
// ⚠ THE PARSE IS THE SAME ONE THE PR USED TO WRITE THE SNAPSHOTS, and that is a
// real limitation rather than a hidden one: this file re-derives the mapping
// instead of importing it, because there is nothing to import — the mapping was
// a one-off transformation. So this guard cannot catch a wrong MAPPING; it
// catches DRIFT, which is the failure that actually recurs (someone edits a
// snapshot, or a spec, and not the other). The mapping itself was proved once,
// differently and more strongly: all six of production's live v2.2 titles and
// descriptions regenerate from their v2.2 spec files byte-for-byte.
// ═══════════════════════════════════════════════════════════════════════════

const SPEC_CODES = ["CHE", "CLA", "GIT", "MAT", "YCP"] as const;

/** MKT-BTC-01 keeps v2.2 (D-50 ruling 4), so it is out of both assertions. */
const NOT_RULED = "bitcoin-price-50k";

interface SnapshotMarket {
	slug: string;
	title: string;
	description: string;
}

function read(rel: string): string {
	return readFileSync(fileURLToPath(new URL(rel, import.meta.url)), "utf8");
}

function snapshot(name: string): SnapshotMarket[] {
	const raw = JSON.parse(read(`../../../docs/data/${name}`)) as {
		markets: SnapshotMarket[];
	};
	return raw.markets;
}

/**
 * The spec → row mapping, re-derived: `description` is the body paragraphs of
 * §1 + §2 + §3 with the headings stripped and a blank line between them;
 * `title` and `slug` are the §5 fenced blocks verbatim.
 *
 * ⚠ Written as three narrow regexes over the spec's own headings rather than a
 * loose scrape, so a spec that loses a section fails LOUDLY here instead of
 * silently contributing a shorter description.
 */
function fieldsFromSpec(code: string): SnapshotMarket {
	const src = read(`../../../docs/markets/MKT-${code}-01.md`);
	const sections = new Map<number, string>();
	// ⛔⛔ SPLIT ON THE HEADINGS, NEVER A LOOKAHEAD TO END-OF-INPUT, AND THIS
	// FILE'S FIRST RUN IS WHY. The first draft used `(?=^## |\\Z)` — correct in
	// Python, where `\\Z` is end-of-string, and NONSENSE in JavaScript, where
	// `\\Z` is the literal letter Z. Every description silently truncated at its
	// first "Zugzwang", which is the second word of most of them. ⚠ The reason it
	// is worth a comment rather than a quiet fix: the failure was INVISIBLE to
	// the regex and visible only in the diff, and a guard whose parse truncates
	// would have had to be "fixed" by loosening the comparison — at which point
	// it would pass forever and check nothing. It went red on the first run and
	// named the market; splitting has no end-of-input case to get wrong.
	const chunks = src.split(/^## /m).slice(1);
	for (const chunk of chunks) {
		const head = chunk.match(/^(\d+) · [^\n]*\n/);
		if (!head) continue;
		sections.set(Number(head[1]), chunk.slice(head[0].length));
	}
	const paras = (n: number): string[] => {
		const body = sections.get(n);
		if (body === undefined) {
			throw new Error(`MKT-${code}-01.md has no section ${n}`);
		}
		return body
			.split(/\n\s*\n/)
			.map((p) => p.trim())
			.filter((p) => p.length > 0);
	};
	const fence = (label: string): string => {
		const m = src.match(
			new RegExp(`\\*\\*${label}\\*\\*[^\\n]*\\n+\`\`\`\\n(.*?)\\n\`\`\``, "s"),
		);
		if (!m) throw new Error(`MKT-${code}-01.md has no ${label} fence`);
		return m[1].trim();
	};
	return {
		slug: fence("Slug"),
		title: fence("Title"),
		description: [...paras(1), ...paras(2), ...paras(3)].join("\n\n"),
	};
}

const SPECS = SPEC_CODES.map((c) => fieldsFromSpec(c));

describe("D-50 · the five specs reach both snapshots unaltered", () => {
	it("spec-parity::the-parse-found-five-complete-specs", () => {
		// ⛔ CONTROL FIRST — every assertion below loops over SPECS, and a parse
		// that yielded an empty array, or an empty description, would satisfy all
		// of them while looking at nothing.
		expect(SPECS).toHaveLength(5);
		for (const s of SPECS) {
			expect({
				slug: s.slug,
				titled: s.title.length > 0,
				// The shortest v3.0 criterion is 792 characters; 400 is a floor that
				// catches a section that failed to parse without pinning a figure that
				// moves whenever the founder edits a word.
				criterion: s.description.length > 400,
			}).toEqual({ slug: s.slug, titled: true, criterion: true });
		}
	});

	it.each([
		"prod-markets-snapshot.json",
		"staging-markets-snapshot.json",
	])("spec-parity::%s carries each spec's title, slug and criterion byte-for-byte", (file) => {
		const rows = snapshot(file);
		expect(rows).toHaveLength(6);
		let checked = 0;
		for (const spec of SPECS) {
			const row = rows.find((r) => r.slug === spec.slug);
			expect(row, `${file} has no market with slug ${spec.slug}`).toBeDefined();
			if (!row) throw new Error("unreachable — narrowing");
			// ⚠ One object comparison rather than three assertions: a mismatch
			// then reports WHICH field moved and by how much, on the slug, in one
			// diff. Three separate `expect`s stop at the first.
			expect({
				slug: row.slug,
				title: row.title,
				description: row.description,
			}).toEqual({
				slug: spec.slug,
				title: spec.title,
				description: spec.description,
			});
			checked += 1;
		}
		expect(checked).toBe(5);
		// ⚠ And the market the ruling does NOT touch must still be in the file —
		// a snapshot that lost it would satisfy everything above.
		expect(rows.some((r) => r.slug === NOT_RULED)).toBe(true);
	});

	it("spec-parity::both-environments-carry-IDENTICAL-v3.0-wording — ruling 3", () => {
		// ⛔⛔ THIS IS RULING 3's OWN SENTENCE AS AN ASSERTION. It was not true
		// before D-50: staging had never received v2.2, so five of the six
		// descriptions and one title differed between the two environments.
		const prod = snapshot("prod-markets-snapshot.json");
		const stg = snapshot("staging-markets-snapshot.json");
		let checked = 0;
		for (const spec of SPECS) {
			const p = prod.find((r) => r.slug === spec.slug);
			const s = stg.find((r) => r.slug === spec.slug);
			expect({
				slug: spec.slug,
				inProd: p !== undefined,
				inStg: s !== undefined,
			}).toEqual({ slug: spec.slug, inProd: true, inStg: true });
			if (!p || !s) throw new Error("unreachable — narrowing");
			expect({
				slug: spec.slug,
				title: p.title,
				description: p.description,
			}).toEqual({
				slug: spec.slug,
				title: s.title,
				description: s.description,
			});
			checked += 1;
		}
		expect(checked).toBe(5);
	});

	it("spec-parity::MKT-BTC-01-is-excluded-by-NAME-and-its-divergence-is-expected", () => {
		// ⛔ THE NEGATIVE CONTROL FOR THE ARM ABOVE, and the reason this file can
		// claim that arm means something. `bitcoin-price-50k` is the one market
		// ruling 4 leaves at v2.2, and its two environments hold different copy.
		// If this ever goes GREEN-BY-EQUALITY, the ruling-3 arm above has lost its
		// ability to distinguish "identical because D-50 made them identical" from
		// "identical because both files came from one place" — which is the exact
		// mistake that would let a staging capture be used to seed production.
		const prod = snapshot("prod-markets-snapshot.json");
		const stg = snapshot("staging-markets-snapshot.json");
		const p = prod.find((r) => r.slug === NOT_RULED);
		const s = stg.find((r) => r.slug === NOT_RULED);
		expect(p).toBeDefined();
		expect(s).toBeDefined();
		if (!p || !s) throw new Error("unreachable — narrowing");
		// The titles DO agree; it is the criterion that diverges.
		expect(p.description).not.toBe(s.description);
		// And no spec in this ruling claims it.
		expect(SPECS.map((x) => x.slug)).not.toContain(NOT_RULED);
	});
});
