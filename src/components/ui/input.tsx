import type * as React from "react";

import { cn } from "@/lib/utils";

function Input({ className, type, ...props }: React.ComponentProps<"input">) {
	return (
		<input
			type={type}
			data-slot="input"
			className={cn(
				"flex h-8 w-full min-w-0 rounded-(--r) bg-transparent px-2.5 py-1 text-sm text-ink transition-all outline-none [border:var(--hairline)]",
				"placeholder:text-n4",
				"focus-visible:shadow-(--state-focus-ring)",
				"disabled:pointer-events-none disabled:opacity-(--state-disabled-opacity)",
				className,
			)}
			{...props}
		/>
	);
}

export { Input };
