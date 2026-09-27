#!/usr/bin/env node
import {
	App,
	CliCredentialsStackSynthesizer,
	DefaultStackSynthesizer,
	Tags,
} from "aws-cdk-lib";
import { ManagedPolicy, PermissionsBoundary } from "aws-cdk-lib/aws-iam";
import {
	PRODUCTION_GITHUB_ENVIRONMENT,
	productionConfig,
} from "../config/production";
import { stagingConfig } from "../config/staging";
import type { EnvironmentConfig } from "../config/types";
import { ComputeStack } from "../lib/compute-stack";
import { DatabaseStack } from "../lib/database-stack";
import { DeployStack } from "../lib/deploy-stack";
import { MonitoringStack } from "../lib/monitoring-stack";
import { NetworkStack } from "../lib/network-stack";
import { SchedulerStack } from "../lib/scheduler-stack";
import { SecurityStack } from "../lib/security-stack";

const app = new App();

/**
 * One set of six stacks per environment, wired by typed props.
 *
 * ⛔ NO `fromLookup` ANYWHERE. Every cross-stack value is passed as a prop, so
 * `cdk synth` runs with no AWS credentials and no network — which is what lets
 * CI validate infrastructure on a pull request.
 *
 * Stack ORDER is left to CDK: every edge here is a real reference (compute reads
 * the VPC and the roles, monitoring reads the service), so CDK derives the
 * ordering itself. Adding `addDependency` on top of that is both deprecated and
 * how this app first produced a dependency cycle.
 */
function defineEnvironment(config: EnvironmentConfig): SecurityStack {
	const prefix = `Zugzwang-${config.name}`;
	// H-3: every stack of an environment deploys through that environment's own
	// bootstrap roles. The default qualifier is left implicit, so staging's
	// synthesised templates are byte-identical to what is deployed today.
	const synthesizer =
		config.bootstrapQualifier === DefaultStackSynthesizer.DEFAULT_QUALIFIER
			? undefined
			: new DefaultStackSynthesizer({ qualifier: config.bootstrapQualifier });
	const env = { account: config.account, region: config.region };

	const network = new NetworkStack(app, `${prefix}-Network`, {
		config,
		env,
		synthesizer,
	});

	// The database references the network and NOTHING references the database
	// (ADR-0059): compute reads DATABASE_URL from the app secret, so replacing
	// the instance is never a compute redeploy.
	const database = new DatabaseStack(app, `${prefix}-Database`, {
		config,
		env,
		synthesizer,
		vpc: network.vpc,
		databaseSecurityGroup: network.databaseSecurityGroup,
		databaseSubnets: network.databaseSubnets,
	});

	const security = new SecurityStack(app, `${prefix}-Security`, {
		config,
		env,
		synthesizer,
	});

	const compute = new ComputeStack(app, `${prefix}-Compute`, {
		config,
		env,
		synthesizer,
		vpc: network.vpc,
		albSecurityGroup: network.albSecurityGroup,
		serviceSecurityGroup: network.serviceSecurityGroup,
		serviceSubnets: network.serviceSubnets,
		repository: security.repository,
		appSecret: security.appSecret,
		executionRole: security.executionRole,
		taskRole: security.taskRole,
		logGroup: security.logGroup,
	});

	const scheduler = new SchedulerStack(app, `${prefix}-Scheduler`, {
		config,
		env,
		synthesizer,
	});

	const monitoring = new MonitoringStack(app, `${prefix}-Monitoring`, {
		config,
		env,
		synthesizer,
		service: compute.service,
		loadBalancer: compute.loadBalancer,
		targetGroup: compute.targetGroup,
		cronRuleNames: scheduler.ruleNames,
	});

	for (const stack of [
		network,
		database,
		security,
		compute,
		scheduler,
		monitoring,
	]) {
		Tags.of(stack).add("Project", "Zugzwang");
		Tags.of(stack).add("Environment", config.name);
		Tags.of(stack).add("ManagedBy", "CDK");
		// H-3: the zzprod execution policy creates a role ONLY with this boundary.
		if (config.permissionsBoundaryPolicyName) {
			PermissionsBoundary.of(stack).apply(
				ManagedPolicy.fromManagedPolicyName(
					stack,
					"PermissionsBoundary",
					config.permissionsBoundaryPolicyName,
				),
			);
		}
	}
	return security;
}

const securityStacks: Record<string, SecurityStack> = {
	[stagingConfig.name]: defineEnvironment(stagingConfig),
	[productionConfig.name]: defineEnvironment(productionConfig),
};

// AWS-MIGRATION-3 — the GitHub OIDC deploy roles (deploy-stack.ts), ONE STACK
// PER ENVIRONMENT (09 §0 — staging and production share this AWS account):
//
//   staging    → `Zugzwang-Deploy`             the account's GitHub OIDC provider
//                                               + the staging role. Unchanged.
//   production → `Zugzwang-production-Deploy`  the production role ONLY; it
//                                               IMPORTS the provider, so it can
//                                               never create or delete it.
//
// Two stacks, so adding production never redeploys the stack holding staging's
// role. Instantiated ONLY under `-c deployStack=true`, so `cdk deploy --all` /
// `cdk destroy --all` cannot reach either by accident. Both are denied to the
// other environment's bootstrap deploy role (infra/policies/*-deploy-role-deny.json).
if (app.node.tryGetContext("deployStack") === "true") {
	// The repository slug lands in a trust policy: an unverified default there is
	// a wrong-repo trust waiting to happen, so it is REQUIRED (no fallback).
	const githubRepository = process.env.ZZ_GITHUB_REPOSITORY;
	const SLUG = /^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/;
	if (!githubRepository || !SLUG.test(githubRepository)) {
		throw new Error(
			"ZZ_GITHUB_REPOSITORY (owner/repo) is required to synth Zugzwang-Deploy",
		);
	}
	// ⛔ REQUIRED, exactly one environment, no default: the environment picks
	// the stack, so a missing or doubled value can never put one environment's
	// role into the other's stack.
	const only = (
		app.node.tryGetContext("deployEnvironments") as string | undefined
	)?.trim();
	if (only === stagingConfig.name) {
		// Byte-identical to what is deployed: same id, same account source, same
		// provider handling as before production existed.
		const deploy = new DeployStack(app, "Zugzwang-Deploy", {
			synthesizer: new CliCredentialsStackSynthesizer(),
			env: {
				account: process.env.CDK_DEFAULT_ACCOUNT,
				region: process.env.ZZ_AWS_REGION ?? "ap-south-1",
			},
			githubRepository,
			environments: [
				{
					name: stagingConfig.name,
					bootstrapQualifier: stagingConfig.bootstrapQualifier,
					passRoleArns: [
						securityStacks[stagingConfig.name].executionRole.roleArn,
						securityStacks[stagingConfig.name].taskRole.roleArn,
					],
				},
			],
			existingOidcProviderArn: process.env.ZZ_GITHUB_OIDC_PROVIDER_ARN,
		});
		Tags.of(deploy).add("Project", "Zugzwang");
		Tags.of(deploy).add("ManagedBy", "CDK");
	} else if (only === productionConfig.name) {
		const deploy = new DeployStack(app, "Zugzwang-production-Deploy", {
			// 09 §0: the template is uploaded to PRODUCTION's bootstrap bucket. The
			// synthesizer's default qualifier is staging's (`hnb659fds`), which would
			// put this upload in cdk-hnb659fds-assets-….
			synthesizer: new CliCredentialsStackSynthesizer({
				qualifier: productionConfig.bootstrapQualifier,
			}),
			env: {
				account: productionConfig.account,
				region: productionConfig.region,
			},
			githubRepository,
			environments: [
				{
					name: productionConfig.name,
					bootstrapQualifier: productionConfig.bootstrapQualifier,
					// Not Vercel's `Production` (09 §C, production.ts).
					githubEnvironment: PRODUCTION_GITHUB_ENVIRONMENT,
					passRoleArns: [
						securityStacks[productionConfig.name].executionRole.roleArn,
						securityStacks[productionConfig.name].taskRole.roleArn,
					],
				},
			],
			// ALWAYS imported — the provider belongs to `Zugzwang-Deploy`.
			existingOidcProviderArn: `arn:aws:iam::${productionConfig.account}:oidc-provider/token.actions.githubusercontent.com`,
		});
		Tags.of(deploy).add("Project", "Zugzwang");
		Tags.of(deploy).add("Environment", productionConfig.name);
		Tags.of(deploy).add("ManagedBy", "CDK");
	} else {
		throw new Error(
			`-c deployEnvironments must be exactly one of staging | production (got ${only || "nothing"})`,
		);
	}
}
