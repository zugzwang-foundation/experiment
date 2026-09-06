import "server-only";

/**
 * MOBILE-1 · Phase B — the device classifier behind ADR-0045's Join/Login
 * exclusion. ONE module, consumed at BOTH server-side call sites: the
 * `/api/auth/[...all]` route wrapper and `acceptTosAction`. Written twice they
 * would drift, and the drift would be silent — which is the same risk ADR-0045
 * already names for the client-hide vs. server-reject split, closed here one
 * layer down (plan §3).
 *
 * ⛔ THIS IS A POLICY GATE, NOT A SECURITY BOUNDARY. ADR-0045 says so in as
 * many words, and every decision below follows from it. A User-Agent is
 * client-controlled and trivially spoofed; the goal is to stop a participant
 * who is not trying to get around it, not to make getting around it impossible.
 * ⇒ Every ambiguity resolves toward LETTING THE REQUEST THROUGH. The failure
 * that matters is wrongly blocking a real computer's signup, never the
 * already-accepted case of an unusual client slipping past.
 *
 * ⛔⛔ THE DEFAULT-MODE iPad CANNOT BE DETECTED HERE AND NOBODY SHOULD TRY.
 * Since iPadOS 13 (2019), unchanged through iPadOS 26, iPadOS Safari's default
 * mode sends a User-Agent byte-identical to real macOS Safari:
 *
 *   Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15
 *   (KHTML, like Gecko) Version/26.x Safari/605.1.15
 *
 * There is no token in that string separating an iPad from a Mac, and UA Client
 * Hints do not rescue it (WebKit has never implemented the spec). So ANY
 * pattern that catches it also blocks every real Mac laptop and desktop from
 * signing up — a far worse outcome than under-blocking iPads. For that device
 * class this module provides no enforcement at all, and the client-side
 * `touch-primary:hidden` rule is the only layer it ever meets. Founder-ratified
 * as intended (plan §3, Self-critique #1, rated high); the opposite of an
 * implementation gap, and asserted as correct in
 * `tests/unit/auth/device-class.test.ts`.
 *
 * ⛔ ReDoS-SAFE BY CONSTRUCTION, NOT BY EXCEPTION HANDLING. Two mechanisms,
 * both structural:
 *   1. the input is truncated to `UA_MAX_LEN` BEFORE anything reads it, so the
 *      cost of a classification is bounded regardless of what a client sends;
 *   2. there is NO REGULAR EXPRESSION in this file at all — matching is
 *      `String.prototype.includes`, which cannot backtrack. This is stronger
 *      than the plan's "linear-time pattern, no nested quantifiers" and is
 *      preferred for exactly that reason (O-1: structural beats procedural).
 * ⚠ try/catch is NOT the mitigation and never was. Catastrophic backtracking
 * does not throw — it is the single-threaded event loop never returning, and
 * there is nothing for a catch block to catch. `tests/unit/auth/
 * device-class.test.ts` asserts the bound with a timer against a 100k-char
 * pathological input, because a structural property can only be observed from
 * outside as "the call came back, fast."
 *
 * ⚠ `server-only` IS NOT REQUIRED BY AGENTS.md §7 HERE AND IS IMPORTED ANYWAY.
 * That rule scopes the directive to files that "touch the DB or secrets," and
 * this file touches neither — `cpmm/calculate.ts` and `config/limits.ts` are
 * pure the same way and carry no directive. The reason is specific to THIS
 * module: this repo ships a client-side hide for the same decision, so the most
 * likely future edit is somebody reaching for `classifyDevice` inside a
 * `"use client"` component to drive it. That would silently bundle the gate's
 * logic to the browser AND invite the belief that a client check is the
 * enforcement, which ADR-0045 says it is not. The directive turns that into a
 * build error. `logging.ts` consumes only the TYPE (`import type`), so it pays
 * nothing for this.
 */

/**
 * Real User-Agent strings run ~120-180 characters. 256 is generous headroom
 * and still a hard ceiling on per-request work.
 *
 * ⚠ The cost is real and accepted: a client that pads its UA past this
 * boundary gets through. That is the same posture as every other gap here —
 * an unbounded input is the ReDoS surface, and a policy gate does not buy a
 * hang. Made observable rather than asserted in prose: the test feeds a
 * blocking token at char 300 and requires `desktop`.
 */
const UA_MAX_LEN = 256;

/**
 * `phone` and `tablet` are BOTH blocked (the Round-2 device-scope ruling, plan
 * Decisions received #8 — Join/Login is computer/laptop only). They stay
 * separate because the reject log records which one, and a false-positive rate
 * nobody can break down by class is a number nobody can act on (plan §3
 * Observability / M1-5).
 */
export type DeviceClass = "desktop" | "phone" | "tablet";

/**
 * Classify a request's `user-agent`. Missing, empty or whitespace-only input
 * classifies `desktop` — the fail-open arm (plan §5, first bullet).
 */
export function classifyDevice(
	userAgent: string | null | undefined,
): DeviceClass {
	if (!userAgent) return "desktop";

	// Truncate FIRST, then fold case once. Both before any matching.
	const ua = userAgent.slice(0, UA_MAX_LEN).toLowerCase();

	// Android decides phone-vs-tablet by the `Mobile` token — Chrome's own
	// convention is to emit it on phones and omit it on tablets.
	//
	// ⚠ THE FALSE-NEGATIVE HERE IS REAL, BOUNDED AND ACCEPTED (plan §3,
	// Self-critique #5a): the convention is Chrome's, not the web's. A vendor
	// browser that ships `Mobile` on a tablet lands in the `phone` arm — a wrong
	// label with the right outcome, since both are blocked. A tablet whose UA
	// omits `Android` entirely is not caught at all, and that is not treated as
	// a defect to be patched with a heavier heuristic, which is the framing this
	// ADR deliberately did not choose.
	if (ua.includes("android")) {
		return ua.includes("mobile") ? "phone" : "tablet";
	}

	if (ua.includes("iphone") || ua.includes("ipod")) return "phone";

	// The ONLY self-identifying iPad string, and it only appears when the user
	// has turned on Safari's per-site "Request Mobile Website" setting — off by
	// default, so this reaches a minority of real iPad traffic. It is the
	// reachable half of the device class whose default half is unreachable; see
	// the module docblock.
	if (ua.includes("ipad")) return "tablet";

	// Legacy phone families, each carrying a token distinctive enough to be
	// decisive on its own.
	if (
		ua.includes("windows phone") ||
		ua.includes("iemobile") ||
		ua.includes("blackberry") ||
		ua.includes("opera mini")
	) {
		return "phone";
	}

	return "desktop";
}

/**
 * Whether ADR-0045's Join/Login exclusion applies to this request.
 *
 * A derivation of `classifyDevice`, never a second table — two tables are two
 * things that can disagree, and the disagreement would be silent.
 */
export function isAuthBlockedDevice(
	userAgent: string | null | undefined,
): boolean {
	return classifyDevice(userAgent) !== "desktop";
}
