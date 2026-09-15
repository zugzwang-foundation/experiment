// SEED-1-DUMMY — `globalSetup` for vitest.prod-seed.config.ts. ADR-0053.
//
// Takes the place P-17 holds in the other three configs. It is not a bypass:
// `resolveSeedTarget` runs P-17's own check in local and staging modes, and its
// prod mode is a positive match that refuses everything but the production ref
// with its acknowledgement. Runs once, before any runner file is imported.

import { resolveSeedTarget } from "./target";

export default function setup(): void {
	const target = resolveSeedTarget(process.env);
	if (!target.ok) {
		throw new Error(`[prod-seed guard] ${target.reason}`);
	}
}
