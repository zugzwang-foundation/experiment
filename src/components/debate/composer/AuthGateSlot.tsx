"use client";

import Link from "next/link";

import { Button } from "@/components/ui/button";
import type { Side } from "../types";
import { AUTH_GATE_COPY } from "./copy";

/**
 * The d5 signed-out auth-gate slot variant (plan §4): clicking `Đ BET` while
 * signed out opens THIS in the opposite slot instead of the composer. Copy is
 * d5-verbatim; both actions link to the existing unstyled auth route (A7 owns
 * the auth skin — no auth-route edits here, §8).
 *
 * ⛔ MOBILE-1 · Phase B — the two actions are ADR-0045's second client-side CTA
 * surface, hidden under BOTH conditions (`max-mobile:` phone width AND the
 * width-independent `touch-primary:`). The hide sits on the single wrapper that
 * holds both links rather than on each `<Button>`: two class strings on two
 * siblings are two things that can drift apart, and half a hidden CTA pair is
 * worse than either state.
 *
 * This slot is reached only from `/m/[slug]`, a `(public)` surface, so unlike
 * `IdentityCluster` there is no `(auth)` mount to reason about here.
 *
 * ⚠ KNOWN WART, DELIBERATELY NOT FIXED HERE. Below the breakpoint this panel
 * keeps its heading, body and micro copy while losing its actions — an
 * instruction with no affordance. The obvious repair is to show the
 * founder-ratified "Sign-up only works on a computer right now." line in their
 * place, and that string is scoped by decision to the two sign-in pages
 * (MOBILE-1 Decisions received #5). Choosing where product copy appears is not
 * an executor's call (CLAUDE.md §3), so it is raised rather than taken.
 */
export function AuthGateSlot({
	side,
	onClose,
}: {
	side: Side;
	onClose: () => void;
}) {
	return (
		<section
			aria-label={AUTH_GATE_COPY.heading(side)}
			className="flex flex-col items-center gap-3 rounded-(--r) px-6 py-10 text-center shadow-(--elev-1) [border:var(--hairline)]"
		>
			<div className="flex w-full justify-end">
				<button
					type="button"
					onClick={onClose}
					aria-label="Close"
					className="rounded-(--r-chip) px-1 text-sm text-n4 transition-all hover:text-ink focus-visible:shadow-(--state-focus-ring)"
				>
					×
				</button>
			</div>
			<h3 className="text-base font-semibold text-ink">
				{AUTH_GATE_COPY.heading(side)}
			</h3>
			<p className="max-w-sm text-sm text-n5">{AUTH_GATE_COPY.body}</p>
			<div className="flex items-center gap-2 max-mobile:hidden touch-primary:hidden">
				<Button asChild size="sm">
					<Link href="/sign-in">{AUTH_GATE_COPY.signUp}</Link>
				</Button>
				<Button asChild variant="ghost" size="sm">
					<Link href="/sign-in">{AUTH_GATE_COPY.signIn}</Link>
				</Button>
			</div>
			<div className="text-xs font-medium tracking-wide text-n4 uppercase">
				{AUTH_GATE_COPY.micro}
			</div>
		</section>
	);
}
