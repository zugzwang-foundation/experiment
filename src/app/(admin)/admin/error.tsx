"use client";

import { ErrorBlock } from "@/components/ui/error-block";

// ADMIN-UI — the admin segment's route error boundary. Before this, a render
// error on any admin page fell through to Next's bare default.
//
// It renders NOTHING from `error` (deliberately left undestructured, the
// route-boundary family's own rule — no binding exists to render by accident),
// and `reset()` re-renders the segment rather than reloading the document.
// `redirect()` / `notFound()` are not errors to this boundary, so the Layer-2
// gate's redirect to /admin/login is unaffected.
//
// ⚠ The body names the one thing an operator must not assume after a crash
// mid-flow: whether a write landed. Every admin write is append-only and
// visible on the market page or the audit log, so that is where to look.

export default function AdminError({
	reset,
}: {
	error: Error & { digest?: string };
	reset: () => void;
}): React.JSX.Element {
	return (
		<main className="flex min-h-dvh items-center justify-center bg-ground px-6 py-12">
			<ErrorBlock
				body="This admin page failed to render. If you had just submitted an action, check the market page or the audit log before repeating it."
				bodyTestId="admin-error"
				actionLabel="Try again"
				onAction={reset}
			/>
		</main>
	);
}
