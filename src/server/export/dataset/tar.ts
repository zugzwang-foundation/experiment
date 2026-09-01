import { createHash } from "node:crypto";
import { gzipSync } from "node:zlib";

/**
 * DATASET.1 Slice 6 — a deterministic ustar writer.
 *
 * ## Why not shell out to `tar`, and why not add a dependency
 *
 * The manifest publishes a `tarball_sha256` and §19.1 permits a v2 rebuild
 * *"for bug-fixes against the same source state"*. Both of those want the
 * same input to produce the same bytes.
 *
 * System `tar` does not do that. It stamps each entry with the file's mtime
 * and the invoking uid/gid/uname, so the same tables archived twice, or
 * archived on two machines, yield different checksums — and a checksum that
 * changes without the data changing is worse than no checksum, because the
 * first mismatch teaches everyone to ignore it. `gzip` compounds it by
 * embedding an mtime in its own header.
 *
 * Adding a tar library is an AGENTS.md §11 ask-first decision, and it would
 * buy features this needs none of (streaming, sparse files, long-name
 * extensions, extraction). What is actually required is ~80 lines: fixed
 * headers, zero timestamps, fixed ownership.
 *
 * ⇒ Every field that could carry entropy is pinned. The archive is a pure
 * function of the file contents and names.
 */

/** One file in the archive. */
export interface TarEntry {
	readonly name: string;
	readonly content: string;
}

const BLOCK = 512;

/**
 * The single most important constant in this file.
 *
 * Zero, not `Date.now()`. A timestamp is the one field that would make the
 * archive non-reproducible while looking like good practice — the release
 * date is already in the manifest, in the tarball name, and in every row's
 * `created_at`, so recording it a fourth time inside the header buys nothing
 * and costs the checksum's meaning.
 */
const FIXED_MTIME = 0;

function octal(value: number, width: number): string {
	// ustar numeric fields are octal, NUL- or space-terminated.
	const digits = value.toString(8);
	if (digits.length > width - 1) {
		// ⚠ Throws rather than clipping. `buf.write(s, off, width)` would
		// silently drop the NUL terminator and corrupt the field, which for
		// the size field means an archive that extracts as garbage. The
		// 100-byte name limit one field over already throws loudly; this
		// matches it rather than being the quiet one.
		throw new Error(
			`ustar numeric field overflow: ${value} needs ${digits.length} octal ` +
				`digits, field holds ${width - 1}. (A single file at or above ` +
				"8 GiB; ustar cannot represent it without a POSIX extension.)",
		);
	}
	return `${digits.padStart(width - 1, "0")}\0`;
}

function header(name: string, size: number): Buffer {
	const buf = Buffer.alloc(BLOCK);

	if (Buffer.byteLength(name) > 100) {
		// No PAX / GNU long-name support, deliberately. Every name this
		// pipeline emits is `<table>.csv` or `debates/<slug>.md`, and a
		// silent truncation would produce an archive whose contents do not
		// match its manifest inventory.
		throw new Error(
			`tar entry name exceeds the 100-byte ustar limit: ${name}. ` +
				"Long-name extensions are deliberately unsupported here.",
		);
	}

	buf.write(name, 0, 100, "utf8");
	buf.write(octal(0o644, 8), 100, 8, "ascii"); // mode
	buf.write(octal(0, 8), 108, 8, "ascii"); // uid  — pinned
	buf.write(octal(0, 8), 116, 8, "ascii"); // gid  — pinned
	buf.write(octal(size, 12), 124, 12, "ascii");
	buf.write(octal(FIXED_MTIME, 12), 136, 12, "ascii");
	buf.write("        ", 148, 8, "ascii"); // checksum placeholder: 8 spaces
	buf.write("0", 156, 1, "ascii"); // typeflag: regular file
	buf.write("ustar\0", 257, 6, "ascii");
	buf.write("00", 263, 2, "ascii");
	// uname/gname pinned empty rather than to the invoking user.

	// The header checksum is the sum of all header bytes with the checksum
	// field itself read as spaces — which is why it is written last.
	let sum = 0;
	for (const byte of buf) sum += byte;
	buf.write(`${sum.toString(8).padStart(6, "0")}\0 `, 148, 8, "ascii");

	return buf;
}

function pad(size: number): Buffer {
	const rem = size % BLOCK;
	return rem === 0 ? Buffer.alloc(0) : Buffer.alloc(BLOCK - rem);
}

/** Build an uncompressed tar archive. Deterministic. */
export function createTar(entries: readonly TarEntry[]): Buffer {
	const parts: Buffer[] = [];

	// ⚠ Duplicate names are REJECTED, not deduplicated or last-wins.
	// `tar` will happily store two entries under one name; extraction yields
	// the LATER one, silently. That is invisible to every other guard in this
	// pipeline: the row-count gate runs before assembly, on the string that
	// was never shipped, so the manifest would publish a count for a file the
	// archive does not yield. `debateEntries` guards its own slugs; this is
	// the place the two artifact classes actually meet, and it is where a
	// `debates/x.md` colliding with a table CSV would have gone unnoticed.
	const names = new Set<string>();
	for (const entry of entries) {
		if (names.has(entry.name)) {
			throw new Error(
				`duplicate tar entry name: ${entry.name}. Extraction would yield ` +
					"only the later entry while the manifest describes the earlier — " +
					"a mismatch no checksum reveals, because the archive is " +
					"internally consistent and simply missing a file.",
			);
		}
		names.add(entry.name);
	}

	// Sorted by name so the archive does not depend on the order tables
	// happened to be exported in.
	//
	// ⚠ Byte order, NOT `localeCompare`. This module pins uid, gid and mtime
	// precisely to remove environment dependence, and `localeCompare` would
	// have put the ambient ICU locale straight back in: measured, under
	// `et-EE` "z" sorts before "t", and under `en-US` an uppercase name
	// reorders against byte order. Today's names are all `[a-z0-9._/-]` so it
	// agrees either way — which is exactly how it would have survived until
	// the first artifact class that did not fit that set.
	const sorted = [...entries].sort((a, b) =>
		a.name < b.name ? -1 : a.name > b.name ? 1 : 0,
	);

	for (const entry of sorted) {
		const content = Buffer.from(entry.content, "utf8");
		parts.push(
			header(entry.name, content.length),
			content,
			pad(content.length),
		);
	}

	// Two zero blocks terminate the archive.
	parts.push(Buffer.alloc(BLOCK * 2));
	return Buffer.concat(parts);
}

/** Byte offset of the 4-byte MTIME field in an RFC 1952 gzip header. */
export const GZIP_MTIME_OFFSET = 4;

/**
 * Build the gzipped tarball.
 *
 * ⚠ **This originally passed `{ mtime: 0 }`, on the assumption that zlib
 * stamps the current time into the gzip header the way `gzip(1)` does. It
 * does not — measured: Node's `gzipSync` writes MTIME=0 already, and the
 * option is not even in `ZlibOptions`.** The option was therefore a no-op
 * that read like a safeguard, and the determinism test above it would have
 * passed either way, since two builds in the same second produce the same
 * timestamp regardless.
 *
 * Replaced with an assertion on the emitted bytes. The property that matters
 * is *"the header carries no timestamp"*, and asserting the byte is true
 * whatever the runtime does — where an option is only true while a default
 * holds, silently, in a field nobody looks at.
 */
export function createTarGz(entries: readonly TarEntry[]): Buffer {
	const gz = gzipSync(createTar(entries), { level: 9 });

	const mtime = gz.readUInt32LE(GZIP_MTIME_OFFSET);
	if (mtime !== 0) {
		throw new Error(
			`gzip header carries MTIME=${mtime}; the tarball would not be ` +
				"reproducible and its published sha256 would change without the " +
				"data changing. Zero the header before publishing.",
		);
	}
	return gz;
}

/**
 * ⚠ **The reproducibility guarantee stops at the tar layer, and saying so is
 * the point.**
 *
 * `createTar` is a pure function of names and contents — every entropy-bearing
 * header field is pinned, so the same input yields the same bytes on any
 * machine, forever. The GZIP wrapper is not: the header's XFL and OS bytes are
 * platform-derived (measured `0x13` here), and the deflate stream itself is
 * not byte-stable across zlib versions, which have changed inside the Node
 * majors this repo has run on.
 *
 * So `tarball_sha256` verifies *the bytes a reader downloaded*, which is what
 * a checksum is for — but it is NOT a stable identifier for *the data*. §19.1
 * contemplates a v2 rebuild against the same source state; rebuilt on another
 * machine that would produce a different `tarball_sha256` for identical
 * content, and someone would reasonably read the difference as data drift.
 *
 * This is the hash that does not move. Publishing both lets a reader answer
 * "did I get the right bytes" and "is this the same dataset" separately.
 */
export function contentSha256(entries: readonly TarEntry[]): string {
	return sha256(createTar(entries));
}

/** SHA-256 of a buffer, lowercase hex — the manifest's `tarball_sha256`. */
export function sha256(buf: Buffer): string {
	return createHash("sha256").update(buf).digest("hex");
}
