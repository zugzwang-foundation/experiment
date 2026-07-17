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
			<div className="flex items-center gap-2">
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
