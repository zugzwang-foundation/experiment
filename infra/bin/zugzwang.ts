#!/usr/bin/env node
import { App, Tags } from "aws-cdk-lib";
import { productionConfig } from "../config/production";
import { stagingConfig } from "../config/staging";
import type { EnvironmentConfig } from "../config/types";
import { ComputeStack } from "../lib/compute-stack";
import { MonitoringStack } from "../lib/monitoring-stack";
import { NetworkStack } from "../lib/network-stack";
import { SchedulerStack } from "../lib/scheduler-stack";
import { SecurityStack } from "../lib/security-stack";

const app = new App();

/**
 * One set of five stacks per environment, wired by typed props.
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
	const env = { account: config.account, region: config.region };

	const network = new NetworkStack(app, `${prefix}-Network`, { config, env });

	const security = new SecurityStack(app, `${prefix}-Security`, {
		config,
		env,
	});

	const compute = new ComputeStack(app, `${prefix}-Compute`, {
		config,
		env,
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
	});

	const monitoring = new MonitoringStack(app, `${prefix}-Monitoring`, {
		config,
		env,
		service: compute.service,
		loadBalancer: compute.loadBalancer,
		targetGroup: compute.targetGroup,
		cronRuleNames: scheduler.ruleNames,
	});

	for (const stack of [network, security, compute, scheduler, monitoring]) {
		Tags.of(stack).add("Project", "Zugzwang");
		Tags.of(stack).add("Environment", config.name);
		Tags.of(stack).add("ManagedBy", "CDK");
	}
}

defineEnvironment(stagingConfig);
defineEnvironment(productionConfig);
