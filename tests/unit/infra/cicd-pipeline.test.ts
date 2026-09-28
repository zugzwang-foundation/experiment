import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * CI/CD — the AWS pipeline's shape. Staging deploys on a push to `staging`;
 * production deploys on a merge to `main` through deploy-production.yml, which
 * calls the same deploy-aws.yml and is held by the `aws-production`
 * environment's required reviewer. Every PRODUCTION deploy passes ci.yml first;
 * a staging deploy, and a PR into `staging`, skip it (STAGING-FAST-DEPLOY,
 * founder ruling 2026-09-28). No migration that destroys data is applied
 * without an explicit decision.
 */

const REPO_ROOT = join(__dirname, "..", "..", "..");
// `$` is assembled so these literals are not read as template strings.
const $ = "$";
const read = (rel: string) => readFileSync(join(REPO_ROOT, rel), "utf8");
const deploy = read(".github/workflows/deploy-aws.yml");
const production = read(".github/workflows/deploy-production.yml");
const ci = read(".github/workflows/ci.yml");
/** The text of one top-level job in deploy-aws.yml, up to the next job. */
const job = (name: string) => {
	const start = deploy.indexOf(`\n  ${name}:\n`);
	expect(start).toBeGreaterThan(-1);
	const next = deploy.slice(start + 1).search(/\n {2}[a-z-]+:\n/);
	return deploy.slice(start, next === -1 ? undefined : start + 1 + next);
};

describe("a pipeline synth needs no live context lookup", () => {
	it("infra/cdk.json carries the account's availability zones", () => {
		// `cdk deploy` synthesizes every stack. Without this committed value the
		// synth looks the zones up through a CDK lookup role, and staging's
		// stacks name staging's (hnb659fds) lookup role, which the production
		// deploy role is denied by design: the first production pipeline run
		// (36322258735) failed exactly there. cdk.context.json is gitignored,
		// so cdk.json is where a CI-visible value has to live.
		const context = JSON.parse(read("infra/cdk.json")).context;
		expect(
			context["availability-zones:account=849076101704:region=ap-south-1"],
		).toEqual(["ap-south-1a", "ap-south-1b", "ap-south-1c"]);
	});
});

describe("production deploys run CI first; staging deploys skip it", () => {
	it("ci.yml is callable, and runs on every pull request except one into staging", () => {
		expect(ci).toMatch(
			/\n {2}pull_request:\n {4}branches-ignore: \[staging\]\n/,
		);
		expect(ci).toMatch(/\n {2}workflow_call:\n/);
		// Nothing narrower: a PR into `main`, or any other branch, still runs it.
		expect(ci).not.toMatch(/\n {4}branches:/);
	});

	it("deploy-aws.yml calls ci.yml, and build waits for it", () => {
		expect(job("ci")).toContain("uses: ./.github/workflows/ci.yml");
		expect(job("build")).toContain("needs: [guard, ci]");
	});

	it("the ci job runs for production only, and never for a rollback", () => {
		expect(job("ci")).toContain(
			`if: ${$}{{ (inputs.environment || 'staging') == 'production' && !inputs.rollback_image_tag }}`,
		);
	});

	it("a production build never proceeds on a skipped CI unless it is a rollback", () => {
		expect(job("build")).toContain(
			`(needs.ci.result == 'success' || (needs.ci.result == 'skipped' && ((inputs.environment || 'staging') == 'staging' || inputs.rollback_image_tag)))`,
		);
	});
});

describe("production deploys on merge to main, behind the approval gate", () => {
	it("triggers only on pushes to main, skipping documentation-only merges", () => {
		const on = production.slice(
			production.indexOf("\non:"),
			production.indexOf("\nconcurrency:"),
		);
		expect(on).toMatch(/push:\s*\n\s*branches:\s*\[main\]/);
		expect(on.match(/branches:/g)).toHaveLength(1);
		expect(on).toContain('- "docs/**"');
		expect(on).not.toMatch(/workflow_dispatch|pull_request/);
	});

	it("calls the shared pipeline for production, writes open, nothing destructive", () => {
		expect(production).toContain("uses: ./.github/workflows/deploy-aws.yml");
		expect(production).toMatch(/environment:\s*production\n/);
		expect(production).toMatch(/writes:\s*open\n/);
		expect(production).toMatch(/allow_destructive_migrations:\s*false\n/);
		expect(production).toContain("secrets: inherit");
		expect(production).toMatch(/id-token:\s*write/);
	});

	it("never cancels a production pipeline that is already running", () => {
		expect(production).toMatch(/cancel-in-progress:\s*false/);
		expect(deploy).toMatch(/cancel-in-progress:\s*false/);
	});

	it("every production job runs in aws-production, where the reviewer gate lives", () => {
		for (const name of ["build", "migrate", "deploy"]) {
			expect(job(name)).toContain(
				`environment: ${$}{{ (inputs.environment || 'staging') == 'production' && 'aws-production' || (inputs.environment || 'staging') }}`,
			);
		}
	});

	it("deploy-aws.yml accepts the same inputs from a caller as from dispatch", () => {
		const call = deploy.slice(deploy.indexOf("  workflow_call:"));
		for (const input of [
			"environment",
			"skip_migrations",
			"writes",
			"allow_destructive_migrations",
		]) {
			expect(call).toContain(`      ${input}:`);
		}
	});
});

describe("rollback redeploys an existing image through the same gate", () => {
	it("is a dispatch-only input, not reachable from a push", () => {
		const dispatch = deploy.slice(
			deploy.indexOf("  workflow_dispatch:"),
			deploy.indexOf("  workflow_call:"),
		);
		expect(dispatch).toContain("      rollback_image_tag:");
		expect(production).not.toContain("rollback_image_tag");
	});

	it("skips CI, the image build and migrations, but not the approval-gated jobs", () => {
		expect(job("ci")).toContain("&& !inputs.rollback_image_tag }}");
		expect(job("migrate")).toContain(
			`if: ${$}{{ !inputs.skip_migrations && !inputs.rollback_image_tag }}`,
		);
		const build = job("build");
		expect(build).toContain(
			`(needs.ci.result == 'skipped' && ((inputs.environment || 'staging') == 'staging' || inputs.rollback_image_tag))`,
		);
		for (const step of [
			"Fetch build-time values from Doppler",
			"Build and push the app image",
			"Build and push the migration image",
		]) {
			const at = build.indexOf(`name: ${step}`);
			expect(at, step).toBeGreaterThan(-1);
			expect(build.slice(at, at + 200)).toContain(
				`if: ${$}{{ !inputs.rollback_image_tag }}`,
			);
		}
	});

	it("accepts only this environment's tag, and only one already in its ECR", () => {
		const build = job("build");
		expect(build).toContain('grep -Eq "^${ENV_NAME}-[0-9a-f]{7,40}$"');
		expect(build).toContain(
			'aws ecr describe-images --repository-name "zugzwang-${ENV_NAME}" --image-ids imageTag="$ROLLBACK"',
		);
	});

	it("the guard's tag rule behaves as written", () => {
		const build = job("build");
		const rule = build.slice(
			build.indexOf("if ! echo"),
			build.indexOf("fi", build.indexOf("if ! echo")) + 2,
		);
		const run = (env: string, tag: string) =>
			spawnSync("bash", ["-c", rule], {
				env: { ...process.env, ENV_NAME: env, ROLLBACK: tag },
			}).status;
		expect(run("production", "production-dd81159a")).toBe(0);
		expect(run("production", "staging-97ffb6b")).toBe(1);
		expect(run("production", "production-latest")).toBe(1);
		expect(run("staging", "staging-97ffb6b")).toBe(0);
	});
});

describe("no destructive migration is applied automatically", () => {
	it("the migrate job checks new migrations before it runs the task", () => {
		const migrate = job("migrate");
		const check = migrate.indexOf(
			"node scripts/aws-migration/check-destructive-migrations.cjs",
		);
		const runTask = migrate.indexOf("aws ecs run-task");
		expect(check).toBeGreaterThan(-1);
		expect(runTask).toBeGreaterThan(check);
		expect(migrate).toContain("fetch-depth: 0");
		expect(migrate).toContain("OutputKey=='DeployedImageTag'");
	});

	it("passes --allow only from the explicit input, which defaults to false", () => {
		expect(job("migrate")).toContain(
			`ALLOW: ${$}{{ inputs.allow_destructive_migrations && '--allow' || '' }}`,
		);
		expect(deploy).toMatch(
			/allow_destructive_migrations:\n(?:\s+[a-z_]+:.*\n)*?\s+default: false/,
		);
	});
});
