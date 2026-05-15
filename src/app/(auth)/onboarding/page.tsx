import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { eq } from "drizzle-orm";
import { cookies } from "next/headers";
import Image from "next/image";
import { redirect } from "next/navigation";
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
		<main>
			{/* (i) Pseudonym + PFP labelled permanent */}
			<section>
				<h1>Your Zugzwang identity</h1>
				<Image
					src="/pfp-placeholder.svg"
					alt={user.pseudonym}
					width={128}
					height={128}
				/>
				<p>
					<strong>{user.pseudonym}</strong>
				</p>
				<p>
					<em>
						Permanent. You can't change this — your pseudonym and picture are
						bound to your account for the experiment.
					</em>
				</p>
			</section>

			{/* (ii) Emphasised re-id warning — SPEC.1 line 684 verbatim */}
			<section role="alert" style={{ border: "2px solid", padding: "1rem" }}>
				<strong>Re-identification risk</strong>
				<p>{REID_WARNING_TEXT}</p>
			</section>

			{/* (iii) ToS body — scrollable region */}
			<section>
				<h2>Terms of Service</h2>
				<div style={{ maxHeight: "300px", overflowY: "scroll" }}>
					<pre style={{ whiteSpace: "pre-wrap" }}>{tosBody}</pre>
				</div>
			</section>

			{/* (iv) Privacy body — scrollable region */}
			<section>
				<h2>Privacy Policy</h2>
				<div style={{ maxHeight: "300px", overflowY: "scroll" }}>
					<pre style={{ whiteSpace: "pre-wrap" }}>{privacyBody}</pre>
				</div>
			</section>

			{/* (v) + (vi) Single checkbox + Continue / Cancel.
			    Inline Server Action wrapper discards the `{ ok: false,
			    code: 'tos_acceptance_required' }` return so the form's
			    action prop type is satisfied (Next.js form actions are
			    typed `(formData) => Promise<void>`). The accept-tos
			    action's side effects (UPDATE + cookie clear + redirect)
			    are the user-facing signal. */}
			<form action={submitTosAcceptance}>
				<label>
					<input type="checkbox" name="accepted" value="true" required />I have
					read and agree to the Terms of Service and Privacy Policy.
				</label>
				<div>
					<button type="submit">Continue</button>
					<a href="/">Cancel</a>
				</div>
			</form>

			{/* (vii) Footer with version hashes */}
			<footer>
				<small>
					ToS {TOS_VERSION_HASH} · Privacy {PRIVACY_VERSION_HASH}
				</small>
			</footer>
		</main>
	);
}
