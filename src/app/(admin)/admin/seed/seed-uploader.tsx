"use client";

import {
	AlertTriangle,
	CheckCircle2,
	Download,
	FileSpreadsheet,
	Loader2,
	Square,
	Upload,
	X,
} from "lucide-react";
import { useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { SEED_CHUNK_MAX } from "@/lib/seed";
import { cn } from "@/lib/utils";

// SEED-STAGING-1 — the browser half of /admin/seed. It previews the sheet,
// then drives /admin/seed/run one chunk at a time and shows progress. It holds
// the parsed rows between chunks; the server re-validates them every time, so
// nothing here is trusted. Stopping mid-way is safe: uploading the same sheet
// again skips every row that was already posted.
//
// Styling uses only the admin console's neutral tokens (n0–n7, ink); the side
// poles are deliberately not used here, so YES and NO are told apart by label.

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
type Counts = {
	posted: number;
	skipped: number;
	failed: number;
	halted: number;
	price: string | null;
};

// The FRAME, never the argument (CLAUDE.md §3, social-content invention). The
// placeholder market is not a slug and every argument is empty, so the
// template cannot validate — let alone post — until the operator fills it in.
const TEMPLATE =
	"market,user,side,stake,argument,reply_to\n" +
	"<market-slug>,u1,YES,100,,\n" +
	"<market-slug>,u2,NO,50,,1\n";

const ACCEPTED = [".csv", ".xlsx"];

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

function formatBytes(n: number): string {
	if (n < 1024) return `${n} B`;
	if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
	return `${(n / 1024 / 1024).toFixed(1)} MB`;
}

function plural(n: number, word: string): string {
	return `${n} ${word}${n === 1 ? "" : "s"}`;
}

const panel = "rounded-(--r) border border-n2 bg-n0 shadow-(--elev-1)";

// ── small presentational pieces ────────────────────────────────────────────

function Steps({ current }: { current: 1 | 2 | 3 | 4 }): React.ReactElement {
	const steps = ["Upload", "Preview", "Seed"];
	return (
		<ol className="flex flex-wrap items-center gap-2 text-xs">
			{steps.map((label, i) => {
				const n = i + 1;
				const done = current > n;
				const active = current === n;
				return (
					<li key={label} className="flex items-center gap-2">
						<span
							className={cn(
								"inline-flex items-center gap-2 rounded-(--r-chip) border px-2.5 py-1",
								active && "border-n5 bg-n1 font-semibold text-ink",
								done && "border-n3 text-n6",
								!active && !done && "border-n2 text-n4",
							)}
						>
							<span
								className={cn(
									"inline-flex size-4 items-center justify-center rounded-full font-mono text-[10px] leading-none",
									active ? "bg-ink text-ground" : "bg-n2 text-n6",
								)}
							>
								{done ? "✓" : n}
							</span>
							{label}
						</span>
						{n < steps.length ? (
							<span aria-hidden className="h-px w-6 bg-n2" />
						) : null}
					</li>
				);
			})}
		</ol>
	);
}

function Stat({
	label,
	value,
	tone = "plain",
}: {
	label: string;
	value: React.ReactNode;
	tone?: "plain" | "warn";
}): React.ReactElement {
	return (
		<div
			className={cn(
				"rounded-(--r) border px-4 py-3",
				tone === "warn" ? "border-n5 bg-n1" : "border-n2 bg-n0",
			)}
		>
			<p className="text-n5 text-xs uppercase tracking-wider">{label}</p>
			<p className="mt-1 font-semibold text-2xl text-ink tabular-nums leading-tight">
				{value}
			</p>
		</div>
	);
}

function Badge({
	children,
	strong = false,
}: {
	children: React.ReactNode;
	strong?: boolean;
}): React.ReactElement {
	return (
		<span
			className={cn(
				"inline-flex items-center rounded-(--r-chip) border px-1.5 py-0.5 text-[11px] tabular-nums leading-none",
				strong ? "border-n5 bg-n2 text-ink" : "border-n2 text-n6",
			)}
		>
			{children}
		</span>
	);
}

function MarketCard({
	s,
	m,
}: {
	s: Summary;
	m: Counts | undefined;
}): React.ReactElement {
	const yesPct = s.rows === 0 ? 0 : Math.round((s.yes / s.rows) * 100);
	const problems = (m?.failed ?? 0) + (m?.halted ?? 0);
	return (
		<div className={cn(panel, "flex flex-col gap-3 p-4")}>
			<div className="flex items-start justify-between gap-2">
				<p className="min-w-0 break-all font-mono text-ink text-xs">
					{s.marketSlug}
				</p>
				{m && problems === 0 && m.posted + m.skipped === s.rows ? (
					<CheckCircle2
						aria-label="complete"
						className="size-4 shrink-0 text-n6"
					/>
				) : null}
				{problems > 0 ? (
					<AlertTriangle
						aria-label="stopped"
						className="size-4 shrink-0 text-ink"
					/>
				) : null}
			</div>
			<div className="flex flex-wrap gap-1.5">
				<Badge>{plural(s.rows, "row")}</Badge>
				<Badge>{s.yes} YES</Badge>
				<Badge>{s.no} NO</Badge>
				<Badge>
					{s.replies} {s.replies === 1 ? "reply" : "replies"}
				</Badge>
			</div>
			<div>
				<div
					className="flex h-1.5 overflow-hidden rounded-(--r-chip) bg-n2"
					role="img"
					aria-label={`${s.yes} YES and ${s.no} NO rows`}
				>
					<div className="h-full bg-n6" style={{ width: `${yesPct}%` }} />
				</div>
				<div className="mt-1 flex justify-between text-[10px] text-n4">
					<span>YES {yesPct}%</span>
					<span>NO {100 - yesPct}%</span>
				</div>
			</div>
			{m ? (
				<div className="flex flex-wrap items-center gap-1.5 border-n2 border-t pt-3">
					<Badge strong>{m.posted} posted</Badge>
					{m.skipped > 0 ? <Badge>{m.skipped} skipped</Badge> : null}
					{problems > 0 ? <Badge strong>{problems} stopped</Badge> : null}
					<span className="ml-auto text-n5 text-xs tabular-nums">
						{formatPrice(m.price)}
					</span>
				</div>
			) : null}
		</div>
	);
}

// ── the uploader ───────────────────────────────────────────────────────────

export function SeedUploader(): React.ReactElement {
	const inputRef = useRef<HTMLInputElement>(null);
	const stopRef = useRef(false);
	const [file, setFile] = useState<File | null>(null);
	const [dragging, setDragging] = useState(false);
	const [preview, setPreview] = useState<Preview | null>(null);
	const [results, setResults] = useState<RowResult[]>([]);
	const [busy, setBusy] = useState<"idle" | "preview" | "seeding">("idle");
	const [message, setMessage] = useState<string | null>(null);
	const [progress, setProgress] = useState({ done: 0, total: 0 });
	const [finished, setFinished] = useState(false);

	function pick(next: File | null): void {
		setMessage(null);
		setPreview(null);
		setResults([]);
		setFinished(false);
		setProgress({ done: 0, total: 0 });
		if (
			next &&
			!ACCEPTED.some((ext) => next.name.toLowerCase().endsWith(ext))
		) {
			setFile(null);
			setMessage(
				"That file type is not supported. Choose a .csv or .xlsx file.",
			);
			return;
		}
		setFile(next);
	}

	function clearFile(): void {
		pick(null);
		if (inputRef.current) inputRef.current.value = "";
	}

	async function onPreview(): Promise<void> {
		if (!file) {
			setMessage("Choose a .csv or .xlsx file first.");
			return;
		}
		setBusy("preview");
		setMessage(null);
		setResults([]);
		setFinished(false);
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
		setFinished(false);
		stopRef.current = false;
		const collected: RowResult[] = [];
		let fromIndex = 0;
		let haltedMarkets: string[] = [];
		for (;;) {
			if (stopRef.current) {
				setMessage(
					"Stopped. Upload the same sheet again to continue; rows already posted are skipped.",
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
			if (res.data.done) {
				setFinished(true);
				break;
			}
		}
		setBusy("idle");
	}

	// ── derived view state ───────────────────────────────────────────────────
	const byMarket = new Map<string, Counts>();
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
	const totals = { posted: 0, skipped: 0, failed: 0, halted: 0 };
	for (const r of results) totals[r.status] += 1;
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
	const step: 1 | 2 | 3 | 4 = finished
		? 4
		: busy === "seeding" || results.length > 0
			? 3
			: preview
				? 2
				: 1;
	const canSeed =
		busy === "idle" &&
		preview !== null &&
		preview.errors.length === 0 &&
		preview.validRows > 0;

	return (
		<div className="space-y-6">
			<Steps current={step} />

			{/* ── 1 · Upload ─────────────────────────────────────────────── */}
			<section className={cn(panel, "p-5")}>
				<div className="mb-4 flex flex-wrap items-center justify-between gap-3">
					<h2 className="font-semibold text-ink text-sm">
						1 · Choose your sheet
					</h2>
					<a
						href={`data:text/csv;charset=utf-8,${encodeURIComponent(TEMPLATE)}`}
						download="seed-template.csv"
						className="inline-flex h-8 items-center gap-1.5 rounded-(--r) bg-(--btn-fill) px-2.5 font-medium text-ink text-sm outline-none [border:var(--hairline)] hover:bg-(--state-hover-fill) focus-visible:shadow-(--state-focus-ring)"
					>
						<Download aria-hidden className="size-4" />
						Download template
					</a>
				</div>

				<label
					htmlFor="seed-file"
					onDragOver={(e) => {
						e.preventDefault();
						if (busy === "idle") setDragging(true);
					}}
					onDragLeave={() => setDragging(false)}
					onDrop={(e) => {
						e.preventDefault();
						setDragging(false);
						if (busy !== "idle") return;
						pick(e.dataTransfer.files?.[0] ?? null);
					}}
					className={cn(
						"flex cursor-pointer flex-col items-center justify-center gap-2 rounded-(--r) border-2 border-dashed px-6 py-10 text-center outline-none transition-colors focus-within:shadow-(--state-focus-ring)",
						dragging
							? "border-ink bg-n2"
							: file
								? "border-n4 bg-n1"
								: "border-n3 bg-n1 hover:border-n5 hover:bg-n2",
						busy !== "idle" && "pointer-events-none opacity-60",
					)}
				>
					<input
						ref={inputRef}
						id="seed-file"
						type="file"
						accept=".csv,.xlsx"
						disabled={busy !== "idle"}
						onChange={(e) => pick(e.target.files?.[0] ?? null)}
						className="sr-only"
					/>
					{file ? (
						<>
							<FileSpreadsheet aria-hidden className="size-8 text-ink" />
							<span className="font-medium text-ink text-sm">{file.name}</span>
							<span className="text-n5 text-xs">
								{formatBytes(file.size)} · click or drop to replace
							</span>
						</>
					) : (
						<>
							<Upload aria-hidden className="size-8 text-n5" />
							<span className="font-medium text-ink text-sm">
								Drop a CSV or Excel file here, or{" "}
								<span className="underline underline-offset-2">
									choose a file
								</span>
							</span>
							<span className="text-n5 text-xs">
								.csv or .xlsx · up to 5 MB · up to 5,000 rows
							</span>
						</>
					)}
				</label>

				<div className="mt-4 flex flex-wrap items-center gap-2">
					<Button onClick={onPreview} disabled={!file || busy !== "idle"}>
						{busy === "preview" ? (
							<Loader2 aria-hidden className="size-4 animate-spin" />
						) : null}
						{busy === "preview" ? "Checking…" : "Preview sheet"}
					</Button>
					{file && busy === "idle" ? (
						<Button variant="ghost" onClick={clearFile}>
							<X aria-hidden className="size-4" />
							Clear
						</Button>
					) : null}
				</div>

				<details className="group mt-4 text-n6 text-xs">
					<summary className="cursor-pointer select-none text-n5 hover:text-ink">
						Sheet format
					</summary>
					<table className="mt-2 w-full text-left">
						<tbody>
							{[
								[
									"market",
									"Market slug, e.g. yc-w27-acceptance (or one Excel tab per market, named by slug)",
								],
								[
									"user",
									"Optional label, never shown. Same label = same participant; blank = a new one",
								],
								["side", "YES or NO"],
								["stake", "Post 10–250 · reply 50–250"],
								["argument", "The argument text (required)"],
								[
									"reply_to",
									"Optional row number of an earlier post in the same market. Same side = Support, opposite side = Counter",
								],
							].map(([col, desc]) => (
								<tr key={col} className="border-n2 border-t">
									<td className="py-1.5 pr-4 align-top font-mono text-ink">
										{col}
									</td>
									<td className="py-1.5">{desc}</td>
								</tr>
							))}
						</tbody>
					</table>
				</details>
			</section>

			{message ? (
				<div
					role="status"
					className="flex items-start gap-2.5 rounded-(--r) border border-n4 bg-n1 px-3.5 py-2.5 text-ink text-sm"
				>
					<AlertTriangle aria-hidden className="mt-0.5 size-4 shrink-0" />
					<span>{message}</span>
				</div>
			) : null}

			{/* ── 2 · Preview ────────────────────────────────────────────── */}
			{preview ? (
				<section className="space-y-4">
					<h2 className="font-semibold text-ink text-sm">
						2 · Preview{" "}
						<span className="font-normal text-n5">— {preview.fileName}</span>
					</h2>
					<div className="grid grid-cols-[repeat(auto-fill,minmax(10rem,1fr))] gap-3">
						<Stat label="Valid rows" value={preview.validRows} />
						<Stat label="Participants" value={preview.participantsNeeded} />
						<Stat label="Markets" value={preview.summary.length} />
						<Stat
							label="Problems"
							value={preview.errors.length}
							tone={preview.errors.length > 0 ? "warn" : "plain"}
						/>
					</div>

					{preview.errors.length > 0 ? (
						<div role="alert" className="rounded-(--r) border border-n5 bg-n1">
							<p className="flex items-center gap-2 border-n3 border-b px-4 py-3 font-semibold text-ink text-sm">
								<AlertTriangle aria-hidden className="size-4" />
								{plural(preview.errors.length, "problem")} — fix the sheet and
								preview again. Nothing is seeded until it is clean.
							</p>
							<ul className="max-h-72 divide-y divide-n2 overflow-y-auto text-sm">
								{preview.errors.map((e) => (
									<li
										key={`${e.rowNumber}-${e.message}`}
										className="flex gap-3 px-4 py-2"
									>
										<span className="w-16 shrink-0 font-mono text-n5 text-xs leading-5">
											{e.rowNumber === 0 ? "File" : `Row ${e.rowNumber}`}
										</span>
										<span className="text-n7">{e.message}</span>
									</li>
								))}
							</ul>
						</div>
					) : (
						<div className="flex items-center gap-2 text-n6 text-sm">
							<CheckCircle2 aria-hidden className="size-4" />
							Every row passed. Ready to seed.
						</div>
					)}

					{preview.summary.length > 0 ? (
						<div className="grid grid-cols-[repeat(auto-fill,minmax(16rem,1fr))] gap-3">
							{preview.summary.map((s) => (
								<MarketCard
									key={s.marketSlug}
									s={s}
									m={byMarket.get(s.marketSlug)}
								/>
							))}
						</div>
					) : null}

					{/* ── 3 · Seed ─────────────────────────────────────────── */}
					<div className={cn(panel, "space-y-3 p-5")}>
						<h2 className="font-semibold text-ink text-sm">3 · Seed</h2>
						<div className="flex flex-wrap items-center gap-2">
							<Button onClick={onSeed} disabled={!canSeed}>
								{busy === "seeding" ? (
									<Loader2 aria-hidden className="size-4 animate-spin" />
								) : null}
								{busy === "seeding"
									? "Seeding…"
									: `Seed ${plural(preview.validRows, "row")}`}
							</Button>
							{busy === "seeding" ? (
								<Button
									variant="outline"
									onClick={() => {
										stopRef.current = true;
									}}
								>
									<Square aria-hidden className="size-3.5" />
									Stop after this batch
								</Button>
							) : null}
						</div>
						{progress.total > 0 &&
						(busy === "seeding" || results.length > 0) ? (
							<div className="flex items-center gap-3">
								<div
									className="h-2 flex-1 overflow-hidden rounded-(--r-chip) bg-n2"
									role="progressbar"
									aria-valuemin={0}
									aria-valuemax={progress.total}
									aria-valuenow={progress.done}
									aria-label="Seeding progress"
								>
									<div
										className="h-full bg-ink transition-[width] duration-300"
										style={{ width: `${pct}%` }}
									/>
								</div>
								<span className="w-24 text-right text-n5 text-xs tabular-nums">
									{progress.done} / {progress.total} · {pct}%
								</span>
							</div>
						) : null}
					</div>
				</section>
			) : null}

			{/* ── Result ─────────────────────────────────────────────────── */}
			{finished ? (
				<div
					role="status"
					className="flex items-start gap-3 rounded-(--r) border border-n4 bg-n1 px-4 py-3"
				>
					<CheckCircle2
						aria-hidden
						className="mt-0.5 size-5 shrink-0 text-ink"
					/>
					<div className="text-sm">
						<p className="font-semibold text-ink">Seeding finished</p>
						<p className="mt-0.5 text-n6">
							{totals.posted} posted · {totals.skipped} skipped (already posted)
							· {totals.failed + totals.halted} stopped
						</p>
					</div>
				</div>
			) : null}

			{failures.length > 0 ? (
				<section role="alert" className="rounded-(--r) border border-n5 bg-n1">
					<h3 className="flex items-center gap-2 border-n3 border-b px-4 py-3 font-semibold text-ink text-sm">
						<AlertTriangle aria-hidden className="size-4" />
						Failed rows — the rest of each listed market was stopped
					</h3>
					<ul className="divide-y divide-n2 text-sm">
						{failures.map((f) => (
							<li key={f.rowNumber} className="flex gap-3 px-4 py-2">
								<span className="w-16 shrink-0 font-mono text-n5 text-xs leading-5">
									Row {f.rowNumber}
								</span>
								<span className="text-n7">
									<span className="font-mono text-xs">{f.marketSlug}</span> ·{" "}
									{f.message}
								</span>
							</li>
						))}
					</ul>
				</section>
			) : null}

			{mapping.size > 0 ? (
				<details className={cn(panel, "group p-4")}>
					<summary className="cursor-pointer select-none font-semibold text-ink text-sm">
						Label → pseudonym ({mapping.size})
					</summary>
					<ul className="mt-3 grid grid-cols-[repeat(auto-fill,minmax(14rem,1fr))] gap-x-6 gap-y-1 text-xs">
						{[...mapping].map(([label, pseudonym]) => (
							<li key={label} className="truncate text-n6">
								<span className="font-mono text-ink">{label}</span> →{" "}
								{pseudonym}
							</li>
						))}
					</ul>
				</details>
			) : null}
		</div>
	);
}
