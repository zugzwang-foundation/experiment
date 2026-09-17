/**
 * The environment contract for the Zugzwang AWS stacks.
 *
 * Every value that differs between staging and production lives here, so that
 * `lib/` contains no environment literals and `cdk diff` between the two is a
 * diff of this file. No secret VALUE ever appears in config — only the name of
 * the Secrets Manager secret and the JSON keys inside it.
 */

export interface HostedZoneConfig {
	/** Route 53 hosted zone id, when Route 53 owns the DNS. */
	readonly hostedZoneId: string;
	/** The zone apex, e.g. `zugzwangworld.com`. */
	readonly zoneName: string;
	/** The record to create, e.g. `staging.zugzwangworld.com`. */
	readonly recordName: string;
}

export interface EnvironmentConfig {
	/** Short name used in stack ids and resource names: `staging` | `production`. */
	readonly name: string;
	/** The value the app reads as ZUGZWANG_ENV — `staging` | `prod`. */
	readonly zugzwangEnv: "staging" | "prod";
	/** AWS region. Supabase lives in ap-south-1, so compute belongs there too. */
	readonly region: string;
	/** AWS account id. Left undefined for an environment-agnostic synth. */
	readonly account?: string;

	// ── Network ──────────────────────────────────────────────────────────────
	readonly vpcCidr: string;
	/**
	 * 0 → tasks run in public subnets with a public IP and no inbound rules
	 *     (cheapest; no NAT charge).
	 * 1 → tasks run in private subnets behind one NAT Gateway (~$32/month).
	 */
	readonly natGateways: number;

	// ── Compute ──────────────────────────────────────────────────────────────
	readonly containerPort: number;
	/** CPU units reserved for the task (1024 = one vCPU). */
	readonly cpu: number;
	/** Hard memory ceiling for the container, MiB. */
	readonly memoryMiB: number;
	/**
	 * SOFT memory reservation, MiB. On EC2 this is what ECS uses for placement,
	 * so keeping it well below `memoryMiB` is what lets the old task and the new
	 * one sit on the same instance for the few seconds of a rolling deploy.
	 */
	readonly memoryReservationMiB: number;
	/** EC2 instance type backing the ECS cluster, e.g. `t3.medium`. */
	readonly instanceType: string;
	/** ASG bounds. Min 1 keeps the app up; max 2 gives a deploy room to land. */
	readonly minInstances: number;
	readonly maxInstances: number;
	/** Image tag deployed by CI. Overridable at synth with `-c imageTag=...`. */
	readonly imageTag: string;
	readonly ecrRepositoryName: string;
	readonly desiredCount: number;
	/**
	 * ⚠ Next.js `cacheComponents` keeps its cache PER PROCESS, and
	 * `revalidateTag` from moderation reaches only the task that served the
	 * request. Until a shared cache handler exists, production must stay at 1.
	 */
	readonly maxCapacity: number;
	/** Seconds ECS waits after SIGTERM — must outlast in-flight `after()` work. */
	readonly stopTimeoutSeconds: number;
	/** Enable ECS Exec for debugging. Off by default. */
	readonly enableExecuteCommand: boolean;

	// ── Ingress ──────────────────────────────────────────────────────────────
	/** ACM certificate in THIS region for the ALB. Undefined → HTTP-only listener. */
	readonly certificateArn?: string;
	/** Route 53 record to create. Undefined → DNS is managed elsewhere (Cloudflare). */
	readonly hostedZone?: HostedZoneConfig;
	/** Public base URL of the app; the cron rules call it. */
	readonly appBaseUrl: string;
	/** Put CloudFront in front of the ALB. Off when Cloudflare already fronts it. */
	readonly cloudFrontEnabled: boolean;
	/** Attach an AWS-managed WAF rule set to the ALB. */
	readonly wafEnabled: boolean;

	// ── Secrets ──────────────────────────────────────────────────────────────
	/** Secrets Manager secret NAME (created and populated outside CDK). */
	readonly secretName: string;
	/** JSON keys inside that secret, injected as container `secrets:`. */
	readonly secretKeys: readonly string[];
	/** JSON key holding the full cron header value, e.g. `Bearer <CRON_SECRET>`. */
	readonly cronAuthHeaderKey: string;

	// ── Migrations ───────────────────────────────────────────────────────────
	/**
	 * Command for the one-off migration task. CI may run migrations itself
	 * instead; this task exists so migrations can also run inside the VPC.
	 */
	readonly migrationCommand: readonly string[];

	// ── Observability ────────────────────────────────────────────────────────
	readonly logRetentionDays: number;
	/** Email subscribed to the alarm topic. Undefined → topic without subscribers. */
	readonly alertEmail?: string;
	readonly alarmThresholds: {
		readonly target5xxPerFiveMinutes: number;
		readonly p95LatencySeconds: number;
		readonly cpuPercent: number;
		readonly memoryPercent: number;
	};
}

/** A scheduled job, mapped 1:1 from `vercel.json` crons. */
export interface CronJob {
	readonly id: string;
	/** Path on the app, e.g. `/api/cron/close-due-markets`. */
	readonly path: string;
	/** EventBridge schedule expression. */
	readonly schedule: string;
	readonly description: string;
}

/**
 * The three jobs `vercel.json` runs today. `close-due-markets` is the critical
 * one: nothing else moves a market out of `Open` at its deadline.
 */
export const CRON_JOBS: readonly CronJob[] = [
	{
		id: "CloseDueMarkets",
		path: "/api/cron/close-due-markets",
		schedule: "rate(1 minute)",
		description: "Closes markets whose resolution deadline has passed.",
	},
	{
		id: "AlarmsDrain",
		path: "/api/cron/alarms-drain",
		schedule: "rate(5 minutes)",
		description: "Drains queued liquidity alarms.",
	},
	{
		id: "R2OrphanSweep",
		path: "/api/cron/r2-orphan-sweep",
		schedule: "rate(6 hours)",
		description: "Removes R2 objects whose upload never committed.",
	},
];

/**
 * Secret JSON keys the container needs at RUNTIME.
 *
 * ⚠ Build-time variables are NOT here — `ZUGZWANG_ENV`, `NEXT_PUBLIC_*` and
 * `BETTER_AUTH_URL` are inlined into the bundle by `next.config.ts`, so they
 * are passed as Docker build args and the image is environment-specific.
 */
export const RUNTIME_SECRET_KEYS: readonly string[] = [
	"DATABASE_URL",
	"BETTER_AUTH_SECRET",
	"BETTER_AUTH_URL",
	"BETTER_AUTH_TRUSTED_ORIGINS",
	"GOOGLE_CLIENT_ID",
	"GOOGLE_CLIENT_SECRET",
	"TURNSTILE_SECRET_KEY",
	"NEXT_PUBLIC_TURNSTILE_SITE_KEY",
	"ADMIN_PASSWORD",
	"CRON_SECRET",
	"OPENAI_API_KEY",
	"RESEND_API_KEY",
	"RESEND_FROM_EMAIL",
	"UPSTASH_REDIS_REST_URL",
	"UPSTASH_REDIS_REST_TOKEN",
	"NEXT_PUBLIC_SENTRY_DSN",
	"NEXT_PUBLIC_POSTHOG_KEY",
	"NEXT_PUBLIC_POSTHOG_HOST",
	"R2_ENDPOINT_UPLOADS",
	"R2_BUCKET_UPLOADS",
	"R2_ACCESS_KEY_ID_UPLOADS",
	"R2_SECRET_ACCESS_KEY_UPLOADS",
	"R2_ENDPOINT_PFP",
	"R2_BUCKET_PFP",
	"R2_ACCESS_KEY_ID_PFP",
	"R2_SECRET_ACCESS_KEY_PFP",
	"R2_PUBLIC_URL_PFP",
	"R2_ENDPOINT_MARKET_MEDIA",
	"R2_BUCKET_MARKET_MEDIA",
	"R2_ACCESS_KEY_ID_MARKET_MEDIA",
	"R2_SECRET_ACCESS_KEY_MARKET_MEDIA",
];
