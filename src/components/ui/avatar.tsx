"use client";

import { Avatar as AvatarPrimitive } from "radix-ui";
import type * as React from "react";

import { cn } from "@/lib/utils";

/**
 * V50 — `xs` (16px) is the Discovery hero-head avatar
 * (surface_discovery_v1_0.html:84). It has to live HERE, on the primitive,
 * rather than as a consumer `className="size-4"`: the size rules below are
 * data-variants, so Tailwind compiles `data-[size=sm]:size-6` to
 * `&[data-size=sm]` with specificity (0,2,0) against a bare `.size-4`'s
 * (0,1,0). `size-6` therefore wins REGARDLESS of twMerge ordering — the trap
 * POLISH-1a item 4 documents and the reason register row PD-2-30 routes to the
 * primitive instead of the call site.
 *
 * The mockup's `.avatar{border-radius:50%; border:1.5px solid var(--ink)}` is
 * NOT ported by token name — the built `--avatar-ring` already carries the ring,
 * and `--color-ink` is #fafafa in this build (see C0 / plan pushback §3).
 *
 * ⚠ PFP-UI-1 (2026-08-26) — TWO CORRECTIONS TO THE SENTENCE ABOVE. Comment
 * only; nothing in this component's behaviour, class strings or API moved.
 *
 * 1 · IT CITES ONE SOURCE FOR A RULE THAT HAS TWO, AND THEY DISAGREE. `.avatar`
 *     is `border-radius:50%` in `surface_discovery_v1_0.html:84`, but `--imgr`
 *     in `surface_d5_v1_0.html:437` and `surface_profile_v1_0.html:181` — the
 *     mockup corpus is itself split, three files circle to six square. Written
 *     against whichever was opened first, it reads as though the corpus spoke
 *     with one voice. It did not, and a reader who checks only the cited line
 *     will not discover that.
 *
 * 2 · THE REASON THE MOCKUP'S RING VALUE IS UNUSABLE IS MISSING, AND IT IS THE
 *     LOAD-BEARING HALF. Saying `--color-ink` "is #fafafa in this build" makes
 *     the divergence sound incidental. It is not: **#fafafa IS `--color-no`,
 *     the NO pole** (values-log v0_3 §3). A 1.5px `--ink` ring on every avatar
 *     would put the NO-side colour around every identity in the product,
 *     including YES-side authors — a side signal on a surface that carries no
 *     side. That is why the value is not portable, rather than merely
 *     different. (Width too: 1.5px on the 16px `xs` mount is 9.4% of the
 *     diameter.) The shape half of the mockup — the circle — is now what every
 *     one of the eight mounts renders; it is only the ring VALUE that stays
 *     unported, and only for this reason.
 */
function Avatar({
	className,
	size = "default",
	...props
}: React.ComponentProps<typeof AvatarPrimitive.Root> & {
	size?: "default" | "xs" | "sm" | "lg";
}) {
	return (
		<AvatarPrimitive.Root
			data-slot="avatar"
			data-size={size}
			className={cn(
				"group/avatar relative flex size-8 shrink-0 rounded-full select-none after:absolute after:inset-0 after:rounded-full after:[border:var(--avatar-ring)] data-[size=lg]:size-10 data-[size=sm]:size-6 data-[size=xs]:size-4",
				className,
			)}
			{...props}
		/>
	);
}

function AvatarImage({
	className,
	...props
}: React.ComponentProps<typeof AvatarPrimitive.Image>) {
	return (
		<AvatarPrimitive.Image
			data-slot="avatar-image"
			className={cn(
				"aspect-square size-full rounded-full object-cover",
				className,
			)}
			{...props}
		/>
	);
}

function AvatarFallback({
	className,
	...props
}: React.ComponentProps<typeof AvatarPrimitive.Fallback>) {
	return (
		<AvatarPrimitive.Fallback
			data-slot="avatar-fallback"
			className={cn(
				"flex size-full items-center justify-center rounded-full bg-muted text-sm text-muted-foreground group-data-[size=sm]/avatar:text-xs group-data-[size=xs]/avatar:text-[9px]",
				className,
			)}
			{...props}
		/>
	);
}

function AvatarBadge({ className, ...props }: React.ComponentProps<"span">) {
	return (
		<span
			data-slot="avatar-badge"
			className={cn(
				"absolute right-0 bottom-0 z-10 inline-flex items-center justify-center rounded-full bg-primary text-primary-foreground bg-blend-color ring-2 ring-background select-none",
				"group-data-[size=sm]/avatar:size-2 group-data-[size=sm]/avatar:[&>svg]:hidden",
				"group-data-[size=default]/avatar:size-2.5 group-data-[size=default]/avatar:[&>svg]:size-2",
				"group-data-[size=lg]/avatar:size-3 group-data-[size=lg]/avatar:[&>svg]:size-2",
				className,
			)}
			{...props}
		/>
	);
}

function AvatarGroup({ className, ...props }: React.ComponentProps<"div">) {
	return (
		<div
			data-slot="avatar-group"
			className={cn(
				"group/avatar-group flex -space-x-2 *:data-[slot=avatar]:ring-2 *:data-[slot=avatar]:ring-background",
				className,
			)}
			{...props}
		/>
	);
}

function AvatarGroupCount({
	className,
	...props
}: React.ComponentProps<"div">) {
	return (
		<div
			data-slot="avatar-group-count"
			className={cn(
				"relative flex size-8 shrink-0 items-center justify-center rounded-full bg-muted text-sm text-muted-foreground ring-2 ring-background group-has-data-[size=lg]/avatar-group:size-10 group-has-data-[size=sm]/avatar-group:size-6 [&>svg]:size-4 group-has-data-[size=lg]/avatar-group:[&>svg]:size-5 group-has-data-[size=sm]/avatar-group:[&>svg]:size-3",
				className,
			)}
			{...props}
		/>
	);
}

export {
	Avatar,
	AvatarBadge,
	AvatarFallback,
	AvatarGroup,
	AvatarGroupCount,
	AvatarImage,
};
