import { type EnvironmentConfig, RUNTIME_SECRET_KEYS } from "./types";

/**
 * PROD-DEPLOY-NO-VARS — the ACM certificate for `zugzwangworld.com` on the
 * production ALB, committed like staging's (not a secret). ⛔ NOT YET ISSUED
 * (09-PRODUCTION-READINESS.md §P, item 13): set this constant to the issued
 * ARN in the same PR that records the issuance. Until then every production
 * Compute synth REFUSES (compute-stack.ts), so nothing can deploy an HTTP-only
 * production listener. `ZZ_PROD_CERT_ARN` still overrides it for a hand-run
 * deploy; the GitHub workflow no longer reads it, because `vars.*` arrived
 * empty in four staging runs.
 */
export const PRODUCTION_CERTIFICATE_ARN: string | undefined = undefined;

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
	// ⛔ H-3: production's OWN bootstrap roles, so the staging deploy path
	// (hnb659fds) cannot deploy these stacks. Requires a separate bootstrap —
	// docs/aws-migration/09-PRODUCTION-READINESS.md §B.
	bootstrapQualifier: "zzprod",
	// ⛔ H-3: every production role is created under this boundary, and the
	// zzprod execution policy refuses to create one without it
	// (infra/policies/production-permissions-boundary.json).
	permissionsBoundaryPolicyName: "zugzwang-production-boundary",

	vpcCidr: "10.10.0.0/16",
	natGateways: 1,

	containerPort: 3000,
	cpu: 1024,
	memoryMiB: 3072,
	// Reservation raised to match the bounded heap below (AWS-MIGRATION-3): ECS
	// places on the reservation, and a 2 GiB heap on a 1 GiB reservation would
	// let a second task be scheduled onto memory this one is already using.
	// With m7i-flex.large (8 GiB) two 3 GiB tasks fit on one host, so a rolling
	// deploy places the replacement task beside the old one without waiting on
	// the ASG. Keep `maxInstances: 2` regardless — it is what lets a launch-
	// template change roll with `minInstancesInService: 1`.
	memoryReservationMiB: 2048,
	// m7i-flex.large — see staging.ts: the account plan refuses t3.medium, and
	// the flex type is eligible and larger (2 vCPU / 8 GiB).
	instanceType: "m7i-flex.large",
	minInstances: 1,
	maxInstances: 2,
	imageTag: "production-latest",
	ecrRepositoryName: "zugzwang-production",
	desiredCount: 1,
	maxCapacity: 1,
	stopTimeoutSeconds: 30,
	enableExecuteCommand: false,
	nodeMaxOldSpaceMiB: 2048,
	keepAliveTimeoutMs: 65_000,
	readinessPath: "/api/ready",
	healthCheckGracePeriodSeconds: 180,
	writesPaused:
		process.env.ZZ_PROD_WRITES_PAUSED === "paused" ? "paused" : undefined,

	certificateArn: process.env.ZZ_PROD_CERT_ARN || PRODUCTION_CERTIFICATE_ARN,
	appBaseUrl: "https://zugzwangworld.com",
	cloudFrontEnabled: false,
	wafEnabled: true,
	// I — COUNT until the staging rehearsal's sampled requests have been read
	// (docs/aws-migration/09-PRODUCTION-READINESS.md §I). `ZZ_PROD_WAF_MODE=block`
	// enforces without a code change once that ruling is made.
	wafMode: process.env.ZZ_PROD_WAF_MODE === "block" ? "block" : "count",

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
