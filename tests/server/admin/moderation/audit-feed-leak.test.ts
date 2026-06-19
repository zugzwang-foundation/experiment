import { readdirSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

// UI.6 slice A — RED-first STRUCTURAL guards. Item (d): the `blocked_text`-
// bearing audit-feed loader and the admin page that renders it must never be
// reachable from a participant / non-admin surface, and must never mint a
// viewable URL for blocked content. These are filesystem-level regression
// guards (no IO beyond reads), in the spirit of the EVENT_TYPES inventory pin.

const ROOT = fileURLToPath(new URL("../../../../", import.meta.url));
const FEED_MODULE = `${ROOT}src/server/admin/moderation/audit-feed.ts`;
const PAGE_FILE = `${ROOT}src/app/(admin)/admin/moderation/audit/page.tsx`;

// Anything that could turn an r2 key into a viewable URL.
const SIGNER_TOKENS = [
	"sign-read",
	"getSignedUrl",
	"s3-request-presigner",
	"presign",
];

function read(path: string): string {
	return readFileSync(path, "utf8");
}

function tsxFilesUnder(dir: string): string[] {
	return readdirSync(dir, { recursive: true, encoding: "utf8" })
		.filter((p) => p.endsWith(".ts") || p.endsWith(".tsx"))
		.map((p) => `${dir}/${p}`);
}

describe("audit-feed loader — server-only + no signer (c/d)", () => {
	it("audit-leak::feed-module-is-server-only", () => {
		expect(read(FEED_MODULE)).toMatch(/import\s+["']server-only["']/);
	});

	it("audit-leak::feed-module-never-imports-the-storage-signer", () => {
		const src = read(FEED_MODULE);
		for (const token of SIGNER_TOKENS) {
			expect(src).not.toContain(token);
		}
	});
});

describe("audit page — gated before read, no raw image (a/c)", () => {
	it("audit-leak::page-exists-under-the-admin-route-group", () => {
		// Throws if missing → RED until the page lands.
		expect(read(PAGE_FILE).length).toBeGreaterThan(0);
	});

	it("audit-leak::page-calls-requireAdminPage-before-the-feed-loader", () => {
		const src = read(PAGE_FILE);
		const gateAt = src.indexOf("requireAdminPage(");
		const loadAt = src.indexOf("loadModerationAuditFeed(");
		expect(gateAt).toBeGreaterThanOrEqual(0);
		expect(loadAt).toBeGreaterThanOrEqual(0);
		// The Layer-2 gate must run before any data read.
		expect(gateAt).toBeLessThan(loadAt);
	});

	it("audit-leak::page-renders-no-raw-img-and-imports-no-signer", () => {
		const src = read(PAGE_FILE);
		expect(src).not.toMatch(/<img[\s/>]/);
		for (const token of SIGNER_TOKENS) {
			expect(src).not.toContain(token);
		}
	});
});

describe("non-admin reachability — blocked_text never leaves the admin surface (d)", () => {
	it("audit-leak::no-non-admin-app-file-imports-the-audit-feed-loader", () => {
		const appFiles = tsxFilesUnder(`${ROOT}src/app`);
		const importers = appFiles.filter((path) => {
			const src = read(path);
			return (
				src.includes("admin/moderation/audit-feed") ||
				src.includes("moderation/audit-feed")
			);
		});
		// Every importer (the page) must live under the (admin) route group.
		for (const path of importers) {
			expect(path).toContain("/app/(admin)/");
		}
	});
});
