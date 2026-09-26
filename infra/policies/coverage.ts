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
