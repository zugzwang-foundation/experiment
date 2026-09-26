/**
 * H-3 — does the zzprod CloudFormation execution policy cover what the
 * production templates create? Pure (no CDK import), so the root test suite
 * checks the committed snapshot and `infra/scripts/check-production-policies.ts`
 * checks a real `cdk synth` with the same logic.
 */

type Statement = {
	Sid?: string;
	Effect: "Allow" | "Deny";
	Action?: string | string[];
	NotAction?: string | string[];
	Resource?: string | string[];
	Condition?: unknown;
};
export type PolicyDocument = { Version: string; Statement: Statement[] };

/** IAM service prefixes CloudFormation calls to create a resource type. */
const OVERRIDES: Record<string, string[]> = {
	"AWS::CDK::Metadata": [],
	"AWS::ElasticLoadBalancingV2": ["elasticloadbalancing"],
	"Custom::LogRetention": ["lambda"],
};

export function servicesFor(resourceType: string): string[] {
	if (OVERRIDES[resourceType]) return OVERRIDES[resourceType];
	const [vendor, service] = resourceType.split("::");
	const family = `${vendor}::${service}`;
	if (OVERRIDES[family]) return OVERRIDES[family];
	if (vendor !== "AWS") {
		throw new Error(`unmapped custom resource type ${resourceType}`);
	}
	return [service.toLowerCase()];
}

const list = (v: string | string[] | undefined) =>
	v === undefined ? [] : Array.isArray(v) ? v : [v];

/** Glob match of an IAM action / ARN pattern (`*` only). */
export function globMatch(pattern: string, value: string): boolean {
	const re = new RegExp(
		`^${pattern
			.split("*")
			.map((p) => p.replace(/[.+?^${}()|[\]\\]/g, "\\$&"))
			.join(".*")}$`,
		"i",
	);
	return re.test(value);
}

/**
 * A small IAM evaluator for the tests: explicit Deny wins, then Allow, else
 * implicit deny. `context` supplies condition keys (e.g. a resource's tags as
 * `aws:ResourceTag/Environment`); a condition whose key is absent does not
 * match, as in IAM. Only `StringEquals` is used by these documents — any other
 * operator throws rather than being silently ignored.
 */
export function evaluatePolicy(
	policy: PolicyDocument,
	action: string,
	resource: string,
	context: Record<string, string> = {},
): "allow" | "deny" | "none" {
	let allowed = false;
	for (const s of policy.Statement) {
		const actionHit = s.NotAction
			? !list(s.NotAction).some((a) => globMatch(a, action))
			: list(s.Action).some((a) => globMatch(a, action));
		const resourceHit = list(s.Resource).some((r) => globMatch(r, resource));
		if (!actionHit || !resourceHit || !conditionsMet(s.Condition, context)) {
			continue;
		}
		if (s.Effect === "Deny") return "deny";
		allowed = true;
	}
	return allowed ? "allow" : "none";
}

function conditionsMet(
	condition: unknown,
	context: Record<string, string>,
): boolean {
	if (condition === undefined) return true;
	for (const [op, pairs] of Object.entries(
		condition as Record<string, Record<string, string | string[]>>,
	)) {
		if (op !== "StringEquals") {
			throw new Error(`evaluatePolicy: unsupported condition operator ${op}`);
		}
		for (const [key, want] of Object.entries(pairs)) {
			const have = context[key];
			if (have === undefined || !list(want).includes(have)) return false;
		}
	}
	return true;
}

/**
 * 09 §0 — staging and production share one account, so a production template
 * must never name a staging resource: not the environment, not staging's
 * bootstrap, not staging's network. Returns the markers found (empty = clean).
 */
export const STAGING_MARKERS = ["staging", "hnb659fds", "10.20."] as const;
export function stagingReferences(templateText: string): string[] {
	const text = templateText.toLowerCase();
	return STAGING_MARKERS.filter((m) => text.includes(m));
}

/**
 * Taggable resources in a production template that do not carry
 * `Environment=production` (the tag the staging-side protection keys on).
 */
export function untaggedProductionResources(template: {
	Resources?: Record<string, { Type: string; Properties?: { Tags?: unknown } }>;
}): string[] {
	const out: string[] = [];
	for (const [id, r] of Object.entries(template.Resources ?? {})) {
		const tags = r.Properties?.Tags;
		if (tags === undefined) continue;
		const list = Array.isArray(tags)
			? (tags as { Key: string; Value: unknown }[])
			: Object.entries(tags as Record<string, unknown>).map(([Key, Value]) => ({
					Key,
					Value,
				}));
		const env = list.find((t) => t.Key === "Environment");
		if (env?.Value !== "production") out.push(`${r.Type} ${id}`);
	}
	return out;
}

/**
 * Resource types whose service has no Allow statement in the policy. IAM is
 * checked separately (it is scoped by resource, not granted service-wide).
 */
export function uncoveredResourceTypes(
	types: readonly string[],
	policy: PolicyDocument,
): string[] {
	const allowed = policy.Statement.filter((s) => s.Effect === "Allow").flatMap(
		(s) => list(s.Action),
	);
	return types.filter((t) =>
		servicesFor(t)
			.filter((svc) => svc !== "iam")
			.some((svc) => !allowed.some((a) => globMatch(a, `${svc}:Create`))),
	);
}
