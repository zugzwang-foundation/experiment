"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { closeMarketAction } from "@/server/admin/markets/close";
import { correctResolutionAction } from "@/server/admin/markets/correct";
import { resolveMarketAction } from "@/server/admin/markets/resolve";
import { voidMarketAction } from "@/server/admin/markets/void";

import {
	actionsForStatus,
	isSubmitEnabled,
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

	return (
		<form
			onSubmit={onSubmit}
			className="mb-4 rounded-lg border border-border bg-card p-5"
		>
			<h2 className="mb-3 text-lg font-semibold">{heading}</h2>

			{hasSide ? (
				<label className="mb-3 flex flex-col gap-1 text-sm">
					<span className="font-medium">{SIDE_LABEL[action]}</span>
					<select
						data-testid={`${action}-side`}
						value={side}
						onChange={(e) => setSide(e.target.value === "NO" ? "NO" : "YES")}
						className="w-32 rounded-md border border-border bg-background px-2 py-1"
					>
						<option value="YES">YES</option>
						<option value="NO">NO</option>
					</select>
				</label>
			) : null}

			{action !== "close" ? (
				<label className="mb-3 flex flex-col gap-1 text-sm">
					<span className="font-medium">Reason</span>
					<textarea
						data-testid={`${action}-reason`}
						value={reason}
						onChange={(e) => setReason(e.target.value)}
						required
						className="rounded-md border border-border bg-background px-2 py-1"
					/>
				</label>
			) : null}

			{gated ? (
				<label className="mb-3 flex flex-col gap-1 text-sm">
					<span className="font-medium">
						Type the market question to confirm
					</span>
					<span className="text-xs text-muted-foreground">{title}</span>
					<input
						data-testid={`${action}-confirm`}
						value={typed}
						onChange={(e) => setTyped(e.target.value)}
						aria-label="Type the market question to confirm"
						autoComplete="off"
						className="rounded-md border border-border bg-background px-2 py-1"
					/>
				</label>
			) : null}

			<button
				type="submit"
				data-testid={`${action}-submit`}
				disabled={!enabled}
				className="rounded-md border border-border bg-foreground px-4 py-2 text-sm font-medium text-background disabled:cursor-not-allowed disabled:opacity-40"
			>
				{pending ? "Working…" : heading}
			</button>

			{errorLines ? (
				<ul
					aria-live="polite"
					className="mt-3 list-disc space-y-1 rounded-md border border-destructive/40 bg-destructive/10 px-4 py-2 pl-8 text-sm text-destructive"
				>
					{errorLines.map((line) => (
						<li key={line}>{line}</li>
					))}
				</ul>
			) : null}

			{done ? (
				<p
					aria-live="polite"
					className="mt-3 rounded-md border border-border bg-muted px-3 py-2 text-sm"
				>
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
		<section aria-label="Terminal market actions">
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
