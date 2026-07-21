import { readFile } from "node:fs/promises";
import { join } from "node:path";
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
	REID_WARNING_TEXT,
	TOS_VERSION_HASH,
} from "@/server/auth/tos-versions";

// F-AUTH-4 onboarding page per plan §4 + SPEC.1 §13 lines 682–688. Single
// inline-scrollable screen:
//
//   1. Pseudonym + PFP block (labelled permanent)
//   2. Emphasised re-id warning callout — REID_WARNING_TEXT verbatim
//   3. Full ToS body in scrollable region
//   4. Full Privacy Policy body in scrollable region
//   5. Single combined acceptance checkbox
//   6. Continue (formAction={acceptTosAction}) + Cancel (Link to /)
//   7. Footer: "ToS placeholder-tos-v0 · Privacy placeholder-privacy-v0"
//
// Reads the signed onboarding_ref cookie, verifies, fetches the user row,
// and renders. If the cookie is missing/invalid/expired, redirects to
// /sign-in (the acceptance flow can't proceed without a verified pre-
// session userId).
//
// PFP rendering: /public/pfp-placeholder.svg (Q2) until SCAFFOLD.15
// wires the R2 URL builder.

async function readLegalDoc(name: "tos" | "privacy"): Promise<string> {
	const path = join(process.cwd(), "public", "legal", `${name}.txt`);
	return readFile(path, "utf-8");
}

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

	const [tosBody, privacyBody] = await Promise.all([
		readLegalDoc("tos"),
		readLegalDoc("privacy"),
	]);

	return (
		// Pure RSC skin (plan §2 V3 — no new client boundary): Card + tokens
		// only. The two buttons are styled with the branded button tokens inline
		// rather than the ui/button primitive, so nothing pulls a client
		// (radix Slot) module into this server component. Top-aligns + scrolls
		// (no `my-auto`) — the content is tall (plan §2 V0).
		<Card className="w-full">
			{/* (i) Pseudonym + PFP labelled permanent */}
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
				<p className="text-sm text-n5">
					Permanent. You can't change this — your pseudonym and picture are
					bound to your account for the experiment.
				</p>
			</CardHeader>
			<CardContent className="flex flex-col gap-4">
				{/* (ii) Emphasised re-id warning — SPEC.1 line 684 verbatim */}
				<div
					role="alert"
					className="rounded-(--r) bg-n1 p-4 [border:var(--hairline)]"
				>
					<strong className="text-sm text-ink">Re-identification risk</strong>
					<p className="mt-1 text-sm text-n6">{REID_WARNING_TEXT}</p>
				</div>

				{/* (iii) ToS body — scrollable region */}
				<section>
					<h2 className="mb-2 text-sm font-medium text-ink">
						Terms of Service
					</h2>
					<div className="max-h-64 overflow-y-auto rounded-(--r) bg-n1 p-3 [border:var(--hairline)]">
						<pre className="font-sans text-xs whitespace-pre-wrap text-n6">
							{tosBody}
						</pre>
					</div>
				</section>

				{/* (iv) Privacy body — scrollable region */}
				<section>
					<h2 className="mb-2 text-sm font-medium text-ink">Privacy Policy</h2>
					<div className="max-h-64 overflow-y-auto rounded-(--r) bg-n1 p-3 [border:var(--hairline)]">
						<pre className="font-sans text-xs whitespace-pre-wrap text-n6">
							{privacyBody}
						</pre>
					</div>
				</section>

				{/* (v) + (vi) Single checkbox + Continue / Cancel.
				    Inline Server Action wrapper discards the `{ ok: false,
				    code: 'tos_acceptance_required' }` return so the form's
				    action prop type is satisfied (Next.js form actions are
				    typed `(formData) => Promise<void>`). The accept-tos
				    action's side effects (UPDATE + cookie clear + redirect)
				    are the user-facing signal. */}
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
							I have read and agree to the Terms of Service and Privacy Policy.
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

			{/* (vii) Footer with version hashes */}
			<footer className="px-(--card-spacing) pb-1 text-center">
				<small className="text-xs text-n5">
					ToS {TOS_VERSION_HASH} · Privacy {PRIVACY_VERSION_HASH}
				</small>
			</footer>
		</Card>
	);
}
