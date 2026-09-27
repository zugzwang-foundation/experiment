import { readdirSync, readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * CI/CD — `scripts/aws-migration/check-destructive-migrations.cjs`. The deploy
 * workflow runs migrations automatically once a deploy is approved; this check
 * refuses to do so when a migration that is new since the deployed build would
 * destroy data, so that a drop or a rewrite is always a deliberate, separate
 * decision (`allow_destructive_migrations`). The pure detector is exercised
 * against the repository's own history: 0017 and 0018 are the only two
 * destructive migrations ever committed, which makes them the controls.
 */

const REPO_ROOT = join(__dirname, "..", "..", "..");
const require = createRequire(import.meta.url);
// biome-ignore lint/suspicious/noExplicitAny: a CommonJS script without types.
const tool: any = require(
	join(REPO_ROOT, "scripts/aws-migration/check-destructive-migrations.cjs"),
);
const MIGRATIONS = join(REPO_ROOT, "drizzle/migrations");
const sqlOf = (prefix: string) => {
	const file = readdirSync(MIGRATIONS).find(
		(f) => f.startsWith(prefix) && f.endsWith(".sql"),
	);
	if (!file) throw new Error(`no migration ${prefix}`);
	return readFileSync(join(MIGRATIONS, file), "utf8");
};

describe("findDestructive", () => {
	it("flags the two destructive migrations this repository has shipped", () => {
		expect(tool.findDestructive(sqlOf("0017_"))).toEqual([
			'ALTER TABLE "comments" DROP COLUMN "stake_at_post_time"',
		]);
		expect(tool.findDestructive(sqlOf("0018_"))).toEqual([
			'DROP TABLE "friendly_fire_events"',
		]);
	});

	it("flags nothing in every other committed migration", () => {
		const flagged = readdirSync(MIGRATIONS)
			.filter((f) => f.endsWith(".sql"))
			.filter(
				(f) =>
					tool.findDestructive(readFileSync(join(MIGRATIONS, f), "utf8"))
						.length > 0,
			);
		expect(flagged).toEqual([
			"0017_drop_comments_stake_at_post_time.sql",
			"0018_drop_friendly_fire_events.sql",
		]);
	});

	it("ignores TRUNCATE and DELETE that are not statements (0021's guards)", () => {
		expect(tool.findDestructive(sqlOf("0021_"))).toEqual([]);
		expect(
			tool.findDestructive(
				"-- DROP TABLE users;\nCREATE INDEX a ON b (c); /* TRUNCATE x; */",
			),
		).toEqual([]);
	});

	it("flags each kind of data-destroying statement", () => {
		for (const sql of [
			"DROP TABLE x",
			"drop schema s cascade",
			"TRUNCATE bets",
			"DELETE FROM users WHERE true",
			"ALTER TABLE t DROP COLUMN c",
			'ALTER TABLE t ALTER COLUMN "c" TYPE bigint',
			"ALTER TABLE t ALTER COLUMN c SET DATA TYPE text",
			"ALTER TABLE t RENAME COLUMN a TO b",
			"ALTER TABLE t RENAME TO u",
		]) {
			expect(tool.findDestructive(`${sql};`), sql).toHaveLength(1);
		}
	});

	it("does not flag additive statements", () => {
		for (const sql of [
			"CREATE TABLE x (id int)",
			"ALTER TABLE t ADD COLUMN c int",
			"CREATE INDEX i ON t (c)",
			"INSERT INTO t VALUES (1)",
			"ALTER TABLE t ALTER COLUMN c SET DEFAULT 0",
		]) {
			expect(tool.findDestructive(`${sql};`), sql).toEqual([]);
		}
	});
});

describe("baselineSha", () => {
	it("reads the commit from a deployed image tag", () => {
		expect(tool.baselineSha("production-dd81159a")).toBe("dd81159a");
		expect(tool.baselineSha("staging-97ffb6b")).toBe("97ffb6b");
	});

	it("refuses a tag it cannot read, rather than guessing", () => {
		expect(tool.baselineSha("")).toBeNull();
		expect(tool.baselineSha("None")).toBeNull();
		expect(tool.baselineSha("staging-latest")).toBeNull();
	});
});
