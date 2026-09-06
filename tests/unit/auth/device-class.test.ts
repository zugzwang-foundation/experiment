import { readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * MOBILE-1 · Phase B — THE DEVICE CLASSIFIER, AS A PURE FUNCTION, AND AS THE
 * ONLY ONE IN THE TREE.
 *
 * WHAT THIS PROVES, AND WHERE IT COMES FROM. `docs/plans/MOBILE-1.md` §3
 * ("Shared classifier module — `src/server/auth/device-class.ts`") makes this
 * module the single source of truth for phone/tablet classification, imported
 * at BOTH server-side call sites (the `/api/auth/[...all]` route wrapper and
 * `acceptTosAction`). §7 rows 1 and 5 enumerate the User-Agent table below and
 * the two properties that are not about any single UA string: bounded runtime
 * on a pathological input (M1-3), and the absence of a second, drifting copy of
 * the same pattern anywhere else under `src/`.
 *
 * ⛔ THE GATE IS A POLICY GATE, NOT A SECURITY BOUNDARY (ADR-0045 Consequences;
 * plan §5). That is why the fail-open rows are not leniency: a missing, empty
 * or whitespace UA classifies `desktop` and the request proceeds. The failure
 * that matters is never wrongly blocking a real desktop signup — not the
 * already-accepted case of an unusual client slipping through.
 *
 * ⛔⛔ THE iPad ROW IS AN ASSERTED CORRECTNESS, NOT AN OVERSIGHT — DO NOT "FIX"
 * IT. It has its own comment at the assertion, and it is the plan's own
 * Self-critique finding #1, rated high specifically so it survives every future
 * read of this file.
 *
 * ⚠ WHY THIS FILE IS RED AT COLLECTION TODAY. `@/server/auth/device-class` is
 * greenfield — the module does not exist until Phase B's implementation lands,
 * so the suite does not resolve. That is deliberate and is this repo's own
 * TDD-driver pattern (`tests/server/auth/tos-accept-grant.test.ts`'s docblock
 * states the same thing for the same reason): a collection-level RED is what
 * stops the fail-open rows — which would be vacuously green against a function
 * that classifies everything as desktop — from reporting a pass before there is
 * anything to pass.
 *
 * ⚠ TDD DRIVER, NOT A `_probe-*` REGRESSION GUARD (CLAUDE.md §5.6).
 */

const ROOT = process.cwd();

// ---------------------------------------------------------------------------
// GREENFIELD IMPORT — the RED driver. Lands with MOBILE-1 Phase B.
// ---------------------------------------------------------------------------
import {
	classifyDevice,
	isAuthBlockedDevice,
} from "@/server/auth/device-class";

/**
 * The UA table from plan §7 row 1, verbatim in intent and realistic in bytes.
 *
 * ⚠ EVERY STRING IS IN ITS REAL MIXED CASE. A UA arrives as `Android`,
 * `iPhone`, `IEMobile` — never lowercased — so a classifier that matches
 * lowercase tokens has to case-fold, and asserting against pre-folded strings
 * would let a non-folding implementation pass a test written against a wire
 * format it never sees.
 */
const UA = {
	/** Chrome on a Pixel. The canonical phone: `Android` AND `Mobile`. */
	androidPhone:
		"Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Mobile Safari/537.36",
	/** Safari on an iPhone. */
	iphone:
		"Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1",
	/** An iPod touch — the same WebKit family, its own token. */
	ipod: "Mozilla/5.0 (iPod touch; CPU iPhone OS 15_7 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/15.6 Mobile/15E148 Safari/604.1",

	windowsChrome:
		"Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36",
	macChrome:
		"Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36",
	linuxFirefox:
		"Mozilla/5.0 (X11; Linux x86_64; rv:127.0) Gecko/20100101 Firefox/127.0",

	/**
	 * Chrome on a Galaxy Tab: `Android`, NO `Mobile` token. Chrome's own
	 * convention (plan §3, "Android tablets").
	 */
	androidTabletChrome:
		"Mozilla/5.0 (Linux; Android 13; SM-X700) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36",
	/**
	 * A budget/non-Chrome Android tablet whose vendor browser DOES ship the
	 * `Mobile` token. Blocked either way — see the assertion's own comment for
	 * the documented false-negative this row is NOT.
	 */
	androidTabletWithMobileToken:
		"Mozilla/5.0 (Linux; Android 11; Lenovo TB-J606F) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/89.0.4389.90 Mobile Safari/537.36",

	/**
	 * ⛔⛔ iPadOS Safari in its DEFAULT mode. Byte-identical in shape to real
	 * macOS Safari — read the assertion below before touching this row.
	 */
	ipadDefaultDesktopMode:
		"Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/26.0 Safari/605.1.15",
	/** The opt-in "Request Mobile Website" iPad string — off by default. */
	ipadRequestMobileWebsite:
		"Mozilla/5.0 (iPad; CPU OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1",

	/** Legacy phone families, each carrying its own distinctive token. */
	windowsPhone:
		"Mozilla/5.0 (compatible; MSIE 10.0; Windows Phone 8.0; Trident/6.0; IEMobile/10.0; ARM; Touch; NOKIA; Lumia 920)",
	blackberry:
		"Mozilla/5.0 (BlackBerry; U; BlackBerry 9900; en) AppleWebKit/534.11+ (KHTML, like Gecko) Version/7.1.0.346 Mobile Safari/534.11+",
	operaMini:
		"Opera/9.80 (J2ME/MIDP; Opera Mini/9.80 (S60; SymbOS; Opera Mobi/23.348; U; en) Presto/2.5.25 Version/10.54",

	/**
	 * A phone with "Request Desktop Site" enabled. The browser sends a desktop
	 * string; the server sees a desktop string; the server allows. Plan §6.
	 */
	requestDesktopSiteFromAPhone:
		"Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Safari/605.1.15",
} as const;

describe("device-class::phones-and-tablets-are-blocked", () => {
	it("device-class::clear-phone-uas-classify-phone-and-are-blocked", () => {
		expect(classifyDevice(UA.androidPhone)).toBe("phone");
		expect(classifyDevice(UA.iphone)).toBe("phone");
		expect(classifyDevice(UA.ipod)).toBe("phone");

		expect(isAuthBlockedDevice(UA.androidPhone)).toBe(true);
		expect(isAuthBlockedDevice(UA.iphone)).toBe(true);
		expect(isAuthBlockedDevice(UA.ipod)).toBe(true);
	});

	it("device-class::legacy-phone-families-classify-phone-and-are-blocked", () => {
		// `windows phone` / `iemobile` / `blackberry` / `opera mini` — the four
		// non-Android, non-iOS tokens the plan's phone pattern carries. Each is
		// distinctive enough that its presence in a UA is decisive on its own.
		expect(classifyDevice(UA.windowsPhone)).toBe("phone");
		expect(classifyDevice(UA.blackberry)).toBe("phone");
		expect(classifyDevice(UA.operaMini)).toBe("phone");

		expect(isAuthBlockedDevice(UA.windowsPhone)).toBe(true);
		expect(isAuthBlockedDevice(UA.blackberry)).toBe(true);
		expect(isAuthBlockedDevice(UA.operaMini)).toBe(true);
	});

	it("device-class::an-android-tablet-without-a-Mobile-token-classifies-tablet", () => {
		// Round 2 ruling (plan Decisions received #8): tablets are excluded from
		// Join/Login too. Chrome omits `Mobile` on tablets and includes it on
		// phones, which is the whole of the heuristic.
		expect(classifyDevice(UA.androidTabletChrome)).toBe("tablet");
		expect(isAuthBlockedDevice(UA.androidTabletChrome)).toBe(true);
	});

	it("device-class::an-android-tablet-that-DOES-carry-Mobile-classifies-phone-still-blocked", () => {
		// ⚠ CLASSIFIED `phone`, WHICH IS THE WRONG WORD AND THE RIGHT OUTCOME.
		// Chrome's `Mobile`-token convention is Chrome's, not the web's — some
		// budget-tablet vendor browsers ship it anyway. Since both classes are
		// blocked, the label is cosmetic and the gate is unaffected.
		//
		// ⛔ THE DOCUMENTED FALSE-NEGATIVE IS A DIFFERENT SHAPE AND IS ACCEPTED,
		// NOT A BUG (plan §3 "Real, bounded, accepted false-negative rate", §5,
		// Self-critique #5a): a tablet whose UA omits `Android` ENTIRELY is not
		// caught here at all. No assertion is written for it because there is no
		// behaviour to assert — the classifier is not expected to catch it, and a
		// test claiming otherwise would be minting a requirement the plan
		// explicitly declined.
		expect(classifyDevice(UA.androidTabletWithMobileToken)).toBe("phone");
		expect(isAuthBlockedDevice(UA.androidTabletWithMobileToken)).toBe(true);
	});

	it("device-class::the-opt-in-Request-Mobile-Website-iPad-string-is-blocked", () => {
		// The ONLY self-identifying iPad UA, and it requires the user to have
		// turned on Safari's per-site "Request Mobile Website" setting, which is
		// OFF by default (plan §3). So this catches a minority of real iPad
		// traffic — it is the reachable half of a class whose default half is
		// unreachable, asserted immediately below.
		expect(classifyDevice(UA.ipadRequestMobileWebsite)).toBe("tablet");
		expect(isAuthBlockedDevice(UA.ipadRequestMobileWebsite)).toBe(true);
	});
});

describe("device-class::computers-are-allowed", () => {
	it("device-class::clear-desktop-uas-classify-desktop-and-are-allowed", () => {
		expect(classifyDevice(UA.windowsChrome)).toBe("desktop");
		expect(classifyDevice(UA.macChrome)).toBe("desktop");
		expect(classifyDevice(UA.linuxFirefox)).toBe("desktop");

		expect(isAuthBlockedDevice(UA.windowsChrome)).toBe(false);
		expect(isAuthBlockedDevice(UA.macChrome)).toBe(false);
		expect(isAuthBlockedDevice(UA.linuxFirefox)).toBe(false);
	});

	it("device-class::a-Request-Desktop-Site-phone-is-allowed-BY-DESIGN", () => {
		// ⚠ BY DESIGN, NOT A GAP (plan §6, first bullet; ADR-0045 Consequences —
		// "not robust against a determined user (desktop-mode browsers, spoofed
		// UA). Accepted because... a policy exclusion, not a security boundary").
		// A phone in desktop mode sends a desktop string and there is nothing in
		// the request that says otherwise. Blocking it would require a heavier
		// detection mechanism, which is the framing this ADR deliberately did not
		// choose.
		expect(classifyDevice(UA.requestDesktopSiteFromAPhone)).toBe("desktop");
		expect(isAuthBlockedDevice(UA.requestDesktopSiteFromAPhone)).toBe(false);
	});

	it("device-class::THE-DEFAULT-MODE-iPAD-IS-ALLOWED-AND-THAT-IS-CORRECT", () => {
		// ⛔⛔⛔ DO NOT "FIX" THIS. A FUTURE READER WILL WANT TO, AND MUST NOT.
		//
		// iPadOS Safari's DEFAULT mode has, since iPadOS 13 (2019) and unchanged
		// through iPadOS 26 (2026), sent a User-Agent string byte-identical to
		// real macOS Safari:
		//
		//   Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15
		//   (KHTML, like Gecko) Version/26.x Safari/605.1.15
		//
		// There is NO token anywhere in that string distinguishing an iPad from a
		// Mac. Researched and confirmed at plan time against current sources
		// (Niels Leenheer, "The User-Agent string of Safari on iOS 26 and macOS
		// 26", 2025; Apple Developer Forums, "Is there any information in the user
		// agent that identifies whether it is an iPad or not?"), recorded at plan
		// §3 and rated HIGH at Self-critique #1 precisely so it stays visible.
		//
		// ⇒ ANY pattern that catches this string ALSO BLOCKS EVERY REAL MAC
		// LAPTOP AND DESKTOP USER'S SIGN-UP. That is a far worse outcome than
		// under-blocking iPads, and it is not attempted. UA Client Hints do not
		// rescue it either: Safari/WebKit has never implemented the Client Hints
		// spec, by longstanding design choice.
		//
		// ⇒ For the default-mode iPad — the overwhelming majority of real iPad
		// traffic — the server-side layer provides NO ENFORCEMENT AT ALL, and the
		// client-side `touch-primary:hidden` rule is the only practical deterrent
		// (plan §3 "Consequence", §6). Founder-ratified as intended (M1-1), not a
		// gap awaiting a decision.
		//
		// This assertion is therefore a CEILING, written down. It reddens if
		// somebody teaches the classifier to guess, which is the event worth
		// catching.
		expect(classifyDevice(UA.ipadDefaultDesktopMode)).toBe("desktop");
		expect(isAuthBlockedDevice(UA.ipadDefaultDesktopMode)).toBe(false);

		// …and the same string is what a real Mac sends, which is the reason.
		// Asserted rather than described, so the two can never disagree.
		expect(classifyDevice(UA.macChrome)).toBe("desktop");
	});
});

describe("device-class::it-fails-open", () => {
	it("device-class::missing-empty-and-whitespace-uas-are-allowed", () => {
		// Plan §5 first bullet: "UA header missing/empty/unparseable at the check
		// → fail OPEN (classify as desktop, let the request through)". The gate is
		// a policy/UX gate; the failure that matters is never wrongly blocking a
		// real desktop signup.
		for (const value of [null, undefined, "", "   ", "\t\n "] as const) {
			expect(classifyDevice(value)).toBe("desktop");
			expect(isAuthBlockedDevice(value)).toBe(false);
		}
	});

	it("device-class::isAuthBlockedDevice-is-exactly-not-desktop", () => {
		// The contract is a derivation, not a second table — two tables would be
		// two things that can drift. Proven across the whole fixture set rather
		// than asserted in a comment.
		for (const ua of Object.values(UA)) {
			expect(isAuthBlockedDevice(ua)).toBe(classifyDevice(ua) !== "desktop");
		}
		for (const value of [null, undefined, "", "   "] as const) {
			expect(isAuthBlockedDevice(value)).toBe(
				classifyDevice(value) !== "desktop",
			);
		}
	});
});

describe("device-class::it-is-total", () => {
	it("device-class::classifyDevice-never-throws-on-any-input", () => {
		// ⛔⛔ THE TOTALITY OF THIS FUNCTION IS A LOAD-BEARING PRECONDITION OF BOTH
		// CALL SITES, AND UNTIL THIS ROW IT WAS ONLY AN ACCIDENT OF THE CURRENT
		// IMPLEMENTATION.
		//
		// Plan §5 bullet 2 ratified a try/catch around the classifier ("fail open,
		// a bug in a peripheral UA check must never take down real signups").
		// Neither call site has one, and that is the RIGHT call — `slice` /
		// `toLowerCase` / `includes` over `string | null | undefined` cannot
		// throw, and error handling for an impossible scenario is what CLAUDE.md
		// §5.2 forbids. But `classifyDevice` is now the FIRST statement of
		// `handleAuth` and the FIRST statement of `acceptTosAction`, so if it ever
		// gains a throw it does not degrade one feature — it 500s EVERY
		// `/api/auth/*` request (sign-in, OAuth callback, OTP) and every ToS
		// acceptance at once.
		//
		// ⇒ So the property the missing try/catch depends on is asserted here
		// instead of assumed there: structural, not procedural (O-1). A future
		// edit that reaches for a regex, a UA-parsing library, or a client-hints
		// lookup reddens HERE, in a unit test, rather than in production on the
		// one code path that has no fallback.
		//
		// Raised by `@security-auditor` at MOBILE-1 Phase B, which found the plan
		// asserting a mechanism the code does not have. The resolution is to keep
		// the code and fix the claim — plan §5 is corrected in the same commit.
		const hostile: unknown[] = [
			null,
			undefined,
			"",
			"   ",
			"\0\0\0",
			"\uD800", // lone high surrogate — survives slice(), breaks naive encoders
			`${"\uD800".repeat(300)}iPhone`, // …and one straddling the 256 boundary
			"Android".repeat(50_000),
			`${" iPhone "}`,
			"🙂".repeat(200), // astral plane; slice() can split a surrogate pair
			"%00%0A%22injected%22 iPhone",
			"\n\r\t iPhone \n\r\t",
		];

		for (const input of hostile) {
			expect(() =>
				classifyDevice(input as string | null | undefined),
			).not.toThrow();
			// …and it still answers with a member of the union, never `undefined`
			// — a gate that returns nothing is a gate that decides nothing.
			expect(["desktop", "phone", "tablet"]).toContain(
				classifyDevice(input as string | null | undefined),
			);
			expect(() =>
				isAuthBlockedDevice(input as string | null | undefined),
			).not.toThrow();
		}
	});
});

describe("device-class::the-input-is-bounded-before-it-is-matched", () => {
	it("device-class::a-blocking-token-beyond-char-256-is-never-seen", () => {
		// ⛔ THIS IS WHAT MAKES THE 256-CHAR SLICE OBSERVABLE RATHER THAN A CLAIM
		// IN A COMMENT (plan §3, M1-3: "`ua.slice(0, 256)` before any pattern
		// match — bounds the input regardless of what a client sends"). A padded
		// string whose only blocking token sits past the boundary must classify
		// `desktop`: the bytes are in the input and the classifier never reads
		// them.
		//
		// ⚠ The cost of the bound is real and accepted: a client that pads its UA
		// gets through. It is the same accepted-risk posture as every other row
		// here — an unbounded input is the ReDoS surface, and a policy gate does
		// not buy a hang.
		const padded = `${"x".repeat(300)}iPhone`;
		expect(padded).toContain("iPhone");
		expect(classifyDevice(padded)).toBe("desktop");
		expect(isAuthBlockedDevice(padded)).toBe(false);

		// The positive control for the reading method: the SAME token inside the
		// window is decisive. Without this, a classifier that never matches
		// anything would pass the row above.
		const withinWindow = `${"x".repeat(100)}iPhone`;
		expect(classifyDevice(withinWindow)).toBe("phone");
	});

	it("device-class::a-pathological-ua-returns-inside-a-tight-time-bound", () => {
		// ⛔⛔ WHY THIS IS A TIMER AND NOT A `expect(...).not.toThrow()`.
		// Catastrophic backtracking DOES NOT THROW. It is the single-threaded
		// event loop never returning — there is no exception, no rejection, no
		// stack. `try/catch` has literally nothing to catch, which is the
		// correction plan §5 records against its own earlier wording (M1-3): the
		// mitigation is structural (bounded input + a linear-time match), and the
		// only way to assert a structural property from outside is to observe that
		// the call comes back, quickly, on an input built to make it not.
		//
		// Two shapes, because they fail differently: a very long input (cost grows
		// with length if the bound is missing) and the classic
		// alternation-inside-repetition trigger with a non-matching tail (cost
		// explodes combinatorially if the pattern is quadratic).
		const longTail = `Android${"a".repeat(100_000)}`;
		const backtrackBait = `Mozilla/5.0 (${"a".repeat(50_000)}!`;

		const singleCallStart = performance.now();
		const longTailClass = classifyDevice(longTail);
		const baitClass = classifyDevice(backtrackBait);
		const singleCallMs = performance.now() - singleCallStart;

		// The calls RETURNED — which on a catastrophic pattern they would not, and
		// the suite would die on the 10s testTimeout instead of failing here.
		// Values asserted too, so "fast" cannot be bought by doing nothing:
		// `Android` without `Mobile` is a tablet; the bait is an ordinary desktop.
		expect(longTailClass).toBe("tablet");
		expect(baitClass).toBe("desktop");
		expect(
			singleCallMs,
			`a single classification of a 100k-char User-Agent took ${singleCallMs}ms. ` +
				`The input must be sliced to 256 chars BEFORE any matching (plan §3, ` +
				`M1-3) and the match must be linear — no nested quantifiers, no ` +
				`alternation inside a repeated group.`,
		).toBeLessThan(50);

		// …and it stays bounded under repetition, so a per-request cost cannot be
		// amortised away by a warm JIT on the first call.
		const ITERATIONS = 200;
		const loopStart = performance.now();
		for (let i = 0; i < ITERATIONS; i += 1) {
			classifyDevice(longTail);
			classifyDevice(backtrackBait);
		}
		const loopMs = performance.now() - loopStart;
		// 250ms for 400 calls is ~4 orders of magnitude clear of a catastrophic
		// match (which reaches seconds-to-minutes on inputs this size) while
		// staying well outside the noise of a loaded machine. It is deliberately
		// not a microbenchmark.
		expect(
			loopMs,
			`${ITERATIONS * 2} classifications of pathological User-Agents took ` +
				`${loopMs}ms. This is a ReDoS bound, not a performance target — ` +
				`re-read plan §3 M1-3 before loosening it.`,
		).toBeLessThan(250);
	});
});

// ---------------------------------------------------------------------------
// ONE CLASSIFIER, TWO CALL SITES — plan §7 row 5, second half.
// ---------------------------------------------------------------------------

const ROUTE = "src/app/api/auth/[...all]/route.ts";
const TOS_ACCEPT = "src/server/auth/tos-accept.ts";
const DEVICE_CLASS = "src/server/auth/device-class.ts";

const read = (rel: string) => readFileSync(join(ROOT, rel), "utf8");

/** Source with `/* *\/` and `//` comments removed. */
function stripComments(source: string): string {
	return source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/[^\n]*/g, "");
}

/** Every `.ts`/`.tsx` file under `dir`, repo-relative, recursively. */
function sourceFilesUnder(dir: string): string[] {
	const out: string[] = [];
	const walk = (abs: string) => {
		for (const entry of readdirSync(abs)) {
			const child = join(abs, entry);
			if (statSync(child).isDirectory()) {
				walk(child);
			} else if (/\.tsx?$/.test(entry)) {
				out.push(relative(ROOT, child));
			}
		}
	};
	walk(join(ROOT, dir));
	return out;
}

/** Every module specifier imported by `file`. */
function specifiersOf(source: string): string[] {
	const re = /(?:from|import)\s*\(?\s*["']([^"']+)["']/g;
	return [...stripComments(source).matchAll(re)].map((m) => m[1] ?? "");
}

/**
 * Whether `spec`, written inside `file`, resolves to the classifier module.
 *
 * ⛔ RESOLVED, NOT SUBSTRING-MATCHED. `art-layer-guards.test.ts:316-331` records
 * why: a substring test answers "does the text contain this path", which is the
 * same question as "does it reach this module" only for `@/…` specifiers. From
 * inside `src/server/auth/`, the idiomatic form is `./device-class`, which
 * contains none of the path. Resolve both forms against the module's real
 * location instead.
 */
function reachesDeviceClass(file: string, spec: string): boolean {
	const target = resolve(ROOT, DEVICE_CLASS).replace(/\.ts$/, "");
	const abs = spec.startsWith("@/")
		? resolve(ROOT, "src", spec.slice(2))
		: spec.startsWith(".")
			? resolve(ROOT, dirname(file), spec)
			: null;
	return abs !== null && abs.replace(/\.tsx?$/, "") === target;
}

describe("device-class::there-is-exactly-one-classifier-in-the-tree", () => {
	it("device-class::both-server-call-sites-import-the-shared-module", () => {
		// Plan §3: "One module, not two independently drifting copies of the same
		// pattern — the same 'two enforcement layers must stay in sync' risk
		// ADR-0045 already names for the client-hide vs. server-reject split,
		// closed one layer down between the two *server*-side call sites."
		//
		// Positive controls for the resolver first, so a broken matcher and a
		// missing import cannot produce the same green.
		expect(reachesDeviceClass(ROUTE, "@/server/auth/device-class")).toBe(true);
		expect(reachesDeviceClass(TOS_ACCEPT, "./device-class")).toBe(true);
		expect(reachesDeviceClass(TOS_ACCEPT, "@/server/auth/device-class")).toBe(
			true,
		);
		expect(reachesDeviceClass(ROUTE, "@/server/auth")).toBe(false);
		expect(reachesDeviceClass(ROUTE, "react")).toBe(false);

		for (const file of [ROUTE, TOS_ACCEPT]) {
			const hits = specifiersOf(read(file)).filter((spec) =>
				reachesDeviceClass(file, spec),
			);
			expect(
				hits.length,
				`${file}: does not import the shared classifier at ` +
					`\`${DEVICE_CLASS}\`. Plan §3 requires BOTH server-side call sites ` +
					`to consume the same exported function — the route wrapper alone ` +
					`misses acceptTosAction's in-process SERVER_ONLY session-issuance ` +
					`path (M1-2 / Self-critique #6), and a second inline copy is exactly ` +
					`the drift this module exists to prevent.`,
			).toBeGreaterThan(0);
		}
	});

	it("device-class::no-second-copy-of-the-classification-tokens-exists-under-src", () => {
		// Plan §7 row 5: "no inline/duplicate pattern anywhere else in the tree".
		//
		// The four tokens below are distinctive enough that their presence in any
		// other source file means somebody re-implemented the classifier rather
		// than importing it. Comments are stripped first: a file is allowed to
		// TALK about `iemobile`; it is not allowed to MATCH on it.
		const TOKENS = ["iemobile", "opera mini", "blackberry", "windows phone"];

		const offenders: string[] = [];
		for (const file of sourceFilesUnder("src")) {
			if (file === DEVICE_CLASS) continue;
			const code = stripComments(read(file)).toLowerCase();
			for (const token of TOKENS) {
				if (code.includes(token)) offenders.push(`${file} → "${token}"`);
			}
		}
		expect(
			offenders,
			`a second copy of the device-classification tokens exists outside ` +
				`\`${DEVICE_CLASS}\`: ${offenders.join(", ")}. Import ` +
				`\`classifyDevice\`/\`isAuthBlockedDevice\` instead — two patterns are ` +
				`two things that can disagree, and the disagreement is silent.`,
		).toEqual([]);

		// POSITIVE CONTROL for the scan itself: the tokens ARE findable by this
		// method in the one file that is allowed to carry them. Without it,
		// "nobody duplicates the pattern" and "the walker found no files" are the
		// same green.
		const canonical = stripComments(read(DEVICE_CLASS)).toLowerCase();
		expect(
			TOKENS.filter((token) => canonical.includes(token)).length,
			`${DEVICE_CLASS} carries none of the classification tokens this scan ` +
				`looks for, so the sweep above proved nothing. Re-derive the token ` +
				`list from the shipped classifier rather than deleting this control.`,
		).toBeGreaterThan(0);
	});
});
