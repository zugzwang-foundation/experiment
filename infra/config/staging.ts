import { type EnvironmentConfig, RUNTIME_SECRET_KEYS } from "./types";

/**
 * Staging — the resettable sandbox (ADR-0024).
 *
 * No NAT Gateway: tasks sit in public subnets with a public IP and accept
 * traffic only from the ALB security group. That is the same security posture
 * as a private subnet for INBOUND purposes and saves ~$32/month; production
 * takes the NAT instead because it is worth paying there.
 */
export const stagingConfig: EnvironmentConfig = {
	name: "staging",
	zugzwangEnv: "staging",
	// ⛔ PINNED, never inherited. `CDK_DEFAULT_REGION` is whatever profile the
	// operator happens to have (it resolved to us-east-1 on the first synth of
	// this app), and compute in the wrong region undoes PERF-1: the app must sit
	// in the same region as Supabase. Override deliberately, or not at all.
	region: process.env.ZZ_AWS_REGION ?? "ap-south-1",
	account: process.env.CDK_DEFAULT_ACCOUNT,

	vpcCidr: "10.20.0.0/16",
	natGateways: 0,

	containerPort: 3000,
	cpu: 512,
	memoryMiB: 1024,
	memoryReservationMiB: 512,
	instanceType: "t3.small",
	minInstances: 1,
	maxInstances: 2,
	imageTag: "staging-latest",
	ecrRepositoryName: "zugzwang-staging",
	desiredCount: 1,
	maxCapacity: 1,
	stopTimeoutSeconds: 30,
	enableExecuteCommand: false,

	certificateArn: process.env.ZZ_STAGING_CERT_ARN,
	appBaseUrl: "https://staging.zugzwangworld.com",
	cloudFrontEnabled: false,
	wafEnabled: false,

	secretName: "zugzwang/staging",
	secretKeys: RUNTIME_SECRET_KEYS,
	cronAuthHeaderKey: "CRON_AUTH_HEADER",

	migrationCommand: ["pnpm", "db:migrate:staging"],

	logRetentionDays: 14,
	alertEmail: process.env.ZZ_ALERT_EMAIL,
	alarmThresholds: {
		target5xxPerFiveMinutes: 20,
		p95LatencySeconds: 3,
		cpuPercent: 85,
		memoryPercent: 85,
	},
};
