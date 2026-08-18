import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

import type { OnboardingFigure } from "./cards";

/**
 * The onboarding deck's figure band — THREE KINDS ACROSS SEVEN CARDS, and the
 * split is deliberate rather than incidental (plan D-5, D-7).
 *
 *   · Card 1 — the BRAND MARK, the same `/brand/zugzwang-mark.svg` static asset
 *     `BrandCluster` already renders. Not a port and not new artwork: the card
 *     that states what the product is opens on the product's own mark.
 *   · Card 2 — the SHARED PFP PLACEHOLDER plus the pseudonym-initial fallback,
 *     exactly as `IdentityCluster` renders it.
 *   · Cards 3–7 — the five `FIG` illustrations, ported from the locked W2.2
 *     mockup's inline SVG.
 *
 * ⛔ CARD 2 IS NOT A LIVE PFP, AND THE REGISTER'S FIGURE NOTE IS WRONG ABOUT
 * THAT. There is no live PFP anywhere in this product: every surface renders
 * the one static `/pfp-placeholder.svg`, and `users.pfp_filename` is populated
 * at signup and then deliberately never read by any renderer
 * (`server/debate-view/resolve-authors.ts` says so in its own words). When the
 * real PFP lands it lands in the `resolve*.ts` resolvers that already own the
 * placeholder constant, and this card inherits it the same way every other
 * surface will. A deck-local avatar fetch would create a second PFP path for
 * that migration to unpick, which is why there is no fetch here at all — the
 * pseudonym the card already needs for its title is the only viewer data it
 * touches.
 *
 * ⚠ COLOURS ARRIVE THROUGH THE TOKEN LAYER, never as literals. The mockup's
 * SVGs reference its own `var(--ink)` / `var(--nN)` names; the built tokens are
 * `--color-ink` / `--color-nN`, and `tests/unit/design/no-raw-hex-view-layer.test.ts`
 * auto-scopes every new file under `src/components` — so a hex smuggled in here
 * would go red without anyone adding this path to a list.
 *
 * ⚠ NO `fixed` CLASS ANYWHERE IN THIS TREE. The deck's document-level layer is
 * `DialogContent`'s, which already carries `fixed … z-50`;
 * `tests/unit/shell/sticky-header.test.ts` scans for the `fixed` token and
 * requires every match to stack above the header's `z-40`, so a second
 * positioned layer here would be a new overlay to justify rather than a style.
 */

/** `.cfig` — the 140px illustration band (W2.2 mockup `:76-78`). */
const FIG_BAND =
	"mb-[18px] flex h-[140px] w-full items-center justify-center rounded-(--imgr) bg-n1 [border:var(--hairline)]";

/**
 * `.cfig svg`. `font-sans` sits on the SVG rather than on each `<text>`:
 * `font-family` inherits through SVG, and the mockup's own rule
 * (`.cfig svg text{font-family:var(--sans)}`) is the same idea one selector up.
 */
const FIG_SVG = "block h-[110px] w-auto max-w-[88%] font-sans";

function GoalFigure() {
	// The balance: K · n on one pan outweighing C on the other.
	return (
		<svg viewBox="0 0 220 120" aria-hidden="true" className={FIG_SVG}>
			<line
				x1="110"
				y1="100"
				x2="110"
				y2="40"
				stroke="var(--color-ink)"
				strokeWidth="2"
			/>
			<polygon points="100,108 120,108 110,98" fill="var(--color-ink)" />
			<line
				x1="48"
				y1="58"
				x2="172"
				y2="36"
				stroke="var(--color-ink)"
				strokeWidth="2"
			/>
			<circle cx="110" cy="47" r="3" fill="var(--color-ink)" />
			<line
				x1="48"
				y1="58"
				x2="48"
				y2="72"
				stroke="var(--color-n5)"
				strokeWidth="1.5"
			/>
			<g fill="var(--color-ink)">
				<circle cx="38" cy="78" r="4" />
				<circle cx="48" cy="78" r="4" />
				<circle cx="58" cy="78" r="4" />
				<circle cx="43" cy="87" r="4" />
				<circle cx="53" cy="87" r="4" />
				<circle cx="38" cy="96" r="4" />
				<circle cx="48" cy="96" r="4" />
			</g>
			<text
				x="48"
				y="116"
				textAnchor="middle"
				fontSize="11"
				fontWeight="800"
				fill="var(--color-n6)"
			>
				K · n
			</text>
			<line
				x1="172"
				y1="36"
				x2="172"
				y2="50"
				stroke="var(--color-n5)"
				strokeWidth="1.5"
			/>
			<circle
				cx="172"
				cy="63"
				r="13"
				fill="none"
				stroke="var(--color-n4)"
				strokeWidth="2"
			/>
			<text
				x="172"
				y="68"
				textAnchor="middle"
				fontSize="13"
				fontWeight="800"
				fill="var(--color-n5)"
			>
				C
			</text>
			<text
				x="172"
				y="92"
				textAnchor="middle"
				fontSize="10"
				fontWeight="700"
				fill="var(--color-n5)"
			>
				capital
			</text>
		</svg>
	);
}

function VoiceFigure() {
	// A voice (speech bubble) that carries a stake (Đ).
	return (
		<svg viewBox="0 0 220 120" aria-hidden="true" className={FIG_SVG}>
			<rect
				x="66"
				y="24"
				width="88"
				height="54"
				rx="14"
				fill="var(--color-n0)"
				stroke="var(--color-ink)"
				strokeWidth="2"
			/>
			<polygon points="86,74 86,96 104,76" fill="var(--color-n0)" />
			<line
				x1="86"
				y1="78"
				x2="86"
				y2="95"
				stroke="var(--color-ink)"
				strokeWidth="2"
			/>
			<line
				x1="88"
				y1="94"
				x2="103"
				y2="78"
				stroke="var(--color-ink)"
				strokeWidth="2"
			/>
			<text
				x="110"
				y="60"
				textAnchor="middle"
				fontSize="27"
				fontWeight="800"
				fill="var(--color-ink)"
			>
				Đ
			</text>
		</svg>
	);
}

function SoulboundFigure() {
	// Your Đ cannot move to another account.
	return (
		<svg viewBox="0 0 220 120" aria-hidden="true" className={FIG_SVG}>
			<circle
				cx="60"
				cy="58"
				r="22"
				fill="var(--color-n0)"
				stroke="var(--color-ink)"
				strokeWidth="2"
			/>
			<text
				x="60"
				y="66"
				textAnchor="middle"
				fontSize="22"
				fontWeight="800"
				fill="var(--color-ink)"
			>
				Đ
			</text>
			<line
				x1="90"
				y1="58"
				x2="146"
				y2="58"
				stroke="var(--color-n4)"
				strokeWidth="2"
			/>
			<polygon points="146,52 158,58 146,64" fill="var(--color-n4)" />
			<circle
				cx="176"
				cy="58"
				r="13"
				fill="none"
				stroke="var(--color-n4)"
				strokeWidth="2"
				strokeDasharray="3 3"
			/>
			<g stroke="var(--color-ink)" strokeWidth="3.5" strokeLinecap="round">
				<line x1="110" y1="44" x2="128" y2="72" />
				<line x1="128" y1="44" x2="110" y2="72" />
			</g>
		</svg>
	);
}

function SideFigure() {
	// Pick one side — YES black / NO white, per INV-3's encoding.
	return (
		<svg viewBox="0 0 220 120" aria-hidden="true" className={FIG_SVG}>
			<rect x="40" y="56" width="70" height="26" fill="var(--color-ink)" />
			<rect x="110" y="56" width="70" height="26" fill="var(--color-n0)" />
			<rect
				x="40"
				y="56"
				width="140"
				height="26"
				fill="none"
				stroke="var(--color-ink)"
				strokeWidth="2"
			/>
			<line
				x1="110"
				y1="56"
				x2="110"
				y2="82"
				stroke="var(--color-ink)"
				strokeWidth="2"
			/>
			<text
				x="75"
				y="74"
				textAnchor="middle"
				fontSize="11"
				fontWeight="800"
				fill="var(--color-n0)"
			>
				YES
			</text>
			<text
				x="145"
				y="74"
				textAnchor="middle"
				fontSize="11"
				fontWeight="800"
				fill="var(--color-ink)"
			>
				NO
			</text>
			<g transform="translate(67,26)">
				<rect
					x="0"
					y="9"
					width="16"
					height="12"
					rx="2"
					fill="var(--color-ink)"
				/>
				<path
					d="M3 9 V6 a5 5 0 0 1 10 0 V9"
					fill="none"
					stroke="var(--color-ink)"
					strokeWidth="2"
				/>
			</g>
		</svg>
	);
}

function ReplyFigure() {
	// A reply is a bet — Support black / Counter white.
	return (
		<svg viewBox="0 0 220 120" aria-hidden="true" className={FIG_SVG}>
			<rect
				x="74"
				y="12"
				width="72"
				height="30"
				rx="6"
				fill="var(--color-n0)"
				stroke="var(--color-ink)"
				strokeWidth="2"
			/>
			<line
				x1="84"
				y1="23"
				x2="136"
				y2="23"
				stroke="var(--color-n3)"
				strokeWidth="3"
			/>
			<line
				x1="84"
				y1="31"
				x2="120"
				y2="31"
				stroke="var(--color-n3)"
				strokeWidth="3"
			/>
			<line
				x1="96"
				y1="42"
				x2="74"
				y2="72"
				stroke="var(--color-n4)"
				strokeWidth="1.5"
			/>
			<line
				x1="124"
				y1="42"
				x2="146"
				y2="72"
				stroke="var(--color-n4)"
				strokeWidth="1.5"
			/>
			<rect
				x="34"
				y="74"
				width="78"
				height="26"
				rx="13"
				fill="var(--color-ink)"
			/>
			<text
				x="73"
				y="91"
				textAnchor="middle"
				fontSize="10.5"
				fontWeight="800"
				fill="var(--color-n0)"
			>
				SUPPORT
			</text>
			<rect
				x="114"
				y="74"
				width="78"
				height="26"
				rx="13"
				fill="var(--color-n0)"
				stroke="var(--color-ink)"
				strokeWidth="2"
			/>
			<text
				x="153"
				y="91"
				textAnchor="middle"
				fontSize="10.5"
				fontWeight="800"
				fill="var(--color-ink)"
			>
				COUNTER
			</text>
		</svg>
	);
}

function BrandHero() {
	return (
		<div className={FIG_BAND}>
			{/* biome-ignore lint/performance/noImgElement: static brand svg — next/image's optimizer refuses svg by default and buys nothing here. */}
			<img
				src="/brand/zugzwang-mark.svg"
				alt=""
				width={110}
				height={110}
				className="block h-[110px] w-auto"
			/>
		</div>
	);
}

/**
 * `.idhero` — an 84px rounded-square frame (W2.2 mockup `:79-81`).
 *
 * The RADIUS AND THE BORDER LIVE ON THE FRAME, and the avatar is squared off
 * inside it. The primitive is round by default and carries its own ring, so
 * overriding both on the primitive would leave two radius utilities racing in
 * the compiled sheet; letting the frame clip via `overflow-hidden` is one
 * declaration with no ambiguity. The placeholder asset is a full-bleed square,
 * so it fills the frame edge to edge.
 */
function IdentityHero({ pseudonym }: { pseudonym: string | null }) {
	return (
		<div className="mb-[18px] flex size-[84px] items-center justify-center overflow-hidden rounded-(--imgr) bg-n1 [border:1.5px_solid_var(--color-ink)]">
			<Avatar className="size-full rounded-none after:hidden">
				<AvatarImage
					src="/pfp-placeholder.svg"
					alt=""
					className="rounded-none"
				/>
				<AvatarFallback className="rounded-none text-[28px] font-extrabold">
					{pseudonym?.charAt(0) ?? ""}
				</AvatarFallback>
			</Avatar>
		</div>
	);
}

export function CardFigure({
	figure,
	pseudonym,
}: {
	figure: OnboardingFigure;
	pseudonym: string | null;
}) {
	switch (figure) {
		case "brand":
			return <BrandHero />;
		case "identity":
			return <IdentityHero pseudonym={pseudonym} />;
		case "goal":
			return (
				<div className={FIG_BAND}>
					<GoalFigure />
				</div>
			);
		case "voice":
			return (
				<div className={FIG_BAND}>
					<VoiceFigure />
				</div>
			);
		case "soulbound":
			return (
				<div className={FIG_BAND}>
					<SoulboundFigure />
				</div>
			);
		case "side":
			return (
				<div className={FIG_BAND}>
					<SideFigure />
				</div>
			);
		case "reply":
			return (
				<div className={FIG_BAND}>
					<ReplyFigure />
				</div>
			);
	}
}
