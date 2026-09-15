import { CircleCheck, Info, TriangleAlert } from "lucide-react";

import { cn } from "@/lib/utils";

// ADMIN-UI — an inline operator notice (flash result, warning, context note).
// Presentational; no client JS. Tone is carried by icon + weight + border rung,
// never by colour alone (the palette is monochrome by rule). `error` announces
// assertively (`role="alert"`); the others politely (`role="status"`).

type Tone = "success" | "error" | "info";

const ICON = { success: CircleCheck, error: TriangleAlert, info: Info };

const TONE: Record<Tone, string> = {
	success: "border-n3 bg-n1 text-ink",
	error: "border-n5 bg-n1 text-ink",
	info: "border-n2 bg-n0 text-n6",
};

export function Notice({
	tone,
	title,
	children,
	className,
}: {
	tone: Tone;
	title?: string;
	children?: React.ReactNode;
	className?: string;
}): React.ReactElement {
	const Icon = ICON[tone];
	return (
		<div
			role={tone === "error" ? "alert" : "status"}
			className={cn(
				"flex items-start gap-2.5 rounded-(--r) border px-3.5 py-2.5 text-sm",
				TONE[tone],
				className,
			)}
		>
			<Icon
				aria-hidden
				className={cn("mt-0.5 size-4 shrink-0", tone === "info" && "text-n4")}
			/>
			<div className="min-w-0 flex-1">
				{title ? <p className="font-semibold">{title}</p> : null}
				{children ? (
					<div className={cn(title && "mt-0.5", "text-n6")}>{children}</div>
				) : null}
			</div>
		</div>
	);
}
