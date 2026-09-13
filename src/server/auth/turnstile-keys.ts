// Cloudflare publishes fixed Turnstile TEST keys — site keys such as
// `1x00000000000000000000AA` and secrets such as
// `1x0000000000000000000000000000000AA` (prefix 1x/2x/3x, zeros, a two-letter
// suffix). Paired, they always pass or always fail, whatever the browser did.
// Staging runs on them deliberately. In production a test SECRET would make
// siteverify accept any token, including one a script made up, which turns the
// F-AUTH-2 gate into decoration while every check still reads green.
//
// Pure, so `instrumentation.ts` can refuse them at boot and a unit test can pin
// the pattern without an environment.

const CLOUDFLARE_TEST_KEY = /^[123]x0+[A-F]{2}$/;

export function isTurnstileTestKey(value: string): boolean {
	return CLOUDFLARE_TEST_KEY.test(value);
}

/**
 * The production requirement: both halves set, neither a Cloudflare test key.
 * Returns the reason a deploy must not serve, or `null` when it may.
 */
export function turnstileProdKeyProblem(
	siteKey: string | undefined,
	secretKey: string | undefined,
): string | null {
	if (!siteKey || !secretKey) {
		return "NEXT_PUBLIC_TURNSTILE_SITE_KEY and TURNSTILE_SECRET_KEY must both be set";
	}
	if (isTurnstileTestKey(siteKey) || isTurnstileTestKey(secretKey)) {
		return "a Cloudflare Turnstile TEST key is configured — siteverify would not verify anything";
	}
	return null;
}
