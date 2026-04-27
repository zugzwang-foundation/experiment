export default function Home() {
	return (
		<main className="flex min-h-screen flex-col items-center justify-center gap-6 bg-neutral-950 p-8 text-neutral-100">
			<h1 className="text-5xl font-bold tracking-tight">Zugzwang</h1>
			<p className="text-lg text-neutral-400">
				The world&apos;s reputation market.
			</p>
			<p className="text-sm text-neutral-500">Coming soon.</p>
			<footer className="mt-12 font-mono text-xs text-neutral-600">
				<div>build {process.env.BUILD_GIT_SHA}</div>
				<div>{process.env.BUILD_TIMESTAMP}</div>
			</footer>
		</main>
	);
}
