import { Button } from "@/components/ui/button";

export default function Scaffold1SmokePage() {
	return (
		<main className="min-h-screen bg-yes/50 p-8 font-mono">
			<h1 className="text-3xl font-bold tracking-tight">SCAFFOLD.1 smoke</h1>
			<p className="mt-4 text-sm">
				Verifies Tailwind v4 + shadcn/ui + Geist font pipeline. Lives under the{" "}
				<code>(dev)</code> route group; removed by DESIGN.7 close-out per plan
				Open Question #1.
			</p>
			<div className="mt-6 flex gap-3">
				<Button>Default Button</Button>
				<Button variant="outline">Outline Button</Button>
			</div>
		</main>
	);
}
