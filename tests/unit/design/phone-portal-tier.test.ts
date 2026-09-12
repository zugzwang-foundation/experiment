/**
 * MOBILE-2b · RI-5 / O-m — the guard ADR-0051 Amendment A1 promises.
 *
 * A1's second Consequence says, in terms: *"the tier gate is a property of DOM
 * position, and a portal leaves the DOM position: portal content opened from the
 * phone tree carries `data-tier="phone"` and is styled for the phone; **a guard
 * pins that every portal opener under `phone/` passes it**."* Until this file
 * there was no such guard, and `@code-reviewer` and `@security-auditor` both said
 * so: the attribute was write-only, so a fourth portal opener added under
 * `phone/` could omit it and nothing would notice — which is precisely the
 * failure the attribute was minted against.
 *
 * ⚠ WHY A SOURCE SCAN RATHER THAN A RENDER. The claim is about EVERY opener,
 * including ones nobody has written yet. A render test can only assert the
 * three that exist; a scan over the directory fails the moment a fourth arrives
 * without the attribute, which is the shape of the obligation.
 *
 * ⚠ AND IT MATCHES A JSX TOKEN, NOT A BARE WORD. This repository has been bitten
 * six times by a textual guard that matched the comment explaining the absence
 * rather than the code — so the source is comment-stripped first, and the
 * positive control below proves the stripper did not simply eat everything.
 */
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

const PHONE_DIR = join(process.cwd(), "src/components/debate/phone");
const DIALOGS = join(process.cwd(), "src/components/debate/dialogs.tsx");

/** Block and line comments removed, so a guard cannot match its own prose. */
function stripComments(source: string): string {
	return source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/[^\n]*/g, "");
}

/** The portal-rendering components this rule is about. */
const PORTAL_COMPONENTS = ["PostPopup", "ReplyPopup", "ImageLightbox"] as const;

function phoneSources(): { file: string; code: string }[] {
	return readdirSync(PHONE_DIR)
		.filter((f) => f.endsWith(".tsx"))
		.map((f) => ({
			file: f,
			code: stripComments(readFileSync(join(PHONE_DIR, f), "utf8")),
		}));
}

describe("phone-tier::every portal opener under phone/ declares its tier", () => {
	it("POSITIVE CONTROL — the scan finds the openers at all", () => {
		const found = phoneSources().flatMap(({ file, code }) =>
			PORTAL_COMPONENTS.filter((c) => code.includes(`<${c}`)).map(
				(c) => `${file}:${c}`,
			),
		);
		// Without this, an empty directory read or an over-eager comment stripper
		// would satisfy every assertion below by finding nothing to check.
		expect(found.length).toBe(PORTAL_COMPONENTS.length);
	});

	it('each opener passes tier="phone"', () => {
		for (const { file, code } of phoneSources()) {
			for (const component of PORTAL_COMPONENTS) {
				const at = code.indexOf(`<${component}`);
				if (at === -1) continue;
				// The element's own attribute list, from the tag name to the first
				// `/>` — not a window of N characters, which would drift with any
				// edit above it.
				const close = code.indexOf("/>", at);
				expect(
					close,
					`${file}: <${component} has no self-closing tag`,
				).toBeGreaterThan(at);
				const element = code.slice(at, close);
				expect(
					element,
					`${file}: <${component}> portals to document.body and must declare tier="phone" (ADR-0051 A1)`,
				).toContain('tier="phone"');
			}
		}
	});

	it("and dialogs.tsx renders it as an attribute rather than dropping it", () => {
		const code = stripComments(readFileSync(DIALOGS, "utf8"));
		// One stamp per portal component that takes the prop. `ResolutionPopup`
		// deliberately does NOT — it has no opener under phone/, and stamping a
		// provenance it does not have would make the marker mean "a dialog"
		// rather than "a dialog the phone tree opened".
		const stamps = code.match(/data-tier=\{tier\}/g) ?? [];
		expect(stamps.length).toBe(PORTAL_COMPONENTS.length);
		expect(code).not.toContain('data-tier="phone"');
	});
});
