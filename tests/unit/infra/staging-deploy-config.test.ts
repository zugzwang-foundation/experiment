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

	it("still refuses production without its certificate", () => {
		expect(workflow).toContain(
			`if [ "\${{ inputs.environment || 'staging' }}" = "production" ] && [ -z "$ZZ_PROD_CERT_ARN" ]; then`,
		);
	});

	it("requires the alert email for production only", () => {
		expect(workflow).toContain(
			`if [ "\${{ inputs.environment || 'staging' }}" = "production" ] && [ -z "$ZZ_ALERT_EMAIL" ]; then`,
		);
		// Positive control: the message still exists, gated to production.
		expect(workflow).toContain("ZZ_ALERT_EMAIL is not set on the");
	});
});
