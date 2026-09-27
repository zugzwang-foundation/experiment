import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import {
	PRODUCTION_ACCOUNT_ID,
	productionConfig,
} from "../../../infra/config/production";
import { stagingConfig } from "../../../infra/config/staging";
import {
	evaluatePolicy,
	type PolicyDocument,
	stagingReferences,
	untaggedProductionResources,
} from "../../../infra/policies/coverage";

/**
 * 09 §0 — staging and production share AWS account 849076101704 as SEPARATE
 * resources. These pin the four isolation properties:
 *   1. staging deployment cannot modify production   (existing staging deny)
 *   2. production deployment cannot modify staging   (P1 exec policy + boundary, P2 deploy-role deny)
 *   3. neither deploy-role stack can be rewritten by the wrong environment (2A)
 *   4. production stacks cannot target staging resources (2B)
 * Real staging names are taken from the deployed stacks / synthesized templates.
 */

const REPO_ROOT = join(__dirname, "..", "..", "..");
const policy = (name: string) =>
	JSON.parse(
		readFileSync(join(REPO_ROOT, "infra/policies", name), "utf8"),
	) as PolicyDocument;
const exec = policy("production-cfn-execution-policy.json");
const boundary = policy("production-permissions-boundary.json");
const prodDeployDeny = policy("production-deploy-role-deny.json");
const stagingDeployDeny = policy("staging-deploy-role-deny.json");
const stripped = (rel: string) =>
	readFileSync(join(REPO_ROOT, rel), "utf8")
		.replace(/\/\*[\s\S]*?\*\//g, " ")
		.replace(/(^|[^:])\/\/[^\n]*/g, "$1 ");

const A = "849076101704";
const R = "ap-south-1";
const STAGING_TAG = { "aws:ResourceTag/Environment": "staging" };
const PRODUCTION_TAG = { "aws:ResourceTag/Environment": "production" };
const stack = (name: string) =>
	`arn:aws:cloudformation:${R}:${A}:stack/${name}/0a1b2c3d-1111-2222-3333-444455556666`;

/** Staging resources by real name, with a destructive action each. */
const STAGING_BY_NAME: [string, string][] = [
	[
		"rds:DeleteDBInstance",
		`arn:aws:rds:${R}:${A}:db:zugzwang-staging-database-postgres9dc8bb04-69fo9sqgtcvo`,
	],
	[
		"secretsmanager:GetSecretValue",
		`arn:aws:secretsmanager:${R}:${A}:secret:zugzwang/staging-AbCdEf`,
	],
	[
		"secretsmanager:PutSecretValue",
		`arn:aws:secretsmanager:${R}:${A}:secret:zugzwang/staging/database-AbCdEf`,
	],
	[
		"ecs:UpdateService",
		`arn:aws:ecs:${R}:${A}:service/zugzwang-staging/Zugzwang-staging-Compute-Service`,
	],
	["ecs:DeleteCluster", `arn:aws:ecs:${R}:${A}:cluster/zugzwang-staging`],
	[
		"ecs:RunTask",
		`arn:aws:ecs:${R}:${A}:task-definition/zugzwang-staging-migrate:7`,
	],
	["ecr:PutImage", `arn:aws:ecr:${R}:${A}:repository/zugzwang-staging`],
	[
		"logs:DeleteLogGroup",
		`arn:aws:logs:${R}:${A}:log-group:/zugzwang/staging/app`,
	],
	["sns:DeleteTopic", `arn:aws:sns:${R}:${A}:zugzwang-staging-alarms`],
	[
		"events:PutTargets",
		`arn:aws:events:${R}:${A}:rule/zugzwang-staging-closeduemarkets`,
	],
	[
		"lambda:UpdateFunctionCode",
		`arn:aws:lambda:${R}:${A}:function:Zugzwang-staging-Database-LogRetentionaae0aa3c5b4d-X`,
	],
	[
		"iam:PutRolePolicy",
		`arn:aws:iam::${A}:role/Zugzwang-staging-Security-TaskRole30FC0FBB-De0L1MgExZVn`,
	],
	[
		"iam:PassRole",
		`arn:aws:iam::${A}:role/cdk-hnb659fds-cfn-exec-role-${A}-${R}`,
	],
	["s3:PutObject", `arn:aws:s3:::cdk-hnb659fds-assets-${A}-${R}/x.json`],
	[
		"ssm:PutParameter",
		`arn:aws:ssm:${R}:${A}:parameter/cdk-bootstrap/hnb659fds/version`,
	],
];

/** The production counterparts — the controls that must stay allowed. */
const PRODUCTION_BY_NAME: [string, string][] = [
	[
		"rds:ModifyDBInstance",
		`arn:aws:rds:${R}:${A}:db:zugzwang-production-database-postgresab12`,
	],
	[
		"secretsmanager:GetSecretValue",
		`arn:aws:secretsmanager:${R}:${A}:secret:zugzwang/production-AbCdEf`,
	],
	[
		"ecs:UpdateService",
		`arn:aws:ecs:${R}:${A}:service/zugzwang-production/Zugzwang-production-Compute-Service`,
	],
	["ecr:PutImage", `arn:aws:ecr:${R}:${A}:repository/zugzwang-production`],
	[
		"logs:CreateLogGroup",
		`arn:aws:logs:${R}:${A}:log-group:/zugzwang/production/app`,
	],
	["sns:CreateTopic", `arn:aws:sns:${R}:${A}:zugzwang-production-alarms`],
];

describe("P1 — the production execution policy and boundary deny staging", () => {
	it("both carry the SAME staging denies (by tag and by name)", () => {
		const denies = (d: PolicyDocument) =>
			JSON.stringify(
				d.Statement.filter((s) => /^DenyStaging/.test(s.Sid ?? "")),
			);
		expect(denies(exec)).toBe(denies(boundary));
		expect(
			exec.Statement.filter((s) => /^DenyStaging/.test(s.Sid ?? "")).map(
				(s) => s.Sid,
			),
		).toEqual(["DenyStagingByTag", "DenyStagingByName"]);
	});

	it.each(
		STAGING_BY_NAME,
	)("denies %s on staging (%s) — by name", (action, arn) => {
		expect(evaluatePolicy(exec, action, arn)).toBe("deny");
		expect(evaluatePolicy(boundary, action, arn)).toBe("deny");
	});

	it("denies ANY staging-tagged resource, whatever its name (e.g. an ALB)", () => {
		const alb = `arn:aws:elasticloadbalancing:${R}:${A}:loadbalancer/app/Zugzw-LoadB-XYZ/1234`;
		for (const d of [exec, boundary]) {
			expect(
				evaluatePolicy(
					d,
					"elasticloadbalancing:DeleteLoadBalancer",
					alb,
					STAGING_TAG,
				),
			).toBe("deny");
			expect(
				evaluatePolicy(
					d,
					"ec2:TerminateInstances",
					`arn:aws:ec2:${R}:${A}:instance/i-0abc`,
					STAGING_TAG,
				),
			).toBe("deny");
		}
	});

	it.each(
		PRODUCTION_BY_NAME,
	)("still allows %s on production (%s) — control", (action, arn) => {
		expect(evaluatePolicy(exec, action, arn, PRODUCTION_TAG)).toBe("allow");
		expect(evaluatePolicy(boundary, action, arn, PRODUCTION_TAG)).toBe("allow");
	});

	it("a production-tagged ALB stays allowed — the tag deny keys on staging only", () => {
		const alb = `arn:aws:elasticloadbalancing:${R}:${A}:loadbalancer/app/Zugzw-LoadB-ABC/5678`;
		expect(
			evaluatePolicy(
				exec,
				"elasticloadbalancing:ModifyLoadBalancerAttributes",
				alb,
				PRODUCTION_TAG,
			),
		).toBe("allow");
	});
});

describe("P2 — the production deploy role cannot modify staging", () => {
	it("contains only Deny statements", () => {
		for (const s of prodDeployDeny.Statement) expect(s.Effect).toBe("Deny");
	});

	it.each([
		"Zugzwang-staging-Network",
		"Zugzwang-staging-Database",
		"Zugzwang-staging-Security",
		"Zugzwang-staging-Compute",
		"Zugzwang-staging-Scheduler",
		"Zugzwang-staging-Monitoring",
		"Zugzwang-Deploy",
		"Zugzwang-production-Deploy",
		"CDKToolkit",
	])("blocks EVERY change to %s, leaving only read-only lookups", (name) => {
		// Every CloudFormation action that creates, updates, executes, imports,
		// deletes or otherwise modifies a stack (or its policy, protection, tags
		// or signals). DetectStackDrift writes drift state, so it is denied too.
		for (const action of [
			"cloudformation:CreateStack",
			"cloudformation:UpdateStack",
			"cloudformation:DeleteStack",
			"cloudformation:CreateChangeSet",
			"cloudformation:ExecuteChangeSet",
			"cloudformation:DeleteChangeSet",
			"cloudformation:ContinueUpdateRollback",
			"cloudformation:CancelUpdateStack",
			"cloudformation:RollbackStack",
			"cloudformation:UpdateTerminationProtection",
			"cloudformation:SetStackPolicy",
			"cloudformation:SignalResource",
			"cloudformation:TagResource",
			"cloudformation:UntagResource",
			"cloudformation:CreateStackRefactor",
			"cloudformation:ExecuteStackRefactor",
			"cloudformation:ImportStacksToStackSet",
			"cloudformation:DetectStackDrift",
			"cloudformation:UpdateStackInstances",
		]) {
			expect(evaluatePolicy(prodDeployDeny, action, stack(name))).toBe("deny");
		}
		// The CLI's toolkit / stack lookups are NOT denied (so a stray lookup of
		// `CDKToolkit` cannot break a production deploy); they grant nothing.
		for (const action of [
			"cloudformation:DescribeStacks",
			"cloudformation:DescribeStackEvents",
			"cloudformation:DescribeStackResources",
			"cloudformation:GetTemplate",
			"cloudformation:GetTemplateSummary",
			"cloudformation:ListStackResources",
			"cloudformation:BatchDescribeTypeConfigurations",
		]) {
			expect(evaluatePolicy(prodDeployDeny, action, stack(name))).toBe("none");
		}
	});

	it("allows nothing but CloudFormation's Describe*/Get*/List*/BatchDescribe* on protected stacks", () => {
		const s = prodDeployDeny.Statement.find(
			(x) => x.Sid === "DenyStagingAndDeployStackChanges",
		);
		expect(s?.Effect).toBe("Deny");
		expect(s?.Action).toBeUndefined();
		expect(s?.NotAction).toEqual([
			"cloudformation:Describe*",
			"cloudformation:Get*",
			"cloudformation:List*",
			"cloudformation:BatchDescribe*",
		]);
	});

	it.each([
		`arn:aws:iam::${A}:role/cdk-hnb659fds-cfn-exec-role-${A}-${R}`,
		`arn:aws:iam::${A}:role/cdk-hnb659fds-deploy-role-${A}-${R}`,
		`arn:aws:iam::${A}:role/Zugzwang-staging-Security-TaskRole30FC0FBB-X`,
		`arn:aws:iam::${A}:role/zugzwang-staging-github-deploy`,
		`arn:aws:iam::${A}:role/zugzwang-production-github-deploy`,
	])("blocks passing, assuming or editing %s", (arn) => {
		for (const action of [
			"iam:PassRole",
			"iam:PutRolePolicy",
			"sts:AssumeRole",
		]) {
			expect(evaluatePolicy(prodDeployDeny, action, arn)).toBe("deny");
		}
	});

	it("blocks staging's bootstrap assets and version parameter", () => {
		expect(
			evaluatePolicy(
				prodDeployDeny,
				"s3:PutObject",
				`arn:aws:s3:::cdk-hnb659fds-assets-${A}-${R}/x.json`,
			),
		).toBe("deny");
		expect(
			evaluatePolicy(
				prodDeployDeny,
				"ssm:GetParameter",
				`arn:aws:ssm:${R}:${A}:parameter/cdk-bootstrap/hnb659fds/version`,
			),
		).toBe("deny");
	});

	it.each([
		"Zugzwang-production-Network",
		"Zugzwang-production-Database",
		"Zugzwang-production-Security",
		"Zugzwang-production-Compute",
		"Zugzwang-production-Scheduler",
		"Zugzwang-production-Monitoring",
		"CDKToolkit-prod",
	])("leaves production's own %s alone — control", (name) => {
		expect(
			evaluatePolicy(
				prodDeployDeny,
				"cloudformation:CreateChangeSet",
				stack(name),
			),
		).toBe("none");
	});

	it("leaves production's own bootstrap alone — control", () => {
		expect(
			evaluatePolicy(
				prodDeployDeny,
				"iam:PassRole",
				`arn:aws:iam::${A}:role/cdk-zzprod-cfn-exec-role-${A}-${R}`,
			),
		).toBe("none");
		expect(
			evaluatePolicy(
				prodDeployDeny,
				"s3:PutObject",
				`arn:aws:s3:::cdk-zzprod-assets-${A}-${R}/x.json`,
			),
		).toBe("none");
		expect(
			evaluatePolicy(
				prodDeployDeny,
				"ssm:GetParameter",
				`arn:aws:ssm:${R}:${A}:parameter/cdk-bootstrap/zzprod/version`,
			),
		).toBe("none");
	});
});

describe("staging's existing deploy-role deny (unchanged) already covers the new stack", () => {
	it("blocks the staging deploy role from Zugzwang-production-Deploy", () => {
		expect(
			evaluatePolicy(
				stagingDeployDeny,
				"cloudformation:CreateChangeSet",
				stack("Zugzwang-production-Deploy"),
			),
		).toBe("deny");
		expect(
			evaluatePolicy(
				stagingDeployDeny,
				"iam:PutRolePolicy",
				`arn:aws:iam::${A}:role/zugzwang-production-github-deploy`,
			),
		).toBe("deny");
	});
});

describe("2A — one deploy-role stack per environment", () => {
	const bin = stripped("infra/bin/zugzwang.ts");

	it("deployEnvironments is required and names exactly one environment", () => {
		expect(bin).toMatch(/only === stagingConfig\.name/);
		expect(bin).toMatch(/only === productionConfig\.name/);
		expect(bin).toMatch(/must be exactly one of staging \| production/);
		expect(bin).not.toMatch(/Default: both|!wanted \|\|/);
	});

	it("production's role lives in its own stack and IMPORTS the account's OIDC provider", () => {
		const start = bin.indexOf(
			'new DeployStack(app, "Zugzwang-production-Deploy"',
		);
		expect(start).toBeGreaterThan(-1);
		const block = bin.slice(start, bin.indexOf("});", start));
		// The source text holds a template literal; assemble the `${` so this
		// string is not itself read as one.
		const interp = (expr: string) => `$${"{"}${expr}}`;
		expect(block).toContain(
			`existingOidcProviderArn: \`arn:aws:iam::${interp("productionConfig.account")}:oidc-provider/token.actions.githubusercontent.com\``,
		);
		expect(block).not.toContain("process.env.ZZ_GITHUB_OIDC_PROVIDER_ARN");
		expect(block).not.toContain("stagingConfig");
	});

	it("staging's stack keeps exactly its previous shape", () => {
		const start = bin.indexOf('new DeployStack(app, "Zugzwang-Deploy"');
		const block = bin.slice(start, bin.indexOf("});", start));
		expect(block).toContain("account: process.env.CDK_DEFAULT_ACCOUNT");
		expect(block).toContain(
			"existingOidcProviderArn: process.env.ZZ_GITHUB_OIDC_PROVIDER_ARN",
		);
		expect(block).not.toContain("productionConfig");
	});
});

describe("the deploy workflow reads each environment's OWN bootstrap stack", () => {
	const workflow = readFileSync(
		join(REPO_ROOT, ".github/workflows/deploy-aws.yml"),
		"utf8",
	);
	// The deploy step's shell, from the toolkit selection to the cdk call, with
	// the workflow expressions filled in for one environment and `cdk deploy`
	// replaced by a printer — so this runs the REAL snippet and reads its argv.
	// `$` is assembled so these literals are not read as template strings.
	const $ = "$";
	const TOOLKIT_EXPANSION = `"${$}{TOOLKIT_ARGS[@]}"`;
	const ENV_EXPR = `${$}{{ inputs.environment || 'staging' }}`;
	const TAG_EXPR = `${$}{{ needs.build.outputs.image_tag }}`;
	const argvFor = (environment: string): string[] => {
		const start = workflow.indexOf("TOOLKIT_ARGS=()");
		const end = workflow.indexOf(TOOLKIT_EXPANSION, start);
		expect(start).toBeGreaterThan(-1);
		expect(end).toBeGreaterThan(start);
		const snippet = workflow
			.slice(start, end + TOOLKIT_EXPANSION.length)
			.replaceAll(ENV_EXPR, environment)
			.replaceAll(TAG_EXPR, `${environment}-abc1234`)
			.replace(
				"pnpm --ignore-workspace exec cdk deploy",
				"printf '%s\\n' cdk deploy",
			);
		const r = spawnSync("bash", ["-eo", "pipefail", "-c", snippet], {
			encoding: "utf8",
		});
		expect(r.status).toBe(0);
		return r.stdout.split("\n").filter(Boolean);
	};

	it("staging's cdk deploy arguments are exactly as before", () => {
		expect(argvFor("staging")).toEqual([
			"cdk",
			"deploy",
			"Zugzwang-staging-Compute",
			"-c",
			"imageTag=staging-abc1234",
			"--require-approval",
			"never",
		]);
	});

	it("production's cdk deploy targets CDKToolkit-prod explicitly", () => {
		expect(argvFor("production")).toEqual([
			"cdk",
			"deploy",
			"Zugzwang-production-Compute",
			"-c",
			"imageTag=production-abc1234",
			"--require-approval",
			"never",
			"--toolkit-stack-name",
			"CDKToolkit-prod",
		]);
	});

	it("the flag is set only for production", () => {
		expect(workflow).toMatch(
			/if \[ "\$\{\{ inputs\.environment \|\| 'staging' \}\}" = "production" \]; then\s+TOOLKIT_ARGS=\(--toolkit-stack-name CDKToolkit-prod\)/,
		);
		expect(workflow.match(/--toolkit-stack-name/g)).toHaveLength(1);
	});
});

describe("2B — production cannot target staging resources", () => {
	it("production is pinned to the shared account, not taken from the credentials", () => {
		expect(PRODUCTION_ACCOUNT_ID).toBe(A);
		expect(productionConfig.account).toBe(A);
		expect(stripped("infra/config/production.ts")).not.toMatch(
			/CDK_DEFAULT_ACCOUNT/,
		);
	});

	it("every account id in the production-side policies is this account", () => {
		for (const d of [exec, boundary, prodDeployDeny]) {
			const ids = new Set(
				JSON.stringify(d).match(/(?<=:)[0-9]{12}(?=:)/g) ?? [],
			);
			expect([...ids]).toEqual([A]);
		}
	});

	it.each([
		"name",
		"zugzwangEnv",
		"vpcCidr",
		"bootstrapQualifier",
		"imageTag",
		"ecrRepositoryName",
		"appBaseUrl",
		"secretName",
	] as const)("production's %s differs from staging's", (key) => {
		expect(productionConfig[key]).not.toBe(stagingConfig[key]);
	});

	it("the two VPC ranges do not overlap", () => {
		expect(productionConfig.vpcCidr).toBe("10.10.0.0/16");
		expect(stagingConfig.vpcCidr).toBe("10.20.0.0/16");
	});

	it("the template scan finds staging references and passes a clean template", () => {
		expect(stagingReferences('{"a":"zugzwang/production"}')).toEqual([]);
		expect(stagingReferences('{"a":"zugzwang/staging"}')).toEqual(["staging"]);
		expect(stagingReferences('{"b":"cdk-hnb659fds-assets"}')).toEqual([
			"hnb659fds",
		]);
		expect(stagingReferences('{"c":"10.20.0.0/16"}')).toEqual(["10.20."]);
	});

	it("the tag scan flags taggable resources without Environment=production", () => {
		const t = {
			Resources: {
				Ok: {
					Type: "AWS::SNS::Topic",
					Properties: { Tags: [{ Key: "Environment", Value: "production" }] },
				},
				Wrong: {
					Type: "AWS::SNS::Topic",
					Properties: { Tags: [{ Key: "Environment", Value: "staging" }] },
				},
				Missing: { Type: "AWS::ECR::Repository", Properties: { Tags: [] } },
				MapOk: {
					Type: "AWS::SSM::Parameter",
					Properties: { Tags: { Environment: "production" } },
				},
				Untaggable: { Type: "AWS::EC2::Route", Properties: {} },
			},
		};
		expect(untaggedProductionResources(t)).toEqual([
			"AWS::SNS::Topic Wrong",
			"AWS::ECR::Repository Missing",
		]);
	});

	it("the pre-deploy check runs both scans on every production template", () => {
		const check = stripped("infra/scripts/check-production-policies.ts");
		expect(check).toMatch(/stagingReferences\(text\)/);
		expect(check).toMatch(/untaggedProductionResources\(t\)/);
	});
});
