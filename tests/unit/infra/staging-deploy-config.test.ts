import { readFileSync } from "node:fs";
import { join } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";

/**
 * STAGING-DEPLOY-NO-VARS — the push-to-staging deploy must not depend on
 * GitHub `vars.*`: four runs received every variable empty while their secrets
 * resolved. Staging's certificate is a committed default; the alert email is
 * not needed by the Compute-only deploy. Production's checks are unchanged.
 */

const REPO_ROOT = join(__dirname, "..", "..", "..");
const workflow = readFileSync(
	join(REPO_ROOT, ".github/workflows/deploy-aws.yml"),
	"utf8",
);

async function loadStaging() {
	vi.resetModules();
	return import("../../../infra/config/staging");
}

afterEach(() => {
	vi.unstubAllEnvs();
});

describe("staging certificate is a committed default", () => {
	it("is used when ZZ_STAGING_CERT_ARN is unset — never an HTTP-only listener", async () => {
		vi.stubEnv("ZZ_STAGING_CERT_ARN", "");
		const { stagingConfig, STAGING_CERTIFICATE_ARN } = await loadStaging();
		expect(STAGING_CERTIFICATE_ARN).toMatch(
			/^arn:aws:acm:ap-south-1:\d{12}:certificate\/[0-9a-f-]{36}$/,
		);
		expect(stagingConfig.certificateArn).toBe(STAGING_CERTIFICATE_ARN);
	});

	it("can still be overridden by the variable", async () => {
		const other =
			"arn:aws:acm:ap-south-1:111111111111:certificate/00000000-0000-0000-0000-000000000000";
		vi.stubEnv("ZZ_STAGING_CERT_ARN", other);
		const { stagingConfig } = await loadStaging();
		expect(stagingConfig.certificateArn).toBe(other);
	});
});

describe("the deploy job's variable checks", () => {
	it("no longer refuses staging on an empty ZZ_STAGING_CERT_ARN", () => {
		expect(workflow).not.toContain(
			"ZZ_STAGING_CERT_ARN is not set on the staging environment",
		);
	});

	it("reads no GitHub variables at all (PROD-DEPLOY-NO-VARS)", () => {
		// vars.* arrived empty in four staging runs; nothing in the deploy
		// path may depend on them.
		expect(workflow).not.toMatch(/\$\{\{\s*vars\./);
	});

	it("takes the write-pause from the dispatch input, per environment", () => {
		expect(workflow).toContain(
			"ZZ_PROD_WRITES_PAUSED: ${{ (inputs.environment || 'staging') == 'production' && (inputs.writes || 'open') == 'paused' && 'paused' || '' }}",
		);
		expect(workflow).toContain(
			"ZZ_STAGING_WRITES_PAUSED: ${{ (inputs.environment || 'staging') == 'staging' && (inputs.writes || 'open') == 'paused' && 'paused' || '' }}",
		);
	});
});

describe("the deploy job installs and runs infra's own toolchain", () => {
	// Run 36233879711: a bare `pnpm install` inside infra/ installed the ROOT
	// workspace (the repo root holds pnpm-workspace.yaml), so `cdk` was absent.
	it("installs infra/ with --ignore-workspace and runs cdk the same way", () => {
		expect(workflow).toContain(
			"pnpm install --frozen-lockfile --ignore-workspace",
		);
		expect(workflow).toContain("pnpm --ignore-workspace exec cdk deploy");
		expect(workflow).not.toMatch(/^\s+pnpm exec cdk /m);
	});
});

describe("the verify gate reads writesPaused as a literal boolean", () => {
	// Run 36234538584: `jq -r '.writesPaused // empty'` turned a correct
	// `false` into "" (jq's `//` treats false like null) and failed a healthy
	// deploy. `tostring` yields "true" / "false" / "null".
	it("uses tostring, never the // alternative, for writesPaused", () => {
		expect(workflow).toContain("jq -r '.writesPaused | tostring'");
		expect(workflow).not.toContain("jq -r '.writesPaused // empty'");
	});

	it("compares it with the dispatch intent rendered the same way", () => {
		expect(workflow).toContain(
			"EXPECTED_PAUSED: ${{ (inputs.writes || 'open') == 'paused' }}",
		);
		expect(workflow).toContain('if [ "$PAUSED" != "$EXPECTED_PAUSED" ]; then');
	});
});
