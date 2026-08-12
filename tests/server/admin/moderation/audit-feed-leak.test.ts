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
// R3-1 (Gate C read-3) — the scanned set is DERIVED FROM THE DIRECTORY, never a
// list of filenames. GC-5 moved a JSX-rendering component out of `page.tsx` into
// a sibling and this guard kept reading green over the one file it named, so the
// control got WEAKER WHILE READING GREEN. A named list is exactly what let one
// file escape; a directory scan picks up the next one automatically (O-1:
// structural beats procedural).
const AUDIT_ROUTE_DIR = `${ROOT}src/app/(admin)/admin/moderation/audit`;
const PAGE_FILE = `${AUDIT_ROUTE_DIR}/page.tsx`;

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

/**
 * Strip comments before any POSITIONAL probe. A positional probe binds on the
 * first textual occurrence of a literal, so prose mentioning the gate would
 * satisfy it.
 */
function stripComments(src: string): string {
	return src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
}

/**
 * R3-3 (@security-auditor L-4) — the DEFAULT-EXPORTED page component's body.
 *
 * The gate probe below binds INSIDE THIS SCOPE ONLY. Previously it bound to the
 * first occurrence of `requireAdminPage(` anywhere in the file, so a helper
 * ABOVE the page function containing that literal would bind the guard to
 * ITSELF and keep it green with the real gate deleted — demonstrated at read-3,
 * where a decoy helper plus a removed gate left the suite at 6/6.
 *
 * Re-measured at read-3: GC-5 shrank the file but **396 lines and 8 function
 * declarations still sit above the gate**, so the self-match surface is large,
 * not residual.
 *
 * Residual, stated rather than hidden: a decoy inside a STRING LITERAL within
 * the page body itself would still bind. Comments are stripped; strings are not.
 */
function pageComponentBody(src: string): string {
	const stripped = stripComments(src);
	const at = stripped.indexOf("export default async function");
	return at < 0 ? "" : stripped.slice(at);
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
		// R3-2 (@security-auditor SURPRISE-2): BOTH loaders, not just one. The
		// page has two data reads and only `loadModerationAuditFeed` was
		// asserted — `searchAuditLog`, the one spanning BOTH union sides, was
		// unasserted entirely.
		const body = pageComponentBody(read(PAGE_FILE));
		// N1 — the scope resolved. An empty body would make every position
		// comparison below vacuous.
		expect(body.length).toBeGreaterThan(0);

		const gateAt = body.indexOf("requireAdminPage(");
		expect(gateAt).toBeGreaterThanOrEqual(0);

		for (const loader of ["loadModerationAuditFeed(", "searchAuditLog("]) {
			const loadAt = body.indexOf(loader);
			expect(loadAt).toBeGreaterThanOrEqual(0);
			// The Layer-2 gate must run before any data read.
			expect(gateAt).toBeLessThan(loadAt);
		}
	});

	it("audit-leak::audit-route-renders-no-raw-img-and-imports-no-signer", () => {
		const files = tsxFilesUnder(AUDIT_ROUTE_DIR);
		// N1 — assert the scanned set before asserting anything about it, and
		// assert it reaches MORE than the page: a directory scan that silently
		// resolved to one file would read exactly like the defect it replaces.
		expect(files).toContain(PAGE_FILE);
		expect(files.length).toBeGreaterThan(1);

		for (const file of files) {
			const src = read(file);
			expect(src).not.toMatch(/<img[\s/>]/);
			for (const token of SIGNER_TOKENS) {
				expect(src).not.toContain(token);
			}
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
