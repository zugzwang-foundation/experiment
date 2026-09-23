import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * MIRROR-1 · RF-8 / G7 — WHERE THE MIRROR APPEARS, pinned at the mounts.
 *
 * The Mirror is selected by one prop, so where it appears is decided entirely by
 * which `<BetComposer` mounts pass `mirror=`. RF-8: every mount above the phone
 * tier does, and the phone tier's does not — the phone keeps today's layout.
 * A source scan is the right instrument here because the question is about the
 * TEXT of three call sites; the render-level half (the default render is
 * byte-identical) is `classic-layout-baseline.test.tsx`.
 *
 * Comments are stripped before scanning: a negative scan that matches the comment
 * explaining an absence is this repository's most repeated guard defect.
 */

const ROOT = process.cwd();
const DESKTOP = "src/components/debate/DebateView.tsx";
const PHONE = "src/components/debate/phone/PhoneDebateView.tsx";

function code(path: string): string {
	return readFileSync(join(ROOT, path), "utf8")
		.replace(/\/\*[\s\S]*?\*\//g, "")
		.replace(/(^|[^:"'`])\/\/.*$/gm, "$1");
}

/** Each `<BetComposer … />` element's attribute text. */
function mounts(source: string): string[] {
	return [...source.matchAll(/<BetComposer\b([\s\S]*?)\/>/g)].map((m) => m[1]);
}

describe("MIRROR-1 RF-8 — the Mirror is the desktop's, never the phone's", () => {
	it("mirror-mounts::both-desktop-mounts-pass-the-mirror-context", () => {
		const desktop = mounts(code(DESKTOP));
		// Positive control: the scan finds the mounts at all — the market arm's
		// post composer and the post arm's reply composer.
		expect(desktop).toHaveLength(2);
		for (const attrs of desktop) {
			expect(attrs).toMatch(/\bmirror=\{/);
		}
		expect(desktop.some((a) => /kind="post"/.test(a))).toBe(true);
		expect(desktop.some((a) => /kind="reply"/.test(a))).toBe(true);
	});

	it("mirror-mounts::the-phone-mount-passes-no-mirror", () => {
		const phone = mounts(code(PHONE));
		// Positive control: the phone mount is found, with a prop it does pass.
		expect(phone).toHaveLength(1);
		expect(phone[0]).toMatch(/\bviewer=\{viewer\}/);
		// Any spelling: an attribute (`mirror=`) or a key slipped into the mount's
		// existing object spread (`mirror:`) — the second passes a `mirror=` scan
		// and the classic baseline alike, which never mounts the phone tree
		// (`@code-reviewer` L4).
		expect(phone[0]).not.toMatch(/\bmirror\b/);
	});
});
