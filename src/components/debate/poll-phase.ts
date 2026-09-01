/**
 * The one-time random phase offset for `DebatePoll`'s interval — desyncs
 * concurrent tabs on the same market so they don't refresh in lockstep,
 * without changing the steady-state cadence (`POLL_INTERVAL_MS_DEBATE_VIEW`
 * itself stays spec-pinned and untouched).
 *
 * Split into its own module, rather than inlined in `DebatePoll.tsx`, so
 * `tests/unit/debate/render/poll.test.tsx` can `vi.mock` this file alone and
 * force a deterministic phase of 0 — collapsing the mechanism to exactly the
 * original unjittered behavior for every timing assertion — without needing
 * to plumb a prop through `DebateView` or partially mock the component module
 * it also imports the tested component from.
 */
export function getInitialPollPhaseOffsetMs(intervalMs: number): number {
	return Math.random() * intervalMs;
}
