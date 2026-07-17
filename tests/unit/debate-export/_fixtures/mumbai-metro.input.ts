// EXPORT.1 — byte-exact golden INPUT fixture (Mumbai Metro Line 3).
//
// AUTO-GENERATED from `mumbai-metro.expected.md` by the @test-writer parser so the
// body / pseudonym / stake / price / time / title strings are byte-identical to the
// committed golden (em-dashes, en-dashes, Đ, ·, straight quotes) — NEVER retyped.
// Do not hand-edit; regenerate from the golden if it ever changes.
//
// INTENDED RED (TDD): `entryPrice` is set on the NON-REMOVED DebatePost / DebateReply
// variants, a field the writer ADDS to the read-model in this task. Until then this
// is a TYPE error (TS2353 unknown property) — but esbuild strips types, so the test
// still RUNS and is RED on the missing `serializeDebateExport` import, not here.
//
// `ExportMarketMeta` is the planned greenfield type (market-meta.ts); imported
// type-only so esbuild erases it (no runtime resolution of the missing module).
// `totalStakeDharma` (3225) and `participants` (11) come from the META path — they
// exceed the visible node-stake sum (2,945) and visible author count (10) because
// removed Post 4 (stake 280, +1 author) is masked OFF the node yet still counts
// (debate-export.md §10.5). The serializer MUST read them verbatim, never node-sum.

import type { ExportMarketMeta } from "@/server/debate-export/market-meta";
import type { DebateViewModel } from "@/server/debate-view/load-debate-view";

export const mumbaiMetroModel: DebateViewModel = {
	market: {
		id: "mkt-mumbai-metro",
		slug: "mumbai-metro-line-3-1m-riders",
		title:
			"Will Mumbai Metro Line 3 average over 1M daily riders before the freeze?",
		description:
			"Resolves YES if Mumbai Metro Line 3 (Aqua Line, Colaba–SEEPZ) records a 7-day rolling average of at least 1,000,000 daily riders at any point on or before the freeze (2026-11-05 23:59 IST), per MMRC published ridership figures. Resolves NO otherwise. Voids only if MMRC ceases publishing ridership data before resolution.",
		status: "Open",
		pricing: { yes: "0.540000000000000000", no: "0.460000000000000000" },
		// UI.A2 additive header field — NOT serialized (debate-export.md §10 field
		// set); illustrative values only (NO is the cheap side at p_no = 0.46).
		unitToWin: { yes: "1.850000000000000000", no: "2.170000000000000000" },
		totals: {
			dharmaStaked: "3225.000000000000000000",
			postCount: 6,
			replyCount: 10,
		},
	},
	posts: [
		{
			removed: false,
			id: "cmt-p1",
			// UI.A2 additive `ordinal` (NOT serialized): (created_at, id)-ascending
			// rank over the six top-level posts — p3(05-15)=1, p1(05-18)=2,
			// p2(05-21)=3, p4(05-26)=4, p5(06-02)=5, p6(06-09)=6.
			ordinal: 2,
			sideAtPostTime: "YES",
			createdAt: "2026-05-18T07:40:00.000Z",
			title: "The corridor is built for this volume",
			teaser: "",
			body: "Line 3 finally connects the three densest job corridors in the city in one ride: the Nariman Point/Colaba CBD, BKC, and the SEEPZ/MIDC tech belt, plus the airport. That is exactly the high-frequency, captive-commuter traffic that fills trains. Office attendance is back near pre-2020 levels and the road alternative between these nodes is brutal. The ramp to 1M is not a stretch, it is the design intent of the corridor.",
			imageUrl: null,
			marker: "none",
			badge: null,
			author: { pseudonym: "CrimsonHawk207", pfpUrl: "/pfp-placeholder.svg" },
			authorStake: "560.000000000000000000",
			entryPrice: "0.470000000000000000",
			aggregate: {
				supportCount: 2,
				counterCount: 1,
				supportDharma: "255.000000000000000000",
				counterDharma: "210.000000000000000000",
			},
			replies: {
				support: [
					{
						removed: false,
						id: "cmt-r1-1",
						side: "YES",
						createdAt: "2026-05-19T10:12:00.000Z",
						body: "Agreed, and the monsoon multiplier is underrated. Once the July flooding starts, the underground line is the only reliable option on this stretch. Last year ridership on the open sections jumped through the wet months.",
						marker: "none",
						author: { pseudonym: "TealOwl118", pfpUrl: "/pfp-placeholder.svg" },
						stake: "180.000000000000000000",
						entryPrice: "0.490000000000000000",
					},
					{
						removed: false,
						id: "cmt-r1-2",
						side: "YES",
						createdAt: "2026-05-22T09:00:00.000Z",
						body: "Corporate shuttle replacement is already happening at a couple of BKC firms I know of. That is hundreds of daily trips moving onto the line per employer.",
						marker: "none",
						author: {
							pseudonym: "SlateHeron061",
							pfpUrl: "/pfp-placeholder.svg",
						},
						stake: "75.000000000000000000",
						entryPrice: "0.520000000000000000",
					},
				],
				counter: [
					{
						removed: false,
						id: "cmt-r1-3",
						side: "NO",
						createdAt: "2026-05-20T16:45:00.000Z",
						body: 'Design intent and realized ridership are different things. Line 1 was projected far above what it actually carried for its first several years. "The corridor is built for it" does not put a 7-day average over a million by November.',
						marker: "none",
						author: {
							pseudonym: "IndigoWolf355",
							pfpUrl: "/pfp-placeholder.svg",
						},
						stake: "210.000000000000000000",
						entryPrice: "0.490000000000000000",
					},
				],
				twoSlot: [],
			},
		},
		{
			removed: false,
			id: "cmt-p2",
			ordinal: 3,
			sideAtPostTime: "NO",
			createdAt: "2026-05-21T12:30:00.000Z",
			title: "Anchor on the actual number",
			teaser: "",
			body: "Let us anchor on the actual number. Current daily ridership is running in the few-hundred-thousand range, not near a million. To clear a 7-day average of 1M before the freeze you need to roughly double-to-triple current throughput in under six months, including the festival-season dip in Oct–Nov. New-line ramps do not move that fast without a step change in feeder connectivity, which is not coming by then.",
			imageUrl: null,
			marker: "none",
			badge: null,
			author: { pseudonym: "GoldenLynx288", pfpUrl: "/pfp-placeholder.svg" },
			authorStake: "500.000000000000000000",
			entryPrice: "0.500000000000000000",
			aggregate: {
				supportCount: 1,
				counterCount: 1,
				supportDharma: "140.000000000000000000",
				counterDharma: "165.000000000000000000",
			},
			replies: {
				support: [
					{
						removed: false,
						id: "cmt-r2-1",
						side: "NO",
						createdAt: "2026-05-23T08:20:00.000Z",
						body: "The last-mile gap is the killer. Half these stations drop you 1.5 km from where you are actually going with no integrated bus feeder. Until that is fixed, people with a direct bus stick to the bus.",
						marker: "none",
						author: {
							pseudonym: "RustStag149",
							pfpUrl: "/pfp-placeholder.svg",
						},
						stake: "140.000000000000000000",
						entryPrice: "0.510000000000000000",
					},
				],
				counter: [
					{
						removed: false,
						id: "cmt-r2-2",
						side: "YES",
						createdAt: "2026-05-24T14:10:00.000Z",
						body: "Doubling current throughput sounds dramatic, but that is literally the normal ramp curve for a line that just completed its full length. The base you are quoting is from before the Colaba extension opened. Forward the trend, do not freeze it at today.",
						marker: "Flipped",
						author: {
							pseudonym: "VioletCrane092",
							pfpUrl: "/pfp-placeholder.svg",
						},
						stake: "165.000000000000000000",
						entryPrice: "0.530000000000000000",
					},
				],
				twoSlot: [],
			},
		},
		{
			removed: false,
			id: "cmt-p3",
			ordinal: 1,
			sideAtPostTime: "YES",
			createdAt: "2026-05-15T06:55:00.000Z",
			title: "The monsoon case alone gets you most of the way",
			teaser: "",
			body: "The monsoon case alone gets you most of the way. Mumbai's wet season is four months of unreliable roads, and Line 3 is fully underground end to end. Every serious flood day pushes a wave of riders onto whatever rail still runs. Stack that seasonal surge on top of the opening ramp and 1M is reachable in the window.",
			imageUrl: null,
			marker: "Flipped",
			badge: null,
			author: { pseudonym: "AmberFox042", pfpUrl: "/pfp-placeholder.svg" },
			authorStake: "320.000000000000000000",
			entryPrice: "0.450000000000000000",
			aggregate: {
				supportCount: 0,
				counterCount: 1,
				supportDharma: "0.000000000000000000",
				counterDharma: "230.000000000000000000",
			},
			replies: {
				support: [],
				counter: [
					{
						removed: false,
						id: "cmt-r3-1",
						side: "NO",
						createdAt: "2026-05-25T11:30:00.000Z",
						body: "Monsoon lifts ridership for days at a time, not a sustained 7-day average over a million. And the surge cuts both ways: severe flooding also shuts stations and snaps the feeder network people use to reach them. It is a spike, not a new baseline.",
						marker: "none",
						author: {
							pseudonym: "GoldenLynx288",
							pfpUrl: "/pfp-placeholder.svg",
						},
						stake: "230.000000000000000000",
						entryPrice: "0.520000000000000000",
					},
				],
				twoSlot: [],
			},
		},
		{
			removed: true,
			id: "cmt-p4",
			ordinal: 4,
			sideAtPostTime: "NO",
			createdAt: "2026-05-26T19:05:00.000Z",
			aggregate: {
				supportCount: 1,
				counterCount: 1,
				supportDharma: "90.000000000000000000",
				counterDharma: "110.000000000000000000",
			},
			replies: {
				support: [
					{
						removed: false,
						id: "cmt-r4-1",
						side: "NO",
						createdAt: "2026-05-27T07:15:00.000Z",
						body: "Even setting tone aside, the throughput math in the parent is roughly right: the gap to 1M is large and the clock is short.",
						marker: "none",
						author: {
							pseudonym: "AzureBison330",
							pfpUrl: "/pfp-placeholder.svg",
						},
						stake: "90.000000000000000000",
						entryPrice: "0.510000000000000000",
					},
				],
				counter: [
					{
						removed: false,
						id: "cmt-r4-2",
						side: "YES",
						createdAt: "2026-05-28T13:40:00.000Z",
						body: "The gap looks large only if you ignore that two major interchange stations open next month. Interchanges are where ridership compounds.",
						marker: "none",
						author: {
							pseudonym: "MossViper175",
							pfpUrl: "/pfp-placeholder.svg",
						},
						stake: "110.000000000000000000",
						entryPrice: "0.540000000000000000",
					},
				],
				twoSlot: [],
			},
		},
		{
			removed: false,
			id: "cmt-p5",
			ordinal: 5,
			sideAtPostTime: "YES",
			createdAt: "2026-06-02T08:25:00.000Z",
			title: "Fare competitiveness is the quiet driver",
			teaser: "",
			body: "Fare competitiveness is the quiet driver here. For the BKC–airport–SEEPZ triangle the line undercuts a cab by a wide margin and beats the door-to-door time. Price-sensitive daily commuters switch on cost, and that is the bulk of the volume.",
			imageUrl: null,
			marker: "Exited",
			badge: null,
			author: { pseudonym: "TealOwl118", pfpUrl: "/pfp-placeholder.svg" },
			authorStake: "150.000000000000000000",
			entryPrice: "0.550000000000000000",
			aggregate: {
				supportCount: 0,
				counterCount: 1,
				supportDharma: "0.000000000000000000",
				counterDharma: "50.000000000000000000",
			},
			replies: {
				support: [],
				counter: [
					{
						removed: false,
						id: "cmt-r5-1",
						side: "NO",
						createdAt: "2026-06-04T17:50:00.000Z",
						body: 'Fare beats a cab, sure, but most of the "bulk volume" you need is people currently on the suburban locals, which are cheaper than the metro, not pricier. Cost actually cuts against the switch for them.',
						marker: "none",
						author: {
							pseudonym: "RustStag149",
							pfpUrl: "/pfp-placeholder.svg",
						},
						stake: "50.000000000000000000",
						entryPrice: "0.530000000000000000",
					},
				],
				twoSlot: [],
			},
		},
		{
			removed: false,
			id: "cmt-p6",
			ordinal: 6,
			sideAtPostTime: "NO",
			createdAt: "2026-06-09T10:05:00.000Z",
			title: "The feeder rationalization slipped",
			teaser: "",
			body: "Concretely on connectivity: the bus feeder rationalization that was supposed to wrap before the line's full opening has slipped. Without those feeders the catchment per station is walking distance only, which caps daily throughput well under the million mark regardless of how good the core line is.",
			imageUrl: null,
			marker: "none",
			badge: null,
			author: { pseudonym: "IndigoWolf355", pfpUrl: "/pfp-placeholder.svg" },
			authorStake: "95.000000000000000000",
			entryPrice: "0.520000000000000000",
			aggregate: {
				supportCount: 1,
				counterCount: 0,
				supportDharma: "70.000000000000000000",
				counterDharma: "0.000000000000000000",
			},
			replies: {
				support: [
					{
						removed: false,
						id: "cmt-r6-1",
						side: "NO",
						createdAt: "2026-06-11T09:35:00.000Z",
						body: "This matches what I am seeing on the ground: packed core stations, empty feeder roads. The line is not the bottleneck, getting to it is.",
						marker: "none",
						author: {
							pseudonym: "SlateHeron061",
							pfpUrl: "/pfp-placeholder.svg",
						},
						stake: "70.000000000000000000",
						entryPrice: "0.510000000000000000",
					},
				],
				counter: [],
				twoSlot: [],
			},
		},
	],
};

export const mumbaiMetroMeta: ExportMarketMeta = {
	outcome: null,
	resolvedAt: null,
	resolutionReason: null,
	participants: 11,
	totalStakeDharma: "3225.000000000000000000",
};
