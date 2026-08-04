// SPDX-License-Identifier: AGPL-3.0-or-later

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * PRIMITIVES-1 C1 (rulings D5 / D6) — the avatar ring is bound to its ratified
 * token IN THE PRIMITIVE, and no consumer re-binds it locally.
 *
 * Two defects are pinned shut here. (1) `after:mix-blend-darken` took the
 * DARKER of ring and backdrop, so against `AvatarFallback`'s `bg-muted` (n1,
 * darker than the n2 ring) the ring blended away and the avatar lost its edge —
 * the path taken whenever the placeholder image fails. Its `dark:` sibling was
 * dead outright: `.dark` is never applied anywhere in `src/**`. (2) The ring
 * arrived via `after:border-border` → `--border`, leaving the ratified
 * `--avatar-ring` (`globals.css`, 1px solid n2 — `design-token-contract.md:209`,
 * values-log `:178`) with ZERO consumers; an orphaned token gets deleted or
 * drifts at the next branding pass, and a `--border` re-point would silently
 * split the two paths apart. Binding the token explicitly is what makes the
 * pixels correct today AND survivable tomorrow.
 *
 * Source-text assertions, deliberately: jsdom cannot compute `::after`, so the
 * class binding IS the observable (AGENTS.md §9 — no jest-dom). The render-side
 * companion is `tests/unit/shell/identity-cluster-link.test.tsx`.
 */

const ROOT = process.cwd();
const AVATAR = "src/components/ui/avatar.tsx";
const CLUSTER = "src/components/shell/IdentityCluster.tsx";
const TOKENS = "src/app/globals.css";

const RING = "after:[border:var(--avatar-ring)]";

function read(file: string): string {
	return readFileSync(join(ROOT, file), "utf8");
}

/** Comments are prose ABOUT the binding, never the binding itself. */
function stripComments(source: string): string {
	return source
		.replace(/\/\*[\s\S]*?\*\//g, "")
		.replace(/^\s*\/\/.*$/gm, "")
		.replace(/\/\/[^"'`\n]*$/gm, "");
}

/** The `Avatar` ROOT's base class string — the ring lives on its `::after`. */
function avatarRootClasses(): string {
	const match = stripComments(read(AVATAR)).match(
		/data-slot="avatar"[\s\S]*?className=\{cn\(\s*"([^"]*)"/,
	);
	if (match?.[1] === undefined) {
		throw new Error(
			`${AVATAR}: could not read the Avatar root's cn() class string — the ` +
				"guard is reading the wrong shape, not the component being clean.",
		);
	}
	return match[1];
}

describe("avatar ring — bound to --avatar-ring in the primitive", () => {
	it("primitive-binds-the-ratified-token", () => {
		expect(avatarRootClasses()).toContain(RING);
	});

	it("primitive-drops-the-blend-and-the-border-alias", () => {
		const cls = avatarRootClasses();
		// `mix-blend` in ANY spelling: the `darken` that ate the ring on the
		// fallback path, and the dead `dark:` sibling. (`bg-blend-color` on
		// AvatarBadge is a different property and out of scope — matching
		// `mix-blend` rather than `blend` keeps it that way.)
		expect(cls).not.toContain("mix-blend");
		// The ring must not ALSO arrive through `--border`; a re-point of
		// `--border` would then split one ring into two values.
		expect(cls).not.toContain("border-border");
	});

	it("identity-cluster-carries-no-local-ring-override", () => {
		// The primitive is now correct, so the consumer-side workaround is gone:
		// no local binding, no blend reset, no `avatarRing` local at all.
		const source = stripComments(read(CLUSTER));
		expect(source).not.toContain(RING);
		expect(source).not.toContain("mix-blend");
		expect(source).not.toContain("avatarRing");
	});

	it("token-is-defined-so-the-binding-resolves", () => {
		// D6's point: a bound token that no longer exists draws NO ring at all.
		expect(read(TOKENS)).toMatch(/^\s*--avatar-ring:\s*\S/m);
	});
});
