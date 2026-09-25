import { type EnvironmentConfig, RUNTIME_SECRET_KEYS } from "./types";

/**
 * Production.
 *
 * ⚠ `maxCapacity: 1` is deliberate and is a correctness constraint, not a cost
 * one. `cacheComponents` keeps Next's cache per process, and a `revalidateTag`
 * raised by a moderation removal reaches only the task that handled it — so a
 * second task could keep serving a removed comment for the cache window.
 * Raising this number requires a shared cache handler first.
 */
export const productionConfig: EnvironmentConfig = {
	name: "production",
	zugzwangEnv: "prod",
	// ⛔ PINNED, never inherited. `CDK_DEFAULT_REGION` is whatever profile the
	// operator happens to have (it resolved to us-east-1 on the first synth of
	// this app), and compute in the wrong region undoes PERF-1: the app must sit
	// in the same region as Supabase. Override deliberately, or not at all.
	region: process.env.ZZ_AWS_REGION ?? "ap-south-1",
	account: process.env.CDK_DEFAULT_ACCOUNT,

	vpcCidr: "10.10.0.0/16",
	natGateways: 1,

	containerPort: 3000,
	cpu: 1024,
	memoryMiB: 3072,
	memoryReservationMiB: 1024,
	instanceType: "t3.medium",
	minInstances: 1,
	maxInstances: 2,
	imageTag: "production-latest",
	ecrRepositoryName: "zugzwang-production",
	desiredCount: 1,
	maxCapacity: 1,
	stopTimeoutSeconds: 30,
	enableExecuteCommand: false,

	certificateArn: process.env.ZZ_PROD_CERT_ARN,
	appBaseUrl: "https://zugzwangworld.com",
	cloudFrontEnabled: false,
	wafEnabled: true,

	secretName: "zugzwang/production",
	secretKeys: RUNTIME_SECRET_KEYS,
	cronAuthHeaderKey: "CRON_AUTH_HEADER",

	// Multi-AZ, a week of point-in-time recovery, and deletion protection: the
	// append-only ledger lives here, and the one outcome the migration plan
	// cannot repair is a lost or half-written database.
	// `t4g.small` holds the entire (<1 MB) dataset in memory many times over.
	database: {
		instanceType: "t4g.small",
		multiAz: true,
		allocatedStorageGb: 20,
		maxAllocatedStorageGb: 100,
		backupRetentionDays: 7,
		deletionProtection: true,
		masterUsername: "zugzwang",
	},

	migrationCommand: ["pnpm", "db:migrate:prod"],
	migrationSecretKeys: ["DATABASE_URL_PROD", "PROD_PROJECT_REF_FRAGMENT"],

	logRetentionDays: 90,
	alertEmail: process.env.ZZ_ALERT_EMAIL,
	alarmThresholds: {
		target5xxPerFiveMinutes: 5,
		p95LatencySeconds: 2,
		cpuPercent: 80,
		memoryPercent: 80,
	},
};
