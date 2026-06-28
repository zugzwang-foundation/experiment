/**
 * R2 staging-token scope verification per SCAFFOLD.8 plan §4.4 C8a
 * + Risk 5 / OQ-13.
 *
 * Confirms that the two staging-scope R2 tokens (uploads + pfp) CANNOT
 * read the prod buckets. Issues 4 HEAD requests — both staging tokens
 * against both prod bucket names — and expects every response to come
 * back as 403 / AccessDenied. A 200 OK or 404 NotFound implies the
 * token can authenticate against the prod bucket, which is a critical
 * isolation failure.
 *
 * Operator usage:
 *   doppler run --config stg -- pnpm verify:r2-scope
 *
 * Reads from the staging Doppler config:
 *   R2_ENDPOINT_UPLOADS / R2_ENDPOINT_PFP   shared with prod (same CF account)
 *   R2_ACCESS_KEY_ID_UPLOADS / R2_SECRET_*  staging uploads-scoped token
 *   R2_ACCESS_KEY_ID_PFP / R2_SECRET_*      staging pfp-scoped token
 *
 * Prod bucket names are constants below (the literals we're trying to
 * REACH cross-scope, not the env-driven R2_BUCKET_* values that point
 * at the staging buckets in this Doppler config).
 *
 * Independent of smoke-staging.ts — also runnable post-token-rotation
 * or as a security audit at any time. Smoke item #11 shells out to
 * this script.
 *
 * Exit codes:
 *   0  all 4 attempts returned 403/AccessDenied (token scope verified)
 *   1  preconditions failed (env vars missing)
 *   2  one or more attempts returned a non-403 (isolation failure)
 */

import { HeadObjectCommand, S3Client } from "@aws-sdk/client-s3";

const PROD_BUCKET_UPLOADS = "zugzwang-uploads";
const PROD_BUCKET_PFP = "zugzwang-pfp";
const PROBE_KEY = "verify-r2-scope/_probe";

type Outcome =
	| { kind: "denied"; status: number; code: string }
	| { kind: "allowed"; status?: number }
	| { kind: "unexpected"; detail: string };

interface Attempt {
	tokenLabel: string;
	bucket: string;
	outcome: Outcome;
}

function readEnv(name: string): string | undefined {
	const v = process.env[name];
	return v && v.length > 0 ? v : undefined;
}

function buildClient(
	endpoint: string,
	accessKeyId: string,
	secretAccessKey: string,
): S3Client {
	return new S3Client({
		region: "auto",
		endpoint,
		credentials: { accessKeyId, secretAccessKey },
		forcePathStyle: false,
	});
}

async function probe(
	client: S3Client,
	bucket: string,
	tokenLabel: string,
): Promise<Attempt> {
	try {
		await client.send(
			new HeadObjectCommand({ Bucket: bucket, Key: PROBE_KEY }),
		);
		return { tokenLabel, bucket, outcome: { kind: "allowed" } };
	} catch (err) {
		const meta = (err as { $metadata?: { httpStatusCode?: number } }).$metadata;
		const status = meta?.httpStatusCode;
		const name = (err as { name?: unknown }).name;
		const code = typeof name === "string" ? name : "Unknown";
		if (status === 403 || code === "AccessDenied" || code === "Forbidden") {
			return {
				tokenLabel,
				bucket,
				outcome: { kind: "denied", status: status ?? 403, code },
			};
		}
		if (status === 404 || code === "NotFound" || code === "NoSuchKey") {
			// Token reached the bucket (which means it has bucket-level
			// access); 404 only fires AFTER authn/authz passes. This is the
			// isolation failure case.
			return {
				tokenLabel,
				bucket,
				outcome: { kind: "allowed", status: status ?? 404 },
			};
		}
		return {
			tokenLabel,
			bucket,
			outcome: {
				kind: "unexpected",
				detail: `${code}${status ? ` (HTTP ${status})` : ""}`,
			},
		};
	}
}

async function main(): Promise<void> {
	const endpointUploads = readEnv("R2_ENDPOINT_UPLOADS");
	const endpointPfp = readEnv("R2_ENDPOINT_PFP");
	const accessKeyUploads = readEnv("R2_ACCESS_KEY_ID_UPLOADS");
	const secretUploads = readEnv("R2_SECRET_ACCESS_KEY_UPLOADS");
	const accessKeyPfp = readEnv("R2_ACCESS_KEY_ID_PFP");
	const secretPfp = readEnv("R2_SECRET_ACCESS_KEY_PFP");

	const missing: string[] = [];
	if (!endpointUploads) missing.push("R2_ENDPOINT_UPLOADS");
	if (!endpointPfp) missing.push("R2_ENDPOINT_PFP");
	if (!accessKeyUploads) missing.push("R2_ACCESS_KEY_ID_UPLOADS");
	if (!secretUploads) missing.push("R2_SECRET_ACCESS_KEY_UPLOADS");
	if (!accessKeyPfp) missing.push("R2_ACCESS_KEY_ID_PFP");
	if (!secretPfp) missing.push("R2_SECRET_ACCESS_KEY_PFP");
	if (missing.length > 0) {
		console.error(
			`[verify-r2-scope] env not configured: ${missing.join(", ")}`,
		);
		console.error(
			"[verify-r2-scope] run with: doppler run --config stg -- pnpm verify:r2-scope",
		);
		process.exit(1);
	}

	// We've narrowed via the missing[] check; non-null assertions are safe.
	const uploadsClient = buildClient(
		endpointUploads as string,
		accessKeyUploads as string,
		secretUploads as string,
	);
	const pfpClient = buildClient(
		endpointPfp as string,
		accessKeyPfp as string,
		secretPfp as string,
	);

	console.log(
		`[verify-r2-scope] probing prod buckets "${PROD_BUCKET_UPLOADS}" + "${PROD_BUCKET_PFP}" with staging tokens...`,
	);

	const attempts = await Promise.all([
		probe(uploadsClient, PROD_BUCKET_UPLOADS, "staging-uploads-token"),
		probe(uploadsClient, PROD_BUCKET_PFP, "staging-uploads-token"),
		probe(pfpClient, PROD_BUCKET_UPLOADS, "staging-pfp-token"),
		probe(pfpClient, PROD_BUCKET_PFP, "staging-pfp-token"),
	]);

	let failures = 0;
	for (const a of attempts) {
		if (a.outcome.kind === "denied") {
			console.log(
				`[PASS] ${a.tokenLabel} → ${a.bucket}: ${a.outcome.code} (HTTP ${a.outcome.status})`,
			);
		} else if (a.outcome.kind === "allowed") {
			console.error(
				`[FAIL] ${a.tokenLabel} → ${a.bucket}: token reached the bucket${
					a.outcome.status ? ` (HTTP ${a.outcome.status})` : ""
				}`,
			);
			failures += 1;
		} else {
			console.error(
				`[FAIL] ${a.tokenLabel} → ${a.bucket}: unexpected response — ${a.outcome.detail}`,
			);
			failures += 1;
		}
	}

	if (failures > 0) {
		console.error(
			`\n[verify-r2-scope] ${failures}/${attempts.length} cross-scope attempts did NOT deny — staging token isolation broken`,
		);
		process.exit(2);
	}
	console.log(
		`\n[verify-r2-scope] all ${attempts.length} cross-scope attempts returned 403/AccessDenied`,
	);
}

void main();
