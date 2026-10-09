// SEED-STAGING-1 — the shapes a seeding sheet passes through, from the parsed
// file to a per-row result. Admin tooling (staging, and production since
// SEED-PROD-1); see docs/plans/SEED-STAGING-1.md and ADR-0064.

/** One data row as read from the file. Every field is a string, "" when blank. */
export type RawSeedRow = {
	/** 1-based data-row index (header excluded), continuous across tabs. */
	rowNumber: number;
	market: string;
	user: string;
	side: string;
	stake: string;
	/** NOT trimmed — an argument's whitespace is the author's. */
	argument: string;
	replyTo: string;
};

/** A row that passed every rule in `validate.ts`. */
export type SeedRow = {
	rowNumber: number;
	marketSlug: string;
	userLabel: string | null;
	side: "YES" | "NO";
	stake: string;
	body: string;
	replyToRow: number | null;
};

/** rowNumber 0 is a file-level error (bad header, unreadable file). */
export type SeedRowError = { rowNumber: number; message: string };

export type SeedRowStatus = "posted" | "skipped" | "failed" | "halted";

export type SeedRowResult = {
	rowNumber: number;
	marketSlug: string;
	status: SeedRowStatus;
	pseudonym: string | null;
	newPrice: string | null;
	message: string | null;
};
