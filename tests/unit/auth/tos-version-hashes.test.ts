import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import {
	PRIVACY_VERSION_HASH,
	TOS_VERSION_HASH,
} from "@/server/auth/tos-versions";

// LEGAL.1 — the acceptance-evidence identifiers are the documents' content
// hashes (SPEC.1 §13 F-AUTH-4), frozen as literals in `tos-versions.ts`. This
// file is what keeps "frozen" from meaning "stale": it recomputes each hash from
// the bytes `/legal` renders and fails when a document changes without its
// identifier, which would otherwise record acceptance of text nobody was shown.
//
// ⚠ The files are hashed as bytes, not as decoded text. `.gitattributes` pins
// `eol=lf`, so every checkout — CI, Vercel, a Windows clone — holds the same
// bytes the hash names; decoding and re-encoding would hash something else.

function sha256OfLegalFile(name: "tos" | "privacy"): string {
	const bytes = readFileSync(
		join(process.cwd(), "public", "legal", `${name}.txt`),
	);
	return createHash("sha256").update(bytes).digest("hex");
}

describe("ToS / Privacy version identifiers (LEGAL.1)", () => {
	it("tos-version::equals-the-sha256-of-public-legal-tos-txt", () => {
		expect(TOS_VERSION_HASH).toBe(sha256OfLegalFile("tos"));
	});

	it("tos-version::privacy-equals-the-sha256-of-public-legal-privacy-txt", () => {
		expect(PRIVACY_VERSION_HASH).toBe(sha256OfLegalFile("privacy"));
	});

	it("tos-version::names-the-documents-that-declare-version-1-0", () => {
		// The label a reader sees on the document and the hash the database
		// records must describe the same text; both files open on their version.
		for (const name of ["tos", "privacy"] as const) {
			const text = readFileSync(
				join(process.cwd(), "public", "legal", `${name}.txt`),
				"utf-8",
			);
			expect(text.split("\n")[2]).toBe(
				"Version 1.0 · Effective 15 September 2026",
			);
		}
	});
});
