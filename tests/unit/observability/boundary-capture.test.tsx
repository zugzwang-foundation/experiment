// @vitest-environment jsdom

import { cleanup, render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * The React error boundaries' Sentry reporting path — `@/lib/boundary-capture`
 * and the four boundaries that call it.
 *
 * WHAT THIS CLOSES. `instrumentation.ts` re-exports `onRequestError`, so Sentry
 * already sees every SERVER throw. It sees nothing a React error boundary
 * catches: a boundary is by definition the thing that stops the error
 * propagating, so it never reaches `window.onerror` and the browser SDK's
 * default global handlers never fire. Before this module every client-side and
 * hydration failure on the product was invisible — the boundary rendered its
 * apology and the event went nowhere.
 *
 * THE VENDOR BOUNDARY IS MOCKED, NOT THE WRAPPER, matching
 * `safe-capture.test.ts`. Two of the assertions below are about which fields of
 * the error get touched, and against the real SDK those would measure Sentry's
 * event-building internals rather than this repo's code.
 *
 * ⚠ `global-error` LOGS "In HTML, <html> cannot be a child of <div>" HERE AND
 * THAT IS EXPECTED — do not "fix" it by dropping the boundary from the table.
 * It replaces the root layout, so its root really is `<html>`, and
 * `global-error.test.tsx` uses `renderToStaticMarkup` precisely to avoid
 * mounting it into a container. That option is not open to this file: the thing
 * under test is a `useEffect`, and a static render never runs one. The warning
 * is React describing the harness, not a defect in the component — the
 * alternative is not testing the last-resort boundary's reporting at all.
 */

const { mockCaptureException } = vi.hoisted(() => ({
	mockCaptureException: vi.fn(),
}));
vi.mock("@sentry/nextjs", () => ({ captureException: mockCaptureException }));

import AuthError from "@/app/(auth)/error";
import DebateRouteError from "@/app/(public)/m/[slug]/error";
import ProfileRouteError from "@/app/(public)/u/[pseudonym]/error";
import GlobalError from "@/app/global-error";
import { captureBoundaryError } from "@/lib/boundary-capture";

// `global-error.tsx` re-instantiates the Geist fonts (it replaces the root
// layout, so it inherits none). `next/font/google` is a build-time transform
// with no Node runtime — same mock, same reason, as `global-error.test.tsx`.
vi.mock("next/font/google", () => ({
	Geist: () => ({ variable: "--font-geist-sans" }),
	Geist_Mono: () => ({ variable: "--font-geist-mono" }),
}));

function thrown(digest?: string) {
	const err = new Error("BOUNDARY_LEAK_pg_connection_refused") as Error & {
		digest?: string;
	};
	if (digest) err.digest = digest;
	return err;
}

const tags = (call: number) => mockCaptureException.mock.calls[call]?.[1]?.tags;

beforeEach(() => mockCaptureException.mockReset());
afterEach(cleanup);

describe("captureBoundaryError — the client-side capture", () => {
	it("boundary-capture::tags-the-event-with-its-kind-and-its-boundary", () => {
		const err = thrown();
		captureBoundaryError(err, "debate");

		expect(mockCaptureException).toHaveBeenCalledTimes(1);
		// The error goes through UNWRAPPED — Sentry needs the real object to
		// build a stack trace, so nothing here pre-digests it into a string.
		expect(mockCaptureException.mock.calls[0]?.[0]).toBe(err);
		expect(tags(0)).toEqual({
			kind: "react_error_boundary",
			boundary: "debate",
		});
	});

	it("boundary-capture::carries-the-digest-when-there-is-one", () => {
		// The join key. After a SERVER throw React's Flight client has already
		// replaced the message with a placeholder, so the digest is the only
		// thing tying this husk to the real event `onRequestError` captured.
		captureBoundaryError(thrown("d4b81ce9"), "profile");
		expect(tags(0)).toEqual({
			kind: "react_error_boundary",
			boundary: "profile",
			digest: "d4b81ce9",
		});
	});

	it("boundary-capture::omits-the-digest-key-entirely-when-absent", () => {
		// Not `digest: undefined`. A Sentry tag value must be a string, and an
		// undefined one shows up in the UI as a tag nobody set.
		captureBoundaryError(thrown(), "auth");
		expect(tags(0)).not.toHaveProperty("digest");
	});

	it("boundary-capture::reads-digest-and-NOTHING-else-off-the-error", () => {
		// ⚠ THE FIELDS THAT ARE NOT READ ARE THE POINT. On the client arm
		// `message` / `stack` / `cause` hold the DB error, the Better Auth
		// internal, the participant's own input. They reach Sentry inside the
		// error object, which is the deliberate part; what must never happen is
		// this repo lifting one into a TAG, where it becomes an indexed,
		// searchable, retained facet. A throwing getter makes that a failure
		// rather than something a reviewer has to notice.
		const reads: string[] = [];
		const tattle = {
			get message() {
				reads.push("message");
				return "";
			},
			get digest() {
				reads.push("digest");
				return "d1";
			},
			get stack() {
				reads.push("stack");
				return "";
			},
			get cause() {
				reads.push("cause");
				return undefined;
			},
		} as unknown as Error & { digest?: string };

		captureBoundaryError(tattle, "global");
		expect(reads).toEqual(["digest"]);
	});

	it("boundary-capture::fails-open-when-the-SDK-throws", () => {
		// SPEC.2 §17.5, and the stake is higher here than at an ordinary call
		// site: this runs INSIDE the boundary already handling a failure, and
		// from `global-error.tsx` there is no boundary above it to catch a
		// throw out of it.
		//
		// ⚠ `mockImplementationOnce`, NOT `mockImplementation`, and the
		// difference is not stylistic. A throwing implementation left standing
		// past the end of this test is reported by the runner as an unhandled
		// error and FAILS THIS TEST even though the helper swallowed the throw
		// correctly — measured: an explicit `try`/`catch` around the call sets
		// its flag to `false` (the catch never runs, the helper absorbed it)
		// and the test still goes RED. The exact mechanism inside Vitest is NOT
		// established here; what is established is that the once-form consumes
		// the implementation on the single call this test makes and the
		// symptom goes away. Recorded as a measurement, not a diagnosis.
		mockCaptureException.mockImplementationOnce(() => {
			throw new Error("sentry transport exploded");
		});
		expect(() => captureBoundaryError(thrown(), "global")).not.toThrow();
		// POSITIVE CONTROL: the throwing implementation was really installed and
		// really reached — otherwise this asserts that a no-op does not throw.
		expect(mockCaptureException).toHaveBeenCalledTimes(1);
	});
});

/**
 * Each boundary is wired, and the wiring is asserted through a real render —
 * a source scan would pass on an effect that never runs.
 */
describe("the four boundaries report", () => {
	const BOUNDARIES = [
		{ name: "global", Component: GlobalError },
		{ name: "auth", Component: AuthError },
		{ name: "debate", Component: DebateRouteError },
		{ name: "profile", Component: ProfileRouteError },
	] as const;

	it.each(
		BOUNDARIES,
	)("boundary-capture::$name reports exactly once on mount", ({
		name,
		Component,
	}) => {
		render(<Component error={thrown("dig-1")} reset={() => {}} />);

		expect(mockCaptureException).toHaveBeenCalledTimes(1);
		expect(tags(0)).toEqual({
			kind: "react_error_boundary",
			boundary: name,
			digest: "dig-1",
		});
	});

	it.each(
		BOUNDARIES,
	)("boundary-capture::$name still renders its apology copy", ({
		Component,
	}) => {
		// The capture is an addition, not a replacement. A boundary that
		// reports and then shows the participant nothing is a worse
		// boundary, and an effect that throws would produce exactly that.
		const { baseElement } = render(
			<Component error={thrown()} reset={() => {}} />,
		);
		expect(baseElement.textContent).toContain("Try again");
	});

	it.each(
		BOUNDARIES,
	)("boundary-capture::$name does not leak the error into the DOM", ({
		Component,
	}) => {
		// SC-1 in miniature: the capture gave every boundary a binding to
		// the error where previously there was none, so the leak assertion
		// has to be re-run against the new shape rather than inherited from
		// the per-boundary suites that predate it.
		const { baseElement } = render(
			<Component error={thrown("SECRET_DIGEST")} reset={() => {}} />,
		);
		const html = baseElement.innerHTML;
		expect(html).toContain("Try again"); // positive control
		expect(html).not.toContain("BOUNDARY_LEAK_pg_connection_refused");
		expect(html).not.toContain("SECRET_DIGEST");
	});

	it("boundary-capture::a-re-render-with-the-same-error-does-not-re-report", () => {
		// The `[error]` dependency is load-bearing, not decoration. React can
		// re-render a boundary for reasons unrelated to the failure; without
		// the dependency each one mints a duplicate Sentry event and the issue
		// count stops meaning anything.
		const err = thrown("dig-2");
		const { rerender } = render(
			<DebateRouteError error={err} reset={() => {}} />,
		);
		rerender(<DebateRouteError error={err} reset={() => {}} />);
		expect(mockCaptureException).toHaveBeenCalledTimes(1);

		// POSITIVE CONTROL: the effect is not simply inert after mount. A
		// genuinely NEW error is a new failure and does report.
		rerender(<DebateRouteError error={thrown("dig-3")} reset={() => {}} />);
		expect(mockCaptureException).toHaveBeenCalledTimes(2);
		expect(tags(1)?.digest).toBe("dig-3");
	});
});
