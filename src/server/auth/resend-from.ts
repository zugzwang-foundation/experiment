// AUTH-OTP-DELIVERY fix (a) / ADR-0033: the sandbox-sender predicate shared by
// the two RESEND_FROM_EMAIL guards — the boot gate (instrumentation.ts) and the
// send-time backstop (email-otp.ts), the LD-10 two-lines-of-defense pair.
//
// Pure string parsing: NO `server-only`, NO `resend` import, no side effects —
// so instrumentation.ts (the boot path, which runs in both the node and edge
// runtimes) can import it safely.
//
// Rule (OQ-4, ratified): a from-address is the Resend sandbox iff its domain,
// lowercased, is `resend.dev` or a `*.resend.dev` subdomain. Handles both a bare
// `a@b.com` and a `"Name <a@b.com>"` RESEND_FROM_EMAIL. Malformed input with no
// parseable `@`-domain returns `false` (non-sandbox) and never throws — it fails
// at send, not at boot; an unset/empty value is handled separately by callers.
// Must not misfire on lookalikes (`notresend.dev`, `resend.dev.evil.com`).

export function isSandboxFrom(value: string): boolean {
	const angle = value.match(/<([^>]*)>/);
	const addr = (angle ? angle[1] : value).trim();
	const at = addr.lastIndexOf("@");
	if (at === -1) return false;
	const domain = addr
		.slice(at + 1)
		.trim()
		.toLowerCase();
	if (domain === "") return false;
	return domain === "resend.dev" || domain.endsWith(".resend.dev");
}
