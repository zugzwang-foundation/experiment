import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import { productionConfig } from "../../../infra/config/production";
import { stagingConfig } from "../../../infra/config/staging";

/**
 * AWS-MIGRATION-3 items 1, 2, 4, 5 and 7, tests-first (CLAUDE.md §5.6) — the
 * environment contract and the one place it is consumed. Plan
 * `docs/plans/AWS-MIGRATION-3.md` §"Test plan" row 8 names
 * `infra/test/compute-config.test.ts` (a synthesised-template assertion); the
 * invoking session redirected it here as a CONFIG-VALUE + SOURCE-SCAN pair, which
 * needs no CDK app and no `cdk synth`. ⚠ RECORDED AS A DEVIATION from the plan's
 * own row: this file cannot see the synthesised CloudFormation, so it proves the
 * VALUES and that compute-stack.ts READS them — not that the template carries
 * what CloudFormation will apply.
 *
 * ⛔ WHY STAGING AND PRODUCTION ARE ASSERTED TOGETHER, ROW FOR ROW. The whole
 * argument for the staging resize (item 7) is that a rehearsal on a different box
 * rehearses nothing. The load test that produced these numbers ran on `t3.small`
 * with a 0.5-vCPU share, 1 GiB and Node's ~560 MB default heap; its findings are
 * therefore NOT a baseline for the resized staging, and the only thing that makes
 * the next run meaningful is that the two environments are the same shape. A
 * silent divergence between these two objects is the defect this file exists to
 * catch, and it is invisible in any single-environment assertion.
 *
 * ⛔ THE HEAP BOUND IS A RELATION, NOT A NUMBER. The load test found Node's own
 * default (560 MB in a 1 GiB container) reached after ~1,500 bets, after which
 * the process spent ~0.9 vCPU in garbage collection WITH NO TRAFFIC and never
 * recovered. Raising the heap fixes that; raising it ABOVE the container limit
 * replaces thrashing with an ECS kill, which is worse because it looks like a
 * crash. The remainder is native memory, V8 metadata and buffers, so the heap is
 * held at or below ~70 % of the hard limit and the ratio is asserted alongside the
 * literals.
 *
 * ⚠ `desiredCount` AND `maxCapacity` ARE BOTH 1 AS A CORRECTNESS CONSTRAINT, not
 * a cost one — `cacheComponents` keeps Next's cache PER PROCESS and a
 * `revalidateTag` raised by a moderation removal reaches only the task that
 * handled it, so a second task could keep serving a removed comment for the cache
 * window. That is an SC-1 masking failure wearing an autoscaling costume. Raising
 * either number requires a shared cache handler first (ADR-0051,
 * `production.ts`'s own docblock).
 *
 * ⚠ THESE MODULES READ `process.env` for the region, account, certificate ARN and
 * the writes-paused flag. None of the fields asserted here is one of those, so
 * the file needs no env fixture — and the env-derived fields are deliberately NOT
 * pinned, because their value depends on who is running the synth.
 */

const REPO_ROOT = join(__dirname, "..", "..", "..");
const COMPUTE_STACK = "infra/lib/compute-stack.ts";

/** Comments stripped, for the same reason every other source scan in this repo strips them. */
function strippedSource(relPath: string): string {
	return readFileSync(join(REPO_ROOT, relPath), "utf8")
		.replace(/\/\*[\s\S]*?\*\//g, " ")
		.replace(/(^|[^:])\/\/[^\n]*/g, "$1 ");
}

/** The two environments, asserted row for row so a divergence cannot hide. */
const ENVIRONMENTS = [
	["staging", stagingConfig],
	["production", productionConfig],
] as const;

describe("environment-config — staging and production are the same shape", () => {
	for (const [label, config] of ENVIRONMENTS) {
		describe(label, () => {
			it(`environment-config::${label}-runs-exactly-one-task`, () => {
				expect(config.desiredCount).toBe(1);
				expect(config.maxCapacity).toBe(1);
				// Stated as the relation too: `maxCapacity > desiredCount` is what
				// compute-stack.ts uses to decide whether to create a scaling target
				// at all, so equality here is what keeps the second task
				// unreachable rather than merely undesired.
				expect(config.maxCapacity).toBe(config.desiredCount);
			});

			it(`environment-config::${label}-bounds-the-node-heap`, () => {
				expect(config.nodeMaxOldSpaceMiB).toBe(2048);
			});

			it(`environment-config::${label}-keeps-alive-past-the-alb-idle-timeout`, () => {
				// The ALB idle timeout is 60 s (compute-stack.ts). 65 s clears it; the
				// preload adds 5 s on top for `headersTimeout`.
				expect(config.keepAliveTimeoutMs).toBe(65_000);
				expect(config.keepAliveTimeoutMs).toBeGreaterThan(60_000);
			});

			it(`environment-config::${label}-health-checks-the-readiness-path`, () => {
				expect(config.readinessPath).toBe("/api/ready");
				// ⛔ NOT `/api/health`. That path answers "the process is alive", which
				// a cold task satisfies long before it can serve — the exact condition
				// that let a 2½-minute-old task into rotation and collapse under twelve
				// users.
				expect(config.readinessPath).not.toBe("/api/health");
			});

			it(`environment-config::${label}-grace-period-outlasts-the-warm-up`, () => {
				expect(config.healthCheckGracePeriodSeconds).toBe(180);
				// The warm is bounded at 90 s (READY_TOTAL_BUDGET_MS); the grace has to
				// cover boot AND the whole warm, or ECS kills the task mid-warm and
				// restarts it into the same warm indefinitely.
				expect(config.healthCheckGracePeriodSeconds).toBeGreaterThan(90);
			});

			it(`environment-config::${label}-task-and-host-are-the-production-shape`, () => {
				expect(config.memoryMiB).toBe(3072);
				expect(config.cpu).toBe(1024);
				expect(config.instanceType).toBe("m7i-flex.large");
			});

			it(`environment-config::${label}-heap-fits-inside-the-container`, () => {
				// ⛔ THE RELATION, which is the durable half of item 1. A heap above the
				// container's hard limit turns GC thrashing into an ECS OOM kill, and
				// the ~30 % headroom is for native memory, V8 metadata and buffers.
				expect(config.nodeMaxOldSpaceMiB).toBeLessThanOrEqual(
					0.7 * config.memoryMiB,
				);
				// And the soft reservation ECS places against must not be below the
				// heap, or a second task could be scheduled onto memory this one has
				// already committed to using.
				expect(config.memoryReservationMiB).toBeGreaterThanOrEqual(
					config.nodeMaxOldSpaceMiB,
				);
			});
		});
	}

	it("environment-config::the-two-environments-do-not-diverge", () => {
		// ⛔ THE ROW THE PER-ENVIRONMENT BLOCKS ABOVE CANNOT REPLACE. They pin each
		// side to a literal; this one states the PROPERTY — that the rehearsal box
		// and the real box are the same — so a future change that moves both
		// literals in step stays green while a change that moves one reddens here
		// with the field named.
		const shared = [
			"cpu",
			"memoryMiB",
			"memoryReservationMiB",
			"instanceType",
			"desiredCount",
			"maxCapacity",
			"nodeMaxOldSpaceMiB",
			"keepAliveTimeoutMs",
			"readinessPath",
			"healthCheckGracePeriodSeconds",
			"containerPort",
			"stopTimeoutSeconds",
		] as const;

		for (const field of shared) {
			expect(stagingConfig[field], `field ${field} diverges`).toEqual(
				productionConfig[field],
			);
		}
	});
});

describe("environment-config — compute-stack.ts consumes the contract", () => {
	it("environment-config::emits-NODE_OPTIONS-from-the-heap-bound", () => {
		const source = strippedSource(COMPUTE_STACK);

		// ⛔ POSITIVE CONTROL FIRST — the stripped source is still a stack file.
		expect(source).toContain("class ComputeStack");

		expect(source).toContain("NODE_OPTIONS");
		expect(source).toContain("--max-old-space-size=");
		// From the config, never a literal: a hardcoded 2048 here would make the
		// config field decorative, and the two could then disagree silently — the
		// PERF-1 shape, where a ratified decision sat in a file nothing read.
		expect(source).toContain("config.nodeMaxOldSpaceMiB");
	});

	it("environment-config::emits-KEEP_ALIVE_TIMEOUT-from-the-contract", () => {
		const source = strippedSource(COMPUTE_STACK);

		expect(source).toContain("KEEP_ALIVE_TIMEOUT");
		expect(source).toContain("config.keepAliveTimeoutMs");
	});

	it("environment-config::passes-the-write-pause-flag-through-to-the-task", () => {
		const source = strippedSource(COMPUTE_STACK);

		// The pause is a TASK ENVIRONMENT value and deliberately not a secret —
		// flipping it is a config change plus a rolling restart, which is what makes
		// it auditable. If the stack never emitted it, the flag would be
		// unreachable in a deployed task and the rehearsal would silently prove
		// nothing.
		expect(source).toContain("ZUGZWANG_WRITES_PAUSED");
		expect(source).toContain("config.writesPaused");
	});

	it("environment-config::target-group-health-check-uses-the-readiness-path", () => {
		const source = strippedSource(COMPUTE_STACK);

		expect(source).toContain("path: config.readinessPath");
		// ⛔ AND NOT A LITERAL TARGET-GROUP PATH. The container health check still
		// names `/api/health` — correctly, it asks a different question — so the
		// assertion is about the `path:` PROPERTY rather than about the string
		// appearing anywhere in the file.
		expect(source).not.toContain('path: "/api/health"');
		// Positive control for that negative: `path:` is present at all, so a
		// renamed property cannot pass the row above by absence.
		expect(source).toMatch(/path:\s*config\.readinessPath/);
	});

	it("environment-config::grace-period-comes-from-the-contract", () => {
		const source = strippedSource(COMPUTE_STACK);

		expect(source).toContain("config.healthCheckGracePeriodSeconds");
		// The value it replaced. A literal left beside the config read would mean
		// whichever CDK saw last, which is not a thing a reader can determine.
		expect(source).not.toMatch(
			/healthCheckGracePeriod:\s*Duration\.seconds\(\s*90\s*\)/,
		);
	});

	it("environment-config::no-scaling-target-when-max-equals-desired", () => {
		const source = strippedSource(COMPUTE_STACK);

		// With `maxCapacity === desiredCount` there must be no autoscaling target at
		// all — not a target with equal bounds. A scaling target that exists is one
		// an operator can widen from the console without touching this repository,
		// and the per-process cache makes that a correctness change rather than a
		// capacity one.
		expect(source).toMatch(/config\.maxCapacity\s*>\s*config\.desiredCount/);
	});
});
