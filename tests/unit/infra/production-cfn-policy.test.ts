import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import { productionConfig } from "../../../infra/config/production";
import { stagingConfig } from "../../../infra/config/staging";
import {
	evaluatePolicy,
	type PolicyDocument,
	servicesFor,
	uncoveredResourceTypes,
} from "../../../infra/policies/coverage";

/**
 * Readiness item 4 (H-3, 09 §B) — the scoped CloudFormation execution policy the
 * `zzprod` bootstrap is created with, and the permissions boundary every
 * production role carries. The root suite has no CDK app, so coverage is checked
 * against the committed resource-type snapshot; the snapshot itself is checked
 * against a real synth by infra/scripts/check-production-policies.ts.
 */

const REPO_ROOT = join(__dirname, "..", "..", "..");
const read = <T>(rel: string): T =>
	JSON.parse(readFileSync(join(REPO_ROOT, rel), "utf8")) as T;
const exec = read<PolicyDocument>(
	"infra/policies/production-cfn-execution-policy.json",
);
const boundary = read<PolicyDocument>(
	"infra/policies/production-permissions-boundary.json",
);
const types = read<string[]>("infra/policies/production-resource-types.json");
const list = (v: string | string[] | undefined) =>
	v === undefined ? [] : Array.isArray(v) ? v : [v];
const BOUNDARY_ARN = `arn:aws:iam::849076101704:policy/${productionConfig.permissionsBoundaryPolicyName}`;

/** Allow / Deny verdict of the execution policy for one action on one resource. */
function decide(action: string, resource: string): "allow" | "deny" | "none" {
	return evaluatePolicy(exec, action, resource);
}

describe("coverage of the production templates", () => {
	it("every resource type the production stacks create has its service allowed", () => {
		expect(types.length).toBeGreaterThan(30);
		expect(uncoveredResourceTypes(types, exec)).toEqual([]);
	});

	it("includes the alarm e-mail subscription production always has", () => {
		// Monitoring refuses to synth production without an alert e-mail, so the
		// subscription is always created; a snapshot taken without one missed it.
		expect(types).toContain("AWS::SNS::Subscription");
	});

	it("the coverage check can fail (negative control)", () => {
		expect(
			uncoveredResourceTypes(
				["AWS::DynamoDB::Table", "AWS::RDS::DBInstance"],
				exec,
			),
		).toEqual(["AWS::DynamoDB::Table"]);
		expect(() => servicesFor("Custom::Unknown")).toThrow(/unmapped/);
	});

	it("grants no service-wide IAM, STS, Organizations, CloudFormation or Secrets Manager", () => {
		const serviceWide = exec.Statement.filter(
			(s) => s.Effect === "Allow" && list(s.Resource).includes("*"),
		).flatMap((s) => list(s.Action));
		for (const a of serviceWide) {
			expect(a).not.toMatch(
				/^(iam|sts|organizations|account|cloudformation):\*|^secretsmanager:\*$/,
			);
		}
	});
});

describe("IAM is scoped to production roles under the boundary", () => {
	const PROD_ROLE =
		"arn:aws:iam::849076101704:role/Zugzwang-production-Compute-InstanceRole-X";

	it("creates or edits a role only with the production boundary condition", () => {
		const s = exec.Statement.find((x) =>
			list(x.Action).includes("iam:CreateRole"),
		);
		expect(s?.Condition).toEqual({
			StringEquals: { "iam:PermissionsBoundary": BOUNDARY_ARN },
		});
		for (const action of [
			"iam:CreateRole",
			"iam:PutRolePolicy",
			"iam:AttachRolePolicy",
		]) {
			expect(list(s?.Action)).toContain(action);
		}
		expect(list(s?.Resource)).toEqual([
			"arn:aws:iam::849076101704:role/Zugzwang-production-*",
		]);
	});

	it.each([
		"arn:aws:iam::849076101704:role/Zugzwang-staging-Compute-InstanceRole-X",
		"arn:aws:iam::849076101704:role/cdk-hnb659fds-cfn-exec-role-849076101704-ap-south-1",
		"arn:aws:iam::849076101704:role/cdk-zzprod-deploy-role-849076101704-ap-south-1",
		"arn:aws:iam::849076101704:role/zugzwang-production-github-deploy",
		"arn:aws:iam::849076101704:role/zugzwang-staging-github-deploy",
	])("cannot touch %s", (arn) => {
		for (const action of [
			"iam:PassRole",
			"iam:UpdateAssumeRolePolicy",
			"iam:DeleteRole",
			"iam:PutRolePolicy",
		]) {
			expect(decide(action, arn)).not.toBe("allow");
		}
	});

	it("can pass and maintain its own production roles", () => {
		expect(decide("iam:PassRole", PROD_ROLE)).toBe("allow");
		expect(decide("iam:GetRole", PROD_ROLE)).toBe("allow");
	});

	it.each([
		"iam:CreateUser",
		"iam:CreateAccessKey",
		"iam:AttachUserPolicy",
		"iam:AddUserToGroup",
		"iam:CreatePolicyVersion",
		"iam:SetDefaultPolicyVersion",
		"iam:DeleteRolePermissionsBoundary",
		"iam:CreateOpenIDConnectProvider",
		"sts:AssumeRole",
		"organizations:LeaveOrganization",
		"account:CloseAccount",
	])("explicitly denies %s", (action) => {
		expect(decide(action, "*")).toBe("deny");
	});

	it("reads secrets only under zugzwang/production — staging's are explicitly denied", () => {
		const base = "arn:aws:secretsmanager:ap-south-1:849076101704:secret:";
		expect(
			decide("secretsmanager:GetSecretValue", `${base}zugzwang/production-AbC`),
		).toBe("allow");
		expect(
			decide("secretsmanager:GetSecretValue", `${base}zugzwang/staging-AbC`),
		).toBe("deny");
	});

	it("reads its own bootstrap assets (Lambda code), and nothing else in S3", () => {
		// CloudFormation creates a Lambda from a zip in the zzprod assets bucket
		// with THIS role's credentials; without the read, the Database stack's
		// LogRetention function fails (first production deploy, 2026-09-27).
		const own = "arn:aws:s3:::cdk-zzprod-assets-849076101704-ap-south-1";
		expect(decide("s3:GetObject", `${own}/2819175352ad1ce0.zip`)).toBe("allow");
		expect(decide("s3:PutObject", `${own}/x.zip`)).toBe("none");
		expect(decide("s3:DeleteObject", `${own}/x.zip`)).toBe("none");
		expect(
			decide(
				"s3:GetObject",
				"arn:aws:s3:::cdk-hnb659fds-assets-849076101704-ap-south-1/x.zip",
			),
		).not.toBe("allow");
		expect(decide("s3:GetObject", "arn:aws:s3:::some-other-bucket/x")).toBe(
			"none",
		);
	});
});

describe("the permissions boundary", () => {
	it("allows no IAM, STS, Organizations, account or CloudFormation action to any production role", () => {
		// One Allow (everything but these); every other statement is a Deny
		// (the same-account staging denies, 09 §0) and can only narrow it.
		const allows = boundary.Statement.filter((x) => x.Effect === "Allow");
		expect(allows).toHaveLength(1);
		expect(
			boundary.Statement.filter((x) => x.Effect !== "Allow").map((x) => x.Sid),
		).toEqual(["DenyStagingByTag", "DenyStagingByName"]);
		const [s] = allows;
		expect(s.Effect).toBe("Allow");
		expect(list(s.NotAction).sort()).toEqual(
			[
				"account:*",
				"cloudformation:*",
				"iam:*",
				"organizations:*",
				"sts:*",
			].sort(),
		);
	});

	it("is set for production only, so staging's templates are unchanged", () => {
		expect(productionConfig.permissionsBoundaryPolicyName).toBe(
			"zugzwang-production-boundary",
		);
		expect(stagingConfig.permissionsBoundaryPolicyName).toBeUndefined();
	});

	it("is applied to every stack of an environment that names one", () => {
		const source = readFileSync(
			join(REPO_ROOT, "infra/bin/zugzwang.ts"),
			"utf8",
		);
		expect(source).toMatch(/if \(config\.permissionsBoundaryPolicyName\)/);
		expect(source).toMatch(/PermissionsBoundary\.of\(stack\)\.apply/);
	});
});
