// MIRROR-2 · RF-10 — a trivial raster pipeline for jsdom, and only for jsdom.
//
// jsdom has no `createImageBitmap`, and its canvas has no 2D context and no
// encoder (both need the native `canvas` package, which this repo does not
// install). Until RF-10 that did not matter to the component suites: the client
// re-save was an optimisation, and every failure fell back to uploading the
// ORIGINAL file, so a picked image still attached in jsdom. RF-10 removed that
// fallback — a re-save that fails refuses the image — so without a pipeline no
// component test could attach an image at all, and A4 (`submit-baseline`), which
// may not be edited, would lose its `imageUploadsId`.
//
// ⛔ THIS IS NOT A MODEL OF A BROWSER. Decoding answers a 1×1 bitmap for any
// bytes, and encoding answers a small blob of whatever type was asked for. It
// exists so a test ABOUT something else can attach an image. Tests ABOUT the
// re-save (`tests/unit/composer/image-attach.test.ts`) install their own stubs
// over these, and the real behaviour is measured in a real browser (MIRROR-2 run
// report).
//
// Runs for every test file; it does nothing outside a DOM environment (the
// node environment's `window` shim in `env.ts` has no `HTMLCanvasElement`).

if (typeof HTMLCanvasElement !== "undefined") {
	if (typeof globalThis.createImageBitmap !== "function") {
		Object.defineProperty(globalThis, "createImageBitmap", {
			configurable: true,
			writable: true,
			value: async () => ({ width: 1, height: 1, close: () => undefined }),
		});
	}
	const context = {
		fillStyle: "",
		fillRect: () => undefined,
		drawImage: () => undefined,
	};
	HTMLCanvasElement.prototype.getContext = function getContext() {
		return context;
	} as unknown as typeof HTMLCanvasElement.prototype.getContext;
	HTMLCanvasElement.prototype.toBlob = function toBlob(
		callback: BlobCallback,
		type?: string,
	): void {
		const outputType = type ?? "image/png";
		callback(new Blob([`jsdom-resaved:${outputType}`], { type: outputType }));
	};
}
