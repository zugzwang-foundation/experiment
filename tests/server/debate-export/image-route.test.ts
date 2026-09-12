import { beforeEach, describe, expect, it, vi } from "vitest";

import { mumbaiMetroModel } from "../../unit/debate-export/_fixtures/mumbai-metro.input";

/**
 * POST-IMAGE-EXPORT — `GET /m/[slug]/export/image?post=N`, the wire surface.
 * Every read behind it is mocked at its module seam (the cron route-handler
 * convention, `tests/server/cron/`); the renderer is mocked so the assertion
 * is about WHAT reaches it — which post, which filename, and that a removed
 * or unresolvable post reaches it never.
 */
const {
	mockGetMarketBySlug,
	mockResolvePostParam,
	mockGetPricing,
	mockGetCachedView,
	mockRender,
	mockResolveImages,
	mockGetThumb,
} = vi.hoisted(() => ({
	mockGetMarketBySlug: vi.fn(),
	mockResolvePostParam: vi.fn(),
	mockGetPricing: vi.fn(),
	mockGetCachedView: vi.fn(),
	mockRender: vi.fn(),
	mockResolveImages: vi.fn(),
	mockGetThumb: vi.fn(),
}));

vi.mock("@/db", () => ({ db: {} }));
vi.mock("@/server/markets/get-by-slug", () => ({
	getMarketBySlug: mockGetMarketBySlug,
}));
vi.mock("@/server/debate-view/resolve-post-param", () => ({
	resolvePostParam: mockResolvePostParam,
}));
vi.mock("@/server/debate-view/market-pricing", () => ({
	getMarketPricingAndReserves: mockGetPricing,
}));
vi.mock("@/server/debate-view/cached-view", () => ({
	getCachedDebateView: mockGetCachedView,
}));
vi.mock("@/server/discovery/media", () => ({
	getDefaultMarketMediaUrl: mockGetThumb,
}));
vi.mock("@/server/debate-export/image/render", () => ({
	renderPostExportJpeg: mockRender,
	resolveExportImages: mockResolveImages,
}));

import { GET } from "@/app/(public)/m/[slug]/export/image/route";

const MARKET = mumbaiMetroModel.market;

function request(post: string | null): Request {
	const url = new URL("http://localhost/m/x/export/image");
	if (post !== null) {
		url.searchParams.set("post", post);
	}
	return new Request(url, { method: "GET" });
}

const ctx = { params: Promise.resolve({ slug: MARKET.slug }) };

async function expect404(p: Promise<Response>): Promise<void> {
	await expect(p).rejects.toMatchObject({
		digest: expect.stringContaining("NEXT_HTTP_ERROR_FALLBACK;404"),
	});
}

beforeEach(() => {
	mockGetMarketBySlug.mockReset().mockResolvedValue(MARKET);
	mockResolvePostParam.mockReset().mockResolvedValue("cmt-p1");
	mockGetPricing.mockReset().mockResolvedValue(null);
	mockGetCachedView.mockReset().mockResolvedValue(mumbaiMetroModel);
	mockGetThumb.mockReset().mockResolvedValue("https://r2.test/m/default.webp");
	mockResolveImages.mockReset().mockImplementation(async (p) => p);
	mockRender
		.mockReset()
		.mockResolvedValue(new Response("jpeg", { status: 200 }));
});

describe("GET /m/[slug]/export/image", () => {
	it("renders the resolved post under `<slug>-post-<ordinal>.jpg`", async () => {
		const res = await GET(request("2"), ctx);
		expect(res.status).toBe(200);
		expect(mockResolvePostParam).toHaveBeenCalledWith(
			{},
			{ marketId: MARKET.id, post: "2" },
		);
		expect(mockRender).toHaveBeenCalledTimes(1);
		const [props, filename] = mockRender.mock.calls[0] ?? [];
		expect(filename).toBe("mumbai-metro-line-3-1m-riders-post-2.jpg");
		expect(props.post.pseudonym).toBe("MagentaWolf207");
		// The header thumb is the DISCOVERY card's image (`is_default` row), read
		// beside the view — not the secondary media the view model carries.
		expect(mockGetThumb).toHaveBeenCalledWith({}, MARKET.id);
		expect(props.market.thumbUrl).toBe("https://r2.test/m/default.webp");
		expect(mockResolveImages).toHaveBeenCalledTimes(1);
	});

	it("overlays live pricing and the live chart tail exactly as the page does", async () => {
		mockGetPricing.mockResolvedValue({
			pricing: { yes: "0.700000000000000000", no: "0.300000000000000000" },
			unitToWin: { yes: "1", no: "1" },
			reserves: { yes: "1", no: "1" },
		});
		mockGetCachedView.mockResolvedValue({
			...mumbaiMetroModel,
			priceChart: {
				series: [{ at: "2026-08-17T00:00:00.000Z", yes: "0.5" }],
			},
		});
		await GET(request("2"), ctx);
		const [props] = mockRender.mock.calls[0] ?? [];
		expect(props.market.yesPct).toBe("70%");
		// `withLiveTail` on an Open market appends the spot at `now`.
		expect(props.chart.series).toHaveLength(2);
		expect(props.chart.series[1].yes).toBe("0.700000000000000000");
	});

	it("404s an unknown market", async () => {
		mockGetMarketBySlug.mockResolvedValue(null);
		await expect404(GET(request("1"), ctx));
		expect(mockRender).not.toHaveBeenCalled();
	});

	it("404s a missing or unresolvable ?post", async () => {
		await expect404(GET(request(null), ctx));
		mockResolvePostParam.mockResolvedValue(null);
		await expect404(GET(request("999"), ctx));
		expect(mockRender).not.toHaveBeenCalled();
	});

	it("404s a REMOVED post before anything is rendered (SC-1)", async () => {
		const first = mumbaiMetroModel.posts[0];
		if (first === undefined) throw new Error("fixture");
		mockGetCachedView.mockResolvedValue({
			...mumbaiMetroModel,
			posts: [
				{
					removed: true,
					id: first.id,
					ordinal: first.ordinal,
					sideAtPostTime: first.sideAtPostTime,
					createdAt: first.createdAt,
					aggregate: first.aggregate,
					replies: first.replies,
				},
				...mumbaiMetroModel.posts.slice(1),
			],
		});
		await expect404(GET(request("2"), ctx));
		expect(mockResolveImages).not.toHaveBeenCalled();
		expect(mockRender).not.toHaveBeenCalled();
	});
});
