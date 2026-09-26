#!/usr/bin/env node
import { App, DefaultStackSynthesizer, Tags } from "aws-cdk-lib";
import { productionConfig } from "../config/production";
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
function defineEnvironment(config: EnvironmentConfig): void {
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
	}
}

defineEnvironment(stagingConfig);
defineEnvironment(productionConfig);

// AWS-MIGRATION-3 — the GitHub OIDC deploy roles (deploy-stack.ts). One stack
// for the account, instantiated ONLY under `-c deployStack=true` so that
// `cdk deploy --all` / `cdk destroy --all` cannot reach it by accident and
// the account-level OIDC provider is never created twice.
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
	// `-c deployEnvironments=staging` creates ONLY the staging deploy role, so
	// the staging pipeline can be stood up without minting a production role
	// before production is approved. Default: both.
	const only = app.node.tryGetContext("deployEnvironments") as
		| string
		| undefined;
	const wanted = only ? only.split(",").map((e) => e.trim()) : undefined;
	const environments = [stagingConfig, productionConfig].filter(
		(c) => !wanted || wanted.includes(c.name),
	);
	if (environments.length === 0) {
		throw new Error(`deployEnvironments=${only} names no known environment`);
	}
	const deploy = new DeployStack(app, "Zugzwang-Deploy", {
		env: {
			account: process.env.CDK_DEFAULT_ACCOUNT,
			region: process.env.ZZ_AWS_REGION ?? "ap-south-1",
		},
		githubRepository,
		environments: environments.map((c) => ({
			name: c.name,
			bootstrapQualifier: c.bootstrapQualifier,
		})),
		existingOidcProviderArn: process.env.ZZ_GITHUB_OIDC_PROVIDER_ARN,
	});
	Tags.of(deploy).add("Project", "Zugzwang");
	Tags.of(deploy).add("ManagedBy", "CDK");
}
