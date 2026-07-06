"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { v7 as uuidv7 } from "uuid";

import { createMarketAction } from "@/server/admin/markets/create";

// MEDIA.1 (§4 / SPEC.1 §15 / K3) — the admin create form's client island. The
// D-15.e zero-client-JS posture is intentionally broken here: SPEC.1 §15
// mandates out-of-band signed-PUT (browser → R2 direct, server bypassed for
// bytes). Flow: pre-generate the market UUIDv7 → per image POST
// /admin/markets/media/sign then PUT the bytes to R2 → on submit call
// `createMarketAction` with the media manifest. The service + state machine
// remain the real gate (this island only orchestrates the upload + submit).

interface MediaEntry {
	mediaId: string;
	key: string;
	displayOrder: number;
	fileName: string;
}

// The sign route speaks the SPEC.2 §4.4 envelope (AUDIT-FIX-B7b A29).
interface SignResponse {
	ok: true;
	data: { mediaId: string; putUrl: string; key: string };
}

export function CreateMarketForm({
	initialError,
}: {
	initialError?: string;
}): React.ReactElement {
	const router = useRouter();
	const [isPending, startTransition] = useTransition();
	// The market PK is pre-generated ONCE so media bytes upload to
	// `m/<marketId>/` before the row exists (Q3). Stable across re-renders.
	const [marketId] = useState(() => uuidv7());
	const [media, setMedia] = useState<MediaEntry[]>([]);
	const [defaultMediaId, setDefaultMediaId] = useState<string | null>(null);
	const [uploading, setUploading] = useState(false);
	const [error, setError] = useState<string | null>(initialError ?? null);

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
				setMedia((prev) => {
					const next: MediaEntry[] = [
						...prev,
						{ mediaId, key, displayOrder: prev.length, fileName: file.name },
					];
					return next;
				});
				// Auto-select the first uploaded image as the default.
				setDefaultMediaId((prev) => prev ?? mediaId);
			}
		} catch (err) {
			setError(err instanceof Error ? err.message : "upload_failed");
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
			setError(result.error.code);
		});
	}

	return (
		<form onSubmit={onSubmit}>
			{error ? <p>Error: {error}</p> : null}
			<p>
				<label>
					Slug <input name="slug" required />
				</label>
			</p>
			<p>
				<label>
					Title (question) <input name="title" required />
				</label>
			</p>
			<p>
				<label>
					Resolution criterion <textarea name="description" required />
				</label>
			</p>
			<p>
				<label>
					Resolution deadline{" "}
					<input type="datetime-local" name="resolutionDeadline" required />
				</label>
			</p>
			<fieldset>
				<legend>Market media (≥1 image, one default)</legend>
				<input
					type="file"
					accept="image/jpeg,image/png,image/webp,image/gif,image/avif"
					multiple
					onChange={handleFiles}
					disabled={uploading}
				/>
				{uploading ? <p>Uploading…</p> : null}
				<ul>
					{media.map((m) => (
						<li key={m.mediaId}>
							<label>
								<input
									type="radio"
									name="defaultMedia"
									checked={m.mediaId === defaultMediaId}
									onChange={() => setDefaultMediaId(m.mediaId)}
								/>{" "}
								{m.fileName} (default)
							</label>
						</li>
					))}
				</ul>
			</fieldset>
			<p>
				<label>
					Explainer video URL (optional, YouTube){" "}
					<input type="url" name="mediaVideoUrl" />
				</label>
			</p>
			<button type="submit" disabled={uploading || isPending}>
				Create
			</button>
		</form>
	);
}
