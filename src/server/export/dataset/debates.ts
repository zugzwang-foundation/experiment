import {
	assertTextArtifactClean,
	type EgressSecrets,
} from "@/server/export/egress";

import type { TarEntry } from "./tar";

/**
 * DATASET.1 Slice 7 — the per-market debate `.md` artifact class (brief D2).
 *
 * P2 found EXPORT.1 **shipped**: the route at `(public)/m/[slug]/export` and
 * the serializer at `src/server/debate-export/serialize.ts` both exist, and
 * `serialize.test.ts` already carries the byte-exact Mumbai Metro Line 3
 * golden that `debate-export.md` §12 names as the conformance reference. So
 * this module **wires the existing renderer in; it does not reimplement it**,
 * and nothing here touches the route, the button or the serializer.
 *
 * ## What this module is actually for
 *
 * The `.md` artifact is a fundamentally different egress shape from a CSV and
 * needs the guard applied differently. A Markdown file has **no keys** — a
 * leaked `users.id` is a word in a sentence — so every key-based assertion in
 * the egress layer is structurally blind to it. `assertTextArtifactClean` is
 * the value-based path, and this is the only caller that needs it.
 *
 * ## The masking boundary, and why nothing here re-derives it
 *
 * `debate-export.md` §10.6: *"Masking is inherited, not reimplemented. The
 * export consumes the same masked read-model the debate view consumes; it
 * adds no masking logic of its own."*
 *
 * ⚠ The serializer takes `DebatePost` / `DebateReply`, whose removed variants
 * carry **no body field at all** — un-renderable by construction rather than
 * by a filter someone has to remember. It must never see `DebateComment`,
 * which carries a raw `userId` and is, per ADR-0025, the single identity-leak
 * path. This module accepts already-serialized text precisely so that it has
 * no opportunity to reach for the unmasked type: it never constructs a view
 * model, so it cannot construct the wrong one.
 */

/** One market's rendered export, as produced by `serializeDebateExport`. */
export interface DebateArtifact {
	/** `markets.slug` — the participant-facing identifier, never the UUID. */
	readonly slug: string;
	/** The serialized Markdown. */
	readonly markdown: string;
}

/**
 * Where debate exports live inside the tarball, beside the tables.
 *
 * A directory rather than a flat prefix so a researcher can `tar xzf` and get
 * `debates/` next to the CSVs, which is the shape §19.1's *"single tarball"*
 * implies once there are two artifact classes in it.
 */
export const DEBATE_DIR = "debates";

/**
 * Convert rendered debate exports into guarded tar entries.
 *
 * ⚠ **Every artifact passes the full value-based egress scan before it
 * becomes an entry.** The guard runs here rather than at the build's end
 * because a violation must stop the archive from existing at all — an archive
 * assembled first and checked afterwards has already been written to disk by
 * the time anyone knows, and on 6 November that disk is the release machine.
 */
export function debateEntries(
	artifacts: readonly DebateArtifact[],
	secrets: EgressSecrets,
): TarEntry[] {
	const seen = new Set<string>();
	const entries: TarEntry[] = [];

	for (const artifact of artifacts) {
		if (seen.has(artifact.slug)) {
			// Two markets cannot share a slug (`markets.slug` is unique), so a
			// duplicate here means the caller assembled the list wrongly — and
			// silently overwriting one debate with another inside a tarball is
			// a data-loss bug that no checksum would reveal.
			throw new Error(
				`duplicate debate slug in the export set: ${artifact.slug}`,
			);
		}
		seen.add(artifact.slug);

		const name = `${DEBATE_DIR}/${artifact.slug}.md`;
		assertTextArtifactClean(name, artifact.markdown, secrets);
		entries.push({ name, content: artifact.markdown });
	}

	return entries;
}
