"use client";

import { ImageOff, LoaderCircle, Upload } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";
import { v7 as uuidv7 } from "uuid";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { createMarketAction } from "@/server/admin/markets/create";

// MEDIA.1 (§4 / SPEC.1 §15 / K3) — the admin create form's client island. The
// D-15.e zero-client-JS posture is intentionally broken here: SPEC.1 §15
// mandates out-of-band signed-PUT (browser → R2 direct, server bypassed for
// bytes). Flow: pre-generate the market UUIDv7 → per image POST
// /admin/markets/media/sign then PUT the bytes to R2 → on submit call
// `createMarketAction` with the media manifest. The service + state machine
// remain the real gate (this island only orchestrates the upload + submit).
//
// ADMIN-UI — presentation only. The field names, the sign/PUT sequence, the
// manifest shape (`mediaId, key, displayOrder, isDefault`), the submit and the
// `?ok=created` push are unchanged. Added, all client-local: an object-URL
// thumbnail per uploaded file (never sent anywhere, revoked on unmount),
// character counters against the ceilings the page passes down, and error
// codes mapped to operator copy (an unmapped code still shows itself).
// ⚠ CC does not write market copy (CLAUDE.md §3): no field carries an example
// question, criterion or date — only format hints.

interface MediaEntry {
	mediaId: string;
	key: string;
	displayOrder: number;
	fileName: string;
	/** Client-local `blob:` preview. Never part of the manifest. */
	previewUrl: string;
}

// The sign route speaks the SPEC.2 §4.4 envelope (AUDIT-FIX-B7b A29).
interface SignResponse {
	ok: true;
	data: { mediaId: string; putUrl: string; key: string };
}

interface FormError {
	code: string;
	fieldErrors?: Record<string, string[]>;
}

const ERROR_COPY: Record<string, string> = {
	slug_invalid: "The slug must be kebab-case, 3–80 characters.",
	slug_taken: "That slug is already taken.",
	content_required: "The title and the resolution criterion are both required.",
	media_required: "Upload at least one market image.",
	default_media_required: "Choose exactly one default image.",
	video_url_invalid: "The explainer video URL must be a YouTube URL.",
	market_id_conflict:
		"This form's market id already exists. Reload the page to start a fresh form (uploads will need repeating).",
	deadline_in_past: "The resolution deadline must be in the future.",
	deadline_ceiling:
		"The resolution deadline cannot be after the conclusion freeze (2026-11-05 23:59 UTC).",
	validation_error: "One or more fields are invalid.",
	admin_session_required:
		"Your admin session has expired — sign in again to continue.",
	error_internal: "Something went wrong — please try again.",
	// Upload leg (the sign route's envelope codes + this island's own).
	error_image_mime_rejected:
		"That file type is not accepted. Use JPEG, PNG, WebP, GIF or AVIF.",
	error_image_oversize: "That image is too large.",
	error_storage_unavailable:
		"Image storage is unavailable right now — please retry shortly.",
	error_invalid_market_id:
		"This form's market id was rejected. Reload the page to start a fresh form.",
	error_invalid_request_body: "The upload request was rejected — please retry.",
	error_invalid_json: "The upload request was rejected — please retry.",
	error_origin_rejected:
		"The upload was refused for this origin. Use the console at its own address.",
	sign_failed: "The upload could not be authorised — please retry.",
	upload_failed: "The image upload failed — please retry.",
};

const FIELD_LABEL: Record<string, string> = {
	slug: "Slug",
	title: "Title",
	description: "Resolution criterion",
	resolutionDeadline: "Resolution deadline",
	marketId: "Market id",
	media: "Market media",
	mediaVideoUrl: "Explainer video URL",
};

const label = "flex flex-col gap-1.5 text-sm";
const labelText = "font-medium text-ink";
const hint = "text-n5 text-xs";

function Counter({
	length,
	max,
}: {
	length: number;
	max: number | undefined;
}): React.ReactElement | null {
	if (max === undefined) return null;
	const over = length > max;
	return (
		<span
			className={cn(
				"text-xs tabular-nums",
				over ? "font-semibold text-ink" : "text-n5",
			)}
		>
			{length}/{max}
			{over ? " — over the limit" : ""}
		</span>
	);
}

export function CreateMarketForm({
	initialError,
	titleMaxChars,
	descriptionMaxChars,
}: {
	initialError?: string;
	titleMaxChars?: number;
	descriptionMaxChars?: number;
}): React.ReactElement {
	const router = useRouter();
	const [isPending, startTransition] = useTransition();
	// The market PK is pre-generated ONCE so media bytes upload to
	// `m/<marketId>/` before the row exists (Q3). Stable across re-renders.
	const [marketId] = useState(() => uuidv7());
	const [media, setMedia] = useState<MediaEntry[]>([]);
	const [defaultMediaId, setDefaultMediaId] = useState<string | null>(null);
	const [uploading, setUploading] = useState(false);
	const [error, setError] = useState<FormError | null>(
		initialError ? { code: initialError } : null,
	);
	const [titleLength, setTitleLength] = useState(0);
	const [descriptionLength, setDescriptionLength] = useState(0);

	// Revoke every preview URL when the form unmounts (a navigation after a
	// successful create included).
	const previews = useRef<string[]>([]);
	useEffect(() => {
		return () => {
			for (const url of previews.current) URL.revokeObjectURL(url);
		};
	}, []);

	async function handleFiles(
		event: React.ChangeEvent<HTMLInputElement>,
	): Promise<void> {
		const files = Array.from(event.target.files ?? []);
		if (files.length === 0) return;
		setUploading(true);
		setError(null);
		try {
			for (const file of files) {
				const signRes = await fetch("/admin/markets/media/sign", {
					method: "POST",
					headers: { "content-type": "application/json" },
					body: JSON.stringify({
						marketId,
						contentType: file.type,
						byteSize: file.size,
					}),
				});
				if (!signRes.ok) {
					const body = (await signRes.json().catch(() => null)) as {
						error?: { code?: string };
					} | null;
					throw new Error(body?.error?.code ?? "sign_failed");
				}
				const { mediaId, putUrl, key } = (
					(await signRes.json()) as SignResponse
				).data;
				const putRes = await fetch(putUrl, {
					method: "PUT",
					headers: { "content-type": file.type },
					body: file,
				});
				if (!putRes.ok) throw new Error("upload_failed");
				const previewUrl = URL.createObjectURL(file);
				previews.current.push(previewUrl);
				setMedia((prev) => {
					const next: MediaEntry[] = [
						...prev,
						{
							mediaId,
							key,
							displayOrder: prev.length,
							fileName: file.name,
							previewUrl,
						},
					];
					return next;
				});
				// Auto-select the first uploaded image as the default.
				setDefaultMediaId((prev) => prev ?? mediaId);
			}
		} catch (err) {
			setError({
				code: err instanceof Error ? err.message : "upload_failed",
			});
		} finally {
			setUploading(false);
			event.target.value = "";
		}
	}

	function onSubmit(event: React.FormEvent<HTMLFormElement>): void {
		event.preventDefault();
		const formEl = event.currentTarget;
		const fd = new FormData(formEl);
		fd.set("marketId", marketId);
		fd.set(
			"media",
			JSON.stringify(
				media.map((m) => ({
					mediaId: m.mediaId,
					key: m.key,
					displayOrder: m.displayOrder,
					isDefault: m.mediaId === defaultMediaId,
				})),
			),
		);
		startTransition(async () => {
			const result = await createMarketAction(fd);
			if (result.ok) {
				router.push(`/admin/markets/${result.data.marketId}?ok=created`);
				return;
			}
			setError({
				code: result.error.code,
				fieldErrors: result.error.field_errors,
			});
		});
	}

	const fieldErrorLines = error?.fieldErrors
		? Object.entries(error.fieldErrors).flatMap(([field, messages]) =>
				messages.map((m) => `${FIELD_LABEL[field] ?? field}: ${m}`),
			)
		: [];

	return (
		<form onSubmit={onSubmit} className="flex flex-col gap-5">
			{error ? (
				<div
					role="alert"
					className="rounded-(--r) border border-n5 bg-n1 px-3.5 py-2.5 text-ink text-sm"
				>
					<p className="font-semibold">
						{ERROR_COPY[error.code] ??
							"That could not be completed — please try again."}
					</p>
					{fieldErrorLines.length > 0 ? (
						<ul className="mt-1 list-disc pl-5 text-n6">
							{fieldErrorLines.map((line) => (
								<li key={line}>{line}</li>
							))}
						</ul>
					) : null}
					<p className="mt-1 font-mono text-n4 text-xs">code: {error.code}</p>
				</div>
			) : null}

			<fieldset className="flex flex-col gap-4 rounded-(--r) border border-n2 bg-n0 p-5 shadow-(--elev-1)">
				<legend className="px-1 font-semibold text-ink text-sm">
					Question
				</legend>
				<label htmlFor="create-slug" className={label}>
					<span className={labelText}>Slug</span>
					<Input
						id="create-slug"
						name="slug"
						required
						autoComplete="off"
						className="font-mono"
					/>
					<span className={hint}>
						The participant URL segment: lowercase words joined by hyphens, 3–80
						characters.
					</span>
				</label>
				<label htmlFor="create-title" className={label}>
					<span className="flex items-baseline justify-between gap-2">
						<span className={labelText}>Title (question)</span>
						<Counter length={titleLength} max={titleMaxChars} />
					</span>
					<Input
						id="create-title"
						name="title"
						required
						autoComplete="off"
						onChange={(e) => setTitleLength(e.target.value.length)}
					/>
					<span className={hint}>
						A binary YES/NO question. Operators confirming a Resolve or Void
						will type it exactly.
					</span>
				</label>
			</fieldset>

			<fieldset className="flex flex-col gap-4 rounded-(--r) border border-n2 bg-n0 p-5 shadow-(--elev-1)">
				<legend className="px-1 font-semibold text-ink text-sm">
					Resolution
				</legend>
				<label htmlFor="create-description" className={label}>
					<span className="flex items-baseline justify-between gap-2">
						<span className={labelText}>Resolution criterion</span>
						<Counter length={descriptionLength} max={descriptionMaxChars} />
					</span>
					<Textarea
						id="create-description"
						name="description"
						required
						rows={5}
						className="min-h-28"
						onChange={(e) => setDescriptionLength(e.target.value.length)}
					/>
				</label>
				<label htmlFor="create-resolution-deadline" className={label}>
					<span className={labelText}>
						Resolution deadline (UTC — not your local time){" "}
					</span>
					<Input
						id="create-resolution-deadline"
						type="datetime-local"
						name="resolutionDeadline"
						required
						className="w-64 font-mono [color-scheme:dark]"
					/>
					<span className={hint}>
						The picker shows a wall clock; the value is stored as UTC. Must be
						in the future and no later than the conclusion freeze, 2026-11-05
						23:59 UTC.
					</span>
				</label>
			</fieldset>

			<fieldset className="flex flex-col gap-4 rounded-(--r) border border-n2 bg-n0 p-5 shadow-(--elev-1)">
				<legend className="px-1 font-semibold text-ink text-sm">
					Market media (≥1 image, one default)
				</legend>
				<label
					className={cn(
						"flex cursor-pointer flex-col items-center justify-center gap-1.5 rounded-(--r) border border-n3 border-dashed bg-ground px-4 py-6 text-center text-sm outline-none transition-colors hover:border-n5 has-[input:focus-visible]:shadow-(--state-focus-ring)",
						uploading && "cursor-progress opacity-70",
					)}
				>
					{uploading ? (
						<LoaderCircle aria-hidden className="size-5 animate-spin text-n5" />
					) : (
						<Upload aria-hidden className="size-5 text-n5" />
					)}
					<span className="font-medium text-ink">
						{uploading ? "Uploading…" : "Choose images to upload"}
					</span>
					<span className={hint}>
						JPEG, PNG, WebP, GIF or AVIF. Each file uploads straight to storage.
					</span>
					<input
						type="file"
						accept="image/jpeg,image/png,image/webp,image/gif,image/avif"
						multiple
						onChange={handleFiles}
						disabled={uploading}
						className="sr-only"
					/>
				</label>
				<span aria-live="polite" className="sr-only">
					{uploading ? "Uploading…" : `${media.length} image(s) uploaded`}
				</span>
				{media.length === 0 ? (
					<p className="flex items-center gap-2 text-n5 text-sm">
						<ImageOff aria-hidden className="size-4" />
						No images uploaded yet.
					</p>
				) : (
					<ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
						{media.map((m) => {
							const isDefault = m.mediaId === defaultMediaId;
							return (
								<li key={m.mediaId}>
									<label
										className={cn(
											"flex h-full cursor-pointer flex-col gap-2 rounded-(--r) border bg-ground p-2 text-sm has-[input:focus-visible]:shadow-(--state-focus-ring)",
											isDefault ? "border-n6" : "border-n2 hover:border-n3",
										)}
									>
										{/* biome-ignore lint/performance/noImgElement: a client-local blob: preview of a file the operator just picked; next/image cannot load blob URLs. */}
										<img
											src={m.previewUrl}
											alt=""
											className="aspect-video w-full rounded-(--imgr) bg-n1 object-cover"
										/>
										<span className="flex items-center gap-2">
											<input
												type="radio"
												name="defaultMedia"
												checked={isDefault}
												onChange={() => setDefaultMediaId(m.mediaId)}
												className="size-4 shrink-0 accent-(--color-n7)"
											/>
											<span className="min-w-0 flex-1 truncate text-n6">
												{m.fileName}
											</span>
											{isDefault ? (
												<span className="shrink-0 rounded-(--r-chip) border border-n5 px-1.5 font-medium text-[11px] text-ink uppercase leading-4 tracking-wide">
													Default
												</span>
											) : null}
										</span>
									</label>
								</li>
							);
						})}
					</ul>
				)}
			</fieldset>

			<fieldset className="flex flex-col gap-4 rounded-(--r) border border-n2 bg-n0 p-5 shadow-(--elev-1)">
				<legend className="px-1 font-semibold text-ink text-sm">Video</legend>
				<label htmlFor="create-media-video-url" className={label}>
					<span className={labelText}>
						Explainer video URL (optional, YouTube){" "}
					</span>
					<Input
						id="create-media-video-url"
						type="url"
						name="mediaVideoUrl"
						autoComplete="off"
					/>
				</label>
			</fieldset>

			<div className="flex flex-wrap items-center gap-3">
				<Button
					type="submit"
					size="lg"
					disabled={uploading || isPending}
					className="px-4"
				>
					{isPending ? "Creating…" : "Create"}
				</Button>
				<span className={hint}>
					The market is created as a Draft. It opens when you seed its pool.
				</span>
			</div>
		</form>
	);
}
