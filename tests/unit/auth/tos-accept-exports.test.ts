import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

// SEED-STAGING-1 §8 (⛔ "The extracted function must NOT live in
// `tos-accept.ts`") + §10 row 2 + §16 `tos-record.ts`.
//
// ⛔ WHY THIS IS A SOURCE SCAN AND NOT A BEHAVIOURAL TEST — THE DEFECT IT
// GUARDS IS A PRIVILEGE ESCALATION, AND IT IS INVISIBLE AT RUNTIME.
//
// `tos-accept.ts` carries the `"use server"` directive, and Next.js exposes
// EVERY export of a `"use server"` module as a publicly callable Server Action,
// addressable by any client that can reach the app. The seeding tool needs the
// transaction body of `acceptTosAction` — the five-column ToS evidence write
// plus `grantInitialDharma` — for a synthetic user that has no cookies and no
// headers. Extracting it is correct. Extracting it INTO THAT FILE would publish
// `recordTosAcceptance(userId)` to the internet, and with it a way for anyone
// to grant themselves, or any user id they can guess, the initial Dharma grant
// (INV-2's issuance side). Nothing fails. Nothing logs. The endpoint simply
// exists, and `importing` it in a test would prove only that the function
// works.
//
// So the property is TEXTUAL: which bindings the `"use server"` module exports,
// and that the new module is `server-only` without that directive. A behavioural
// test cannot see a module's public action surface; this can.
//
// ⚠ COMMENTS ARE STRIPPED BEFORE SCANNING. Both files document the rule in
// prose — `tos-record.ts` is expected to say in its own docblock that it is NOT
// a `"use server"` module — and a scan that matched the explanation would
// report the defect it was written to forbid. This repository has shipped that
// exact mistake (AGENTS.md §8: six previous negative source scans matched the
// comment explaining the absence), so the strip comes first and the scanner
// refuses any `export` form it does not recognise rather than quietly reading
// zero.

const AUTH_DIR = "../../../src/server/auth";

function sourceOf(file: string): string {
	return readFileSync(
		fileURLToPath(new URL(`${AUTH_DIR}/${file}`, import.meta.url)),
		"utf-8",
	);
}

/** Block comments, then line comments. A `//` inside a string is preceded by a
 * non-space character (`http://`, a path in a template) so the second pattern
 * cannot reach it. */
function stripComments(source: string): string {
	return source
		.replace(/\/\*[\s\S]*?\*\//g, "")
		.replace(/(^|[\s;{}()[\],])\/\/[^\n]*/g, "$1");
}

/**
 * Every binding the module exports — and a THROW on any `export` form the
 * scanner does not understand, so a syntax nobody anticipated cannot be read
 * as "exports nothing".
 */
function exportedBindings(source: string): string[] {
	const stripped = stripComments(source);
	const statementStarts = stripped.match(/(?:^|\n)[ \t]*export\b/g) ?? [];

	const names: string[] = [];
	let consumed = 0;

	// `export { a, b as c }` / `export type { T }` — the brace form first,
	// because the declaration pattern below would misread its opening token.
	for (const match of stripped.matchAll(
		/(?:^|\n)[ \t]*export[ \t]*(?:type[ \t]+)?\{([\s\S]*?)\}/g,
	)) {
		consumed += 1;
		for (const part of (match[1] ?? "").split(",")) {
			const trimmed = part.trim();
			if (trimmed === "") continue;
			const alias = trimmed.split(/\s+as\s+/);
			names.push((alias[1] ?? alias[0] ?? "").trim());
		}
	}

	// `export [default] [async] function|class|const|let|var|type|interface|enum|namespace NAME`
	for (const match of stripped.matchAll(
		/(?:^|\n)[ \t]*export[ \t]+(?:default[ \t]+)?(?:async[ \t]+)?(?:function\*?|class|const|let|var|type|interface|enum|namespace)[ \t]+([A-Za-z_$][\w$]*)/g,
	)) {
		consumed += 1;
		names.push(match[1] ?? "");
	}

	// `export * from "..."` — re-exports an unknown set, so the scanner must
	// not claim to have enumerated anything.
	for (const _ of stripped.matchAll(/(?:^|\n)[ \t]*export[ \t]*\*/g)) {
		consumed += 1;
		names.push("*");
	}

	if (consumed !== statementStarts.length) {
		throw new Error(
			`export scanner understood ${consumed} of ${statementStarts.length} export statements — an unrecognised form would otherwise read as "no exports"`,
		);
	}
	return names;
}

/** The first thing the module actually says, directives included. */
function firstStatement(source: string): string {
	const lines = stripComments(source)
		.split("\n")
		.map((line) => line.trim())
		.filter((line) => line !== "");
	return lines[0] ?? "";
}

function hasUseServerDirective(source: string): boolean {
	return /["']use server["']/.test(stripComments(source));
}

describe("tos-accept-exports — the Server-Action surface of the ToS module", () => {
	it("tos-accept-exports::tos-accept-is-a-use-server-module", () => {
		// The premise of the whole file. If this directive ever goes away the
		// rule below stops being load-bearing — and so does the action, which
		// would be a different and louder failure.
		expect(firstStatement(sourceOf("tos-accept.ts"))).toBe('"use server";');
	});

	it("tos-accept-exports::tos-accept-exports-exactly-acceptTosAction", () => {
		// §8's ⛔, stated as the assertion it is: in a `"use server"` module the
		// export list IS the public endpoint list. One name, and it is the one
		// the onboarding form posts to.
		expect(exportedBindings(sourceOf("tos-accept.ts"))).toEqual([
			"acceptTosAction",
		]);
	});

	it("tos-accept-exports::tos-accept-delegates-to-recordTosAcceptance", () => {
		// The refactor's load-bearing half (§9: "Refactor: calls
		// `recordTosAcceptance`. Behaviour unchanged"). Without this the two
		// files could BOTH be correct in isolation while `tos-accept.ts` kept its
		// own inline copy of the transaction — two implementations of the initial
		// grant, drifting, with the auth suites green against whichever one they
		// happen to drive.
		const stripped = stripComments(sourceOf("tos-accept.ts"));
		expect(stripped).toContain("recordTosAcceptance");
		expect(stripped).toMatch(
			/from\s+["'](?:\.\/tos-record|@\/server\/auth\/tos-record)["']/,
		);
	});

	it("tos-accept-exports::tos-record-carries-no-use-server-directive", () => {
		// The point of moving the function. `server-only` and `"use server"` are
		// near-opposites: one forbids a module from reaching the client, the
		// other publishes its exports TO the client as callable endpoints.
		expect(hasUseServerDirective(sourceOf("tos-record.ts"))).toBe(false);
	});

	it("tos-accept-exports::tos-record-imports-server-only", () => {
		// The positive half: the module must still be structurally unreachable
		// from a client component (AGENTS.md §7). "Not a Server Action" and
		// "server-side only" are two claims, and this is the second.
		expect(stripComments(sourceOf("tos-record.ts"))).toMatch(
			/import\s+["']server-only["']/,
		);
	});

	it("tos-accept-exports::tos-record-exports-recordTosAcceptance", () => {
		expect(exportedBindings(sourceOf("tos-record.ts"))).toContain(
			"recordTosAcceptance",
		);
	});

	it("tos-accept-exports::tos-record-re-exports-nothing-wholesale", () => {
		// `export *` would make the enumeration above unfalsifiable, and in a
		// module that owns an issuance path the public surface has to be
		// readable at a glance.
		expect(exportedBindings(sourceOf("tos-record.ts"))).not.toContain("*");
	});
});
