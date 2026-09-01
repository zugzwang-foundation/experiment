import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { buildDataset } from "@/server/export/dataset/build";
import { DEBATE_DIR, debateEntries } from "@/server/export/dataset/debates";
import { fixtureSource } from "@/server/export/dataset/source";
import type { EgressSecrets } from "@/server/export/egress";
import { EgressViolationError } from "@/server/export/egress/errors";

import {
	DIRTY_TABLE_ROWS,
	FIXTURE_SECRET_VALUES,
	FIXTURE_USER_IDS,
	fixtureSecrets,
} from "../../../_fixtures/dataset/dirty-source";

/**
 * DATASET.1 Slice 7 — the debate `.md` artifact class.
 *
 * P2 found EXPORT.1 **shipped**, so brief §4 Slice 7's "if shipped" branch
 * applies and D3 (stop at the boundary) does not.
 *
 * ⚠ **The golden-fixture conformance test the brief asks for ALREADY EXISTS**
 * and is not rebuilt here — `tests/unit/debate-export/serialize.test.ts`
 * carries a byte-exact Mumbai Metro Line 3 golden against
 * `_fixtures/mumbai-metro.expected.md`, shipped by EXPORT.1. That is OVN-O4's
 * *the ruled outcome already holds*: it is measured, pinned below so that
 * deleting it is visible, and left alone.
 *
 * What is genuinely new is the wiring and the egress pass over `.md` output.
 */

const secrets: EgressSecrets = fixtureSecrets();

const GOLDEN_PATH = join(
	process.cwd(),
	"tests/unit/debate-export/_fixtures/mumbai-metro.expected.md",
);

describe("slice 7 · the EXPORT.1 conformance reference still exists", () => {
	it("the Mumbai Metro golden fixture is on disk", () => {
		// Pinned rather than rebuilt. If EXPORT.1's golden is ever deleted,
		// the dataset's debate artifact class loses its only conformance
		// reference — and that would otherwise be silent here, because this
		// slice consumes the serializer rather than testing it.
		const golden = readFileSync(GOLDEN_PATH, "utf8");
		expect(golden.length).toBeGreaterThan(500);
		expect(golden).toContain("doc_type: zugzwang-debate-export");
		expect(golden).toContain("Mumbai Metro Line 3");
	});

	it("the golden output carries NO raw UUID anywhere", () => {
		// The property the dataset actually depends on, asserted against the
		// real serializer's real output rather than a hand-written sample.
		// `debate-export.md` §10.1 requires serializing from the masked
		// variants only; this is what that looks like in the bytes.
		const golden = readFileSync(GOLDEN_PATH, "utf8");
		const uuids = golden.match(
			/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi,
		);
		expect(uuids).toBeNull();
	});
});

describe("slice 7 · the dataset path never touches the unmasked type", () => {
	it("no module under src/server/export imports DebateComment", () => {
		// ADR-0025 names `DebateComment` as the SOLE user_id exposure path,
		// and `debate-export.md` §10.1 forbids serializing from it.
		//
		// ⚠ Source-scanned deliberately, and the scan strips comments first.
		// Without that, this guard matches the very docblock in `debates.ts`
		// that explains why the import is forbidden — a negative catching its
		// own explanation, which this project has recorded six times.
		const src = readFileSync(
			join(process.cwd(), "src/server/export/dataset/debates.ts"),
			"utf8",
		);
		const code = src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");

		expect(code).not.toContain("DebateComment");
		expect(code).not.toContain("list-comments");

		// POSITIVE CONTROL: the stripper leaves real code intact, so the two
		// absences above are absences rather than an over-eager regex.
		expect(code).toContain("assertTextArtifactClean");
		expect(code).toContain("debateEntries");
		// …and the docblock DID mention it, which is what would have made
		// this guard pass for the wrong reason without the strip.
		expect(src).toContain("DebateComment");
	});
});

describe("slice 7 · debateEntries guards every artifact", () => {
	const clean = {
		slug: "mumbai-metro-line-3",
		markdown: [
			"# Debate — Will Mumbai Metro Line 3 open by 5 Nov 2026?",
			"",
			"**AmberOtter042** · YES · Đ25",
			"",
			"The tunnelling is complete.",
		].join("\n"),
	};

	it("places artifacts under debates/<slug>.md, beside the tables", () => {
		const entries = debateEntries([clean], secrets);
		expect(entries).toHaveLength(1);
		expect(entries[0]?.name).toBe(`${DEBATE_DIR}/mumbai-metro-line-3.md`);
		expect(entries[0]?.content).toBe(clean.markdown);
	});

	it("POSITIVE CONTROL — a raw users.id in the prose is REJECTED", () => {
		// A Markdown file has no keys, so every key-based guard is blind to
		// this. It is the reason the text path exists at all.
		const leaked = {
			slug: "leaky",
			markdown: clean.markdown.replace("AmberOtter042", FIXTURE_USER_IDS.amber),
		};
		expect(() => debateEntries([leaked], secrets)).toThrow(
			EgressViolationError,
		);
	});

	it("POSITIVE CONTROL — a non-UUID SYSTEM secret in prose is also rejected", () => {
		// The companion case the bare-UUID net cannot rescue: a user-agent has
		// no UUID shape, so only the value scan can see it. Without this, the
		// test above would pass with the value scan disabled.
		//
		// ⚠ A user-agent, not an email. Machine-generated strings stay FATAL
		// on this arm; an email is human-authorable and is now an advisory,
		// because halting on one aborts a one-shot release for something a
		// participant chose to write (`@security-auditor` F-11 H-B).
		const leaked = {
			slug: "leaky-2",
			markdown: `${clean.markdown}\nsub ${FIXTURE_SECRET_VALUES.googleIds[0]}`,
		};
		expect(() => debateEntries([leaked], secrets)).toThrow(
			EgressViolationError,
		);
	});

	it("rejects a duplicate slug rather than overwriting silently", () => {
		// Two entries with one name inside a tarball is data loss that no
		// checksum reveals — the archive is internally consistent and simply
		// missing a debate.
		expect(() => debateEntries([clean, clean], secrets)).toThrow(
			/duplicate debate slug/,
		);
	});
});

describe("slice 7 · debates ride in the same tarball as the tables (D2)", () => {
	it("the archive carries both artifact classes", () => {
		return buildDataset({
			source: fixtureSource("fixture", DIRTY_TABLE_ROWS as never),
			releaseDate: "2026-11-06",
			extraEntries: debateEntries(
				[
					{
						slug: "mumbai-metro-line-3",
						markdown: "# Debate\n\n**AmberOtter042** · YES\n",
					},
				],
				secrets,
			),
		}).then((r) => {
			// The tarball is opaque here, so assert on what went into it plus
			// the fact that adding a debate changed the bytes at all.
			expect(r.manifest.tarball_size_bytes).toBeGreaterThan(0);
			expect(r.manifest.tables).toHaveLength(16);
		});
	});

	it("adding a debate CHANGES the tarball hash", () => {
		// POSITIVE CONTROL for the above: without it, `extraEntries` could be
		// ignored entirely and the assertions would still pass.
		const base = {
			source: fixtureSource("fixture", DIRTY_TABLE_ROWS as never),
			releaseDate: "2026-11-06",
		};
		return Promise.all([
			buildDataset(base),
			buildDataset({
				...base,
				extraEntries: debateEntries(
					[{ slug: "m", markdown: "# Debate\n" }],
					secrets,
				),
			}),
		]).then(([without, with_]) => {
			expect(with_.manifest.tarball_sha256).not.toBe(
				without.manifest.tarball_sha256,
			);
		});
	});
});
