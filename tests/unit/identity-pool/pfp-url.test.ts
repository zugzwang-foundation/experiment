// PFP-1 — composing the public R2 URL for an identity's PFP.
//
// SPEC.2 §12.7 line 1308: the frontend composes
// `${R2_PFP_BASE_URL}/v1/${pfp_filename}`. (.env.example said
// `/v1/${pseudonym}.webp`, which contradicted the spec and is corrected in
// this commit.)

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { PFP_PLACEHOLDER, pfpUrl } from "@/server/identity-pool/pfp-url";

const BASE = "https://pub-abc123.r2.dev";
let original: string | undefined;

beforeEach(() => {
	original = process.env.R2_PUBLIC_URL_PFP;
	process.env.R2_PUBLIC_URL_PFP = BASE;
});

afterEach(() => {
	if (original === undefined) delete process.env.R2_PUBLIC_URL_PFP;
	else process.env.R2_PUBLIC_URL_PFP = original;
});

describe("pfpUrl", () => {
	it("composes the v1-prefixed public URL", () => {
		expect(pfpUrl("gold-zebra.webp")).toBe(`${BASE}/v1/gold-zebra.webp`);
	});

	it("carries a variant filename through unchanged", () => {
		expect(pfpUrl("gold-cat-v3.webp")).toBe(`${BASE}/v1/gold-cat-v3.webp`);
	});

	// A scrubbed row (SPEC.1 §23) has pfp_filename NULL and must still render.
	it("falls back to the placeholder for a scrubbed identity", () => {
		expect(pfpUrl(null)).toBe(PFP_PLACEHOLDER);
	});

	it("falls back to the placeholder for an empty filename", () => {
		expect(pfpUrl("")).toBe(PFP_PLACEHOLDER);
	});

	// A missing env var must degrade to a silhouette, never take down a profile
	// page with a thrown error.
	it("falls back rather than throwing when the env is unset", () => {
		delete process.env.R2_PUBLIC_URL_PFP;
		expect(() => pfpUrl("gold-zebra.webp")).not.toThrow();
		expect(pfpUrl("gold-zebra.webp")).toBe(PFP_PLACEHOLDER);
	});

	it("falls back when the env is set but empty", () => {
		process.env.R2_PUBLIC_URL_PFP = "";
		expect(pfpUrl("gold-zebra.webp")).toBe(PFP_PLACEHOLDER);
	});

	// The filename comes from an operator-supplied CSV via
	// `scripts/seed-identity-pool.ts`, which does not validate its shape.
	it("refuses a filename that could escape the v1/ prefix", () => {
		for (const hostile of [
			"../../../etc/passwd",
			"a/b.webp",
			"https://evil.example/x.webp",
			"gold-zebra.webp?x=1",
			"gold-zebra.svg",
			"Gold-Zebra.webp",
		]) {
			expect(pfpUrl(hostile)).toBe(PFP_PLACEHOLDER);
		}
	});

	// The `-<number>` segment ADR-0011 adds once compositing lands must not
	// need a change here.
	it("accepts the numbered filename shape ADR-0011 will introduce", () => {
		expect(pfpUrl("gold-zebra-007.webp")).toBe(
			`${BASE}/v1/gold-zebra-007.webp`,
		);
	});

	it("does not double the slash when the base carries a trailing one", () => {
		process.env.R2_PUBLIC_URL_PFP = `${BASE}/`;
		expect(pfpUrl("gold-zebra.webp")).toBe(`${BASE}/v1/gold-zebra.webp`);
	});
});
