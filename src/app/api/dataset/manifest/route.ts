import {
	envelope,
	jsonResponse,
	resolveRequestId,
} from "@/server/middleware/envelope";

/**
 * `GET /api/dataset/manifest` — SPEC.2 §19.7, F-DATASET-1.
 *
 * ## Why this exists at all, and why the answer was checkable
 *
 * DATASET.3's brief admitted this endpoint **only if §19.7 states
 * unambiguously what it is for**, given that `dataset-release.md` publishes the
 * archive through a GitHub release — the worry being that a public route built
 * on a guess, six days from the precursor freeze, is worse than an unfinished
 * lane. §19.7 answers it directly, and anticipates the GitHub path rather than
 * conflicting with it:
 *
 * > *The endpoint is a thin static-file pointer; it does not serve the tarball
 * > itself (GitHub release assets serve directly). The endpoint exists to make
 * > programmatic discovery possible — researcher tooling can fetch the manifest
 * > to verify checksums + schema version + table inventory before downloading
 * > the tarball.*
 *
 * So: a reader checks the checksum and the table inventory BEFORE spending a
 * gigabyte of bandwidth, and can do it from a script rather than by scraping a
 * releases page.
 *
 * ## What it deliberately is not
 *
 * **No auth** — the dataset is CC-BY-4.0 and the manifest describes a public
 * artifact; a gate here would protect nothing and would break the one use case
 * the section names. **No database.** **No build-on-request**: the release is a
 * one-shot job run by an operator, and a route that could rebuild it would be
 * an unauthenticated way to spend the whole export budget. The manifest is a
 * committed static file, served as bytes.
 *
 * ## The pre-release state is the spec's, not mine
 *
 * §19.7: *"Active post-2026-11-06 only — pre-release the endpoint returns HTTP
 * 503 `error_dataset_not_yet_released`; post-release it returns the manifest
 * JSON."* Both halves are implemented, and the 503 is also what a MISSING
 * manifest file returns after the date — fail-closed, because "the release
 * exists" is a claim about a file, not about the calendar. An operator who has
 * not yet published gets the same honest answer a researcher would get a day
 * early.
 *
 * ⚠ **`RELEASE_DATE` is compared as a UTC calendar day**, not as a local one.
 * The freeze is `2026-11-05 23:59 UTC` and the dataset is dated `2026-11-06`;
 * a server in a positive offset would otherwise flip this route hours early,
 * which is precisely the kind of thing that is invisible until the day.
 *
 * Runtime: Node (ADR-0003 — no `runtime = 'edge'` export). The published answer
 * is cached, because the body is a static file that changes once, ever; the
 * pre-release 503 is NOT, because a cached 503 outlives the state it describes.
 */

/** The §19.1 release date, as a UTC calendar day. */
const RELEASE_DATE = "2026-11-06";

/** §15.4 error code, verbatim from §19.7. */
const NOT_YET_RELEASED = "error_dataset_not_yet_released";

/**
 * Seconds a client should wait before asking again, pre-release.
 *
 * ⚠ **Renamed from `CACHE_BEFORE`, because it never was one**
 * (`@security-auditor` L-5). It is passed as `jsonResponse`'s fourth argument,
 * which is `retryAfterHeader` — so the emitted header was `Retry-After: 300`
 * and no `Cache-Control` was sent at all, while the constant's own docblock
 * described caching behaviour. The name is now what the value does.
 *
 * `Retry-After` is in fact the right header here: the 503 is a temporal state
 * that flips once, and a researcher polling on the morning of the sixth should
 * not be handed a cached 503 by an intermediary for an hour afterwards.
 */
const RETRY_AFTER_BEFORE = 300;

/**
 * Seconds a client may cache the published manifest.
 *
 * Long, because the body is immutable by definition — §19.1 permits a v2
 * rebuild, and a v2 is a new release with its own manifest rather than an edit
 * to this one.
 */
const CACHE_AFTER = 3600;

/**
 * The published manifest, or `null` while the release has not happened.
 *
 * ⚠ **`null` today, and that is the whole pre-release state.** The release task
 * writes `manifest.json` and imports it here in the same commit that publishes
 * the GitHub release; until then there is nothing truthful to serve, and
 * inventing a shape would mean shipping a checksum for an artifact that does
 * not exist. Typed as `unknown` deliberately: this route does not validate or
 * reshape the manifest, it serves the file, and a type here would be a fourth
 * declaration of a shape §19.7 already owns.
 */
const PUBLISHED_MANIFEST: unknown = null;

/** Is the release date reached, in UTC? */
function released(now: Date): boolean {
	return now.toISOString().slice(0, 10) >= RELEASE_DATE;
}

export async function GET(request: Request): Promise<Response> {
	const requestId = resolveRequestId(request);

	// ⚠ Both conditions, and the second is not redundant. The date passing is
	// a fact about the calendar; the manifest existing is a fact about whether
	// anyone published. Serving on the date alone would answer 200 with an
	// empty body on the morning of 6 November if the operator's build had not
	// finished — which is the one morning this route is read.
	if (!released(new Date()) || PUBLISHED_MANIFEST === null) {
		return jsonResponse(
			requestId,
			503,
			envelope(
				NOT_YET_RELEASED,
				"The Zugzwang public dataset has not been released yet. It is " +
					`published on ${RELEASE_DATE}; this endpoint serves its manifest ` +
					"from then.",
			),
			RETRY_AFTER_BEFORE,
		);
	}

	return new Response(JSON.stringify(PUBLISHED_MANIFEST), {
		status: 200,
		headers: {
			"content-type": "application/json",
			"X-Request-Id": requestId,
			"cache-control": `public, max-age=${CACHE_AFTER}`,
			// ⚠ **`Vary: X-Request-Id`, because the response echoes it**
			// (`@security-auditor` L-5). Without it a shared cache keys this
			// response on the URL alone and serves one client's trace token to
			// every other client. The content is harmless — a request id is not
			// a secret — but a cache-key that ignores a header the body varies
			// on is wrong in a way that stops being harmless the moment
			// anything else varies with it.
			vary: "X-Request-Id",
		},
	});
}
