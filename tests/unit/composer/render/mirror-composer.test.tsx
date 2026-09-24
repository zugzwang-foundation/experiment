// @vitest-environment jsdom
import { act, cleanup, fireEvent, render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * MIRROR-1 · S3 — the Mirror composer's POST variant, rendered through
 * `BetComposer` exactly as a desktop mount will render it (with a `mirror`
 * context). `docs/design/composer-mirror.md` RF-1, RF-3, RF-4, RF-6 (image view)
 * and RF-7, plus guards G3 (render), G4 and G5.
 *
 * Elements are found by accessible name or by `data-testid`, never by a styling
 * class (OVN-V5). Where a class IS the assertion — the frame's 16:9 rule, the
 * submit's pole — it is read off the element the testid already found.
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

import { BetComposer } from "@/components/debate/composer/BetComposer";
import { c2Sentence, overCapStrip } from "@/components/debate/composer/copy";
import { floorFor } from "@/components/debate/composer/gating";
import type { MirrorContext } from "@/components/debate/composer/MirrorComposer";
import { formatDharma } from "@/components/debate/format";
import { BET_MAX_STAKE, BET_MIN_STAKE_POST } from "@/server/config/limits";

import { composerProps, TITLE, VIEWER } from "./_harness";

const MIRROR: MirrorContext = {
	author: { pseudonym: "OliveBeaver000", pfpUrl: "/pfp-placeholder.svg" },
	pricing: { yes: "0.100000000000000000", no: "0.900000000000000000" },
};

const urlStatics = URL as unknown as {
	createObjectURL?: (blob: Blob) => string;
	revokeObjectURL?: (url: string) => void;
};

let placedBodies: string[] = [];

beforeEach(() => {
	placedBodies = [];
	vi.stubGlobal(
		"fetch",
		vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
			const url = String(input);
			if (url === "/api/uploads/sign") {
				return new Response(
					JSON.stringify({
						ok: true,
						data: {
							uploadId: "0190c0de-0000-7000-8000-0000000000m3",
							putUrl: "https://r2.example.invalid/put/m3",
						},
					}),
					{ status: 200, headers: { "content-type": "application/json" } },
				);
			}
			if (url === "/api/bets/place") {
				placedBodies.push(String(init?.body));
				return new Response(
					JSON.stringify({ ok: true, data: { commentId: "cmt-m3" } }),
					{ status: 200, headers: { "content-type": "application/json" } },
				);
			}
			return new Response(JSON.stringify({}), { status: 200 });
		}),
	);
	urlStatics.createObjectURL = () => "blob:mirror/preview";
	urlStatics.revokeObjectURL = () => undefined;
});

afterEach(() => {
	cleanup();
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

function byTestId<T extends Element = HTMLElement>(
	root: ParentNode,
	id: string,
): T {
	const el = root.querySelector(`[data-testid="${id}"]`);
	if (el === null) {
		throw new Error(`no [data-testid="${id}"]`);
	}
	return el as T;
}

function asTextarea(el: HTMLElement): HTMLTextAreaElement {
	if (!(el instanceof HTMLTextAreaElement)) {
		throw new Error(`expected a textarea, got <${el.tagName.toLowerCase()}>`);
	}
	return el;
}

function mirrorPost(over?: Partial<Parameters<typeof BetComposer>[0]>) {
	return render(<BetComposer {...composerProps()} mirror={MIRROR} {...over} />);
}

async function attach(container: HTMLElement) {
	const input = container.querySelector('input[type="file"]');
	if (!(input instanceof HTMLInputElement)) {
		throw new Error("no file input");
	}
	await act(async () => {
		fireEvent.change(input, {
			target: {
				files: [new File(["m"], "chart.png", { type: "image/png" })],
			},
		});
	});
	await settle();
}

describe("MIRROR-1 RF-1 — the shell and its rows", () => {
	it("mirror::the-mirror-renders-only-when-a-context-is-passed", () => {
		// Positive and negative in one: the same component, with and without the
		// prop. Without it, today's layout (no mirror testid at all).
		const without = render(<BetComposer {...composerProps()} />);
		expect(
			without.container.querySelector('[data-testid="mirror-composer"]'),
		).toBeNull();
		expect(without.container.querySelector("section")).not.toBeNull();
		cleanup();
		const withIt = mirrorPost();
		expect(byTestId(withIt.container, "mirror-composer")).toBeTruthy();
	});

	it("mirror::rows-in-register-order-author-title-frame-then-stake-bar", () => {
		const { container } = mirrorPost();
		const shell = byTestId(container, "mirror-composer");
		const body = byTestId(shell, "mirror-body");
		// The body's rows, in order; the stake bar is the body's SIBLING (pinned).
		const order = [
			byTestId(body, "mirror-author-row"),
			byTestId(body, "mirror-title"),
			byTestId(body, "mirror-media-host"),
		];
		for (let i = 1; i < order.length; i++) {
			expect(
				order[i - 1].compareDocumentPosition(order[i]) &
					Node.DOCUMENT_POSITION_FOLLOWING,
			).toBeTruthy();
		}
		const bar = byTestId(shell, "mirror-stake-bar");
		expect(bar.parentElement).toBe(shell);
		expect(body.contains(bar)).toBe(false);
	});

	it("mirror::the-accessible-name-is-still-place-your-d-bet", () => {
		const { container } = mirrorPost();
		const shell = byTestId(container, "mirror-composer");
		expect(shell.getAttribute("aria-label")).toBe("Place your Đ BET — YES");
		// design-canon §3 rule 5 as MIRROR-1 amended it: the header is no longer
		// SHOWN on the post composer.
		expect(shell.textContent).not.toContain("Place your Đ BET");
	});
});

describe("MIRROR-1 RF-3 — the author row", () => {
	it("mirror::identity-chip-amount-draft-and-close", () => {
		const { container, getByLabelText } = mirrorPost();
		const row = byTestId(container, "mirror-author-row");
		expect(row.textContent).toContain("OliveBeaver000");
		expect(row.textContent).toContain("YES @ 10%");
		expect(byTestId(row, "mirror-amount-echo").textContent).toBe("Đ 10");
		expect(row.textContent).toContain("Draft");
		// Posts: the × is on this row.
		expect(row.contains(getByLabelText("Close"))).toBe(true);
	});

	it("mirror::the-chip-price-is-the-paired-percent-not-an-independent-round", () => {
		// 0.105 — an exact tie. Paired: YES rounds to 11, so NO is 100 − 11 = 89.
		// Rounded on its own, NO's 0.895 would print 90 and disagree with the
		// PriceBar beside it (SPEC.1 §10.8).
		const { container } = render(
			<BetComposer
				{...composerProps()}
				side="NO"
				mirror={{
					...MIRROR,
					pricing: {
						yes: "0.105000000000000000",
						no: "0.895000000000000000",
					},
				}}
			/>,
		);
		const row = byTestId(container, "mirror-author-row");
		expect(row.textContent).toContain("NO @ 89%");
		expect(row.textContent).not.toContain("NO @ 90%");
	});

	it("mirror::no-pricing-shows-the-bare-side", () => {
		const { container } = render(
			<BetComposer
				{...composerProps()}
				mirror={{ ...MIRROR, pricing: null }}
			/>,
		);
		const row = byTestId(container, "mirror-author-row");
		expect(row.textContent).toContain("YES");
		expect(row.textContent).not.toContain("@");
	});

	it("mirror::the-amount-echo-follows-the-input-as-the-card-will-print-it", () => {
		const { container, getByLabelText } = mirrorPost();
		const echo = byTestId(container, "mirror-amount-echo");
		fireEvent.change(getByLabelText("Stake amount"), {
			target: { value: "25" },
		});
		expect(echo.textContent).toBe("Đ 25");
		// Rounded by the one display formatter, as the posted card will be.
		fireEvent.change(getByLabelText("Stake amount"), {
			target: { value: "12.5" },
		});
		expect(echo.textContent).toBe("Đ 13");
		// Above what can be spent → the stake that would actually be placed.
		fireEvent.change(getByLabelText("Stake amount"), {
			target: { value: "500" },
		});
		expect(echo.textContent).toBe(`Đ ${formatDharma(VIEWER.spendableToday)}`);
		fireEvent.change(getByLabelText("Stake amount"), {
			target: { value: "" },
		});
		expect(echo.textContent).toBe("Đ —");
	});
});

describe("MIRROR-1 RF-4 — the title", () => {
	it("mirror::placeholder-name-and-limit-are-todays", () => {
		const { getByLabelText } = mirrorPost();
		const title = asTextarea(getByLabelText("Argument title"));
		expect(title.tagName).toBe("TEXTAREA");
		expect(title.getAttribute("placeholder")).toBe("Your argument — required");
		expect(title.maxLength).toBe(125);
	});

	it("mirror::g3-left-counter-absent-at-114-then-10-at-115-and-0-at-125", () => {
		const { container, getByLabelText } = mirrorPost();
		const title = asTextarea(getByLabelText("Argument title"));
		const left = () =>
			container.querySelector('[data-testid="mirror-title-left"]')
				?.textContent ?? null;
		fireEvent.change(title, { target: { value: "a".repeat(114) } });
		expect(left()).toBeNull();
		fireEvent.change(title, { target: { value: "a".repeat(115) } });
		expect(left()).toBe("10 left");
		fireEvent.change(title, { target: { value: "a".repeat(125) } });
		expect(left()).toBe("0 left");
	});

	it("mirror::a-typed-newline-never-reaches-the-title", () => {
		const { getByLabelText } = mirrorPost();
		const title = asTextarea(getByLabelText("Argument title"));
		// Paste path: the strip.
		fireEvent.change(title, { target: { value: "one\ntwo" } });
		expect(title.value).toBe("one two");
		// Key path: Enter is cancelled at source.
		const enter = new KeyboardEvent("keydown", {
			key: "Enter",
			bubbles: true,
			cancelable: true,
		});
		title.dispatchEvent(enter);
		expect(enter.defaultPrevented).toBe(true);
	});
});

describe("MIRROR-2 RF-4 — the title block, its type and its focus", () => {
	it("mirror::the-composer-opens-with-the-cursor-in-the-title", () => {
		const { getByLabelText } = mirrorPost();
		expect(document.activeElement).toBe(getByLabelText("Argument title"));
	});

	it("mirror::a-c2-composer-does-not-put-the-cursor-in-a-disabled-title", () => {
		// The C2 floor disables every field; a disabled field takes no focus.
		const { getByLabelText } = render(
			<BetComposer
				{...composerProps()}
				viewer={{ ...VIEWER, balance: "5", spendableToday: "5" }}
				mirror={MIRROR}
			/>,
		);
		const title = getByLabelText("Argument title");
		expect(title.hasAttribute("disabled")).toBe(true);
		expect(document.activeElement).not.toBe(title);
	});

	it("mirror::the-block-is-54px-and-rests-at-28px-centred-before-any-measurement", () => {
		// jsdom lays nothing out, so the field rests where an empty field's
		// placeholder sits: 28px on one 35px line, (53 − 35) / 2 = 9px down.
		const { getByLabelText } = mirrorPost();
		const title = asTextarea(getByLabelText("Argument title"));
		expect(title.className).toContain("h-[54px]");
		expect(title.style.fontSize).toBe("28px");
		expect(title.style.lineHeight).toBe("35px");
		expect(title.style.paddingTop).toBe("9px");
		fireEvent.change(title, { target: { value: TITLE } });
		// Typing never touches the block's height.
		expect(title.className).toContain("h-[54px]");
		expect(title.style.height).toBe("");
	});

	it("mirror::size-changes-ease-only-once-the-author-types-and-never-under-reduced-motion", () => {
		const { getByLabelText } = mirrorPost();
		const title = asTextarea(getByLabelText("Argument title"));
		const EASE = "transition-[font-size,line-height,padding-top]";
		// The first fit is not a change the author made: no transition yet.
		expect(title.className).not.toContain(EASE);
		fireEvent.change(title, { target: { value: "Hello" } });
		expect(title.className).toContain(EASE);
		expect(title.className).toContain("duration-150");
		expect(title.className).toContain("ease-[ease]");
		expect(title.className).toContain("motion-reduce:transition-none");
	});

	it("mirror::the-title-shows-no-focus-ring-the-caret-marks-the-place", () => {
		const { container, getByLabelText } = mirrorPost();
		const title = getByLabelText("Argument title");
		expect(title.className).not.toMatch(/focus(-visible)?:shadow/);
		expect(title.className).not.toMatch(/focus(-visible)?:ring/);
		expect(title.className).toContain("outline-none");
		// Positive control: the same pattern finds the toggle's keyboard ring.
		expect(byTestId(container, "mirror-detail-toggle").className).toMatch(
			/focus-visible:shadow/,
		);
	});

	it("mirror::the-measuring-copy-is-hidden-from-everyone", () => {
		const { container, getAllByRole, getByLabelText } = mirrorPost();
		const probe = byTestId(container, "mirror-title-probe");
		expect(probe.tagName).toBe("TEXTAREA");
		expect(probe.getAttribute("aria-hidden")).toBe("true");
		expect(probe.getAttribute("tabindex")).toBe("-1");
		expect(probe.className).toContain("invisible");
		// It is not a field anyone can reach: the only title is the labelled one.
		expect(getByLabelText("Argument title")).not.toBe(probe);
		expect(getAllByRole("textbox")).not.toContain(probe);
	});
});

describe("MIRROR-1 RF-6 — the media frame (image view)", () => {
	it("mirror::the-frame-is-16-by-9-and-min-width-of-both-axes", () => {
		const { container } = mirrorPost();
		const host = byTestId(container, "mirror-media-host");
		const frame = byTestId(container, "mirror-media-frame");
		// jsdom performs no layout, so the geometry is proven in a real browser
		// (run report). This pins the CSS that states the rule.
		expect(host.className).toContain("min-h-[160px]");
		expect(host.className).toContain("[container-type:size]");
		expect(frame.className).toContain("aspect-video");
		expect(frame.className).toContain("w-[min(100cqw,calc(100cqh*16/9))]");
		expect(frame.className).toContain("mx-auto");
	});

	it("mirror::empty-frame-invites-a-pick-with-a-dashed-edge", () => {
		const { container, getByRole } = mirrorPost();
		const pick = getByRole("button", { name: "Add an image" });
		const caption = document.getElementById(
			pick.getAttribute("aria-describedby") ?? "",
		);
		expect(caption?.textContent).toBe(
			"Optional · shown whole · any orientation",
		);
		const frame = byTestId(container, "mirror-media-frame");
		expect(frame.className).toContain("border-dashed");
		expect(frame.contains(pick)).toBe(true);
	});

	it("mirror::attached-shows-the-picture-whole-with-replace-and-remove-and-no-filename", async () => {
		const { container, getByRole } = mirrorPost();
		await attach(container);
		const frame = byTestId(container, "mirror-media-frame");
		const img = frame.querySelector("img");
		expect(img?.getAttribute("src")).toBe("blob:mirror/preview");
		expect(img?.className).toContain("object-contain");
		expect(getByRole("button", { name: "Replace" })).toBeTruthy();
		expect(getByRole("button", { name: "Remove image" })).toBeTruthy();
		expect(frame.textContent).not.toContain("chart.png");
		expect(frame.className).not.toContain("border-dashed");
		// The invitation is gone once a file is in hand.
		expect(
			container.querySelector('button[aria-label="Add an image"]'),
		).toBeNull();
	});

	it("mirror::remove-returns-to-the-invitation", async () => {
		const { container, getByRole } = mirrorPost();
		await attach(container);
		fireEvent.click(getByRole("button", { name: "Remove image" }));
		expect(getByRole("button", { name: "Add an image" })).toBeTruthy();
		expect(
			byTestId(container, "mirror-media-frame").querySelector("img"),
		).toBeNull();
	});
});

describe("MIRROR-1 — review fixes (@code-reviewer M2, L1)", () => {
	it("mirror::the-three-fields-take-the-canon-disabled-treatment", () => {
		// C2 disables every field (the classic's own rule); the Mirror's plain
		// elements must also LOOK disabled, with the canon's one treatment.
		const { getByLabelText } = render(
			<BetComposer
				{...composerProps()}
				viewer={{ ...VIEWER, balance: "5", spendableToday: "5" }}
				mirror={MIRROR}
			/>,
		);
		for (const label of ["Argument title", "Argument body", "Stake amount"]) {
			const field = getByLabelText(label);
			expect(field.hasAttribute("disabled")).toBe(true);
			expect(field.className).toContain(
				"disabled:opacity-(--state-disabled-opacity)",
			);
		}
	});

	it("mirror::an-attach-error-reads-in-place-of-the-caption-and-the-frame-stays-one-target", async () => {
		vi.stubGlobal(
			"fetch",
			vi.fn(async (input: RequestInfo | URL) => {
				if (String(input) === "/api/uploads/sign") {
					return new Response(
						JSON.stringify({
							ok: false,
							error: {
								code: "error_image_mime_rejected",
								message: "unsupported image type",
							},
						}),
						{ status: 400, headers: { "content-type": "application/json" } },
					);
				}
				return new Response(JSON.stringify({}), { status: 200 });
			}),
		);
		const { container, getByRole } = mirrorPost();
		await attach(container);
		const frame = byTestId(container, "mirror-media-frame");
		const status = frame.querySelector('[role="status"]');
		expect(status?.textContent).toBe(
			"unsupported image type Try again in a few seconds.",
		);
		// The caption gives way to the error; the pick is still the whole frame.
		expect(frame.textContent).not.toContain(
			"Optional · shown whole · any orientation",
		);
		const pick = getByRole("button", { name: "Add an image" });
		expect(pick.className).toContain("absolute inset-0");
		expect(pick.hasAttribute("aria-describedby")).toBe(false);
		// The live region is NOT inside the button (it would not be monitored).
		expect(pick.contains(status)).toBe(false);
	});
});

describe("MIRROR-1 RF-7 — the stake bar (G4, G5)", () => {
	it("mirror::g4-limits-render-the-post-floor-and-the-cap-constants", () => {
		const { container } = mirrorPost();
		const limits = byTestId(container, "mirror-limits");
		expect(limits.textContent).toContain(
			`Min Đ ${formatDharma(floorFor("post"))}`,
		);
		expect(limits.textContent).toContain(
			`Max Đ ${formatDharma(BET_MAX_STAKE)}`,
		);
		// And the floor IS the post constant, not a literal that happens to match.
		expect(floorFor("post")).toBe(BET_MIN_STAKE_POST);
	});

	it("mirror::g5-submit-reads-exactly-place-d-bet-on-one-line-and-no-balance-anywhere", () => {
		const { container, getByRole } = mirrorPost();
		const submit = getByRole("button", { name: "PLACE Đ BET" });
		expect(submit.textContent).toBe("PLACE Đ BET");
		// One line: the label is a single text node, with no element children.
		expect(submit.children).toHaveLength(0);
		const shell = byTestId(container, "mirror-composer");
		// Positive control first — the search reads the rendered bar at all.
		expect(shell.textContent).toContain("Min");
		// ⚠ NO WORD BOUNDARY. `textContent` concatenates sibling text with no
		// separator, so a balance line sitting after the body reads
		// `…optionalBalance Đ 810…` and `\bBalance\b` can never match there — the
		// first version of this line passed with a planted balance (MIRROR-1 S6
		// mutation G5b). A plain, case-blind substring has no such blind spot.
		expect(shell.textContent).not.toMatch(/balance/i);
		expect(shell.textContent).not.toContain("spendable");
	});

	it("mirror::the-submit-wears-the-pole-of-the-side-being-bet-both-poles", () => {
		const yes = mirrorPost();
		const yesBtn = yes.getByRole("button", { name: "PLACE Đ BET" });
		expect(yesBtn.className).toContain("bg-yes");
		expect(yesBtn.className).toContain("text-no");
		expect(yesBtn.className).not.toContain("bg-no");
		cleanup();
		const no = render(
			<BetComposer {...composerProps()} side="NO" mirror={MIRROR} />,
		);
		const noBtn = no.getByRole("button", { name: "PLACE Đ BET" });
		expect(noBtn.className).toContain("bg-no");
		expect(noBtn.className).toContain("text-yes");
		expect(noBtn.className).not.toContain("bg-yes");
	});

	it("mirror::a-validation-notice-replaces-min-max-in-place", () => {
		// C2 — spendable below the post floor.
		const { container } = render(
			<BetComposer
				{...composerProps()}
				viewer={{ ...VIEWER, balance: "5", spendableToday: "5" }}
				mirror={MIRROR}
			/>,
		);
		const limits = byTestId(container, "mirror-limits");
		expect(limits.textContent).toBe(
			c2Sentence({ floor: floorFor("post"), spendable: "5" }),
		);
		expect(limits.textContent).not.toContain("Min");
	});

	it("mirror::over-cap-notice-replaces-min-max-and-submit-stays-disabled", () => {
		const { container, getByLabelText, getByRole } = render(
			<BetComposer
				{...composerProps()}
				viewer={{ ...VIEWER, balance: "1000", spendableToday: "1000" }}
				mirror={MIRROR}
			/>,
		);
		fireEvent.change(getByLabelText("Argument title"), {
			target: { value: TITLE },
		});
		fireEvent.change(getByLabelText("Stake amount"), {
			target: { value: "300" },
		});
		expect(byTestId(container, "mirror-limits").textContent).toBe(
			overCapStrip(),
		);
		expect(
			getByRole("button", { name: "PLACE Đ BET" }).hasAttribute("disabled"),
		).toBe(true);
	});
});

describe("MIRROR-1 — the Mirror sends what the classic layout sends", () => {
	/**
	 * The same inputs through both layouts of the same controller; the two request
	 * bodies must be byte-identical. A4 proves this through the real host once the
	 * desktop mounts switch; this proves it for the component on its own, image
	 * included, before they do.
	 */
	async function placeWith(mirror: boolean): Promise<string> {
		placedBodies = [];
		const { container, getByLabelText, getByRole } = render(
			mirror ? (
				<BetComposer {...composerProps()} mirror={MIRROR} />
			) : (
				<BetComposer {...composerProps()} />
			),
		);
		fireEvent.change(getByLabelText("Argument title"), {
			target: { value: TITLE },
		});
		fireEvent.change(getByLabelText("Stake amount"), {
			target: { value: "40" },
		});
		await attach(container);
		await act(async () => {
			fireEvent.click(getByRole("button", { name: "PLACE Đ BET" }));
		});
		await settle();
		cleanup();
		expect(placedBodies).toHaveLength(1);
		return placedBodies[0];
	}

	it("mirror::a-support-reply-with-friendly-fire-on-sends-the-same-bytes-as-the-classic", async () => {
		// FF-1's switch lives in each layout's own place (the classic header row,
		// the Mirror's statement slot) but it is ONE element over ONE state, so the
		// flagged body must match byte for byte — `friendlyFire` included.
		async function flagged(mirror: boolean): Promise<string> {
			placedBodies = [];
			const props = {
				...composerProps(),
				kind: "reply" as const,
				side: "YES" as const,
				parentCommentId: "cmt-p1",
				replyContext: {
					relation: "support" as const,
					authorPseudonym: "BlueWolf472",
				},
			};
			const { getByLabelText, getByRole } = render(
				mirror ? (
					<BetComposer {...props} mirror={MIRROR} />
				) : (
					<BetComposer {...props} />
				),
			);
			fireEvent.change(getByLabelText("Argument title"), {
				target: { value: TITLE },
			});
			fireEvent.click(getByRole("switch", { name: "Friendly fire" }));
			await act(async () => {
				fireEvent.click(getByRole("button", { name: "PLACE Đ BET" }));
			});
			await settle();
			cleanup();
			expect(placedBodies).toHaveLength(1);
			return placedBodies[0];
		}
		const classic = await flagged(false);
		const mirror = await flagged(true);
		expect(classic).toContain('"friendlyFire":true');
		expect(mirror).toBe(classic);
	});

	it("mirror::same-inputs-same-body-bytes-as-the-classic-layout", async () => {
		const classic = await placeWith(false);
		const mirror = await placeWith(true);
		// Positive control: the body carries every input, so equality is not
		// equality of two empty requests.
		expect(classic).toContain('"stake":"40"');
		expect(classic).toContain(
			'"imageUploadsId":"0190c0de-0000-7000-8000-0000000000m3"',
		);
		expect(classic).toContain(TITLE);
		expect(mirror).toBe(classic);
	});
});
