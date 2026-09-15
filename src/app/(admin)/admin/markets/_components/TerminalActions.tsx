"use client";

import {
	Ban,
	Check,
	CircleCheck,
	Lock,
	type LucideIcon,
	Scale,
	TriangleAlert,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { cn } from "@/lib/utils";
import { closeMarketAction } from "@/server/admin/markets/close";
import { correctResolutionAction } from "@/server/admin/markets/correct";
import { resolveMarketAction } from "@/server/admin/markets/resolve";
import { voidMarketAction } from "@/server/admin/markets/void";

import {
	actionsForStatus,
	isSubmitEnabled,
	isTypedConfirmMatch,
	type MarketStatus,
	requiresTypedConfirm,
	type TerminalAction,
	terminalActionFields,
	terminalErrorCopy,
} from "./terminal-actions-logic";

// UI.6 S2 — the client-gated terminal-market-action surface (§2.S2). REPLACES
// the plain-HTML Close / Resolve / Void / Correct submit paths on
// [marketId]/page.tsx: each gated action arms only when the operator types the
// market question (D-2), and every ActionResult error renders as human copy —
// no raw `?error=<code>` surface survives, and no ungated parallel path remains
// (R-5). The Seed (Draft, F-ADMIN-2) affordance is untouched — it is not one of
// these four. The server actions + state machine remain the real gate; the
// typed confirm is added friction ahead of the append-only INV-4 lineage.
//
// ADMIN-UI — presentation only. Every `data-testid`, the aria-label, the field
// set posted (`terminalActionFields`), the gate (`isSubmitEnabled`) and the
// error copy (`terminalErrorCopy`) are unchanged. Close stays ONE-CLICK — that
// is a ratified decision (`requiresTypedConfirm`), not an omission. The side
// control stays a native <select>. The added match hint reads the SAME
// `isTypedConfirmMatch` the gate reads, so the hint and the button cannot
// disagree.

// The uniform ActionResult surface the four wire actions return (data shape
// differs per action; only ok/error is consumed here).
type ActionResult =
	| { ok: true; data: unknown }
	| {
			ok: false;
			error: {
				code: string;
				message: string;
				field_errors?: Record<string, string[]>;
			};
	  };

type WireAction = (formData: FormData) => Promise<ActionResult>;

const ACTION_FN: Record<TerminalAction, WireAction> = {
	close: closeMarketAction,
	resolve: resolveMarketAction,
	void: voidMarketAction,
	correct: correctResolutionAction,
};

const HEADING: Record<TerminalAction, string> = {
	close: "Close market",
	resolve: "Resolve",
	void: "Void market",
	correct: "Correct resolution",
};

const ICON: Record<TerminalAction, LucideIcon> = {
	close: Lock,
	resolve: CircleCheck,
	void: Ban,
	correct: Scale,
};

/** One line under each heading: what the action does, stated plainly. */
const SUMMARY: Record<TerminalAction, string> = {
	close:
		"Stops new bets. Nothing is settled — the market then waits for Resolve or Void.",
	resolve: "Settles the market to the winning side and pays out positions.",
	void: "Cancels the market and refunds stakes.",
	correct:
		"Re-settles a resolved market to a different side through the F-RESOLVE-2 clawback.",
};

/** The side-selector label per action (resolve → winning; correct → corrected). */
const SIDE_LABEL: Partial<Record<TerminalAction, string>> = {
	resolve: "Winning side",
	correct: "Corrected side",
};

function ActionForm({
	action,
	marketId,
	title,
	resuming,
}: {
	action: TerminalAction;
	marketId: string;
	title: string;
	resuming: boolean;
}): React.ReactElement {
	const router = useRouter();
	const [typed, setTyped] = useState("");
	const [reason, setReason] = useState("");
	const [side, setSide] = useState<"YES" | "NO">("YES");
	const [errorLines, setErrorLines] = useState<string[] | null>(null);
	const [done, setDone] = useState(false);
	const [pending, setPending] = useState(false);

	const gated = requiresTypedConfirm(action);
	const hasSide = action === "resolve" || action === "correct";
	const enabled = isSubmitEnabled(action, typed, title) && !pending;
	const heading =
		action === "resolve" && resuming ? "Complete settlement" : HEADING[action];
	const Icon = ICON[action];
	const matched = gated && isTypedConfirmMatch(typed, title);
	const fieldId = `${action}-${marketId}`;

	async function onSubmit(event: React.FormEvent): Promise<void> {
		event.preventDefault();
		// Client-side belt: never fire a gated action without the typed match
		// (the disabled button is the primary gate; this covers a forced submit).
		if (!isSubmitEnabled(action, typed, title)) return;
		setPending(true);
		setErrorLines(null);
		setDone(false);
		try {
			const fields = terminalActionFields(action, { marketId, side, reason });
			const formData = new FormData();
			for (const [key, value] of Object.entries(fields)) {
				formData.append(key, value);
			}
			const result = await ACTION_FN[action](formData);
			if (result.ok) {
				setDone(true);
				setTyped("");
				setReason("");
			} else {
				setErrorLines(terminalErrorCopy(result.error));
			}
			// Re-sync the server-rendered status either way (e.g. a Resolve that
			// committed the trigger then failed settle leaves the market Resolving —
			// the refresh re-renders it with the "Complete settlement" affordance).
			router.refresh();
		} finally {
			setPending(false);
		}
	}

	const control =
		"w-full rounded-(--r) border border-n2 bg-ground px-2.5 text-ink text-sm outline-none transition-colors hover:border-n3 focus-visible:shadow-(--state-focus-ring) disabled:opacity-(--state-disabled-opacity)";

	return (
		<form
			onSubmit={onSubmit}
			aria-labelledby={`${fieldId}-heading`}
			aria-busy={pending}
			className={cn(
				"flex flex-col gap-4 rounded-(--r) border bg-n0 p-5 shadow-(--elev-1)",
				gated ? "border-n3" : "border-n2",
			)}
		>
			<div className="flex items-start justify-between gap-3">
				<div className="flex min-w-0 items-start gap-2.5">
					<Icon aria-hidden className="mt-1 size-4 shrink-0 text-n5" />
					<div className="min-w-0">
						<h3
							id={`${fieldId}-heading`}
							className="font-semibold text-base text-ink"
						>
							{heading}
						</h3>
						<p className="mt-0.5 text-n5 text-sm">
							{action === "resolve" && resuming
								? "A Resolve committed but settlement did not finish. Run it again to complete settlement."
								: SUMMARY[action]}
						</p>
					</div>
				</div>
				<span
					className={cn(
						"shrink-0 whitespace-nowrap rounded-(--r-chip) border px-2 py-0.5 font-medium text-[11px] uppercase leading-4 tracking-wide",
						gated ? "border-n5 text-ink" : "border-n2 text-n5",
					)}
				>
					{gated ? "Irreversible" : "One click"}
				</span>
			</div>

			{hasSide ? (
				<label className="flex flex-col gap-1.5 text-sm">
					<span className="font-medium text-ink">{SIDE_LABEL[action]}</span>
					<select
						data-testid={`${action}-side`}
						value={side}
						onChange={(e) => setSide(e.target.value === "NO" ? "NO" : "YES")}
						disabled={pending}
						className={cn(control, "h-9 w-36 font-semibold")}
					>
						<option value="YES">YES</option>
						<option value="NO">NO</option>
					</select>
				</label>
			) : null}

			{action !== "close" ? (
				<label className="flex flex-col gap-1.5 text-sm">
					<span className="font-medium text-ink">Reason</span>
					<textarea
						data-testid={`${action}-reason`}
						value={reason}
						onChange={(e) => setReason(e.target.value)}
						required
						rows={3}
						disabled={pending}
						className={cn(control, "min-h-20 py-2")}
					/>
					<span className="text-n5 text-xs">
						Recorded with the action in the append-only audit trail.
					</span>
				</label>
			) : null}

			{/* POLISH.8 S-4 (D12) — SPEC.1 §15 F-ADMIN-3 Confirmation requires the
			    confirm to restate the winning side and to name the action as
			    permanent, with corrections available only via an F-RESOLVE-2
			    clawback. COPY ONLY: every value below is already in props/state —
			    no new prop, no read-model field, no behaviour change.
			    ⚠ SIDE-ENCODING COPY, NOT A POLE SITE. The side is stated as TEXT
			    and is never colourised — INV-3's poles encode side, and keying a
			    colour off this string would mint a fourth pole surface. */}
			{gated ? (
				<p
					data-testid={`${action}-permanence`}
					className="flex items-start gap-2 rounded-(--r) border border-n4 bg-n1 px-3 py-2.5 text-ink text-xs leading-5"
				>
					<TriangleAlert aria-hidden className="mt-0.5 size-3.5 shrink-0" />
					<span>
						{hasSide ? (
							<span className="font-semibold">
								{`${action === "resolve" ? "Winning side" : "Corrected side"}: ${side}. `}
							</span>
						) : null}
						{hasSide
							? "This action is permanent — the market cannot be re-opened, edited or un-resolved. Corrections are available only via an F-RESOLVE-2 clawback."
							: "This action is permanent — a voided market cannot be re-opened, and it has no correction path."}
					</span>
				</p>
			) : null}

			{gated ? (
				<label className="flex flex-col gap-1.5 text-sm">
					<span className="font-medium text-ink">
						Type the market question to confirm
					</span>
					<span className="select-all rounded-(--r) border border-n2 border-dashed bg-ground px-2.5 py-1.5 text-n6 text-xs">
						{title}
					</span>
					<input
						data-testid={`${action}-confirm`}
						value={typed}
						onChange={(e) => setTyped(e.target.value)}
						aria-label="Type the market question to confirm"
						aria-describedby={`${fieldId}-match`}
						autoComplete="off"
						spellCheck={false}
						disabled={pending}
						className={cn(control, "h-9", matched && "border-n6")}
					/>
					<span
						id={`${fieldId}-match`}
						className={cn(
							"flex items-center gap-1 text-xs",
							matched ? "text-ink" : "text-n5",
						)}
					>
						{matched ? (
							<>
								<Check aria-hidden className="size-3.5" />
								Question matches — the action is armed.
							</>
						) : (
							"Case and surrounding spaces are ignored."
						)}
					</span>
				</label>
			) : null}

			<div className="flex flex-wrap items-center gap-3">
				<button
					type="submit"
					data-testid={`${action}-submit`}
					disabled={!enabled}
					className={cn(
						"inline-flex h-9 items-center justify-center gap-2 rounded-(--r) px-4 font-medium text-sm outline-none transition-colors focus-visible:shadow-(--state-focus-ring) disabled:cursor-not-allowed disabled:opacity-40",
						gated
							? "bg-ink text-ground hover:bg-n7"
							: "border border-n3 bg-(--btn-fill) text-ink hover:bg-(--state-hover-fill)",
					)}
				>
					{pending ? "Working…" : heading}
				</button>
				{gated && !matched ? (
					<span className="text-n5 text-xs">
						Armed once the question is typed.
					</span>
				) : null}
			</div>

			{errorLines ? (
				<ul
					aria-live="polite"
					className="list-disc space-y-1 rounded-(--r) border border-n5 bg-n1 px-4 py-2.5 pl-8 text-ink text-sm"
				>
					{errorLines.map((line) => (
						<li key={line}>{line}</li>
					))}
				</ul>
			) : null}

			{done ? (
				<p
					aria-live="polite"
					className="flex items-center gap-2 rounded-(--r) border border-n3 bg-n1 px-3 py-2 text-ink text-sm"
				>
					<Check aria-hidden className="size-4" />
					Done.
				</p>
			) : null}
		</form>
	);
}

export function TerminalActions({
	marketId,
	title,
	status,
}: {
	marketId: string;
	title: string;
	status: MarketStatus;
}): React.ReactElement | null {
	const actions = actionsForStatus(status);
	if (actions.length === 0) return null;
	const resuming = status === "Resolving";
	return (
		<section aria-label="Terminal market actions" className="grid gap-4">
			{actions.map((action) => (
				<ActionForm
					key={action}
					action={action}
					marketId={marketId}
					title={title}
					resuming={resuming}
				/>
			))}
		</section>
	);
}
