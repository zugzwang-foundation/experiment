import type { DebatePost } from "./types";

/**
 * REPLY-IMAGE-EXPORT — the parent post ordinal that enables a reply's download
 * mark, or `null` when there must be no mark.
 *
 * ⛔ `null` UNDER A REMOVED PARENT (operator ruling, SC-1): the reply export
 * prints the parent's title, and a withheld argument's title must not reach an
 * image. One function for every mount, so the rule is written once.
 */
export function replyDownloadOrdinal(
	parent: DebatePost | null | undefined,
): number | null {
	return parent != null && !parent.removed ? parent.ordinal : null;
}

/**
 * The post a reply belongs to, found by the REPLY's id.
 *
 * ⚠ THE REPLY POP-UP MUST ASK THIS, NOT READ THE POST ON SCREEN. The pop-up's
 * reply is state captured when it opened, and a back swipe can change the
 * focused post while it stays open — so pairing it with the current post would
 * download a different post's reply under the same number. The reply's own id
 * names its real parent whatever the screen now shows.
 */
export function parentOfReply(
	posts: readonly DebatePost[],
	replyId: string,
): DebatePost | null {
	return (
		posts.find(
			(p) =>
				p.replies.support.some((r) => r.id === replyId) ||
				p.replies.counter.some((r) => r.id === replyId),
		) ?? null
	);
}
