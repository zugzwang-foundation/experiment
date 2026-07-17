/**
 * Type-only surface for the debate-view client components. The view-model SHAPE
 * is imported from the server aggregator with `import type` — erased at compile
 * time, so NO runtime `server-only` import crosses into the client bundle (the
 * standard Next.js pattern for handing an RSC-computed view-model's type to the
 * client boundary that renders it). The masking discriminated union lives in
 * `load-debate-view.ts`; a removed entry has no body/author field at the type
 * level, so a client leak is a compile error here too.
 */
import type {
	DebatePost,
	DebateReply,
} from "@/server/debate-view/load-debate-view";

export type {
	DebateMarketHeader,
	DebatePost,
	DebateReply,
	DebateViewModel,
	ReplyAggregate,
	ReplyGroups,
} from "@/server/debate-view/load-debate-view";
export type { AuthorIdentity } from "@/server/debate-view/resolve-authors";
export type { ViewerMarketContext } from "@/server/debate-view/viewer-context";

/** The present (non-removed) post/reply variants — content + author available. */
export type PresentPost = Extract<DebatePost, { removed: false }>;
export type PresentReply = Extract<DebateReply, { removed: false }>;

export type Side = "YES" | "NO";
export type Marker = "Flipped" | "Exited" | "none";
