// @vitest-environment jsdom
import { act, cleanup, fireEvent, render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * MIRROR-1 · G2 + RF-5 / RF-6 — the detail toggle is a VIEW change and nothing
 * else. The image stays attached (and its preview on screen when it comes back),
 * the detail stays typed, and the submit carries both whichever view is showing.
 * Plus the slide's mechanics: the outgoing view is held, inert, for one duration
 * and then hidden; `prefers-reduced-motion` skips the hold.
 */

vi.mock("next/navigation", () => ({
	useRouter: () => ({
		refresh: () => undefined,
		push: () => undefined,
		replace: () => undefined,
		back: () => undefined,
		forward: () => undefined,
		prefetch: () => undefined,
	}),
}));

const flag = vi.hoisted(() => ({ imageAttach: true as boolean | undefined }));
vi.mock("@/lib/posthog/use-flag", () => ({
	useFlag: (_name: string, fallback: boolean) => flag.imageAttach ?? fallback,
}));

import { BetComposer } from "@/components/debate/composer/BetComposer";
import type { MirrorContext } from "@/components/debate/composer/MirrorComposer";

import { composerProps, EXTENDED, TITLE } from "./_harness";

const MIRROR: MirrorContext = {
	author: { pseudonym: "OliveBeaver000", pfpUrl: null },
	pricing: { yes: "0.100000000000000000", no: "0.900000000000000000" },
};
const UPLOAD_ID = "0190c0de-0000-7000-8000-0000000000g2";

const urlStatics = URL as unknown as {
	createObjectURL?: (blob: Blob) => string;
	revokeObjectURL?: (url: string) => void;
};

let placed: string[] = [];
let revoked: string[] = [];
let reduceMotion = false;

beforeEach(() => {
	placed = [];
	revoked = [];
	reduceMotion = false;
	flag.imageAttach = true;
	vi.stubGlobal(
		"fetch",
		vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
			const url = String(input);
			if (url === "/api/uploads/sign") {
				return new Response(
					JSON.stringify({
						ok: true,
						data: {
							uploadId: UPLOAD_ID,
							putUrl: "https://r2.example.invalid/put/g2",
						},
					}),
					{ status: 200, headers: { "content-type": "application/json" } },
				);
			}
			if (url === "/api/bets/place") {
				placed.push(String(init?.body));
				return new Response(
					JSON.stringify({ ok: true, data: { commentId: "cmt-g2" } }),
					{ status: 200, headers: { "content-type": "application/json" } },
				);
			}
			return new Response(JSON.stringify({}), { status: 200 });
		}),
	);
	urlStatics.createObjectURL = () => "blob:g2/preview";
	urlStatics.revokeObjectURL = (u: string) => {
		revoked.push(u);
	};
	vi.stubGlobal(
		"matchMedia",
		(query: string) =>
			({
				matches: query.includes("prefers-reduced-motion") && reduceMotion,
				media: query,
				addEventListener: () => undefined,
				removeEventListener: () => undefined,
			}) as unknown as MediaQueryList,
	);
});

afterEach(() => {
	cleanup();
	vi.useRealTimers();
	vi.unstubAllGlobals();
	urlStatics.createObjectURL = undefined;
	urlStatics.revokeObjectURL = undefined;
});

async function settle() {
	for (let i = 0; i < 25; i++) {
		await act(async () => {
			await Promise.resolve();
		});
	}
}

function view(root: ParentNode, which: "image" | "detail"): HTMLElement {
	const el = root.querySelector(`[data-mirror-view="${which}"]`);
	if (!(el instanceof HTMLElement)) {
		throw new Error(`no ${which} view`);
	}
	return el;
}

function toggle(root: ParentNode): HTMLButtonElement {
	const el = root.querySelector('[data-testid="mirror-detail-toggle"]');
	if (!(el instanceof HTMLButtonElement)) {
		throw new Error("no toggle");
	}
	return el;
}

async function attach(container: HTMLElement) {
	const input = container.querySelector('input[type="file"]');
	if (!(input instanceof HTMLInputElement)) {
		throw new Error("no file input");
	}
	await act(async () => {
		fireEvent.change(input, {
			target: {
				files: [new File(["g"], "chart.png", { type: "image/png" })],
			},
		});
	});
	await settle();
}

function mount() {
	return render(<BetComposer {...composerProps()} mirror={MIRROR} />);
}

describe("MIRROR-1 RF-5 — the toggle's three labels and its pressed state", () => {
	it("mirror-toggle::add-detail-then-show-image-then-edit-detail", () => {
		const { container, getByLabelText } = mount();
		const t = toggle(container);
		expect(t.textContent).toBe("Add detail");
		expect(t.getAttribute("aria-pressed")).toBe("false");
		fireEvent.click(t);
		expect(t.textContent).toBe("Show image");
		expect(t.getAttribute("aria-pressed")).toBe("true");
		fireEvent.change(getByLabelText("Argument body"), {
			target: { value: EXTENDED },
		});
		fireEvent.click(t);
		expect(t.textContent).toBe("Edit detail");
		expect(t.getAttribute("aria-pressed")).toBe("false");
	});

	it("mirror-toggle::whitespace-only-detail-is-still-add-detail", () => {
		// "Detail has text" is the wire's own test: whitespace-only detail is not
		// sent (`composeWireBody`), so it must not claim to be editable text.
		const { container, getByLabelText } = mount();
		fireEvent.click(toggle(container));
		fireEvent.change(getByLabelText("Argument body"), {
			target: { value: "   " },
		});
		fireEvent.click(toggle(container));
		expect(toggle(container).textContent).toBe("Add detail");
	});

	it("mirror-toggle::the-toggle-sits-in-the-title-row-after-the-title", () => {
		const { container, getByLabelText } = mount();
		const title = getByLabelText("Argument title");
		const t = toggle(container);
		// Same row, title first — the focus order title → toggle → media.
		expect(title.closest("div")?.parentElement).toBe(t.parentElement);
		expect(
			title.compareDocumentPosition(t) & Node.DOCUMENT_POSITION_FOLLOWING,
		).toBeTruthy();
	});
});

describe("MIRROR-1 G2 — toggling never drops the image or the detail", () => {
	it("mirror-toggle::the-image-stays-attached-and-its-preview-survives-the-round-trip", async () => {
		const { container } = mount();
		await attach(container);
		const img = () => view(container, "image").querySelector("img");
		expect(img()?.getAttribute("src")).toBe("blob:g2/preview");
		vi.useFakeTimers();
		fireEvent.click(toggle(container));
		act(() => {
			vi.advanceTimersByTime(300);
		});
		// Hidden, not unmounted: the preview element is still there, unrevoked.
		expect(view(container, "image").hidden).toBe(true);
		expect(img()?.getAttribute("src")).toBe("blob:g2/preview");
		expect(revoked).not.toContain("blob:g2/preview");
		fireEvent.click(toggle(container));
		act(() => {
			vi.advanceTimersByTime(300);
		});
		expect(view(container, "image").hidden).toBe(false);
		expect(img()?.getAttribute("src")).toBe("blob:g2/preview");
	});

	it("mirror-toggle::submitted-from-the-detail-view-the-body-carries-image-and-detail", async () => {
		const { container, getByLabelText, getByRole } = mount();
		fireEvent.change(getByLabelText("Argument title"), {
			target: { value: TITLE },
		});
		await attach(container);
		fireEvent.click(toggle(container));
		fireEvent.change(getByLabelText("Argument body"), {
			target: { value: EXTENDED },
		});
		// Submitted WHILE the detail view shows.
		expect(view(container, "detail").hidden).toBe(false);
		await act(async () => {
			fireEvent.click(getByRole("button", { name: "PLACE Đ BET" }));
		});
		await settle();
		expect(placed).toHaveLength(1);
		const body = JSON.parse(placed[0]) as Record<string, string>;
		expect(body.imageUploadsId).toBe(UPLOAD_ID);
		expect(body.body).toBe(`${TITLE}\n\n${EXTENDED}`);
	});

	it("mirror-toggle::submitted-from-the-image-view-the-body-still-carries-the-detail", async () => {
		const { container, getByLabelText, getByRole } = mount();
		fireEvent.change(getByLabelText("Argument title"), {
			target: { value: TITLE },
		});
		fireEvent.click(toggle(container));
		fireEvent.change(getByLabelText("Argument body"), {
			target: { value: EXTENDED },
		});
		fireEvent.click(toggle(container));
		await attach(container);
		// Submitted WHILE the image view shows; the detail is out of sight.
		expect(view(container, "image").hidden).toBe(false);
		await act(async () => {
			fireEvent.click(getByRole("button", { name: "PLACE Đ BET" }));
		});
		await settle();
		expect(placed).toHaveLength(1);
		const body = JSON.parse(placed[0]) as Record<string, string>;
		expect(body.imageUploadsId).toBe(UPLOAD_ID);
		expect(body.body).toBe(`${TITLE}\n\n${EXTENDED}`);
	});
});

describe("MIRROR-1 RF-6 — the switch's slide", () => {
	it("mirror-toggle::the-outgoing-view-is-held-inert-for-one-duration-then-hidden", () => {
		vi.useFakeTimers();
		const { container } = mount();
		const image = view(container, "image");
		const detail = view(container, "detail");
		// At rest: image shown, detail hidden — and nothing animates on first render.
		expect(image.getAttribute("data-view-state")).toBe("shown");
		expect(image.className).not.toContain("animate-in");
		expect(detail.hidden).toBe(true);
		fireEvent.click(toggle(container));
		// During the slide: detail enters from the right, image leaves to the left,
		// out of reach.
		expect(detail.getAttribute("data-view-state")).toBe("shown");
		expect(detail.className).toContain("slide-in-from-right-[36px]");
		expect(image.getAttribute("data-view-state")).toBe("leaving");
		expect(image.className).toContain("slide-out-to-left-[36px]");
		expect(image.hasAttribute("inert")).toBe(true);
		expect(image.getAttribute("aria-hidden")).toBe("true");
		act(() => {
			vi.advanceTimersByTime(259);
		});
		expect(image.getAttribute("data-view-state")).toBe("leaving");
		act(() => {
			vi.advanceTimersByTime(1);
		});
		expect(image.getAttribute("data-view-state")).toBe("hidden");
		expect(image.hidden).toBe(true);
	});

	it("mirror-toggle::reduced-motion-swaps-with-no-hold", () => {
		reduceMotion = true;
		const { container } = mount();
		fireEvent.click(toggle(container));
		expect(view(container, "image").getAttribute("data-view-state")).toBe(
			"hidden",
		);
		expect(view(container, "detail").getAttribute("data-view-state")).toBe(
			"shown",
		);
	});

	it("mirror-toggle::moving-to-detail-focuses-the-detail-field-and-back-leaves-it-on-the-toggle", async () => {
		const { container, getByLabelText } = mount();
		const t = toggle(container);
		t.focus();
		await act(async () => {
			fireEvent.click(t);
		});
		expect(document.activeElement).toBe(getByLabelText("Argument body"));
		t.focus();
		await act(async () => {
			fireEvent.click(t);
		});
		expect(document.activeElement).toBe(t);
	});
});

describe("MIRROR-1 — focus across the switch (@code-reviewer L6)", () => {
	it("mirror-toggle::leaving-the-detail-field-by-click-lands-focus-on-the-toggle", async () => {
		// jsdom's `click()` does not focus the button it clicks — which is exactly
		// Safari's behaviour, and the case that dropped focus to <body>.
		const { container, getByLabelText } = mount();
		await act(async () => {
			fireEvent.click(toggle(container));
		});
		const detail = getByLabelText("Argument body");
		expect(document.activeElement).toBe(detail);
		await act(async () => {
			fireEvent.click(toggle(container));
		});
		expect(document.activeElement).toBe(toggle(container));
	});

	it("mirror-toggle::a-switch-with-focus-elsewhere-does-not-steal-it", async () => {
		const { container, getByLabelText } = mount();
		await act(async () => {
			fireEvent.click(toggle(container));
		});
		const title = getByLabelText("Argument title");
		title.focus();
		await act(async () => {
			fireEvent.click(toggle(container));
		});
		// Focus was in the title, not the detail field: it stays there.
		expect(document.activeElement).toBe(title);
	});
});

describe("MIRROR-1 — the image-attach brake (ADR-0052) leaves the detail view", () => {
	it("mirror-toggle::flag-off-no-toggle-no-image-view-detail-shown", () => {
		flag.imageAttach = false;
		const { container, getByLabelText } = mount();
		expect(
			container.querySelector('[data-testid="mirror-detail-toggle"]'),
		).toBeNull();
		expect(container.querySelector('[data-mirror-view="image"]')).toBeNull();
		expect(container.querySelector('input[type="file"]')).toBeNull();
		expect(view(container, "detail").hidden).toBe(false);
		// Positive control: the detail field is reachable.
		expect(getByLabelText("Argument body")).toBeTruthy();
	});
});

describe("MIRROR-2 RF-6 — focus: the frame's edge lifts; buttons ring for the keyboard only", () => {
	function frame(root: ParentNode): HTMLElement {
		const el = root.querySelector('[data-testid="mirror-media-frame"]');
		if (!(el instanceof HTMLElement)) {
			throw new Error("no frame");
		}
		return el;
	}
	/** The class list as TOKENS — a substring test cannot tell `border-n3` from `focus-within:border-n3`. */
	const tokens = (el: Element) => (el.getAttribute("class") ?? "").split(/\s+/);

	it("mirror-toggle::the-detail-field-draws-no-ring-outline-or-glow", () => {
		const { container, getByLabelText } = mount();
		fireEvent.click(toggle(container));
		const detail = getByLabelText("Argument body");
		expect(detail.className).not.toMatch(
			/focus(-visible|-within)?:(shadow|ring|outline)/,
		);
		expect(tokens(detail)).toContain("outline-none");
		// Positive control: the same pattern sees the toggle's keyboard ring.
		expect(toggle(container).className).toMatch(
			/focus(-visible|-within)?:(shadow|ring|outline)/,
		);
	});

	it("mirror-toggle::in-the-detail-view-the-frame-edge-is-n2-and-lifts-to-n3-on-focus", () => {
		const { container } = mount();
		fireEvent.click(toggle(container));
		const edge = tokens(frame(container));
		expect(edge).toContain("border-n2");
		expect(edge).toContain("focus-within:border-n3");
		// n3 only as the lift, never at rest.
		expect(edge).not.toContain("border-n3");
	});

	it("mirror-toggle::the-image-view-frame-never-lifts-for-its-own-buttons", async () => {
		const { container } = mount();
		// Empty: the dashed n3 invitation.
		expect(tokens(frame(container))).toEqual(
			expect.arrayContaining(["border-dashed", "border-n3"]),
		);
		expect(frame(container).className).not.toContain("focus-within:");
		await attach(container);
		// Attached: solid n2, and still no lift.
		expect(tokens(frame(container))).toContain("border-n2");
		expect(frame(container).className).not.toContain("focus-within:");
	});

	it("mirror-toggle::every-composer-button-rings-only-under-focus-visible", async () => {
		const { container, getAllByRole } = mount();
		await attach(container);
		const shell = container.querySelector('[data-testid="mirror-composer"]');
		if (!(shell instanceof HTMLElement)) throw new Error("no shell");
		const buttons = [...shell.querySelectorAll("button")];
		// Positive control: the buttons this rule is about are all here.
		const names = buttons.map(
			(b) => b.getAttribute("aria-label") ?? b.textContent,
		);
		expect(names).toEqual(
			expect.arrayContaining([
				"Close",
				"Add detail",
				"Replace",
				"Remove image",
				"PLACE Đ BET",
			]),
		);
		expect(getAllByRole("button").length).toBeGreaterThanOrEqual(5);
		for (const b of buttons) {
			const cls = b.getAttribute("class") ?? "";
			// A ring may be drawn ONLY behind `focus-visible:` — never plain
			// `focus:`, which a mouse click also matches.
			expect(cls).not.toMatch(/(^|\s)focus:(shadow|ring|outline|border)/);
			expect(tokens(b)).toContain("outline-none");
		}
	});

	it("mirror-toggle::leaving-the-detail-field-by-click-moves-focus-without-a-ring", async () => {
		// The L6 move (Safari: a clicked button takes no focus) follows a POINTER
		// press, so it must not claim keyboard focus-visibility.
		const { container, getByLabelText } = mount();
		await act(async () => {
			fireEvent.click(toggle(container));
		});
		expect(document.activeElement).toBe(getByLabelText("Argument body"));
		const t = toggle(container);
		const focus = vi.spyOn(t, "focus");
		await act(async () => {
			fireEvent.click(t);
		});
		expect(document.activeElement).toBe(t);
		expect(focus).toHaveBeenCalledWith({ focusVisible: false });
	});
});
