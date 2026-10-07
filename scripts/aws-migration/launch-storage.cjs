// LAUNCH-DB-COPY-1 — copy the storage objects the STAGING DUMP references into
// the PRODUCTION buckets, so no restored row points at a missing file
// (docs/plans/LAUNCH-DB-COPY-1.md §3, runbook step 8).
//
//   node scripts/aws-migration/launch-storage.cjs <zugzwang-staging-<stamp>.dump> --account=<12-digit id> [--execute]
//
// ⛔ CHECK-ONLY BY DEFAULT: it lists what it would copy, and writes nothing.
//
// The keys come from the dump itself (pg_restore renders the four tables to
// text, no database connection), not from a live query — so the object list
// and the rows being restored cannot disagree.
//
// COPY-ONLY, STRUCTURALLY. There is no delete call in this file, and every
// write carries `IfNoneMatch: "*"`, so an object that already exists in a
// production bucket is never replaced. Production's own uploads become
// unreferenced after the restore and are left exactly where they are.
//
//   image_uploads.r2_object_key           staging uploads bucket → production uploads bucket
//   users / identity_pool.pfp_filename    staging PFP bucket     → production PFP bucket
//   market_media.r2_object_key            one shared bucket      → verified present only

const {
	ENVS,
	REGION,
	parseDumpFileName,
	redact,
	parseSecret,
	assertLaunchWindow,
} = require("./lib/launch-common.cjs");

const BUCKETS = {
	uploads: { source: "zugzwang-staging-uploads", target: "zugzwang-uploads" },
	pfp: { source: "zugzwang-staging-pfp", target: "zugzwang-pfp" },
	marketMedia: {
		source: "zugzwang-market-media",
		target: "zugzwang-market-media",
	},
};

/** Secret key suffix per family, as in `src/server/storage/r2.ts`. */
const ARM = { uploads: "UPLOADS", pfp: "PFP", marketMedia: "MARKET_MEDIA" };

/**
 * Rows of one `COPY <table> (...) FROM stdin;` block from pg_restore's text
 * output, keyed by the header's columns. `\N` is NULL. The table is matched
 * exactly as written in the header.
 */
function extractCopyRows(sqlText, table) {
	const lines = String(sqlText).split(/\r?\n/);
	const start = lines.findIndex((l) => {
		const m = /^COPY (\S+) \((.*)\) FROM stdin;$/.exec(l);
		return m !== null && m[1] === table;
	});
	if (start === -1) return [];
	const header = /^COPY \S+ \((.*)\) FROM stdin;$/.exec(lines[start]);
	const columns = header[1]
		.split(",")
		.map((c) => c.trim().replace(/^"|"$/g, ""));
	const rows = [];
	for (let i = start + 1; i < lines.length && lines[i] !== "\\."; i++) {
		const values = lines[i].split("\t");
		const row = {};
		columns.forEach((c, j) => {
			row[c] =
				values[j] === "\\N" || values[j] === undefined ? null : values[j];
		});
		rows.push(row);
	}
	return rows;
}

const present = (v) => typeof v === "string" && v !== "";
const uniqSorted = (xs) => [...new Set(xs.filter(present))].sort();

/**
 * A PFP's object key is NOT its file name: it is `v1/<pfp_filename>` — the
 * version sentinel of ADR-0011, as composed by src/server/identity-pool/
 * pfp-url.ts and checked by scripts/verify-identity-pool.ts. The prefix is
 * added AFTER nulls and empties are dropped, so a scrubbed identity never
 * becomes the key "v1/".
 */
const PFP_KEY_PREFIX = "v1/";
const pfpKeys = (rows) =>
	uniqSorted(rows.map((r) => r.pfp_filename)).map(
		(f) => `${PFP_KEY_PREFIX}${f}`,
	);

/** The three key families the dump's rows reference. */
function referencedObjects({ imageUploads, users, identityPool, marketMedia }) {
	return {
		uploads: uniqSorted(imageUploads.map((r) => r.r2_object_key)),
		pfp: [...new Set([...pfpKeys(users), ...pfpKeys(identityPool)])].sort(),
		marketMedia: uniqSorted(marketMedia.map((r) => r.r2_object_key)),
	};
}

/**
 * PFP keys that a copied PARTICIPANT already shows. A missing one of these is
 * a hard failure; a missing avatar of an UNASSIGNED pool row (a future signup)
 * is a warning, so one absent future avatar cannot block the uploads that are
 * load-bearing today.
 */
function participantPfpKeys(users) {
	return pfpKeys(users);
}

/** Whether a failed decision for this object must stop the copy. */
function isHardFailure(family, key, participantPfp) {
	return family !== "pfp" || participantPfp.has(key);
}

/**
 * Each table's parsed rows must equal the count the dump's manifest recorded.
 * extractCopyRows returns [] for a block it cannot read, so without this a
 * parse divergence reports "0 referenced, 0 problems" and the copy succeeds
 * having copied nothing (@security-auditor M-5).
 */
function assertParsedCounts(parsed, manifestTables) {
	for (const [table, rows] of Object.entries(parsed)) {
		const expected = Number(manifestTables?.[table]?.count);
		if (!Number.isInteger(expected)) {
			throw new Error(`refusing: the manifest has no count for ${table}`);
		}
		if (rows.length !== expected) {
			throw new Error(
				`refusing: parsed ${rows.length} ${table} rows from the dump but its manifest says ${expected}`,
			);
		}
	}
}

/** Refuses anything that is not a plain relative key. */
function assertSafeKey(key) {
	if (
		!present(key) ||
		key.includes("..") ||
		key.startsWith("/") ||
		key.includes("\\")
	) {
		throw new Error(`refusing: unsafe storage key ${JSON.stringify(key)}`);
	}
	return key;
}

/** What to do with one referenced object. The target is checked first. */
function copyDecision({ inTarget, targetSize, inSource, sourceSize }) {
	if (inTarget) {
		if (!inSource || Number(targetSize) === Number(sourceSize)) {
			return "skip-present";
		}
		return "fail-size-conflict";
	}
	return inSource ? "copy" : "fail-missing-in-source";
}

async function main() {
	const fs = require("node:fs");
	const path = require("node:path");
	const { spawnSync } = require("node:child_process");
	const {
		S3Client,
		HeadObjectCommand,
		GetObjectCommand,
		PutObjectCommand,
	} = require("@aws-sdk/client-s3");
	const AWS = process.env.AWS_CLI || "aws";

	const argv = process.argv.slice(2);
	const execute = argv.includes("--execute");
	const account = (argv.find((a) => a.startsWith("--account=")) ?? "").slice(
		"--account=".length,
	);
	const dumpArg = argv.find((a) => !a.startsWith("--"));
	if (!/^[0-9]{12}$/.test(account)) {
		throw new Error(
			"refusing: --account=<12-digit AWS account id> is required",
		);
	}
	const dumpFile = path.resolve(String(dumpArg));
	const base = path.basename(dumpFile);
	const parsed = parseDumpFileName(base);
	if (!parsed || parsed.env !== "staging") {
		throw new Error(
			`refusing: "${base}" is not a zugzwang-staging-<stamp>.dump (storage is copied FROM staging only)`,
		);
	}
	if (!fs.existsSync(dumpFile)) throw new Error(`refusing: ${base} not found`);
	const manifestFile = `${dumpFile}.manifest.json`;
	if (!fs.existsSync(manifestFile)) {
		throw new Error(`refusing: ${base}.manifest.json not found`);
	}
	const manifest = JSON.parse(fs.readFileSync(manifestFile, "utf8"));
	// Writes to production's buckets: only inside the launch window, acknowledged.
	if (execute) assertLaunchWindow();

	const aws = (a) => {
		const r = spawnSync(AWS, ["--region", REGION, ...a], { encoding: "utf8" });
		if (r.status !== 0) throw new Error(redact(r.stderr.trim().slice(0, 300)));
		return r.stdout;
	};
	const caller = aws([
		"sts",
		"get-caller-identity",
		"--query",
		"Account",
		"--output",
		"text",
	]).trim();
	if (caller !== account) {
		throw new Error(
			`refusing: AWS credentials are for account ${caller}, not ${account}`,
		);
	}
	const secret = (env) =>
		parseSecret(
			aws([
				"secretsmanager",
				"get-secret-value",
				"--secret-id",
				ENVS[env].secret,
				"--query",
				"SecretString",
				"--output",
				"text",
			]),
		);
	const src = secret("staging");
	const dst = secret("prod");
	for (const family of Object.keys(BUCKETS)) {
		const arm = ARM[family];
		if (src[`R2_BUCKET_${arm}`] !== BUCKETS[family].source) {
			throw new Error(
				`refusing: the staging secret's ${family} bucket is not ${BUCKETS[family].source}`,
			);
		}
		if (dst[`R2_BUCKET_${arm}`] !== BUCKETS[family].target) {
			throw new Error(
				`refusing: the production secret's ${family} bucket is not ${BUCKETS[family].target}`,
			);
		}
	}

	// 1. the keys, from the dump (pg_restore renders text; no connection)
	const tables = [
		"public.image_uploads",
		"public.users",
		"public.identity_pool",
		"public.market_media",
	];
	const r = spawnSync(
		"docker",
		[
			"run",
			"--rm",
			"-v",
			`${path.dirname(dumpFile)}:/backup`,
			"postgres:17-alpine",
			"pg_restore",
			"--data-only",
			...tables.map((t) => `--table=${t.split(".")[1]}`),
			"-f",
			"-",
			`/backup/${base}`,
		],
		{ encoding: "utf8", maxBuffer: 512 * 1024 * 1024 },
	);
	if (r.status !== 0) {
		throw new Error(
			`pg_restore render failed: ${r.stderr.trim().slice(0, 300)}`,
		);
	}
	const parsedRows = {
		"public.image_uploads": extractCopyRows(r.stdout, "public.image_uploads"),
		"public.users": extractCopyRows(r.stdout, "public.users"),
		"public.identity_pool": extractCopyRows(r.stdout, "public.identity_pool"),
		"public.market_media": extractCopyRows(r.stdout, "public.market_media"),
	};
	assertParsedCounts(parsedRows, manifest.tables);
	const users = parsedRows["public.users"];
	const refs = referencedObjects({
		imageUploads: parsedRows["public.image_uploads"],
		users,
		identityPool: parsedRows["public.identity_pool"],
		marketMedia: parsedRows["public.market_media"],
	});
	const participantPfp = new Set(participantPfpKeys(users));

	// 2. clients: staging credentials read the source, production's write the target
	const client = (cfg, arm) =>
		new S3Client({
			region: "auto",
			endpoint: cfg[`R2_ENDPOINT_${arm}`],
			credentials: {
				accessKeyId: cfg[`R2_ACCESS_KEY_ID_${arm}`],
				secretAccessKey: cfg[`R2_SECRET_ACCESS_KEY_${arm}`],
			},
		});
	const head = async (c, bucket, key) => {
		try {
			const h = await c.send(
				new HeadObjectCommand({ Bucket: bucket, Key: key }),
			);
			return { exists: true, size: h.ContentLength ?? 0, type: h.ContentType };
		} catch (e) {
			if (e?.$metadata?.httpStatusCode === 404 || e?.name === "NotFound") {
				return { exists: false, size: 0 };
			}
			throw e;
		}
	};
	// Bounded concurrency with a progress line: thousands of PFP objects must
	// not mean an hour of silent serial round trips inside the paused window.
	const CONCURRENCY = 16;
	const mapLimit = async (items, label, fn) => {
		const out = new Array(items.length);
		let next = 0;
		let done = 0;
		const worker = async () => {
			while (next < items.length) {
				const i = next++;
				out[i] = await fn(items[i]);
				done += 1;
				if (done % 250 === 0 || done === items.length) {
					console.log(`  ${label}: ${done}/${items.length}`);
				}
			}
		};
		await Promise.all(Array.from({ length: CONCURRENCY }, worker));
		return out;
	};

	const clients = {};
	for (const family of Object.keys(BUCKETS)) {
		clients[family] = {
			src: client(src, ARM[family]),
			dst: client(dst, ARM[family]),
		};
	}
	const items = [];
	for (const family of ["uploads", "pfp", "marketMedia"]) {
		for (const key of refs[family])
			items.push({ family, key: assertSafeKey(key) });
	}
	console.log(
		`referenced: uploads ${refs.uploads.length} · pfp ${refs.pfp.length} (${participantPfp.size} on participants) · market-media ${refs.marketMedia.length}`,
	);
	const plan = await mapLimit(items, "checked", async ({ family, key }) => {
		const c = clients[family];
		const t = await head(c.dst, BUCKETS[family].target, key);
		const sObj =
			family === "marketMedia"
				? t
				: await head(c.src, BUCKETS[family].source, key);
		const decision = copyDecision({
			inTarget: t.exists,
			targetSize: t.size,
			inSource: sObj.exists,
			sourceSize: sObj.size,
		});
		return {
			family,
			key,
			decision,
			size: sObj.size || t.size,
			type: sObj.type,
		};
	});

	const count = (d) => plan.filter((p) => p.decision === d).length;
	const problems = plan.filter((p) => p.decision.startsWith("fail"));
	const hard = problems.filter((p) =>
		isHardFailure(p.family, p.key, participantPfp),
	);
	const warnings = problems.filter(
		(p) => !isHardFailure(p.family, p.key, participantPfp),
	);
	console.log(
		`plan: copy ${count("copy")} · already present ${count("skip-present")} · problems ${hard.length} · warnings ${warnings.length}`,
	);
	for (const f of hard)
		console.log(`  PROBLEM ${f.decision}  ${f.family}  ${f.key}`);
	for (const f of warnings.slice(0, 20))
		console.log(
			`  warning ${f.decision}  ${f.family}  ${f.key}  (unassigned pool avatar)`,
		);
	const report = `${dumpFile}.storage.json`;
	const save = (extra) =>
		fs.writeFileSync(
			report,
			`${JSON.stringify(
				{
					dump: base,
					refs,
					participantPfp: [...participantPfp],
					plan: plan.map(({ family, key, decision, size }) => ({
						family,
						key,
						decision,
						size,
					})),
					...extra,
				},
				null,
				2,
			)}
`,
		);

	if (hard.length > 0) {
		save({ executed: false, result: "refused: problems listed" });
		throw new Error(
			"refusing: fix the problems above before copying (nothing was written to any bucket)",
		);
	}
	if (!execute) {
		save({ executed: false, result: "check-only" });
		console.log(`CHECK ONLY — nothing copied. Plan saved to ${report}`);
		process.exit(0);
	}

	// ── EXECUTE: copy-only, never overwrite ──
	const toCopy = plan.filter((x) => x.decision === "copy");
	await mapLimit(toCopy, "copied", async (p) => {
		const c = clients[p.family];
		const got = await c.src.send(
			new GetObjectCommand({ Bucket: BUCKETS[p.family].source, Key: p.key }),
		);
		const body = Buffer.from(await got.Body.transformToByteArray());
		await c.dst.send(
			new PutObjectCommand({
				Bucket: BUCKETS[p.family].target,
				Key: p.key,
				Body: body,
				ContentType: got.ContentType ?? p.type,
				CacheControl: got.CacheControl,
				Metadata: got.Metadata,
				IfNoneMatch: "*",
			}),
		);
	});

	// re-check every object that must now be present in its production bucket
	const mustExist = plan.filter((p) => !warnings.includes(p));
	const after = await mapLimit(mustExist, "re-checked", async (p) => {
		const t = await head(
			clients[p.family].dst,
			BUCKETS[p.family].target,
			p.key,
		);
		return t.exists ? null : `${p.family}:${p.key}`;
	});
	const missing = after.filter(Boolean);
	save({
		executed: true,
		copied: toCopy.length,
		warnings: warnings.length,
		missingAfter: missing,
	});
	if (missing.length > 0) {
		throw new Error(
			`copied ${toCopy.length}, but ${missing.length} referenced object(s) are still missing in production: ${missing.slice(0, 5).join(", ")}`,
		);
	}
	console.log(
		`DONE — copied ${toCopy.length}; every participant-facing object is present in production (${warnings.length} unassigned pool avatars missing in staging too). Report: ${report}`,
	);
	process.exit(0);
}

module.exports = {
	BUCKETS,
	PFP_KEY_PREFIX,
	extractCopyRows,
	assertParsedCounts,
	referencedObjects,
	participantPfpKeys,
	isHardFailure,
	assertSafeKey,
	copyDecision,
};

if (require.main === module) {
	main().catch((e) => {
		console.error(redact(e?.message ? e.message : String(e)));
		process.exit(1);
	});
}
