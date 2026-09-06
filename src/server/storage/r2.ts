import "server-only";
import {
	DeleteObjectCommand,
	GetObjectCommand,
	HeadObjectCommand,
	PutObjectCommand,
	S3Client,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

import {
	StorageObjectMissingError,
	StorageUnavailableError,
} from "@/lib/errors";
import { safeCaptureException } from "@/server/observability/safe-capture";

// R2 S3-compat client wrapper. Two bucket-scoped clients constructed once at
// module load per SCAFFOLD.15 plan §5.1 + B2 ratification. The env vars are
// distinct per bucket (R2_*_UPLOADS vs R2_*_PFP) so a compromise of one
// token's credentials does not grant access to the other bucket.
//
// region:"auto" is the S3 SDK contract — R2 ignores it but the SDK requires
// a non-empty value or it throws at the credentials-resolver layer.
// forcePathStyle:false uses virtual-hosted-style URLs which R2 supports and
// which are required for the signed-URL paths to render correctly against
// the Cloudflare edge.
//
// Module-load construction is acceptable per SCAFFOLD.15 plan §6 risk #4 —
// the same posture as `src/server/upstash/redis.ts` (env-validate at load,
// throw with a pointer to .env.example on missing values).

// Exported so `read-url-memo.ts` can take the bucket as a typed parameter and
// build its own memo key from it. Before that, the bucket reached the memo as a
// caller-written string prefix that had to agree with the bucket passed to
// `mintReadUrl` — two literals, no check, and the ADR-0026 arm separation
// resting on them matching.
export type R2Bucket = "uploads" | "pfp" | "market-media";

interface R2BucketEnv {
	endpoint: string;
	accessKeyId: string;
	secretAccessKey: string;
	bucketName: string;
}

function resolveBucketEnv(bucket: R2Bucket): R2BucketEnv {
	if (bucket === "uploads") {
		const endpoint = process.env.R2_ENDPOINT_UPLOADS;
		const accessKeyId = process.env.R2_ACCESS_KEY_ID_UPLOADS;
		const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY_UPLOADS;
		const bucketName = process.env.R2_BUCKET_UPLOADS;
		if (!endpoint || !accessKeyId || !secretAccessKey || !bucketName) {
			throw new Error(
				"R2 uploads env not configured: set R2_ENDPOINT_UPLOADS, R2_ACCESS_KEY_ID_UPLOADS, R2_SECRET_ACCESS_KEY_UPLOADS, R2_BUCKET_UPLOADS (see .env.example).",
			);
		}
		return { endpoint, accessKeyId, secretAccessKey, bucketName };
	}
	if (bucket === "pfp") {
		const endpoint = process.env.R2_ENDPOINT_PFP;
		const accessKeyId = process.env.R2_ACCESS_KEY_ID_PFP;
		const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY_PFP;
		const bucketName = process.env.R2_BUCKET_PFP;
		if (!endpoint || !accessKeyId || !secretAccessKey || !bucketName) {
			throw new Error(
				"R2 pfp env not configured: set R2_ENDPOINT_PFP, R2_ACCESS_KEY_ID_PFP, R2_SECRET_ACCESS_KEY_PFP, R2_BUCKET_PFP (see .env.example).",
			);
		}
		return { endpoint, accessKeyId, secretAccessKey, bucketName };
	}

	// ADR-0026 #2 / SPEC.2 §12.1: the third `market-media` bucket arm, with its
	// OWN isolated credentials (R2_*_MARKET_MEDIA) — preserves the per-bucket
	// compromise-isolation property (a leak in one token's creds cannot reach
	// another bucket). Admin-set per-market media in the `m/<marketId>/`
	// namespace.
	const endpoint = process.env.R2_ENDPOINT_MARKET_MEDIA;
	const accessKeyId = process.env.R2_ACCESS_KEY_ID_MARKET_MEDIA;
	const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY_MARKET_MEDIA;
	const bucketName = process.env.R2_BUCKET_MARKET_MEDIA;
	if (!endpoint || !accessKeyId || !secretAccessKey || !bucketName) {
		throw new Error(
			"R2 market-media env not configured: set R2_ENDPOINT_MARKET_MEDIA, R2_ACCESS_KEY_ID_MARKET_MEDIA, R2_SECRET_ACCESS_KEY_MARKET_MEDIA, R2_BUCKET_MARKET_MEDIA (see .env.example).",
		);
	}
	return { endpoint, accessKeyId, secretAccessKey, bucketName };
}

const clients: Partial<
	Record<R2Bucket, { client: S3Client; bucketName: string }>
> = {};

function getClient(bucket: R2Bucket): { client: S3Client; bucketName: string } {
	const cached = clients[bucket];
	if (cached) return cached;
	const env = resolveBucketEnv(bucket);
	const client = new S3Client({
		region: "auto",
		endpoint: env.endpoint,
		credentials: {
			accessKeyId: env.accessKeyId,
			secretAccessKey: env.secretAccessKey,
		},
		forcePathStyle: false,
	});
	const handle = { client, bucketName: env.bucketName };
	clients[bucket] = handle;
	return handle;
}

/**
 * Sign a PUT URL for the given bucket + key + content-type. Returns the
 * signed URL string. Caller is responsible for handing it back to the
 * browser; R2 enforces method + key + content-type bind at PUT time.
 *
 * AUDIT-FIX-A1: `opts.ifNoneMatch` arms **write-once**. When true, the
 * presigned PUT carries `If-None-Match: "*"` — the first PUT creates the
 * object, every later PUT to the same key → HTTP 412. The header joins the
 * SigV4 `SignedHeaders`, so a client cannot drop it to bypass write-once (the
 * signature would not validate). This binds the moderated bytes ≡ the rendered
 * bytes BY CONSTRUCTION (participant sign path). The admin market-media sign
 * path passes NO opts and stays mutable (trusted/unmoderated — ADR-0026/0027).
 */
export async function mintPutUrl(
	bucket: R2Bucket,
	key: string,
	contentType: string,
	ttlSeconds: number,
	opts?: { ifNoneMatch?: boolean },
): Promise<string> {
	const { client, bucketName } = getClient(bucket);
	try {
		return await getSignedUrl(
			client,
			new PutObjectCommand({
				Bucket: bucketName,
				Key: key,
				ContentType: contentType,
				// Write-once binding (participant path only). `"*"` = "no object may
				// already exist at this key" — R2 rejects any overwrite with 412.
				...(opts?.ifNoneMatch ? { IfNoneMatch: "*" } : {}),
			}),
			{ expiresIn: ttlSeconds },
		);
	} catch (err) {
		// AUDIT-FIX-B1 A5 (§17.3 6c): `r2_unavailable` capture-at-source — the
		// four vendor-failure arms in this wrapper cover every R2 caller (sign
		// routes, precommit signRead, verify-object, orphan sweep) with no
		// second string. Never on the 404 product arm (headObject below).
		safeCaptureException(err, { tags: { kind: "r2_unavailable" } });
		throw new StorageUnavailableError(err);
	}
}

/**
 * Sign a READ URL for the given bucket + key. Caller chooses TTL — 60s for
 * the moderation hop, 3600s for the future DEBATE.4 render path.
 *
 * `cacheControl`, when given, is served as the object's `Cache-Control` via the
 * `response-cache-control` query parameter, overriding whatever is (or is not)
 * stored on the object itself. See `RENDER_IMAGE_CACHE_CONTROL` for why the
 * header is applied here rather than at upload; the short version is that this
 * direction covers objects that already exist, and the upload direction cannot.
 *
 * ⚠ IT IS DELIBERATELY OPTIONAL, and the omitting caller is not an oversight.
 * `signReadSingleUse` hands its URL to OpenAI's fetcher, where no browser cache
 * exists to instruct — the same reasoning that keeps that path out of the memo
 * (`sign-read.ts`). A caching directive there would be noise on a gate that
 * fails closed, so the parameter is absent rather than defaulted.
 *
 * `signingDate` pins the instant the signature is computed against, instead of
 * letting it default to "now".
 *
 * ⚠ WHY THAT MATTERS, because it looks like a testing seam and is not. A SigV4
 * signature covers `X-Amz-Date`, so signing the same object twice a second apart
 * yields two DIFFERENT URLs — and a browser caches by URL, so the second one is
 * a full re-download of bytes it already holds. The memo hides that within one
 * process, but the memo is a `Map` in one process: every serverless instance
 * keeps its own, a cold start starts empty, and two instances serving the same
 * image hand out two different URLs to the same visitor. The cache-hit rate is
 * therefore not "one URL per hold window" but "one URL per hold window PER
 * INSTANCE", which on a fleet is close to no reuse at all.
 *
 * Pinning the date to a window START makes the URL a pure function of
 * (bucket, key, ttl, window) — so every instance, warm or cold, computes the
 * same bytes, and the reuse becomes global rather than per-process. It is the
 * memo's caller (`read-url-memo.ts`) that owns the window, because the window
 * has to be the one its own safety theorem was proved against.
 */
export async function mintReadUrl(
	bucket: R2Bucket,
	key: string,
	ttlSeconds: number,
	cacheControl?: string,
	signingDate?: Date,
): Promise<string> {
	const { client, bucketName } = getClient(bucket);
	try {
		return await getSignedUrl(
			client,
			new GetObjectCommand({
				Bucket: bucketName,
				Key: key,
				...(cacheControl ? { ResponseCacheControl: cacheControl } : {}),
			}),
			{ expiresIn: ttlSeconds, ...(signingDate ? { signingDate } : {}) },
		);
	} catch (err) {
		safeCaptureException(err, { tags: { kind: "r2_unavailable" } });
		throw new StorageUnavailableError(err);
	}
}

/**
 * HeadObject — returns object metadata (size + content-type + ETag). The
 * post-PUT verification path (`verify-object.ts`, AUDIT-FIX-A1) consumes
 * `contentLength` for the A10 real-byte size backstop and `etag` as the
 * append-only forensic fingerprint (R2 ETag is a quoted MD5, kept verbatim —
 * a fingerprint, NEVER a security primitive). Throws
 * `StorageObjectMissingError` on 404, `StorageUnavailableError` on 5xx.
 */
export async function headObject(
	bucket: R2Bucket,
	key: string,
): Promise<{
	contentLength: number;
	contentType: string | undefined;
	etag: string | undefined;
}> {
	const { client, bucketName } = getClient(bucket);
	try {
		const out = await client.send(
			new HeadObjectCommand({ Bucket: bucketName, Key: key }),
		);
		const contentLength = out.ContentLength ?? 0;
		return { contentLength, contentType: out.ContentType, etag: out.ETag };
	} catch (err) {
		if (err && typeof err === "object" && "name" in err) {
			const name = (err as { name?: unknown }).name;
			if (name === "NotFound" || name === "NoSuchKey") {
				// Client-error product condition, not vendor-down — no capture.
				throw new StorageObjectMissingError(key);
			}
		}
		safeCaptureException(err, { tags: { kind: "r2_unavailable" } });
		throw new StorageUnavailableError(err);
	}
}

/**
 * DeleteObject — idempotent (204 even if the key doesn't exist per S3-compat
 * contract). Consumed by the orphan-sweep cron handler.
 */
export async function deleteObject(
	bucket: R2Bucket,
	key: string,
): Promise<void> {
	const { client, bucketName } = getClient(bucket);
	try {
		await client.send(
			new DeleteObjectCommand({ Bucket: bucketName, Key: key }),
		);
	} catch (err) {
		safeCaptureException(err, { tags: { kind: "r2_unavailable" } });
		throw new StorageUnavailableError(err);
	}
}
