import { deflateSync, inflateSync } from "node:zlib";

/**
 * BLOCK-5b — a minimal PNG codec, deliberately hand-rolled rather than added as
 * a dependency (AGENTS.md §11 makes a new dep an ask-first decision, and this
 * needs ~150 lines of well-specified format handling that no runtime code will
 * ever execute).
 *
 * ⚠⚠ IT IS DELIBERATELY NARROW. It decodes 8-bit non-interlaced greyscale /
 * RGB / greyscale+alpha / RGBA and THROWS on anything else — palette PNGs
 * included. That throw is a feature: the glyph pipeline writes RGBA, the guard
 * asserts RGBA, and if an asset is ever re-exported as a palette or 16-bit PNG
 * the decoder says so loudly instead of silently reading the wrong bytes and
 * reporting a plausible number.
 *
 * ⛔ RGBA IS ALSO WHY THE ACHROMATIC GUARD IS NOT VACUOUS. A greyscale (or
 * greyscale+alpha) PNG cannot represent a colour at all, so `R === G === B`
 * would hold by construction and the check would prove nothing about the
 * artwork. Shipping RGBA keeps three independent channels in the file, so the
 * guard is testing the pixels rather than the container — which is exactly what
 * the synthetic positive control in `resolution-block-glyphs.test.ts` exists to
 * demonstrate.
 */

export type DecodedPng = {
	width: number;
	height: number;
	/** RGBA, 4 bytes per pixel, row-major. Always expanded to 4 channels. */
	data: Uint8Array;
	/** The PNG colour type as declared in IHDR — 0/2/4/6. */
	colourType: number;
};

const SIGNATURE = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];

/** CRC-32 (PNG uses the standard IEEE polynomial, reflected). */
const CRC_TABLE = (() => {
	const table = new Uint32Array(256);
	for (let n = 0; n < 256; n++) {
		let c = n;
		for (let k = 0; k < 8; k++) {
			c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
		}
		table[n] = c >>> 0;
	}
	return table;
})();

function crc32(bytes: Uint8Array): number {
	let c = 0xffffffff;
	for (const byte of bytes) {
		// biome-ignore lint/style/noNonNullAssertion: index is masked to 0..255, always in range
		c = CRC_TABLE[(c ^ byte) & 0xff]! ^ (c >>> 8);
	}
	return (c ^ 0xffffffff) >>> 0;
}

const CHANNELS: Record<number, number> = { 0: 1, 2: 3, 4: 2, 6: 4 };

function paeth(a: number, b: number, c: number): number {
	const p = a + b - c;
	const pa = Math.abs(p - a);
	const pb = Math.abs(p - b);
	const pc = Math.abs(p - c);
	if (pa <= pb && pa <= pc) return a;
	if (pb <= pc) return b;
	return c;
}

export function decodePng(buf: Buffer): DecodedPng {
	for (const [i, expected] of SIGNATURE.entries()) {
		if (buf[i] !== expected) {
			throw new Error(`not a PNG: signature byte ${i} is ${buf[i]}`);
		}
	}

	let offset = 8;
	let width = 0;
	let height = 0;
	let bitDepth = 0;
	let colourType = 0;
	let interlace = 0;
	const idat: Buffer[] = [];

	while (offset < buf.length) {
		const length = buf.readUInt32BE(offset);
		const type = buf.toString("ascii", offset + 4, offset + 8);
		const data = buf.subarray(offset + 8, offset + 8 + length);
		if (type === "IHDR") {
			width = data.readUInt32BE(0);
			height = data.readUInt32BE(4);
			bitDepth = data[8] ?? 0;
			colourType = data[9] ?? 0;
			interlace = data[12] ?? 0;
		} else if (type === "IDAT") {
			idat.push(Buffer.from(data));
		} else if (type === "IEND") {
			break;
		}
		offset += 12 + length;
	}

	if (bitDepth !== 8) {
		throw new Error(`unsupported PNG bit depth ${bitDepth} (only 8 handled)`);
	}
	if (interlace !== 0) {
		throw new Error("unsupported interlaced PNG");
	}
	const channels = CHANNELS[colourType];
	if (channels === undefined) {
		throw new Error(
			`unsupported PNG colour type ${colourType} (palette and unknown types are rejected on purpose)`,
		);
	}

	const raw = inflateSync(Buffer.concat(idat));
	const stride = width * channels;
	const out = new Uint8Array(width * height * 4);
	const prev = new Uint8Array(stride);
	const line = new Uint8Array(stride);

	let pos = 0;
	for (let y = 0; y < height; y++) {
		const filter = raw[pos] ?? 0;
		pos += 1;
		for (let i = 0; i < stride; i++) {
			const x = raw[pos + i] ?? 0;
			const a = i >= channels ? (line[i - channels] ?? 0) : 0;
			const b = prev[i] ?? 0;
			const c = i >= channels ? (prev[i - channels] ?? 0) : 0;
			let value: number;
			switch (filter) {
				case 0:
					value = x;
					break;
				case 1:
					value = x + a;
					break;
				case 2:
					value = x + b;
					break;
				case 3:
					value = x + ((a + b) >> 1);
					break;
				case 4:
					value = x + paeth(a, b, c);
					break;
				default:
					throw new Error(`unknown PNG filter type ${filter} on row ${y}`);
			}
			line[i] = value & 0xff;
		}
		pos += stride;

		for (let x = 0; x < width; x++) {
			const s = x * channels;
			const d = (y * width + x) * 4;
			if (colourType === 0) {
				const g = line[s] ?? 0;
				out[d] = g;
				out[d + 1] = g;
				out[d + 2] = g;
				out[d + 3] = 255;
			} else if (colourType === 2) {
				out[d] = line[s] ?? 0;
				out[d + 1] = line[s + 1] ?? 0;
				out[d + 2] = line[s + 2] ?? 0;
				out[d + 3] = 255;
			} else if (colourType === 4) {
				const g = line[s] ?? 0;
				out[d] = g;
				out[d + 1] = g;
				out[d + 2] = g;
				out[d + 3] = line[s + 1] ?? 0;
			} else {
				out[d] = line[s] ?? 0;
				out[d + 1] = line[s + 1] ?? 0;
				out[d + 2] = line[s + 2] ?? 0;
				out[d + 3] = line[s + 3] ?? 0;
			}
		}
		prev.set(line);
	}

	return { width, height, data: out, colourType };
}

function chunk(type: string, data: Uint8Array): Buffer {
	const head = Buffer.alloc(8);
	head.writeUInt32BE(data.length, 0);
	head.write(type, 4, "ascii");
	const body = Buffer.concat([head.subarray(4), Buffer.from(data)]);
	const crc = Buffer.alloc(4);
	crc.writeUInt32BE(crc32(body), 0);
	return Buffer.concat([head.subarray(0, 4), body, crc]);
}

/**
 * Encode 8-bit RGBA as a PNG. Used ONLY to mint the synthetic positive-control
 * fixture in-test — a small image with a known chromatic fill, so the
 * achromatic guard can be shown to actually fail on colour rather than merely
 * to pass on the shipped assets.
 */
export function encodePngRgba(
	width: number,
	height: number,
	rgba: Uint8Array,
): Buffer {
	const ihdr = Buffer.alloc(13);
	ihdr.writeUInt32BE(width, 0);
	ihdr.writeUInt32BE(height, 4);
	ihdr[8] = 8; // bit depth
	ihdr[9] = 6; // colour type: RGBA
	ihdr[10] = 0; // deflate
	ihdr[11] = 0; // adaptive filtering
	ihdr[12] = 0; // no interlace

	const stride = width * 4;
	const raw = Buffer.alloc((stride + 1) * height);
	for (let y = 0; y < height; y++) {
		raw[y * (stride + 1)] = 0; // filter: None
		Buffer.from(rgba.subarray(y * stride, (y + 1) * stride)).copy(
			raw,
			y * (stride + 1) + 1,
		);
	}

	return Buffer.concat([
		Buffer.from(SIGNATURE),
		chunk("IHDR", ihdr),
		chunk("IDAT", deflateSync(raw)),
		chunk("IEND", new Uint8Array(0)),
	]);
}
