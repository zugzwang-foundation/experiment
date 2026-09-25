import { type EnvironmentConfig, RUNTIME_SECRET_KEYS } from "./types";

/**
 * Staging — the resettable sandbox (ADR-0024).
 *
 * ⚠ ONE NAT GATEWAY, THE SAME AS PRODUCTION. This block used to say "no NAT:
 * tasks sit in public subnets with a public IP" — true for Fargate, FALSE for
 * ECS on EC2 with `awsvpc` networking, where a task's own network interface
 * never gets a public IP whatever subnet it sits in. Measured at
 * AWS-MIGRATION-2 with a one-off task: Sentry, Upstash, OpenAI and Cloudflare
 * all timed out from a task on an instance that itself had internet. The app
 * rendered pages (RDS is in-VPC) while every outbound integration was dead,
 * which is the worst kind of "works": idempotency fails CLOSED, so bets would
 * have been refused. Staging exists to rehearse production; it now has
 * production's network shape.
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
	natGateways: 1,

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

	// Single-AZ and one day of backups: staging is a resettable sandbox
	// (ADR-0035), and its database is rebuilt from fixtures, not restored.
	database: {
		instanceType: "t4g.micro",
		multiAz: false,
		allocatedStorageGb: 20,
		maxAllocatedStorageGb: 50,
		backupRetentionDays: 1,
		deletionProtection: false,
		masterUsername: "zugzwang",
	},

	migrationCommand: ["pnpm", "db:migrate:staging"],
	migrationSecretKeys: ["DATABASE_URL_STAGING", "STAGING_PROJECT_REF_FRAGMENT"],

	logRetentionDays: 14,
	alertEmail: process.env.ZZ_ALERT_EMAIL,
	alarmThresholds: {
		target5xxPerFiveMinutes: 20,
		p95LatencySeconds: 3,
		cpuPercent: 85,
		memoryPercent: 85,
	},
};
