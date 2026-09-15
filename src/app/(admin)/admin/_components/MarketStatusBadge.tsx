import {
	Ban,
	CircleCheck,
	CircleDot,
	Hourglass,
	Lock,
	type LucideIcon,
	PencilLine,
	Snowflake,
} from "lucide-react";

import { cn } from "@/lib/utils";

// ADMIN-UI — the market lifecycle status pill. Presentational Server Component.
//
// ⚠ MONOCHROME BY RULE, AND NEVER THE SIDE POLES. The status is carried three
// ways at once — the word, an icon, and a rung on the neutral emphasis ladder
// (filled / outlined / dashed / dim) — so no state is distinguishable by tone
// alone. `--color-yes` / `--color-no` name a SIDE and nothing here is a side.
//
// `status` is typed `string` because the overview read model types it so
// (`AdminMarketRow.status`); an unrecognised value renders neutrally with its
// own text rather than throwing.

const META: Record<string, { icon: LucideIcon; className: string }> = {
	Draft: {
		icon: PencilLine,
		className: "border-dashed border-n3 text-n5",
	},
	Open: {
		icon: CircleDot,
		className: "border-n7 bg-n7 text-ground",
	},
	Closed: {
		icon: Lock,
		className: "border-n5 bg-n1 text-ink",
	},
	Resolving: {
		icon: Hourglass,
		className: "border-n5 text-ink",
	},
	Resolved: {
		icon: CircleCheck,
		className: "border-n2 bg-n1 text-n6",
	},
	Voided: {
		icon: Ban,
		className: "border-n2 text-n4",
	},
	Frozen: {
		icon: Snowflake,
		className: "border-n2 bg-n1 text-n5",
	},
};

export function MarketStatusBadge({
	status,
	className,
}: {
	status: string;
	className?: string;
}): React.ReactElement {
	const meta = META[status];
	const Icon = meta?.icon ?? CircleDot;
	return (
		<span
			data-market-status={status}
			className={cn(
				"inline-flex h-6 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-(--r-chip) border px-2 font-medium text-xs leading-none",
				meta?.className ?? "border-n2 text-n5",
				className,
			)}
		>
			<Icon aria-hidden className="size-3.5" />
			{status}
		</span>
	);
}
