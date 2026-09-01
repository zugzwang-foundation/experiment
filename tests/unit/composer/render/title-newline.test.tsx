// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { BetComposer } from "@/components/debate/composer/BetComposer";
import { COMPOSER_COPY } from "@/components/debate/composer/copy";

import { composerProps, EXTENDED, stubWireFetch } from "./_harness";

/**
 * UI-QUICK change set 11 §3 — NO NEWLINE REACHES THE TITLE, AND THE PROOF IS
 * THE BUILT PAYLOAD.
 *
 * ⚠⚠ WHY THIS FILE EXISTS. There is no title column. `payload.ts` joins the two
 * fields into ONE `comments.body` as `title + "\n\n" + extended`, and the server
 * splits it back with `body.split("\n", 1)[0]` — **the first newline**. So a
 * newline typed into the title does not merely look wrong: it TRUNCATES the
 * derived title everywhere it is read — the debate card, the pop-up, the
 * Discovery hero, both profile surfaces, and the ADR-0025 `.md` export. With two
 * newlines it would additionally push the remainder of the title into the
 * *teaser*.
 *
 * ⛔⛔ THE DEFENCE LOST A LAYER AND HAD TO GAIN ONE. Until CS11 the title was an
 * `<input>`, which CANNOT hold a newline — a structural guarantee — with an
 * onChange strip behind it as the paste belt. Making the field multi-line
 * removes the structural layer. `onKeyDown` blocking Enter replaces it, and the
 * strip is kept verbatim for the paths a key handler never sees: paste, drop,
 * IME composition.
 *
 * ⛔ AND THE ASSERTION IS ON THE PAYLOAD, NOT ON THE HANDLER. Asserting that a
 * strip exists is not asserting that it fires — the same distinction that made
 * CS7's "source-verified" in-flight guard insufficient. These tests type into
 * the real component, submit, and read the leading segment of the REAL request
 * body off a stubbed fetch.
 *
 * No jest-dom in this repo (AGENTS.md §9) — plain DOM assertions only.
 */

vi.mock("next/navigation", () => ({
	useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
}));

afterEach(() => {
	cleanup();
	vi.unstubAllGlobals();
	vi.clearAllMocks();
});

/** The title segment of the joined body — everything before the `"\n\n"`. */
function submittedTitleSegment(
	fetchStub: ReturnType<typeof vi.fn>,
): string | null {
	for (const call of fetchStub.mock.calls) {
		if (!String(call[0]).includes("/api/bets/place")) {
			continue;
		}
		const init = call[1] as RequestInit | undefined;
		if (typeof init?.body !== "string") {
			continue;
		}
		const body = (JSON.parse(init.body) as { body?: string }).body ?? "";
		return body.split("\n\n")[0] ?? "";
	}
	return null;
}

function fillAndSubmit(title: string, viaPaste: boolean) {
	const field = screen.getByLabelText<HTMLTextAreaElement>("Argument title");
	if (viaPaste) {
		// Paste and drop never reach a key handler — this is the path the strip
		// exists for. jsdom does not synthesise a paste's value change, so the
		// change event carries the pasted text exactly as a real paste would.
		fireEvent.paste(field);
		fireEvent.change(field, { target: { value: title } });
	} else {
		fireEvent.change(field, { target: { value: title } });
	}
	fireEvent.change(
		screen.getByLabelText<HTMLTextAreaElement>("Argument body"),
		{ target: { value: EXTENDED } },
	);
	fireEvent.click(screen.getByRole("button", { name: COMPOSER_COPY.submit }));
}

describe("§3 the title field cannot carry a newline into the payload", () => {
	it("title-newline::a-TYPED-Enter-never-reaches-the-value", () => {
		render(<BetComposer {...composerProps()} />);
		const field = screen.getByLabelText<HTMLTextAreaElement>("Argument title");
		fireEvent.change(field, { target: { value: "First half" } });

		// ⛔ Layer 1. `preventDefault` on Enter means the browser never inserts the
		// newline, so the value is unchanged by the keystroke.
		const notPrevented = fireEvent.keyDown(field, {
			key: "Enter",
			code: "Enter",
		});
		expect(notPrevented).toBe(false); // false ⇒ preventDefault() was called
		expect(field.value).toBe("First half");
		expect(field.value).not.toContain("\n");
	});

	it("title-newline::a-PASTED-multi-line-string-is-stripped-before-the-payload", () => {
		const fetchStub = stubWireFetch([{ status: 200, body: { ok: true } }]);
		render(<BetComposer {...composerProps()} />);

		// ⛔ Layer 2, the path a key handler cannot see.
		fillAndSubmit("Line one\nLine two\r\nLine three", true);

		const segment = submittedTitleSegment(fetchStub);
		expect(segment).not.toBeNull();
		// ⛔⛔ THE ASSERTION THIS FILE EXISTS FOR — read off the real request body.
		expect(segment).not.toContain("\n");
		expect(segment).not.toContain("\r");
		// …and nothing was silently dropped: the newlines became spaces, so the
		// words survive. A strip that truncated instead would pass the line above.
		expect(segment).toContain("Line one");
		expect(segment).toContain("Line three");
	});

	it("title-newline::a-TYPED-multi-line-value-is-stripped-before-the-payload", () => {
		// The non-paste path through the same strip — covers drop and IME, which
		// also arrive as a change event carrying newlines.
		const fetchStub = stubWireFetch([{ status: 200, body: { ok: true } }]);
		render(<BetComposer {...composerProps()} />);
		fillAndSubmit("Alpha\nBeta", false);

		expect(submittedTitleSegment(fetchStub)).not.toContain("\n");
	});

	it("title-newline::the-field-is-fixed-and-cannot-grow-by-content-or-drag", () => {
		// The CS7 §3 rule, applied to the field that just became multi-line: a
		// title that grew with typing would push the submit off screen exactly as
		// the description once did.
		render(<BetComposer {...composerProps()} />);
		const field = screen.getByLabelText<HTMLTextAreaElement>("Argument title");
		const cls = field.getAttribute("class") ?? "";
		expect(cls).toContain("h-[72px]");
		expect(cls).toContain("resize-none");
		expect(cls).toContain("field-sizing-fixed");
		// The cap is untouched by the element swap.
		expect(field.getAttribute("maxlength")).toBe("125");
	});
});
