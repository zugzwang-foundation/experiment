import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

/**
 * RADIO-1 G10 — `InfoTip` must not come back onto the Radio controls. On touch
 * at ≥640px its Popover branch merges a click toggle onto its child, so one tap
 * would press the control AND open the gloss.
 *
 * The scan runs on COMMENT-STRIPPED source — the docblock names the very
 * component it bans, and six earlier negative scans in this repo matched the
 * comment explaining the absence (AGENTS.md §8). The negative has a positive
 * control.
 */

const ROOT = process.cwd();

function stripComments(source: string): string {
	return source
		.replace(/\/\*[\s\S]*?\*\//g, "")
		.replace(/^\s*\/\/.*$/gm, "")
		.replace(/\/\/[^"'`\n]*$/gm, "");
}

const read = (file: string) =>
	stripComments(readFileSync(join(ROOT, file), "utf8"));

describe("RADIO-1 G10 — no InfoTip on the Radio controls", () => {
	it("RadioSlot does not use InfoTip", () => {
		expect(read("src/components/shell/RadioSlot.tsx")).not.toMatch(
			/\bInfoTip\b/,
		);
	});

	it("positive control: the same scan finds InfoTip where it is used", () => {
		expect(read("src/components/shell/GitHubStars.tsx")).toMatch(/\bInfoTip\b/);
	});
});
