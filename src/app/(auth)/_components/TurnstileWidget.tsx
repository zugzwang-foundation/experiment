"use client";

import { type ReactElement, useEffect, useRef } from "react";

// Cloudflare Turnstile, the F-AUTH-2 CAPTCHA gate (SPEC.1 §13 + ADR-0004 §4),
// mounted on the two surfaces that ask the server to send an OTP email.
//
// The server already refuses a send without a token that siteverify accepts
// (`zugzwang-otp-gate` in `src/server/auth/index.ts`). What was missing was a
// token worth sending: both surfaces posted a fixed placeholder, which only a
// test secret accepts — so production would have refused every email sign-in.
//
// ⛔ THE TOKEN IS HANDED UP, NEVER STORED HERE. A Turnstile token is single-use
// and short-lived; the parent owns it, sends it once, and remounts this widget
// (a new `key`) to get another. Expiry, error and timeout all hand up `null`,
// so a stale token can never sit in the parent looking valid.
//
// No npm dependency: Cloudflare serves the loader, and explicit rendering is a
// three-call API (`render`, `remove`, and the callbacks) that does not justify
// one (AGENTS.md §11, adding a dependency is ask-first).

const SCRIPT_SRC =
	"https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";

type RenderOptions = {
	sitekey: string;
	callback: (token: string) => void;
	"expired-callback": () => void;
	"error-callback": () => void;
	"timeout-callback": () => void;
	theme: "dark";
	size: "flexible";
};

export type TurnstileApi = {
	render: (container: HTMLElement, options: RenderOptions) => string;
	remove: (widgetId: string) => void;
};

declare global {
	interface Window {
		turnstile?: TurnstileApi;
	}
}

let loader: Promise<TurnstileApi> | null = null;

function loadTurnstile(): Promise<TurnstileApi> {
	if (window.turnstile) return Promise.resolve(window.turnstile);
	if (loader) return loader;
	loader = new Promise<TurnstileApi>((resolve, reject) => {
		const script = document.createElement("script");
		script.src = SCRIPT_SRC;
		script.async = true;
		// Forget a failed attempt (network error, or a script that loaded without
		// defining the API) so the next mount fetches again instead of replaying
		// the cached rejection forever.
		const fail = () => {
			loader = null;
			script.remove();
			reject(new Error("turnstile_unavailable"));
		};
		script.onload = () => {
			if (window.turnstile) resolve(window.turnstile);
			else fail();
		};
		script.onerror = fail;
		document.head.appendChild(script);
	});
	return loader;
}

export function TurnstileWidget({
	onToken,
}: {
	onToken: (token: string | null) => void;
}): ReactElement {
	const container = useRef<HTMLDivElement>(null);
	// The latest callback, read at call time, so a parent re-render never
	// re-renders the challenge the participant may be halfway through.
	const handToken = useRef(onToken);
	handToken.current = onToken;

	// Inlined at build time (`NEXT_PUBLIC_`), read at render so each environment
	// ships its own key — staging's Cloudflare test key, production's real one.
	const siteKey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;

	useEffect(() => {
		const element = container.current;
		if (!siteKey || !element) {
			// FAIL CLOSED: no key means no token, and the parent refuses to send
			// without one. Logged because it is a deploy defect, not user error.
			console.error(
				"turnstile_unavailable",
				"NEXT_PUBLIC_TURNSTILE_SITE_KEY not set",
			);
			handToken.current(null);
			return;
		}
		let cancelled = false;
		let widgetId: string | null = null;
		loadTurnstile()
			.then((api) => {
				if (cancelled) return;
				widgetId = api.render(element, {
					sitekey: siteKey,
					callback: (token) => handToken.current(token),
					"expired-callback": () => handToken.current(null),
					"error-callback": () => handToken.current(null),
					"timeout-callback": () => handToken.current(null),
					theme: "dark",
					size: "flexible",
				});
			})
			.catch(() => {
				if (!cancelled) handToken.current(null);
			});
		return () => {
			cancelled = true;
			if (widgetId !== null) window.turnstile?.remove(widgetId);
		};
	}, [siteKey]);

	return <div ref={container} data-testid="turnstile-widget" />;
}
