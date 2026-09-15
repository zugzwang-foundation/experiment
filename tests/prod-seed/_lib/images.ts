// SEED-1-DUMMY — the images folder: every row's file exists, every file has a
// row (SEED-1 §4.3 rule 7, §5.3 step 3). Filesystem only; no network.
// NEVER import this from src/**.

import { existsSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

import { IMAGE_UPLOADS_MAX_BYTES } from "../../../src/server/config/limits";
import { IMAGE_MIME_BY_EXT, imageExt, type SeedTable } from "./table";

/** Files the OS drops into folders on its own: dotfiles, Thumbs.db, desktop.ini. */
const OS_JUNK = /^(\.|thumbs\.db$|desktop\.ini$)/i;

export function imageRows(table: SeedTable) {
	return table.rows.filter((r) => r.image !== null);
}

/** Every problem with `dir` against `table`. Empty means uploads can start. */
export function preflightImages(
	table: SeedTable,
	dir: string | undefined,
): string[] {
	const wanted = new Set(imageRows(table).map((r) => r.image as string));
	if (wanted.size === 0) return [];
	if (!dir)
		return [
			`${wanted.size} rows carry an image but no images folder was given`,
		];
	if (!existsSync(dir)) return [`images folder ${dir} does not exist`];

	const errors: string[] = [];
	const present = new Set(
		readdirSync(dir, { withFileTypes: true })
			.filter((e) => e.isFile() && !OS_JUNK.test(e.name))
			.map((e) => e.name),
	);
	for (const name of wanted) {
		if (!present.has(name)) {
			errors.push(`missing file ${name}`);
			continue;
		}
		const { size } = statSync(join(dir, name));
		if (size === 0) errors.push(`${name} is empty`);
		if (size > IMAGE_UPLOADS_MAX_BYTES)
			errors.push(`${name} is ${size} bytes, over the 8 MiB cap`);
		if (!Object.hasOwn(IMAGE_MIME_BY_EXT, imageExt(name)))
			errors.push(`${name} is not an accepted type`);
	}
	for (const name of present) {
		if (!wanted.has(name)) errors.push(`file ${name} maps to no row`);
	}
	return errors;
}
