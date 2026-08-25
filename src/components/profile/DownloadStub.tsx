import { Download } from "lucide-react";

import { Button } from "@/components/ui/button";

/**
 * UNWIRE-1 — extracted from `bookmarks/BookmarkToggle.tsx`'s `CardActions`
 * (SUB-1), which bundled this permanently-disabled download affordance with
 * the bookmark trigger. The bookmark module is unwired product-wide, but
 * nobody ratified removing this control from Profile's argument cards — its
 * only consumer, `ArgumentList.tsx`, keeps it, byte-identical: same `Button`
 * props, same disabled state, same icon, same accessible name.
 *
 * R4 — the mockup's second `.cardacts` glyph (`:628`). It reuses the SHIPPED
 * disabled render the bookmark module's own inert cells used — same
 * `variant`, same `size`, same `disabled` + `aria-disabled` pair.
 * ⛔ THE LABEL SAYS WHY IT CANNOT BE USED: "no per-argument export exists
 * yet" names the absence of an export. A bare `aria-label="Download"` on a
 * control that can never fire would be a promise the surface cannot keep.
 */
export function DownloadStub() {
	return (
		<Button
			variant="ghost"
			size="icon-xs"
			disabled
			aria-disabled="true"
			aria-label="Download — no per-argument export exists yet"
		>
			<Download />
		</Button>
	);
}
