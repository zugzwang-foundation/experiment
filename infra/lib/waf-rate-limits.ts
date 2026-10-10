/**
 * WAF-RATE-1 — per-IP rate limits at the edge. These are ABUSE limits, not
 * user limits: they exist to stop a bot or a flood before it reaches the single
 * app task, and are set so a person using the site normally never meets them.
 * The app's own limits (bets, OTP, admin login, uploads — src/server/config/
 * limits.ts) are unchanged and still do the per-user work; they also fail OPEN
 * when Upstash is unreachable, which is why this backstop lives in the WAF.
 *
 * Measured before choosing the numbers (2026-10-06, production):
 *   - a cold page load is 27–36 same-origin requests, of which 21–24 are
 *     `/_next/static/*` JS/CSS and fonts (immutable, browser-cached after the
 *     first load) and only 1–3 are dynamic. Market and PFP images come from R2
 *     and never reach the ALB.
 *   - an open market tab polls `/m/[slug]/version` once per 30 s (10 per
 *     5 min) and stops when hidden or idle 5 min.
 *   - the browser calls `/api/auth/*` ONLY during sign-in (2–5 requests);
 *     pages read the session server-side.
 *   - export links are plain `<a download>`, never prefetched: an export or
 *     image render happens only on a click.
 *   - the busiest 5 minutes of the last 4 days was 664 requests for ALL
 *     visitors combined, most of it our own audit scripts.
 *
 * ⚠ WHY STATIC FILES HAVE THEIR OWN, HIGHER LIMIT. Counting JS/CSS in the main
 * limit would make 1,000 requests ≈ 30 cold page loads per IP — about 30
 * people opening the site at once behind one shared address (a campus, an
 * office, a mobile carrier's CGNAT). Excluding them makes the main limit
 * ≈ 1,000 dynamic requests per IP, enough for well over 100 people sharing one
 * address, while static files keep a separate cap so they cannot be flooded
 * either.
 *
 * ⚠ PER SOURCE IP. DNS points straight at the ALB (no proxy in front), so the
 * connection's source IP IS the visitor. If a proxy/CDN is ever put in front,
 * every visitor would share the proxy's few IPs and these limits would block
 * real users: switch `aggregateKeyType` to `FORWARDED_IP` with the proxy's
 * client-IP header in the same change.
 */

/**
 * ⛔ NO `aws-cdk-lib` IMPORT IN THIS FILE, NOT EVEN A TYPE. `infra/config/*.ts`
 * imports this module and the APP's build type-checks those configs (tests and
 * env checks import them), but the app image never installs `infra/`'s own
 * dependencies. A `import type … from "aws-cdk-lib/…"` here passed every local
 * check — where `infra/node_modules` exists — and failed the staging image
 * build with TS2307. These local shapes are structurally what `CfnWebACL`
 * accepts; compute-stack.ts passes them straight in and the infra typecheck
 * proves the fit.
 */
type Statement = {
	readonly byteMatchStatement?: {
		readonly fieldToMatch: { readonly uriPath: Record<string, never> };
		readonly positionalConstraint: "STARTS_WITH";
		readonly searchString: string;
		readonly textTransformations: { priority: number; type: "NONE" }[];
	};
	readonly regexMatchStatement?: {
		readonly fieldToMatch: { readonly uriPath: Record<string, never> };
		readonly regexString: string;
		readonly textTransformations: { priority: number; type: "NONE" }[];
	};
	readonly notStatement?: { readonly statement: Statement };
	readonly orStatement?: { readonly statements: Statement[] };
};

export type WafRateRule = {
	readonly name: string;
	readonly priority: number;
	readonly action:
		| {
				readonly block: {
					readonly customResponse: {
						readonly responseCode: number;
						readonly customResponseBodyKey: string;
						readonly responseHeaders: {
							name: string;
							value: string;
						}[];
					};
				};
		  }
		| { readonly count: Record<string, never> };
	readonly statement: {
		readonly rateBasedStatement: {
			readonly limit: number;
			readonly evaluationWindowSec: number;
			readonly aggregateKeyType: "IP";
			readonly scopeDownStatement: Statement;
		};
	};
	readonly visibilityConfig: {
		readonly cloudWatchMetricsEnabled: boolean;
		readonly metricName: string;
		readonly sampledRequestsEnabled: boolean;
	};
};

/** The window every rule counts over: 5 minutes, per IP. */
export const WAF_RATE_WINDOW_SECONDS = 300;

export type WafRateLimits = {
	/** Every request except static files (pages, RSC, API, polls). */
	readonly dynamicPerIp: number;
	/** Static files only (`STATIC_PATH_PREFIXES`). */
	readonly staticPerIp: number;
	/** Sign-in and admin login (`AUTH_PATH_PREFIXES`). */
	readonly authPerIp: number;
	/** Debate and post-image downloads (`EXPORT_PATH_REGEX`). */
	readonly exportPerIp: number;
	/** `count` records what would be blocked without blocking it. */
	readonly action: "block" | "count";
};

/**
 * The production values. 1,000 dynamic ≈ 100+ people per shared IP;
 * 5,000 static ≈ 150 cold page loads per IP; 100 auth ≈ 20–50 sign-ins per IP
 * (the stricter existing OTP limits still apply); 30 exports — one person
 * clicking download that often in 5 minutes is not browsing.
 */
export const DEFAULT_WAF_RATE_LIMITS: WafRateLimits = {
	dynamicPerIp: 1_000,
	staticPerIp: 5_000,
	authPerIp: 100,
	exportPerIp: 30,
	action: "block",
};

/** Paths served from disk as immutable/static files. */
export const STATIC_PATH_PREFIXES: readonly string[] = [
	"/_next/static/",
	"/brand/",
	"/art/",
	"/tutorial/",
];

/** Better Auth's handler and the separate admin login. */
export const AUTH_PATH_PREFIXES: readonly string[] = [
	"/api/auth/",
	"/admin/login",
];

/** `/m/<slug>/export` and `/m/<slug>/export/image` (query string excluded). */
export const EXPORT_PATH_REGEX = "^/m/[^/]+/export(/image)?/?$";

/** Key of the custom 429 body in the WebACL's `customResponseBodies`. */
export const RATE_LIMITED_BODY_KEY = "rate-limited";

/** How long a blocked client is told to wait; WAF un-blocks once the IP's
 * count over the trailing window falls back under the limit. */
export const RATE_LIMITED_RETRY_AFTER_SECONDS = 300;

export const RATE_LIMITED_RESPONSE_BODIES: Record<
	string,
	{ readonly contentType: "TEXT_PLAIN"; readonly content: string }
> = {
	[RATE_LIMITED_BODY_KEY]: {
		contentType: "TEXT_PLAIN",
		content:
			"Too many requests from your network. Please wait a few minutes and try again.",
	},
};

const uriStartsWith = (prefix: string): Statement => ({
	byteMatchStatement: {
		fieldToMatch: { uriPath: {} },
		positionalConstraint: "STARTS_WITH",
		searchString: prefix,
		textTransformations: [{ priority: 0, type: "NONE" }],
	},
});

const anyOf = (statements: Statement[]): Statement =>
	statements.length === 1 ? statements[0] : { orStatement: { statements } };

const isStatic = (): Statement =>
	anyOf(STATIC_PATH_PREFIXES.map(uriStartsWith));

const isAuth = (): Statement => anyOf(AUTH_PATH_PREFIXES.map(uriStartsWith));

const isExport = (): Statement => ({
	regexMatchStatement: {
		fieldToMatch: { uriPath: {} },
		regexString: EXPORT_PATH_REGEX,
		textTransformations: [{ priority: 0, type: "NONE" }],
	},
});

function rateRule(
	name: string,
	priority: number,
	limit: number,
	scope: Statement,
	action: WafRateLimits["action"],
): WafRateRule {
	return {
		name,
		priority,
		action:
			action === "block"
				? {
						block: {
							customResponse: {
								responseCode: 429,
								customResponseBodyKey: RATE_LIMITED_BODY_KEY,
								responseHeaders: [
									{
										name: "Retry-After",
										value: String(RATE_LIMITED_RETRY_AFTER_SECONDS),
									},
								],
							},
						},
					}
				: { count: {} },
		statement: {
			rateBasedStatement: {
				limit,
				evaluationWindowSec: WAF_RATE_WINDOW_SECONDS,
				aggregateKeyType: "IP",
				scopeDownStatement: scope,
			},
		},
		visibilityConfig: {
			cloudWatchMetricsEnabled: true,
			metricName: name,
			sampledRequestsEnabled: true,
		},
	};
}

/**
 * The four rate rules, highest priority first. The narrow auth and export
 * rules come before the broad ones so a flood of either is answered by its own
 * (lower) limit; the managed rule set is placed after all of them by the
 * caller.
 */
export function wafRateLimitRules(limits: WafRateLimits): WafRateRule[] {
	return [
		rateRule("rate-limit-auth", 1, limits.authPerIp, isAuth(), limits.action),
		rateRule(
			"rate-limit-export",
			2,
			limits.exportPerIp,
			isExport(),
			limits.action,
		),
		rateRule(
			"rate-limit-dynamic",
			3,
			limits.dynamicPerIp,
			{ notStatement: { statement: isStatic() } },
			limits.action,
		),
		rateRule(
			"rate-limit-static",
			4,
			limits.staticPerIp,
			isStatic(),
			limits.action,
		),
	];
}

/** WAF requires its CloudWatch log group name to start with this. */
export const WAF_LOG_GROUP_PREFIX = "aws-waf-logs-";
