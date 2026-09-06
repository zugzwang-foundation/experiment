"use client";

import { useRouter } from "next/navigation";
import { type FormEvent, type ReactElement, useState } from "react";
import { AuthAlert } from "@/app/(auth)/_components/AuthAlert";
import { Wordmark } from "@/components/shell/Wordmark";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { authClient } from "@/lib/auth-client";
import { MOBILE_AUTH_MESSAGE } from "@/lib/copy/device-gate";

// F-AUTH-1 + F-AUTH-2 sign-in landing per plan §4 page inventory.
// Client component (per SCAFFOLD.3-FOLLOWUP-1 §2) — Better Auth's
// better-call enforces JSON-only on /sign-in/social and the email-OTP
// endpoints, so native form POSTs return 415. The SDK wraps fetch with
// the correct Content-Type and surface-specific transport (Q6: header
// `x-turnstile-token` for the Turnstile gate, not body). Visual
// treatment (typography, spacing, brand colors) deferred to DESIGN.1
// + DESIGN.7 per plan §8 out-of-scope.

export default function SignInPage(): ReactElement {
	const router = useRouter();
	const [emailLoading, setEmailLoading] = useState(false);
	const [emailError, setEmailError] = useState<string | null>(null);
	const [googleLoading, setGoogleLoading] = useState(false);
	const [googleError, setGoogleError] = useState<string | null>(null);

	async function handleGoogle(
		event: FormEvent<HTMLFormElement>,
	): Promise<void> {
		event.preventDefault();
		setGoogleError(null);
		setGoogleLoading(true);
		try {
			// Per §5 exit criterion #2 (LOW-2 correction): the route returns
			// HTTP 200 JSON `{url, redirect: true}`; the SDK's redirectPlugin
			// then assigns window.location.href to data.url, navigating the
			// browser to Google's consent screen.
			await authClient.signIn.social({
				provider: "google",
				callbackURL: "/",
			});
		} catch (err) {
			setGoogleError(err instanceof Error ? err.message : "sign_in_failed");
		} finally {
			setGoogleLoading(false);
		}
	}

	async function handleEmailOtp(
		event: FormEvent<HTMLFormElement>,
	): Promise<void> {
		event.preventDefault();
		setEmailError(null);
		setEmailLoading(true);
		const formData = new FormData(event.currentTarget);
		const email = String(formData.get("email") ?? "");
		const turnstileToken = String(formData.get("turnstileToken") ?? "");
		try {
			// Plan-Q6 + §15 MEDIUM-1: Form A SDK call shape — second
			// positional arg is `FetchOptions` directly (NOT wrapped in
			// `{ fetchOptions: ... }`). The header lands on the wire as
			// `x-turnstile-token`; the hand-rolled hook reads it from
			// `ctx.request.headers` per src/server/auth/index.ts.
			const { error } = await authClient.emailOtp.sendVerificationOtp(
				{ email, type: "sign-in" },
				{ headers: { "x-turnstile-token": turnstileToken } },
			);
			if (error) {
				setEmailError(error.message ?? "send_failed");
				return;
			}
			router.push(`/sign-in/otp?email=${encodeURIComponent(email)}`);
		} catch (err) {
			setEmailError(err instanceof Error ? err.message : "send_failed");
		} finally {
			setEmailLoading(false);
		}
	}

	return (
		<Card className="my-auto w-full">
			<CardHeader className="text-center">
				{/* The brand lockup stands where the title string stood, SUPERSEDING
				    POLISH.7a D01 (the W2.1 `.mhead` copy "Continue to Zugzwang",
				    mockup `:313`). Same substitution SPEC.1 §21.9 already ruled for
				    onboarding Card 1 — the wordmark takes the title's place, and the
				    card supplies a visually hidden one so the surface stays NAMED
				    rather than becoming an unnamed card. `CardTitle` is kept as that
				    name, not replaced by a bare `<h*>`: the accessible name then
				    still lives in the slot it lived in before, and
				    `data-slot="card-title"` survives for anything reading the header
				    grid. `dialogs.tsx:201` is the same `sr-only` title move.

				    ⛔ REUSED, NOT REDRAWN. The mark is `BrandCluster`'s own
				    `/brand/zugzwang-mark.svg` static asset — at the 140px it renders
				    at on the re-show deck the header's RULES control opens
				    (`figures.tsx:402`), not the header's own 48px, because this card
				    is a destination and not chrome. The letters are that cluster's
				    own `Wordmark` — the
				    component extracted at O1-DECK-R2 §4 precisely so a second site
				    could not drift from the header. No SVG is inlined here and there
				    is no second implementation of either half. `gap-2.5` is the
				    cluster's own mark-to-letters gap, carried across; the `card`
				    scale is the ratified one for a wordmark standing in a title's
				    place, which is exactly what this is.

				    ⛔ NO COUNTDOWN, AND NOTHING SHARED HAD TO BE REFACTORED TO LEAVE
				    IT OUT. `BrandCluster` itself is not reusable here — it owns the
				    minute timer, its `targetMs`/`initialDisplay` props and a
				    remaining-time `aria-label`, and it is ONE link target to `/`. But
				    the countdown was never fused to the mark: `Wordmark` renders the
				    letters and nothing else, which is what that extraction was for,
				    and the mark is a static file. Time-to-freeze is header chrome and
				    has no business on a sign-in card. */}
				<CardTitle className="sr-only">Zugzwang</CardTitle>
				<div className="flex flex-col items-center gap-2.5">
					{/* biome-ignore lint/performance/noImgElement: static 140px brand svg — next/image's optimizer refuses svg by default and buys nothing here. */}
					<img
						src="/brand/zugzwang-mark.svg"
						alt=""
						width={140}
						height={140}
						className="size-[140px]"
					/>
					<Wordmark scale="card" />
				</div>
			</CardHeader>
			{/* ⛔⛔ MOBILE-1 · Phase B — TWO SIBLING BLOCKS, BOTH SERVER-RENDERED,
			    AND A PURE-CSS TOGGLE BETWEEN THEM. Never a JS-computed conditional
			    render, and that is a correctness requirement rather than a style
			    preference (plan §4). This page is already `"use client"` and cannot
			    submit anything without JS — but a `matchMedia`/`innerWidth` branch
			    would paint the WRONG block until hydration, so a blocked visitor
			    would watch a real sign-in form flash before being told they cannot
			    use it. A CSS toggle is correct from the first paint, with no
			    runtime width read anywhere.

			    Both conditions apply to both blocks, in mirror: the form hides under
			    either, the message appears under either. `max-mobile:` is the 640px
			    phone rule; `touch-primary:` is width-independent and is the only
			    layer a default-mode iPad ever meets, since that device's User-Agent
			    is byte-identical to a real Mac's and the server gate cannot see it
			    (`src/server/auth/device-class.ts`).

			    ⚠ The header above stays at every width — the brand lockup is not
			    part of what is being refused, and a card with no name is worse than
			    one whose form is hidden. */}
			<CardContent
				data-testid="sign-in-form-block"
				className="flex flex-col gap-4 max-mobile:hidden touch-primary:hidden"
			>
				{/* F-AUTH-1 — Google OAuth. */}
				<form onSubmit={handleGoogle}>
					<Button type="submit" disabled={googleLoading} className="w-full">
						{googleLoading ? "Redirecting…" : "Continue with Google"}
					</Button>
					{googleError ? (
						<AuthAlert className="mt-3">{googleError}</AuthAlert>
					) : null}
				</form>

				{/* "or"-divider (W2.1 .ordiv) — the word flanked by two hairline
				    rules; the rules are the branded Separator (bg-border ≡ the
				    --hairline neutral, WI-1: never the mockup's raw var(--n2)). */}
				<div className="flex items-center gap-3">
					<Separator className="flex-1" />
					<span className="text-xs font-medium tracking-wider text-n5">or</span>
					<Separator className="flex-1" />
				</div>

				{/* F-AUTH-2 — Email + OTP. Hidden `turnstileToken` input retained
				    per Plan-Q7 sub-verdict (anchor for future Cloudflare Turnstile
				    widget mount once DESIGN.* lands). The onSubmit handler reads
				    it from form data and passes the value as the
				    `x-turnstile-token` HEADER on the SDK call. */}
				<form onSubmit={handleEmailOtp} className="flex flex-col gap-3">
					{/* POLISH.7a D03 — the W2.1 `.emailrow`: the field and its submit
					    share ONE row (mockup `:318-322`, CSS `:154`
					    `display:flex;gap:9px`), not the stacked full-width pair this
					    shipped as. The 9px is a hardcoded LAYOUT value, which
					    POLISH-SURFACE-TEMPLATE §6 puts in the fair-game half — it is not
					    a colour and F2/H13 do not reach it. The field takes the slack
					    (`.email{flex:1 1 auto;min-width:0}`) and the submit stays
					    intrinsic (`.econt{flex:0 0 auto}`). */}
					<div className="flex gap-[9px]">
						<Input
							type="email"
							name="email"
							required
							placeholder="Email address"
							aria-label="Email address"
							className="min-w-0 flex-1"
						/>
						<Button type="submit" disabled={emailLoading} className="shrink-0">
							{emailLoading ? "Sending…" : "Send code"}
						</Button>
					</div>
					{/* TODO(DESIGN.*): Cloudflare Turnstile widget client-side. */}
					{/* ⚠ SEAM CONTRACT (UI-A7 §3.1): this hidden anchor MUST SURVIVE —
					    `handleEmailOtp` reads `formData.get("turnstileToken")`. It sits
					    beside the row rather than in it because a hidden input is not a
					    flex child worth laying out; it is still inside the same <form>,
					    which is what `new FormData(event.currentTarget)` reads. */}
					<input
						type="hidden"
						name="turnstileToken"
						value="placeholder-token"
					/>
					{emailError ? (
						<AuthAlert className="mt-3">{emailError}</AuthAlert>
					) : null}
				</form>
			</CardContent>
			{/* The message half of the toggle. Copy is founder-ratified and
			    VERBATIM (MOBILE-1 Decisions received #5) — it is the whole of what
			    this surface says to a blocked device, so it is not paraphrased,
			    softened, or given a "try again later" that nobody promised. The
			    exclusion is deliberate and indefinite (ADR-0045: "genuinely
			    excluding mobile participants from this experiment phase's identity
			    system"), not a not-ready-yet. */}
			<CardContent
				data-testid="mobile-auth-unavailable"
				className="hidden flex-col items-center gap-2 text-center text-sm text-n5 max-mobile:flex touch-primary:flex"
			>
				{MOBILE_AUTH_MESSAGE}
			</CardContent>
		</Card>
	);
}
