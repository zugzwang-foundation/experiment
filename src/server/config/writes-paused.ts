/**
 * The write-pause switch for the final production data sync (AWS-MIGRATION-3).
 *
 * While the last backup is taken and restored into RDS, nothing may write to
 * the source database. `proxy.ts` reads these two values on every request and
 * answers writes with 503 + Retry-After; reads are untouched.
 *
 * ⚠ THE FLAG IS AN EXACT VALUE, NOT A BOOLEAN. `"true"`, `"1"`, `"yes"` and
 * `""` all mean NOT paused — the same fail-closed-to-normal convention the
 * staging runners use for their intent tokens. A pause is a deliberate act with
 * a named value, never something a stray truthy string can switch on.
 *
 * No I/O, no secrets, pure over the env record it is handed, so the proxy
 * (Edge/Node runtime alike) and the tests call it the same way. It is not
 * imported by `src/server/config/limits.ts` on purpose: that module carries
 * `'use cache'` blocks and must not learn a per-request switch.
 */
export const WRITES_PAUSED_ENV = "ZUGZWANG_WRITES_PAUSED";
export const WRITES_PAUSED_VALUE = "paused";
export const WRITES_PAUSED_RETRY_AFTER_ENV =
	"ZUGZWANG_WRITES_PAUSED_RETRY_AFTER";
export const WRITES_PAUSED_RETRY_AFTER_DEFAULT_SEC = 300;

export function isWritesPaused(
	env: Readonly<Record<string, string | undefined>> = process.env,
): boolean {
	return env[WRITES_PAUSED_ENV] === WRITES_PAUSED_VALUE;
}

export function writesPausedRetryAfterSeconds(
	env: Readonly<Record<string, string | undefined>> = process.env,
): number {
	const raw = env[WRITES_PAUSED_RETRY_AFTER_ENV];
	if (raw === undefined || !/^\d+$/.test(raw)) {
		return WRITES_PAUSED_RETRY_AFTER_DEFAULT_SEC;
	}
	const n = Number.parseInt(raw, 10);
	return n > 0 ? n : WRITES_PAUSED_RETRY_AFTER_DEFAULT_SEC;
}
