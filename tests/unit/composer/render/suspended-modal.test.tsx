// @vitest-environment jsdom

import {
	cleanup,
	fireEvent,
	render,
	screen,
	within,
} from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { BetComposer } from "@/components/debate/composer/BetComposer";
import {
	COMPOSER_COPY,
	SUSPENDED_COPY,
} from "@/components/debate/composer/copy";
import { SlotHeader } from "@/components/debate/composer/SlotHeader";

import { composerProps, stubWireFetch, TITLE, wireError } from "./_harness";

/**
 * OQ-7c R-4 — TRACK-A/BANNED FINAL: the suspended modal (the Dialog block
 * embedded in BetComposer — no dedicated component exists as-built) renders
 * the copy.ts suspended copy verbatim; single OK affordance; zero
 * retry/resubmit controls; and once the terminal propagates through the
 * as-built `onSuspended` prop (BetComposer → host `suspended` state →
 * SlotHeader), the entry/submit affordances render disabled.
 */

vi.mock("next/navigation", () => ({
	useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
}));

afterEach(() => {
	cleanup();
	vi.unstubAllGlobals();
	vi.clearAllMocks();
});

function typeAndSubmit() {
	fireEvent.change(screen.getByLabelText<HTMLInputElement>("Argument title"), {
		target: { value: TITLE },
	});
	fireEvent.click(screen.getByRole("button", { name: COMPOSER_COPY.submit }));
}

describe("BetComposer suspended modal (R-4)", () => {
	it("render::track-a-modal-copy-verbatim-single-ok-zero-retry", async () => {
		stubWireFetch([
			{ status: 403, body: wireError("comment_track_a_blocked") },
		]);
		render(<BetComposer {...composerProps()} />);
		typeAndSubmit();
		const dialog = await screen.findByRole("dialog");
		expect(
			within(dialog).getByText(SUSPENDED_COPY.trackA.title).textContent,
		).toBe(SUSPENDED_COPY.trackA.title);
		expect(
			within(dialog).getByText(SUSPENDED_COPY.trackA.body).textContent,
		).toBe(SUSPENDED_COPY.trackA.body);
		// Single OK affordance; no retry/resubmit control reaches the modal.
		expect(
			within(dialog).getAllByRole("button", {
				name: SUSPENDED_COPY.trackA.action,
			}),
		).toHaveLength(1);
		// W2.11 / CD-A single-OK anatomy: exactly ONE button TOTAL in the
		// suspended dialog (the OK affordance) — the shadcn default X-close is
		// stripped at the call site (showCloseButton={false}), never reachable.
		expect(within(dialog).getAllByRole("button")).toHaveLength(1);
		expect(within(dialog).queryByRole("button", { name: /close/i })).toBeNull();
		expect(
			within(dialog).queryByRole("button", {
				name: /retry|try again|resubmit/i,
			}),
		).toBeNull();
		expect(within(dialog).queryByText(COMPOSER_COPY.submit)).toBeNull();
		// The composer's own submit renders disabled under the P2 terminal
		// (queried by text: the modal marks the backgrounded tree aria-hidden).
		expect(
			screen.getByText(COMPOSER_COPY.submit).hasAttribute("disabled"),
		).toBe(true);
	});

	it("render::banned-variant-renders-the-banned-body-verbatim", async () => {
		stubWireFetch([{ status: 403, body: wireError("banned_user") }]);
		render(<BetComposer {...composerProps()} />);
		typeAndSubmit();
		const dialog = await screen.findByRole("dialog");
		expect(
			within(dialog).getByText(SUSPENDED_COPY.banned.title).textContent,
		).toBe(SUSPENDED_COPY.banned.title);
		expect(
			within(dialog).getByText(SUSPENDED_COPY.banned.body).textContent,
		).toBe(SUSPENDED_COPY.banned.body);
	});

	it("render::ok-dismiss-fires-the-as-built-onSuspended-prop", async () => {
		const onSuspended = vi.fn();
		const onClose = vi.fn();
		stubWireFetch([
			{ status: 403, body: wireError("comment_track_a_blocked") },
		]);
		render(<BetComposer {...composerProps({ onSuspended, onClose })} />);
		typeAndSubmit();
		const dialog = await screen.findByRole("dialog");
		fireEvent.click(
			within(dialog).getByRole("button", {
				name: SUSPENDED_COPY.trackA.action,
			}),
		);
		expect(onSuspended).toHaveBeenCalledTimes(1);
		expect(onClose).toHaveBeenCalledTimes(1);
	});

	it("render::entry-affordance-disabled-once-suspended-propagates", () => {
		// The host half of the propagation: DebateView feeds onSuspended into
		// its `suspended` state, which SlotHeader turns into a dead entry.
		const onToggleEntry = vi.fn();
		render(
			<SlotHeader
				side="YES"
				pricing={null}
				unitToWin={null}
				viewer={null}
				marketOpen={true}
				suspended={true}
				composerOpen={false}
				onToggleEntry={onToggleEntry}
			/>,
		);
		const entry = screen.getByRole("button", { name: "Đ BET YES" });
		expect(entry.hasAttribute("disabled")).toBe(true);
		expect(entry.getAttribute("aria-disabled")).toBe("true");
		fireEvent.click(entry);
		expect(onToggleEntry).not.toHaveBeenCalled();
		cleanup();
		// Control: the same header un-suspended renders a live entry.
		render(
			<SlotHeader
				side="YES"
				pricing={null}
				unitToWin={null}
				viewer={null}
				marketOpen={true}
				suspended={false}
				composerOpen={false}
				onToggleEntry={onToggleEntry}
			/>,
		);
		expect(
			screen
				.getByRole("button", { name: "Đ BET YES" })
				.hasAttribute("disabled"),
		).toBe(false);
	});
});
