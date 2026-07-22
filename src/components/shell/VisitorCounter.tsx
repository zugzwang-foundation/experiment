"use client";

import { Eye } from "lucide-react";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";

/**
 * The global-header visitor counter (SPEC.1 §21.1, DESIGN.W2.5). A vanity /
 * traction count of TOTAL page visits — repeats counted — labelled plainly
 * "visitors". It is explicitly NOT `n`: it POSTs to `/api/visits` and renders
 * the returned integer; it reads nothing from the ledger / engine.
 *
 * Client leaf: POST on mount and on every `usePathname()` change — the count
 * refreshes on navigation, NO poll / interval / websocket (§21.1). A ref guards
 * the POST so it fires exactly once per unique pathname, deduping React strict-
 * mode's double-invoked mount effect (which would otherwise double-count) while
 * still firing on a real navigation. No cancellation: the count is global, so a
 * late resolve for a prior path is harmless.
 *
 * Three states (design-language §4.10 + W2.11): loading (`visitor-before-load`)
 * · value (number + eye) · P5 silent fallback (dash — never an error surface).
 * Muted register + eye glyph are load-bearing anti-conflation, not styling.
 */

type CounterState = "loading" | { total: number | null };

const NUMBER_FORMAT = new Intl.NumberFormat("en-US");

export function VisitorCounter() {
	const pathname = usePathname();
	const [state, setState] = useState<CounterState>("loading");
	const firedFor = useRef<string | null>(null);

	useEffect(() => {
		if (firedFor.current === pathname) return;
		firedFor.current = pathname;
		void (async () => {
			try {
				const res = await fetch("/api/visits", { method: "POST" });
				const data: unknown = await res.json();
				const total =
					data && typeof (data as { total?: unknown }).total === "number"
						? (data as { total: number }).total
						: null;
				setState({ total });
			} catch {
				setState({ total: null });
			}
		})();
	}, [pathname]);

	const dataState =
		state === "loading"
			? "loading"
			: state.total === null
				? "fallback"
				: "value";

	// P5 dash for both the pre-load and the silent-fallback states (never an
	// error); the grouped, tabular number once the count arrives.
	const numberText =
		state === "loading" || state.total === null
			? "—"
			: NUMBER_FORMAT.format(state.total);

	return (
		<span
			data-testid="visitor-counter"
			data-state={dataState}
			aria-busy={state === "loading"}
			className="flex items-center gap-1.5 text-xs text-muted-foreground select-none"
		>
			<Eye aria-hidden="true" className="size-3.5 shrink-0" />
			<span>
				<span className="tabular-nums">{numberText}</span> visitors
			</span>
		</span>
	);
}
