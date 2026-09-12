"use client";

import { Download, LoaderCircle } from "lucide-react";
import { useParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";

import { Button } from "@/components/ui/button";

/** `<market-slug>-post-<ordinal>.jpg` — mirrors the route's own naming. */
export function postImageFilename(slug: string, ordinal: number): string {
	return `${slug}-post-${ordinal}.jpg`;
}

export function postImageHref(slug: string, ordinal: number): string {
	return `/m/${encodeURIComponent(slug)}/export/image?post=${ordinal}`;
}

const ERROR_COPY = "Couldn't build the image — try again";
/**
 * ⚠ THE WAIT IS REAL AND WAS UNANNOUNCED. The image is rendered SERVER-SIDE —
 * Satori lays the composition out, fetches and transcodes the avatar and the
 * post's attachment, then `sharp` encodes a 2400×1400 JPEG — so a click is
 * followed by a pause of a second or more before the browser's own download
 * appears. The only signal was the icon's pulse, which reads as decoration
 * rather than as "working": a reader who clicks and sees nothing happen clicks
 * again, and a second click is a second render.
 *
 * ⚠ PRESENT TENSE, because it describes what is happening while it is on
 * screen; the label is removed the instant the blob is saved.
 */
const BUSY_COPY = "Preparing the image…";

/**
 * The post card's download mark, now a working control. One click fetches
 * `/m/[slug]/export/image?post=N` — the server-rendered JPEG of this post and
 * its market — and hands the browser the bytes as a download. No new page, no
 * modal: the anchor is synthetic and lives for one click.
 *
 * ⚠ Fetch → blob → anchor, NOT a bare `<a download>`. A plain anchor cannot
 * tell success from a 404 page saved as `.jpg`, cannot disable itself while
 * the server renders, and cannot report failure. Here the response is checked
 * for `ok`, for the `image/jpeg` type and for a non-empty body before anything
 * is saved, so a corrupt or blank file is never silently produced; the button
 * is disabled for the duration; and a failure surfaces as a live-region line
 * beside the mark, in the same shape the composer's `ErrorStrip` uses.
 *
 * The slug comes from the route (`useParams`) rather than a threaded prop:
 * this component only ever mounts under `/m/[slug]`, and `ArgProfile` is
 * shared by five mounts that would otherwise all have to carry a value four
 * of them never use. Outside that route — a test harness, a future mount —
 * there is no slug, and the control renders as the inert, disabled placeholder
 * it used to be rather than a button that promises a download it cannot make.
 */
export function DownloadPostImage({ ordinal }: { ordinal: number }) {
	const params = useParams<{ slug?: string }>();
	const slug = typeof params?.slug === "string" ? params.slug : null;
	const [phase, setPhase] = useState<"idle" | "busy" | "error">("idle");
	const mounted = useRef(true);
	useEffect(() => {
		mounted.current = true;
		return () => {
			mounted.current = false;
		};
	}, []);

	const busy = phase === "busy";
	const disabled = slug === null || busy;

	const onClick = async () => {
		if (slug === null || busy) {
			return;
		}
		setPhase("busy");
		try {
			const res = await fetch(postImageHref(slug, ordinal), {
				cache: "no-store",
			});
			if (!res.ok) {
				throw new Error(`export image ${res.status}`);
			}
			const blob = await res.blob();
			if (blob.size === 0 || blob.type !== "image/jpeg") {
				throw new Error("export image: not a jpeg");
			}
			saveBlob(blob, postImageFilename(slug, ordinal));
			if (mounted.current) {
				setPhase("idle");
			}
		} catch {
			if (mounted.current) {
				setPhase("error");
			}
		}
	};

	return (
		<span className="ml-auto flex h-5 shrink-0 items-center gap-1.5">
			{/* ⚠ ONE SLOT, TWO STATES — busy and error are mutually exclusive and share
			    this position, so the row's geometry is the same whichever is showing
			    and the button never moves under the cursor mid-click. */}
			{/* ⛔⛔ THE BUSY COPY IS `sr-only` NOW — operator ruling, and the change is
			    only in what is PAINTED. It was a visible grey line beside the mark,
			    and it looked like a fault: an identity row that is otherwise chips
			    and glyphs grew a sentence for a second or two, the row reflowed
			    around it, and the one thing it said was that nothing had gone wrong
			    yet. The spinner on the mark itself says the same thing without
			    asking for a column.
			    ⛔ THE ANNOUNCEMENT SURVIVES, AND DELETING THE NODE WOULD HAVE BEEN
			    THE EASY WRONG MOVE. A spinner is invisible to a screen reader, and
			    `aria-busy` alone is not announced by most of them — so the live
			    region is what still tells a non-sighted reader that their click
			    registered, which is the whole reason the label was added. It is
			    hidden from the eye, not from the tree. */}
			{busy ? (
				<span
					role="status"
					aria-live="polite"
					data-testid="download-post-image-busy"
					className="sr-only"
				>
					{BUSY_COPY}
				</span>
			) : phase === "error" ? (
				<span
					role="status"
					aria-live="polite"
					data-testid="download-post-image-error"
					className="text-[10px] text-n5"
				>
					{ERROR_COPY}
				</span>
			) : null}
			<Button
				type="button"
				variant="ghost"
				size="icon"
				disabled={disabled}
				aria-disabled={disabled ? "true" : undefined}
				aria-busy={busy ? "true" : undefined}
				// ⚠ NO `title` ATTRIBUTE, AND ITS ABSENCE IS A GUARD, NOT AN OVERSIGHT.
				// TIME-1's G5 bans `[title]` anywhere on a post card, because a native
				// tooltip is exactly how an absolute timestamp leaks back onto a surface
				// that is supposed to speak in relative time. This control's tooltip
				// carried no time and tripped it anyway — which is the guard working: a
				// blanket ban is the only version of that rule nobody has to police
				// case by case. `aria-label` already names the control, so what is lost
				// is a hover hint on an icon whose meaning the label carries.
				aria-label="Download post image"
				onClick={onClick}
				// ⚠ `text-ink` — the SAME token `Replies · n` uses two elements to the
				// left, so the mark and the one promoted field on this row sit at the
				// same emphasis. `icon` (32px / 20px) is the size the placeholder had.
				className="shrink-0 text-ink [&_svg]:size-5"
			>
				{/* ⛔⛔ `animate-spin` IS THE ONE THING HERE THAT COULD HAVE SHIPPED
				    SILENTLY DEAD, and it was checked rather than assumed. The art
				    layer authors its own `@keyframes` and records why: `.animate-spin`
				    was absent from this app's built CSS, so the obvious utility would
				    have produced rings that never turned — no error, no warning, just
				    a still icon. ⚠ THE CAUSE IS THE PART THAT MATTERS: it was absent
				    because NOTHING IN THE TREE USED IT, and Tailwind v4 emits on
				    demand. This is the first use, so the utility and its keyframes are
				    emitted for it — verified by building and reading
				    `.next/static/chunks/*.css`, not by reasoning from the note.
				    ⇒ If a later change removes this icon, the art layer's measurement
				    becomes true again for whoever reaches for `animate-spin` next.
				    ⚠ `animate-pulse` ON THE WHOLE BUTTON IS WHAT THIS REPLACES. Fading
				    the mark in and out reads as decoration — the reader sees a styled
				    control, not a working one — and it was the only signal once the
				    label went. A rotation is the one motion that means "in progress"
				    without a caption. */}
				{busy ? <LoaderCircle className="animate-spin" /> : <Download />}
			</Button>
		</span>
	);
}

function saveBlob(blob: Blob, filename: string): void {
	const url = URL.createObjectURL(blob);
	const a = document.createElement("a");
	a.href = url;
	a.download = filename;
	a.rel = "noopener";
	a.style.display = "none";
	document.body.appendChild(a);
	a.click();
	a.remove();
	// Revoke on the next macrotask — a synchronous revoke can race the click
	// in Safari and abort the download it just started.
	setTimeout(() => URL.revokeObjectURL(url), 1000);
}
