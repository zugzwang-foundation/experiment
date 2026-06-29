import "server-only";

import { readFile } from "node:fs/promises";
import { join } from "node:path";

/**
 * Read the static `public/zugzwang.md` context block from disk at request time
 * (EXPORT.1 / ADR-0025 §4–5; debate-export.md §5). The combined export prepends
 * this block VERBATIM — no trim, no re-indent — so the file the export embeds and
 * the one served standalone at `/zugzwang.md` draw from the SAME single source and
 * can never drift. Bundled into the route's Lambda via `next.config.ts` →
 * `outputFileTracingIncludes` (mirrors the `/api/health` runtime-fs precedent).
 *
 * A read miss throws → 500 (Sentry); the export is NEVER served context-less — the
 * block is load-bearing for thesis neutrality + format conformance (plan §5).
 */
export async function readContextBlock(): Promise<string> {
	return readFile(join(process.cwd(), "public", "zugzwang.md"), "utf8");
}
