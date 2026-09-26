/**
 * H-3 pre-bootstrap check. Run against a fresh synth BEFORE creating the zzprod
 * bootstrap (docs/aws-migration/09-PRODUCTION-READINESS.md §B):
 *
 *   npx cdk synth "Zugzwang-production-*" -o cdk.out.prod -q
 *   npx tsx scripts/check-production-policies.ts cdk.out.prod
 *
 * Fails when the production templates contain a resource type that is not in
 * the committed snapshot (production-resource-types.json) or that the execution
 * policy does not cover, when a production role lacks the permissions boundary,
 * or when a role name falls outside the execution policy's IAM scope.
 * Reads local files only; makes no AWS call.
 */
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { productionConfig } from "../config/production";
import {
	globMatch,
	type PolicyDocument,
	uncoveredResourceTypes,
} from "../policies/coverage";

const dir = process.argv[2];
if (!dir) throw new Error("usage: check-production-policies.ts <synth-dir>");

const here = join(__dirname, "..", "policies");
const policy = JSON.parse(
	readFileSync(join(here, "production-cfn-execution-policy.json"), "utf8"),
) as PolicyDocument;
const snapshot = JSON.parse(
	readFileSync(join(here, "production-resource-types.json"), "utf8"),
) as string[];
const boundaryName = productionConfig.permissionsBoundaryPolicyName;

const failures: string[] = [];
const types = new Set<string>();
const templates = readdirSync(dir).filter((f) =>
	/^Zugzwang-production-.*\.template\.json$/.test(f),
);
if (templates.length !== 6) {
	failures.push(`expected 6 production templates, found ${templates.length}`);
}
for (const file of templates) {
	const t = JSON.parse(readFileSync(join(dir, file), "utf8"));
	for (const [id, r] of Object.entries<{
		Type: string;
		Properties?: Record<string, unknown>;
	}>(t.Resources ?? {})) {
		types.add(r.Type);
		if (r.Type !== "AWS::IAM::Role") continue;
		const boundary = JSON.stringify(r.Properties?.PermissionsBoundary ?? "");
		if (!boundaryName || !boundary.includes(`:policy/${boundaryName}`)) {
			failures.push(`${file} ${id}: role has no ${boundaryName} boundary`);
		}
		const name = r.Properties?.RoleName;
		if (typeof name === "string" && !globMatch("Zugzwang-production-*", name)) {
			failures.push(`${file} ${id}: explicit role name ${name} out of scope`);
		}
	}
}
for (const t of types) {
	if (!snapshot.includes(t)) failures.push(`new resource type ${t}`);
}
for (const t of uncoveredResourceTypes([...types], policy)) {
	failures.push(`resource type ${t} not covered by the execution policy`);
}

if (failures.length > 0) {
	console.error(failures.map((f) => `FAIL  ${f}`).join("\n"));
	process.exit(1);
}
console.log(
	`PASS  ${templates.length} templates, ${types.size} resource types, every role bounded`,
);
