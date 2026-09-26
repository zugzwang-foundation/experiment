import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Readiness item 5 (H-3 / review HIGH-3, 09 §B) — the inline deny put on the
 * STAGING bootstrap's deploy role (`cdk-hnb659fds-deploy-role-…`). That role's
 * bootstrap policy allows CloudFormation and S3 on `*`, so without this it can
 * change-set any production stack, or `Zugzwang-Deploy` (which defines the
 * PRODUCTION GitHub deploy role), with the admin execution role. The deny must
 * block exactly that and nothing staging's own pipeline needs.
 */

const REPO_ROOT = join(__dirname, "..", "..", "..");
type Statement = {
	Effect: string;
	Action: string | string[];
	Resource: string | string[];
};
const policy = JSON.parse(
	readFileSync(
		join(REPO_ROOT, "infra/policies/staging-deploy-role-deny.json"),
		"utf8",
	),
) as { Statement: Statement[] };
const list = (v: string | string[]) => (Array.isArray(v) ? v : [v]);
const glob = (pattern: string, value: string) =>
	new RegExp(
		`^${pattern
			.split("*")
			.map((p) => p.replace(/[.+?^${}()|[\]\\]/g, "\\$&"))
			.join(".*")}$`,
	).test(value);
const denied = (action: string, resource: string) =>
	policy.Statement.some(
		(s) =>
			list(s.Action).some((a) => glob(a, action)) &&
			list(s.Resource).some((r) => glob(r, resource)),
	);

const ACCT = "849076101704";
const stack = (name: string) =>
	`arn:aws:cloudformation:ap-south-1:${ACCT}:stack/${name}/0a1b2c3d-1111-2222-3333-444455556666`;

describe("the deny", () => {
	it("contains only Deny statements (it can never grant anything)", () => {
		expect(policy.Statement.length).toBeGreaterThan(0);
		for (const s of policy.Statement) expect(s.Effect).toBe("Deny");
	});

	it.each([
		"Zugzwang-production-Network",
		"Zugzwang-production-Database",
		"Zugzwang-production-Security",
		"Zugzwang-production-Compute",
		"Zugzwang-production-Scheduler",
		"Zugzwang-production-Monitoring",
		"Zugzwang-Deploy",
		"CDKToolkit-prod",
	])("blocks change sets and stack writes on %s", (name) => {
		for (const action of [
			"cloudformation:CreateChangeSet",
			"cloudformation:ExecuteChangeSet",
			"cloudformation:UpdateStack",
			"cloudformation:DeleteStack",
		]) {
			expect(denied(action, stack(name))).toBe(true);
		}
	});

	it.each([
		`arn:aws:iam::${ACCT}:role/cdk-zzprod-cfn-exec-role-${ACCT}-ap-south-1`,
		`arn:aws:iam::${ACCT}:role/cdk-zzprod-deploy-role-${ACCT}-ap-south-1`,
		`arn:aws:iam::${ACCT}:role/zugzwang-production-github-deploy`,
		`arn:aws:iam::${ACCT}:role/Zugzwang-production-Security-TaskRole30FC0FBB-X`,
	])("blocks passing, assuming or editing %s", (arn) => {
		for (const action of [
			"iam:PassRole",
			"iam:PutRolePolicy",
			"sts:AssumeRole",
		]) {
			expect(denied(action, arn)).toBe(true);
		}
	});

	it("blocks production bootstrap assets and version parameter", () => {
		expect(
			denied(
				"s3:PutObject",
				`arn:aws:s3:::cdk-zzprod-assets-${ACCT}-ap-south-1/x.json`,
			),
		).toBe(true);
		expect(
			denied(
				"ssm:GetParameter",
				`arn:aws:ssm:ap-south-1:${ACCT}:parameter/cdk-bootstrap/zzprod/version`,
			),
		).toBe(true);
	});
});

describe("staging's own pipeline is untouched", () => {
	it.each([
		"Zugzwang-staging-Network",
		"Zugzwang-staging-Database",
		"Zugzwang-staging-Security",
		"Zugzwang-staging-Compute",
		"Zugzwang-staging-Scheduler",
		"Zugzwang-staging-Monitoring",
		"CDKToolkit",
	])("does not block %s", (name) => {
		for (const action of [
			"cloudformation:CreateChangeSet",
			"cloudformation:ExecuteChangeSet",
			"cloudformation:DescribeStacks",
		]) {
			expect(denied(action, stack(name))).toBe(false);
		}
	});

	it("does not block staging's exec role, assets or bootstrap parameter", () => {
		expect(
			denied(
				"iam:PassRole",
				`arn:aws:iam::${ACCT}:role/cdk-hnb659fds-cfn-exec-role-${ACCT}-ap-south-1`,
			),
		).toBe(false);
		expect(
			denied(
				"s3:PutObject",
				`arn:aws:s3:::cdk-hnb659fds-assets-${ACCT}-ap-south-1/x.json`,
			),
		).toBe(false);
		expect(
			denied(
				"ssm:GetParameter",
				`arn:aws:ssm:ap-south-1:${ACCT}:parameter/cdk-bootstrap/hnb659fds/version`,
			),
		).toBe(false);
		expect(
			denied(
				"iam:PassRole",
				`arn:aws:iam::${ACCT}:role/Zugzwang-staging-Security-TaskRole30FC0FBB-X`,
			),
		).toBe(false);
	});
});

describe("Zugzwang-Deploy no longer needs a bootstrap deploy role", () => {
	it("is synthesized with the operator's CLI credentials", () => {
		const source = readFileSync(
			join(REPO_ROOT, "infra/bin/zugzwang.ts"),
			"utf8",
		);
		const at = source.indexOf('new DeployStack(app, "Zugzwang-Deploy"');
		expect(at).toBeGreaterThan(-1);
		const end = source.indexOf("});", at);
		expect(source.slice(at, end)).toContain(
			"synthesizer: new CliCredentialsStackSynthesizer()",
		);
	});
});
