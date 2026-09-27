// CI/CD — refuse to auto-apply a DESTRUCTIVE migration.
//
//   node scripts/aws-migration/check-destructive-migrations.cjs <deployed-image-tag> [--allow]
//
// The deploy workflow applies migrations as soon as a deploy is approved. That
// is right for additive migrations (expand/contract, AGENTS.md §6), and wrong
// for one that drops, truncates, deletes or rewrites data: those must be a
// separate, deliberate decision. This lists the migration files added or
// changed since the commit the environment is RUNNING (read from its deployed
// image tag, `<env>-<sha>`) and exits 1 if any holds a data-destroying
// statement, unless `--allow` (the workflow's `allow_destructive_migrations`).
//
// It fails CLOSED: when the deployed commit cannot be read or is not in this
// checkout's history, it refuses rather than guessing which migrations are new.
// It reads git only; it never connects to a database.
const { execFileSync } = require("node:child_process");
const { readFileSync } = require("node:fs");

/** Statements that destroy or rewrite existing data (comment-stripped, per statement). */
const PATTERNS = [
	/^(drop\s+(table|schema|database|view|materialized\s+view)|truncate|delete\s+from)\b/i,
	/\bdrop\s+column\b/i,
	/\balter\s+column\s+\S+\s+(set\s+data\s+)?type\b/i,
	/\brename\s+(to|column)\b/i,
];

/** The data-destroying statements in one migration file, whitespace-normalised. */
function findDestructive(sql) {
	const stripped = sql
		.replace(/\/\*[\s\S]*?\*\//g, " ")
		.replace(/--[^\n]*/g, " ");
	return stripped
		.split(";")
		.map((s) => s.replace(/\s+/g, " ").trim())
		.filter((s) => s && PATTERNS.some((p) => p.test(s)));
}

/** The commit a deployed image tag names (`production-dd81159a` -> `dd81159a`), or null. */
function baselineSha(tag) {
	const m = /^[a-z]+-([0-9a-f]{7,40})$/.exec(String(tag || "").trim());
	return m ? m[1] : null;
}

function git(args) {
	return execFileSync("git", args, { encoding: "utf8" }).trim();
}

function main() {
	const argv = process.argv.slice(2);
	const allow = argv.includes("--allow");
	const tag = argv.find((a) => !a.startsWith("--"));
	const refuse = (why) => {
		if (allow) {
			console.log(`allowed by allow_destructive_migrations: ${why}`);
			return 0;
		}
		console.log(`refusing: ${why}`);
		console.log(
			"re-run with allow_destructive_migrations=true only after deciding it deliberately (backup first)",
		);
		return 1;
	};

	const sha = baselineSha(tag);
	if (!sha)
		return refuse(`cannot read the deployed commit from image tag "${tag}"`);
	try {
		git(["cat-file", "-e", `${sha}^{commit}`]);
	} catch {
		return refuse(`deployed commit ${sha} is not in this checkout's history`);
	}

	const files = git([
		"diff",
		"--name-only",
		"--diff-filter=AMR",
		sha,
		"HEAD",
		"--",
		"drizzle/migrations/",
	])
		.split("\n")
		.filter((f) => f.endsWith(".sql"));
	console.log(
		`migrations new since the deployed ${sha}: ${files.length ? files.join(", ") : "none"}`,
	);

	const findings = files.flatMap((f) =>
		findDestructive(readFileSync(f, "utf8")).map((s) => `${f}: ${s}`),
	);
	if (findings.length === 0) {
		console.log("no destructive statement; safe to apply automatically");
		return 0;
	}
	for (const f of findings) console.log(`  DESTRUCTIVE ${f}`);
	return refuse(
		`${findings.length} destructive statement(s) in new migrations`,
	);
}

module.exports = { findDestructive, baselineSha };

if (require.main === module) {
	try {
		process.exit(main());
	} catch (error) {
		console.error(String(error?.message ? error.message : error));
		process.exit(1);
	}
}
