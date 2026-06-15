// ENGINE.10 synthetic fixtures — 8 placeholder markets (the hot pool rows).
//
// THESIS FENCE (CLAUDE.md §3, plan §2): these are SYNTHETIC PLACEHOLDERS, never
// invented real market questions, resolution criteria, or settlement dates —
// those are Hrishikesh's. Title/description/slug are deterministic placeholder
// strings; the resolution deadline is a far-future placeholder instant. The
// scale battery stresses the ENGINE, not the copy.

export const SYNTHETIC_MARKET_COUNT = 8;

/** Far-future placeholder deadline — NOT a real settlement date (thesis fence). */
export const SYNTHETIC_RESOLUTION_DEADLINE = new Date("2027-01-01T00:00:00Z");

/** The seeded CPMM reserve per side (symmetric Y₀ = N₀), as an 18-dp string. */
export const SYNTHETIC_SEED_RESERVES = "1000.000000000000000000";

export interface SyntheticMarketSpec {
	/** 1-based ordinal — `synthetic-market-${n}`. */
	ordinal: number;
	slug: string;
	title: string;
	description: string;
}

/** The 8 synthetic market specs (placeholder content only). */
export const SYNTHETIC_MARKETS: readonly SyntheticMarketSpec[] = Array.from(
	{ length: SYNTHETIC_MARKET_COUNT },
	(_unused, i): SyntheticMarketSpec => {
		const ordinal = i + 1;
		return {
			ordinal,
			slug: `synthetic-market-${ordinal}`,
			title: `Synthetic Market ${ordinal}`,
			description: `Placeholder resolution criteria for synthetic market ${ordinal}.`,
		};
	},
);
