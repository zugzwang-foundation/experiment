"use client";

import { useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { SEED_CHUNK_MAX } from "@/lib/seed";

// SEED-STAGING-1 — the browser half of /admin/seed. It previews the sheet,
// then drives /admin/seed/run one chunk at a time and shows progress. It holds
// the parsed rows between chunks; the server re-validates them every time, so
// nothing here is trusted. Stopping mid-way is safe: uploading the same sheet
// again skips every row that was already posted.

type RawRow = {
	rowNumber: number;
	market: string;
	user: string;
	side: string;
	stake: string;
	argument: string;
	replyTo: string;
};
type RowError = { rowNumber: number; message: string };
type Summary = {
	marketSlug: string;
	rows: number;
	yes: number;
	no: number;
	replies: number;
};
type Preview = {
	fileName: string;
	batchId: string;
	rows: RawRow[];
	validRows: number;
	errors: RowError[];
	summary: Summary[];
	participantsNeeded: number;
	openMarkets: string[];
};
type RowResult = {
	rowNumber: number;
	marketSlug: string;
	status: "posted" | "skipped" | "failed" | "halted";
	pseudonym: string | null;
	newPrice: string | null;
	message: string | null;
};
type ChunkResponse = {
	batchId: string;
	results: RowResult[];
	nextIndex: number;
	done: boolean;
	haltedMarkets: string[];
	errors: RowError[];
};

// The FRAME, never the argument (CLAUDE.md §3, social-content invention). The
// placeholder market is not a slug and every argument is empty, so the
// template cannot validate — let alone post — until the operator fills it in.
const TEMPLATE =
	"market,user,side,stake,argument,reply_to\n" +
	"<market-slug>,u1,YES,100,,\n" +
	"<market-slug>,u2,NO,50,,1\n";

async function postJson<T>(
	url: string,
	init: RequestInit,
): Promise<{ ok: true; data: T } | { ok: false; message: string }> {
	try {
		const res = await fetch(url, init);
		const body = (await res.json()) as
			| { ok: true; data: T }
			| { ok: false; error?: { message?: string } };
		if (body.ok) return body;
		return {
			ok: false,
			message: body.error?.message ?? `request failed (${res.status})`,
		};
	} catch (err) {
		return {
			ok: false,
			message: err instanceof Error ? err.message : "network error",
		};
	}
}

function formatPrice(p: string | null): string {
	if (p === null) return "—";
	const n = Number(p);
	return Number.isFinite(n) ? `${(n * 100).toFixed(1)}% YES` : p;
}

export function SeedUploader(): React.ReactElement {
	const fileRef = useRef<HTMLInputElement>(null);
	const stopRef = useRef(false);
	const [preview, setPreview] = useState<Preview | null>(null);
	const [results, setResults] = useState<RowResult[]>([]);
	const [busy, setBusy] = useState<"idle" | "preview" | "seeding">("idle");
	const [message, setMessage] = useState<string | null>(null);
	const [progress, setProgress] = useState({ done: 0, total: 0 });

	async function onPreview(): Promise<void> {
		const file = fileRef.current?.files?.[0];
		if (!file) {
			setMessage("Choose a .csv or .xlsx file first.");
			return;
		}
		setBusy("preview");
		setMessage(null);
		setResults([]);
		setPreview(null);
		const form = new FormData();
		form.set("file", file);
		const res = await postJson<Preview>("/admin/seed/preview", {
			method: "POST",
			body: form,
		});
		setBusy("idle");
		if (!res.ok) {
			setMessage(res.message);
			return;
		}
		setPreview(res.data);
		setProgress({ done: 0, total: res.data.validRows });
	}

	async function onSeed(): Promise<void> {
		if (!preview || preview.errors.length > 0) return;
		setBusy("seeding");
		setMessage(null);
		stopRef.current = false;
		const collected: RowResult[] = [];
		let fromIndex = 0;
		let haltedMarkets: string[] = [];
		for (;;) {
			if (stopRef.current) {
				setMessage(
					"Stopped. Upload the same sheet again to continue; posted rows are skipped.",
				);
				break;
			}
			const res = await postJson<ChunkResponse>("/admin/seed/run", {
				method: "POST",
				headers: { "content-type": "application/json" },
				body: JSON.stringify({
					rows: preview.rows,
					fromIndex,
					count: SEED_CHUNK_MAX,
					haltedMarkets,
				}),
			});
			if (!res.ok) {
				setMessage(`Stopped at row ${fromIndex + 1}: ${res.message}`);
				break;
			}
			if (res.data.errors.length > 0) {
				setPreview({ ...preview, errors: res.data.errors });
				setMessage(
					"The sheet no longer validates against live markets. Nothing more was posted.",
				);
				break;
			}
			collected.push(...res.data.results);
			setResults([...collected]);
			haltedMarkets = res.data.haltedMarkets;
			fromIndex = res.data.nextIndex;
			setProgress({ done: fromIndex, total: preview.validRows });
			if (res.data.done) break;
		}
		setBusy("idle");
	}

	const byMarket = new Map<
		string,
		{
			posted: number;
			skipped: number;
			failed: number;
			halted: number;
			price: string | null;
		}
	>();
	for (const r of results) {
		const m = byMarket.get(r.marketSlug) ?? {
			posted: 0,
			skipped: 0,
			failed: 0,
			halted: 0,
			price: null,
		};
		m[r.status] += 1;
		if (r.newPrice !== null) m.price = r.newPrice;
		byMarket.set(r.marketSlug, m);
	}
	const labelOf = new Map(
		preview?.rows.map((r) => [r.rowNumber, r.user]) ?? [],
	);
	const mapping = new Map<string, string>();
	for (const r of results) {
		const label = labelOf.get(r.rowNumber);
		if (label && r.pseudonym) mapping.set(label.toLowerCase(), r.pseudonym);
	}
	const failures = results.filter((r) => r.status === "failed");
	const pct =
		progress.total === 0
			? 0
			: Math.round((progress.done / progress.total) * 100);

	return (
		<div className="space-y-6">
			<section className="rounded-(--r) border border-n2 bg-n0 p-4">
				<div className="flex flex-wrap items-center gap-3">
					<input
						ref={fileRef}
						type="file"
						accept=".csv,.xlsx"
						disabled={busy !== "idle"}
						className="text-sm text-n6"
					/>
					<Button onClick={onPreview} disabled={busy !== "idle"}>
						{busy === "preview" ? "Checking…" : "Preview"}
					</Button>
					<a
						href={`data:text/csv;charset=utf-8,${encodeURIComponent(TEMPLATE)}`}
						download="seed-template.csv"
						className="text-n5 text-sm underline hover:text-ink"
					>
						Download template
					</a>
				</div>
				<p className="mt-3 text-n5 text-xs">
					Columns: market, user (optional label, never shown), side (YES/NO),
					stake, argument, reply_to (optional row number). An .xlsx file may
					instead use one tab per market, named by the market slug.
				</p>
			</section>

			{message ? (
				<p
					role="status"
					className="rounded-(--r) border border-n3 bg-n1 p-3 text-ink text-sm"
				>
					{message}
				</p>
			) : null}

			{preview ? (
				<section className="space-y-4">
					<h2 className="font-semibold text-ink text-sm">
						{preview.fileName}: {preview.validRows} valid row
						{preview.validRows === 1 ? "" : "s"}, {preview.participantsNeeded}{" "}
						participant{preview.participantsNeeded === 1 ? "" : "s"}
					</h2>
					{preview.errors.length > 0 ? (
						<div
							role="alert"
							className="rounded-(--r) border border-n5 bg-n1 p-3"
						>
							<p className="font-medium text-ink text-sm">
								{preview.errors.length} problem
								{preview.errors.length === 1 ? "" : "s"}. Fix the sheet and
								preview again; nothing will be seeded until it is clean.
							</p>
							<ul className="mt-2 max-h-64 list-disc space-y-1 overflow-y-auto pl-5 text-n6 text-xs">
								{preview.errors.map((e) => (
									<li key={`${e.rowNumber}-${e.message}`}>
										{e.rowNumber === 0 ? "File" : `Row ${e.rowNumber}`}:{" "}
										{e.message}
									</li>
								))}
							</ul>
						</div>
					) : null}
					{preview.summary.length > 0 ? (
						<table className="w-full text-left text-sm">
							<thead className="text-n5 text-xs">
								<tr>
									<th className="py-1">Market</th>
									<th className="py-1">Rows</th>
									<th className="py-1">YES</th>
									<th className="py-1">NO</th>
									<th className="py-1">Replies</th>
									<th className="py-1">Posted</th>
									<th className="py-1">Skipped</th>
									<th className="py-1">Failed / halted</th>
									<th className="py-1">Price now</th>
								</tr>
							</thead>
							<tbody className="text-ink">
								{preview.summary.map((s) => {
									const m = byMarket.get(s.marketSlug);
									return (
										<tr key={s.marketSlug} className="border-n2 border-t">
											<td className="py-1.5 font-mono text-xs">
												{s.marketSlug}
											</td>
											<td>{s.rows}</td>
											<td>{s.yes}</td>
											<td>{s.no}</td>
											<td>{s.replies}</td>
											<td>{m?.posted ?? 0}</td>
											<td>{m?.skipped ?? 0}</td>
											<td>{(m?.failed ?? 0) + (m?.halted ?? 0)}</td>
											<td>{formatPrice(m?.price ?? null)}</td>
										</tr>
									);
								})}
							</tbody>
						</table>
					) : null}
					<div className="flex flex-wrap items-center gap-3">
						<Button
							onClick={onSeed}
							disabled={
								busy !== "idle" ||
								preview.errors.length > 0 ||
								preview.validRows === 0
							}
						>
							{busy === "seeding"
								? "Seeding…"
								: `Seed ${preview.validRows} rows`}
						</Button>
						{busy === "seeding" ? (
							<Button
								variant="outline"
								onClick={() => {
									stopRef.current = true;
								}}
							>
								Stop after this chunk
							</Button>
						) : null}
						{progress.total > 0 ? (
							<div className="flex min-w-48 flex-1 items-center gap-2">
								<div
									className="h-2 flex-1 overflow-hidden rounded-(--r-chip) bg-n2"
									role="progressbar"
									aria-valuemin={0}
									aria-valuemax={progress.total}
									aria-valuenow={progress.done}
									aria-label="Seeding progress"
								>
									<div className="h-full bg-ink" style={{ width: `${pct}%` }} />
								</div>
								<span className="text-n5 text-xs">
									{progress.done} / {progress.total}
								</span>
							</div>
						) : null}
					</div>
				</section>
			) : null}

			{failures.length > 0 ? (
				<section
					role="alert"
					className="rounded-(--r) border border-n5 bg-n1 p-3"
				>
					<h3 className="font-medium text-ink text-sm">Failed rows</h3>
					<ul className="mt-2 list-disc space-y-1 pl-5 text-n6 text-xs">
						{failures.map((f) => (
							<li key={f.rowNumber}>
								Row {f.rowNumber} ({f.marketSlug}): {f.message}. The rest of
								that market was halted.
							</li>
						))}
					</ul>
				</section>
			) : null}

			{mapping.size > 0 ? (
				<section>
					<h3 className="mb-2 font-medium text-ink text-sm">
						Label → pseudonym
					</h3>
					<ul className="grid grid-cols-3 gap-x-6 gap-y-1 text-xs">
						{[...mapping].map(([label, pseudonym]) => (
							<li key={label} className="text-n6">
								<span className="font-mono">{label}</span> → {pseudonym}
							</li>
						))}
					</ul>
				</section>
			) : null}
		</div>
	);
}
