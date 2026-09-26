import { type EnvironmentConfig, RUNTIME_SECRET_KEYS } from "./types";

/** The ACM certificate on the staging ALB's :443 listener (not a secret). */
export const STAGING_CERTIFICATE_ARN =
	"arn:aws:acm:ap-south-1:849076101704:certificate/c166e9a8-7c6d-4763-a5d6-91fc743be239";

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
	// The qualifier staging was bootstrapped with (CDKToolkit, measured 2026-09-26).
	bootstrapQualifier: "hnb659fds",

	vpcCidr: "10.20.0.0/16",
	natGateways: 1,

	containerPort: 3000,
	// AWS-MIGRATION-3: staging now MIRRORS the production task and host so the
	// rehearsal proves the box that will launch. The load test recorded in
	// docs/aws-migration/08-STAGING-LOAD-TEST-RESULTS.md ran on the previous
	// shape — t3.small, cpu 512 / 1024 MiB / 512 reservation, default heap — and
	// its numbers are not a baseline for this one.
	cpu: 1024,
	memoryMiB: 3072,
	memoryReservationMiB: 2048,
	// m7i-flex.large, not t3.medium: this account is on the AWS Free Tier plan,
	// which refuses non-eligible instance types at launch ("not eligible for
	// Free Tier" — measured 2026-09-25, 06-STAGING-DEPLOYMENT.md §10.4).
	// m7i-flex.large IS eligible and larger (2 vCPU / 8 GiB), so two 3 GiB
	// tasks fit on one host and a rolling deploy needs no second instance.
	instanceType: "m7i-flex.large",
	minInstances: 1,
	maxInstances: 2,
	imageTag: "staging-latest",
	ecrRepositoryName: "zugzwang-staging",
	desiredCount: 1,
	maxCapacity: 1,
	stopTimeoutSeconds: 30,
	enableExecuteCommand: false,
	nodeMaxOldSpaceMiB: 2048,
	keepAliveTimeoutMs: 65_000,
	readinessPath: "/api/ready",
	healthCheckGracePeriodSeconds: 180,
	writesPaused:
		process.env.ZZ_STAGING_WRITES_PAUSED === "paused" ? "paused" : undefined,

	// STAGING-DEPLOY-NO-VARS — the staging ACM certificate is a COMMITTED
	// default (read from the live staging HTTPS listener, 2026-09-26), so the
	// push-to-staging deploy cannot synth an HTTP-only listener just because a
	// GitHub variable failed to arrive: four runs received every `vars.*`
	// empty. Not a secret. `ZZ_STAGING_CERT_ARN` still overrides it.
	certificateArn: process.env.ZZ_STAGING_CERT_ARN || STAGING_CERTIFICATE_ARN,
	appBaseUrl: "https://staging.zugzwangworld.com",
	cloudFrontEnabled: false,
	// I — off unless a WAF rehearsal is running: `ZZ_STAGING_WAF=count` attaches
	// the same rule set production uses, in count mode, so staging's template is
	// unchanged by default.
	wafEnabled: process.env.ZZ_STAGING_WAF === "count",
	wafMode: "count",

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
