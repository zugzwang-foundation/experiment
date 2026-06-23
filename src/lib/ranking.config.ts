/**
 * The tunable constants of the read-time ranking model (RANKING.md §12).
 *
 * EVERY value here is a **pre-tuning placeholder — NOT final; pins 2026-09-01**
 * (the number-tuning pass, RANKING.md §0/§12). They exist so the model produces
 * a real order for the DEBATE.8 demo; they are NOT the launch values. The
 * `{ kLane: 3, floorLane.n: 5, floorLane.D: 200, floorLane.nPowB: 3,
 * floorSplit: 6 }` set matches the §13 worked-example illustrative constants so
 * the worked-example test reproduces §13.
 *
 * Config is INJECTED into every `ranking.ts` function (defaulting to the value
 * below) so the model is tuning-independent and tests pin explicit constants.
 */
export type RankingConfig = {
	/** Dominance ratio that qualifies a post for a Top lane / a badge (§3.2). */
	kLane: number;
	/**
	 * Absolute activity floor below which a lane does not fire (noise-kill,
	 * §3.2). Per badge/Top lane: `n` (traction), `D` (stake), `lop` (Top's
	 * dominance-split lane), `nPowB` (the contestation badge lane, OD-1(A)).
	 */
	floorLane: { n: number; D: number; lop: number; nPowB: number };
	/** Minimum `n` for Top's dominance-split lane to count — anti 2-vs-0 (§3.3). */
	floorSplit: number;
	/** Ranked posts between latest injections in the Top list (§4). */
	latestInterleaveInterval: number;
};

export const DEFAULT_RANKING_CONFIG: RankingConfig = {
	kLane: 3, // pre-tuning placeholder — NOT final; pins 2026-09-01
	floorLane: {
		n: 5, // pre-tuning placeholder — NOT final; pins 2026-09-01
		D: 200, // pre-tuning placeholder — NOT final; pins 2026-09-01
		lop: 0.5, // pre-tuning placeholder — NOT final; pins 2026-09-01
		nPowB: 3, // pre-tuning placeholder — NOT final; pins 2026-09-01
	},
	floorSplit: 6, // pre-tuning placeholder — NOT final; pins 2026-09-01
	latestInterleaveInterval: 10, // pre-tuning placeholder — NOT final; pins 2026-09-01
};
