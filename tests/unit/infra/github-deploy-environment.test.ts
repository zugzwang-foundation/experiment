import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import { PRODUCTION_GITHUB_ENVIRONMENT } from "../../../infra/config/production";

/**
 * 09 §C — which GitHub environment may mint the token the production deploy
 * role trusts. GitHub's `Production` environment is Vercel's: `vercel[bot]`
 * records a deployment there for every `main` commit, and GitHub matches
 * environment names case-insensitively, so a workflow job naming `production`
 * would run INSIDE it. AWS production therefore has its own environment, whose
 * name is written once (production.ts) and must agree in three places: the
 * role's trust `sub`, the stack that builds the role, and every workflow job
 * that assumes it. Staging keeps `staging` everywhere, byte for byte.
 */

const REPO_ROOT = join(__dirname, "..", "..", "..");
const stripped = (rel: string) =>
	readFileSync(join(REPO_ROOT, rel), "utf8")
		.replace(/\/\*[\s\S]*?\*\//g, " ")
		.replace(/(^|[^:])\/\/[^\n]*/g, "$1 ");
// `$` is assembled so these literals are not read as template strings.
const $ = "$";

describe("the production GitHub environment name", () => {
	it("is aws-production, and cannot collide with Vercel's Production", () => {
		expect(PRODUCTION_GITHUB_ENVIRONMENT).toBe("aws-production");
		// GitHub environment names are case-insensitive.
		expect(PRODUCTION_GITHUB_ENVIRONMENT.toLowerCase()).not.toBe("production");
		expect(PRODUCTION_GITHUB_ENVIRONMENT.toLowerCase()).not.toBe("preview");
		// Lowercase, so the OIDC `sub` casing cannot differ from the trust policy.
		expect(PRODUCTION_GITHUB_ENVIRONMENT).toBe(
			PRODUCTION_GITHUB_ENVIRONMENT.toLowerCase(),
		);
	});
});

describe("the deploy role trusts exactly one GitHub environment", () => {
	it("builds the trust sub from githubEnvironment, falling back to the name", () => {
		const stack = stripped("infra/lib/deploy-stack.ts");
		expect(stack).toContain(
			`"token.actions.githubusercontent.com:sub": \`repo:${$}{props.githubRepository}:environment:${$}{githubEnvironment ?? environment}\``,
		);
		expect(stack).toContain(
			`"token.actions.githubusercontent.com:aud": "sts.amazonaws.com"`,
		);
		// One exact value, never a pattern.
		expect(stack).not.toMatch(/StringLike/);
	});

	const bin = stripped("infra/bin/zugzwang.ts");
	const block = (id: string) => {
		const start = bin.indexOf(`new DeployStack(app, "${id}"`);
		expect(start).toBeGreaterThan(-1);
		return bin.slice(start, bin.indexOf("});", start));
	};

	it("production passes its own GitHub environment", () => {
		expect(block("Zugzwang-production-Deploy")).toContain(
			"githubEnvironment: PRODUCTION_GITHUB_ENVIRONMENT",
		);
	});

	it("staging passes none, so its role keeps trusting environment:staging", () => {
		expect(block("Zugzwang-Deploy")).not.toContain("githubEnvironment");
	});
});

describe("deploy-aws.yml runs production jobs in that environment", () => {
	const workflow = readFileSync(
		join(REPO_ROOT, ".github/workflows/deploy-aws.yml"),
		"utf8",
	);
	const APP_ENV = "(inputs.environment || 'staging')";
	const MAPPED = `${$}{{ ${APP_ENV} == 'production' && '${PRODUCTION_GITHUB_ENVIRONMENT}' || ${APP_ENV} }}`;
	const jobEnvironments = workflow
		.split("\n")
		.filter((line) => /^ {4}environment:/.test(line))
		.map((line) => line.replace(/^ {4}environment:\s*/, "").trim());

	it("every job-level environment uses the mapping (build, migrate, deploy)", () => {
		expect(jobEnvironments).toHaveLength(3);
		for (const value of jobEnvironments) expect(value).toBe(MAPPED);
	});

	it("the mapping sends staging and push to staging, production to its own environment", () => {
		// The same expression in JS: GitHub's `==` on strings, `&&`/`||` returning operands.
		const evaluate = (input: string) => {
			const app = input || "staging";
			return (app === "production" && PRODUCTION_GITHUB_ENVIRONMENT) || app;
		};
		expect(evaluate("")).toBe("staging");
		expect(evaluate("staging")).toBe("staging");
		expect(evaluate("production")).toBe("aws-production");
	});
});
