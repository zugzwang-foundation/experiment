import { readFileSync } from "node:fs";
import { join } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";

/**
 * Production-readiness pass (docs/aws-migration/09-PRODUCTION-READINESS.md) —
 * guards for the decisions that pass made, each of which is one token away from
 * being undone with every other test green (review MEDIUM-7, security M2).
 * Config VALUES are asserted by import; the CDK wiring by source scan (this
 * root suite has no CDK app — the environment-config.test.ts convention),
 * comments stripped so a docblock cannot satisfy a scan.
 */

const REPO_ROOT = join(__dirname, "..", "..", "..");

function stripped(relPath: string): string {
	return readFileSync(join(REPO_ROOT, relPath), "utf8")
		.replace(/\/\*[\s\S]*?\*\//g, " ")
		.replace(/(^|[^:])\/\/[^\n]*/g, "$1 ");
}

async function loadConfigs() {
	vi.resetModules();
	const { stagingConfig } = await import("../../../infra/config/staging");
	const { productionConfig } = await import("../../../infra/config/production");
	return { stagingConfig, productionConfig };
}

afterEach(() => {
	vi.unstubAllEnvs();
});

describe("§B — each environment deploys through its own CDK bootstrap", () => {
	it("staging keeps the qualifier it was bootstrapped with; production has its own", async () => {
		const { stagingConfig, productionConfig } = await loadConfigs();
		expect(stagingConfig.bootstrapQualifier).toBe("hnb659fds");
		expect(productionConfig.bootstrapQualifier).toBe("zzprod");
		expect(productionConfig.bootstrapQualifier).not.toBe(
			stagingConfig.bootstrapQualifier,
		);
	});

	it("each deploy role's bootstrap ARNs are built per environment, from that environment's qualifier", () => {
		const source = stripped("infra/lib/deploy-stack.ts");
		// Positive control: the statement exists.
		expect(source).toContain('sid: "AssumeCdkBootstrapRoles"');
		// No hard-coded qualifier: a literal here would bind every role to one bootstrap.
		expect(source).not.toMatch(/hnb659fds|zzprod/);
		// The ARN list is built INSIDE the per-environment loop, from its qualifier.
		const loop = source.indexOf("of props.environments");
		const arns = source.indexOf("cdk-${bootstrapQualifier}-");
		expect(loop).toBeGreaterThan(-1);
		expect(arns).toBeGreaterThan(loop);
	});

	it("the app binds each environment's stacks to its qualifier", () => {
		const source = stripped("infra/bin/zugzwang.ts");
		expect(source).toMatch(
			/new DefaultStackSynthesizer\(\{\s*qualifier:\s*config\.bootstrapQualifier/,
		);
		// Every stack of the environment receives it (six stacks).
		expect(source.match(/\bsynthesizer,/g)?.length ?? 0).toBeGreaterThanOrEqual(
			5,
		);
		expect(source).toMatch(/config, env, synthesizer \}|env,\s*synthesizer,/);
	});
});

describe("§D / HIGH-4 — PassRole names the task roles by their real ARNs", () => {
	it("the deploy role passes exactly the ARNs it is handed, and nothing name-derived", () => {
		const deploy = stripped("infra/lib/deploy-stack.ts");
		expect(deploy).toContain('sid: "PassTaskRoles"');
		expect(deploy).toContain("resources: [...passRoleArns]");
		// No name pattern, no wildcard: generated names are truncated in production.
		expect(deploy).not.toMatch(/Security-\*|role\/zugzwang-/);
	});

	it("the app hands each environment's own Security roles to its deploy role", () => {
		const bin = stripped("infra/bin/zugzwang.ts");
		expect(bin).toContain("securityStacks[c.name].executionRole.roleArn");
		expect(bin).toContain("securityStacks[c.name].taskRole.roleArn");
	});

	it("the live task roles are NOT renamed (renaming would replace them under Compute's import)", () => {
		const security = stripped("infra/lib/security-stack.ts");
		// Positive control: both roles are defined here.
		expect(security).toContain('new iam.Role(this, "TaskExecutionRole"');
		expect(security).toContain('new iam.Role(this, "TaskRole"');
		expect(security).not.toMatch(/roleName:/);
	});
});

describe("security M1 — the migration container holds only its own secrets", () => {
	it("does not spread the app's runtime secrets into the migrate container", () => {
		const source = stripped("infra/lib/compute-stack.ts");
		const start = source.indexOf('addContainer("migrate"');
		expect(start).toBeGreaterThan(-1);
		const block = source.slice(start, source.indexOf("logging:", start));
		expect(block).toContain("config.migrationSecretKeys");
		expect(block).not.toMatch(/\.\.\.secrets\b/);
	});
});

describe("§I — the WAF starts in COUNT and staging is untouched by default", () => {
	it("production counts unless ZZ_PROD_WAF_MODE is exactly 'block'", async () => {
		vi.stubEnv("ZZ_PROD_WAF_MODE", "");
		expect((await loadConfigs()).productionConfig.wafMode).toBe("count");
		vi.stubEnv("ZZ_PROD_WAF_MODE", "Block");
		expect((await loadConfigs()).productionConfig.wafMode).toBe("count");
		vi.stubEnv("ZZ_PROD_WAF_MODE", "block");
		expect((await loadConfigs()).productionConfig.wafMode).toBe("block");
	});

	it("staging attaches no WAF unless a rehearsal asks for it", async () => {
		vi.stubEnv("ZZ_STAGING_WAF", "");
		expect((await loadConfigs()).stagingConfig.wafEnabled).toBe(false);
		vi.stubEnv("ZZ_STAGING_WAF", "count");
		const { stagingConfig } = await loadConfigs();
		expect(stagingConfig.wafEnabled).toBe(true);
		expect(stagingConfig.wafMode).toBe("count");
	});

	it("compute-stack maps count/block onto the rule group's override action", () => {
		const source = stripped("infra/lib/compute-stack.ts");
		expect(source).toMatch(
			/config\.wafMode === "block" \? \{ none: \{\} \} : \{ count: \{\} \}/,
		);
	});
});

describe("STAGING-PUSH-DEPLOY — a push deploys staging and can never reach production", () => {
	const workflow = readFileSync(
		join(REPO_ROOT, ".github/workflows/deploy-aws.yml"),
		"utf8",
	);

	it("the only push trigger is the staging branch", () => {
		const on = workflow.slice(
			workflow.indexOf("\non:"),
			workflow.indexOf("\nconcurrency:"),
		);
		// Positive control: the block was found and carries the push trigger.
		expect(on).toMatch(/push:\s*\n\s*branches:\s*\[staging\]/);
		expect(on.match(/branches:/g)?.length).toBe(1);
	});

	it("every environment read falls back to staging, never to an unset value", () => {
		const reads = workflow.match(/inputs\.environment[^}\n]*/g) ?? [];
		expect(reads.length).toBeGreaterThan(10);
		for (const read of reads) {
			expect(read).toMatch(/^inputs\.environment \|\| 'staging'/);
		}
	});

	it("the guard job refuses a push that resolves to anything but staging", () => {
		expect(workflow).toContain(
			'if [ "$EVENT" = "push" ] && [ "$TARGET" != "staging" ]; then',
		);
		expect(workflow).toContain("EVENT: ${{ github.event_name }}");
	});
});
