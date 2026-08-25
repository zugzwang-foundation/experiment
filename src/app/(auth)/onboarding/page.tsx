import { eq } from "drizzle-orm";
import { cookies } from "next/headers";
import Image from "next/image";
import { redirect } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { db } from "@/db";
import { users } from "@/db/schema/auth";
import { verifyOnboardingRef } from "@/server/auth/onboarding-ref";
import { acceptTosAction } from "@/server/auth/tos-accept";
import {
	PRIVACY_VERSION_HASH,
	TOS_VERSION_HASH,
} from "@/server/auth/tos-versions";

// F-AUTH-4 onboarding page per SPEC.1 §13 F-AUTH-4, as amended 2026-08-25
// (ONBOARD-CARD). One short card:
//
//   1. Pseudonym + PFP
//   2. Single combined acceptance checkbox, its label linking to /legal
//   3. Continue (formAction={acceptTosAction}) + Cancel (Link to /)
//   4. Footer: "ToS placeholder-tos-v0 · Privacy placeholder-privacy-v0"
//
// ⛔ WHAT LEFT, AND WHY THE READ LEFT WITH IT. The amendment supersedes two of
// F-AUTH-4's structural commitments: the two document bodies rendering inline,
// and the re-identification warning rendering here as its own emphasised block.
// Both are gone, and with them this file's `readLegalDoc` — because that read
// existed to FEED THE RENDER and fed nothing else. The version hashes are
// `tos-versions.ts` constants, written by `acceptTosAction`; they never came
// from this read and are untouched by its removal. `/legal` now performs the
// only read of `public/legal/{tos,privacy}.txt` in the app, and renders both
// bodies whole from the same files the hashes name. The warning text stays
// exported from `tos-versions.ts` and lands in the ToS body at LEGAL.1.
//
// ⚠ THE GATE IS UNCHANGED. Everything F-AUTH-4 still binds is still here: the
// checkbox is unticked by default and `required`, Continue submits to
// `acceptTosAction`, and the acceptance transaction writes tos_accepted_at,
// both version hashes, IP and user-agent with the initial grant. Nothing in
// this file touches that path — it renders the form the action already owns.
//
// Reads the signed onboarding_ref cookie, verifies, fetches the user row,
// and renders. If the cookie is missing/invalid/expired, redirects to
// /sign-in (the acceptance flow can't proceed without a verified pre-
// session userId).
//
// PFP rendering: /public/pfp-placeholder.svg (Q2) until SCAFFOLD.15
// wires the R2 URL builder.

async function submitTosAcceptance(formData: FormData): Promise<void> {
	"use server";
	await acceptTosAction(formData);
}

export default async function OnboardingPage(): Promise<React.ReactElement> {
	const cookieStore = await cookies();
	const ref = cookieStore.get("onboarding_ref")?.value;
	if (!ref) redirect("/sign-in");

	const verified = verifyOnboardingRef(ref);
	if (!verified) redirect("/sign-in");

	const user = await db.query.users.findFirst({
		where: eq(users.id, verified.userId),
		columns: { pseudonym: true, pfpFilename: true, tosAcceptedAt: true },
	});
	if (!user) redirect("/sign-in");
	if (user.tosAcceptedAt) redirect("/"); // Already accepted — bounce home

	return (
		// Pure RSC skin (plan §2 V3 — no new client boundary): Card + tokens
		// only. The two buttons are styled with the branded button tokens inline
		// rather than the ui/button primitive, so nothing pulls a client
		// (radix Slot) module into this server component.
		//
		// `my-auto` matches the sign-in card, and is now correct here for the
		// same reason it was wrong before: the card that top-aligned did so
		// because it was 1196px tall at 1440×900 and centring would have pushed
		// its head above the fold. Stripped, it is shorter than the sign-in
		// card, so the layout's own note — "short surfaces add `my-auto` to
		// center; onboarding omits it and top-aligns + scrolls" — now points
		// this surface at the centring arm.
		<Card className="my-auto w-full">
			{/* (i) Pseudonym + PFP */}
			<CardHeader className="justify-items-center text-center">
				<Image
					src="/pfp-placeholder.svg"
					alt={user.pseudonym}
					width={128}
					height={128}
					className="rounded-(--imgr) [border:var(--avatar-ring)]"
				/>
				<CardTitle className="mt-3 text-lg">Your Zugzwang identity</CardTitle>
				<p className="text-xl font-semibold text-ink">{user.pseudonym}</p>
			</CardHeader>
			<CardContent className="flex flex-col gap-4">
				{/* (ii) + (iii) Single checkbox + Continue / Cancel.
				    Inline Server Action wrapper discards the `{ ok: false,
				    code: 'tos_acceptance_required' }` return so the form's
				    action prop type is satisfied (Next.js form actions are
				    typed `(formData) => Promise<void>`). The accept-tos
				    action's side effects (UPDATE + cookie clear + redirect)
				    are the user-facing signal.

				    ⛔ THE LINK IS THE CONSPICUOUS-LINK HALF OF THE AMENDED
				    PATTERN — it sits inside the label, adjacent to the unticked
				    checkbox, and carries the documents' own names rather than a
				    bare "here". New tab, deliberately: this form holds unsaved
				    acceptance state behind a 10-minute signed ref, and a
				    same-tab navigation to a long document is the shortest path
				    to an expired one. */}
				<form action={submitTosAcceptance} className="flex flex-col gap-3">
					<label className="flex items-start gap-2 text-sm text-n6">
						<input
							type="checkbox"
							name="accepted"
							value="true"
							required
							className="mt-0.5 size-4 accent-ink"
						/>
						<span>
							I have read and agree to the{" "}
							<a
								href="/legal"
								target="_blank"
								rel="noopener noreferrer"
								className="text-ink underline underline-offset-2 outline-none hover:text-n7 focus-visible:shadow-(--state-focus-ring)"
							>
								Terms of Service and Privacy Policy
							</a>
							.
						</span>
					</label>
					<div className="flex gap-3">
						<button
							type="submit"
							className="inline-flex h-8 flex-1 items-center justify-center rounded-(--r) bg-(--btn-fill) px-2.5 text-sm font-medium text-ink transition-all outline-none [border:var(--hairline)] hover:bg-(--state-hover-fill) focus-visible:shadow-(--state-focus-ring) active:bg-(--state-pressed-fill)"
						>
							Continue
						</button>
						<a
							href="/"
							className="inline-flex h-8 items-center justify-center rounded-(--r) border border-transparent px-2.5 text-sm font-medium text-n5 transition-all outline-none hover:bg-(--state-hover-fill) hover:text-ink focus-visible:shadow-(--state-focus-ring)"
						>
							Cancel
						</a>
					</div>
				</form>
			</CardContent>

			{/* (iv) Footer with version hashes — the amendment keeps this line on
			    this screen: it names the exact version this acceptance will be
			    recorded against, which is the transparency half of the
			    acceptance-evidence record. */}
			<footer className="px-(--card-spacing) pb-1 text-center">
				<small className="text-xs text-n5">
					ToS {TOS_VERSION_HASH} · Privacy {PRIVACY_VERSION_HASH}
				</small>
			</footer>
		</Card>
	);
}
