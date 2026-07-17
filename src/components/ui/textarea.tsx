import type * as React from "react";

import { cn } from "@/lib/utils";

function Textarea({ className, ...props }: React.ComponentProps<"textarea">) {
	return (
		<textarea
			data-slot="textarea"
			className={cn(
				"flex min-h-16 w-full rounded-(--r) bg-transparent px-2.5 py-2 text-sm text-ink transition-all outline-none [border:var(--hairline)] field-sizing-content",
				"placeholder:text-n4",
				"focus-visible:shadow-(--state-focus-ring)",
				"disabled:pointer-events-none disabled:opacity-(--state-disabled-opacity)",
				className,
			)}
			{...props}
		/>
	);
}

export { Textarea };
