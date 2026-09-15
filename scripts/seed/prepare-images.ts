/**
 * SEED-1-DUMMY — fill the images folder (ADR-0053; SEED-1 §5.3).
 *
 * Copies ONE common image to every filename the table names, then runs the same
 * pre-flight the runner runs. For the real seed, replace the files in the folder
 * with the real images under the same names and run it with --check-only.
 *
 *   pnpm exec tsx scripts/seed/prepare-images.ts --table ../seed-runs/dummy1/table.json \
 *     --common ./placeholder.png --dir ../seed-runs/dummy1/images
 *   pnpm exec tsx scripts/seed/prepare-images.ts --table … --dir … --check-only
 */
import { copyFileSync, existsSync, mkdirSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";

import { imageRows, preflightImages } from "../../tests/prod-seed/_lib/images";
import { imageExt, type SeedTable } from "../../tests/prod-seed/_lib/table";

function die(message: string): never {
	console.error(`\nREFUSED — ${message}\n`);
	process.exit(1);
}

function flag(argv: readonly string[], name: string): string | undefined {
	const at = argv.indexOf(name);
	if (at === -1) return undefined;
	const value = argv[at + 1];
	if (value === undefined || value.startsWith("--"))
		die(`${name} needs a value`);
	return value;
}

const argv = process.argv.slice(2);
const tablePath = flag(argv, "--table") ?? die("--table is required");
const dir = resolve(flag(argv, "--dir") ?? die("--dir is required"));
const checkOnly = argv.includes("--check-only");
const table = JSON.parse(readFileSync(tablePath, "utf8")) as SeedTable;
const rows = imageRows(table);

if (!checkOnly) {
	const common =
		flag(argv, "--common") ??
		die("--common is required (or pass --check-only)");
	if (!existsSync(common)) die(`common image ${common} does not exist`);
	mkdirSync(dir, { recursive: true });
	let copied = 0;
	for (const row of rows) {
		const name = row.image as string;
		if (imageExt(name) !== imageExt(common)) {
			die(
				`${name} expects .${imageExt(name)} but the common image is .${imageExt(common)} — regenerate with --image-ext ${imageExt(common)}`,
			);
		}
		const target = join(dir, name);
		if (existsSync(target)) continue; // never overwrite a real image already dropped in
		copyFileSync(common, target);
		copied += 1;
	}
	console.log(
		`copied ${copied} placeholder(s) into ${dir} (${rows.length - copied} already present)`,
	);
}

const errors = preflightImages(table, dir);
if (errors.length > 0) {
	console.error(
		`pre-flight FAILED (${errors.length}):\n  ${errors.slice(0, 50).join("\n  ")}`,
	);
	process.exit(1);
}
console.log(
	`pre-flight OK — ${rows.length} images, every row has a file and every file has a row`,
);
