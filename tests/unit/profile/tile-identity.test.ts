import { describe, expect, it } from "vitest";

import { displayNetProfitLoss, formatDharma } from "@/components/debate/format";

// DROUND R2 (SPEC.1 §10.8) — the §23 tile identity is preserved in DISPLAYED
// space: displayed Net P/L = displayed Wallet + displayed Positions − Σ issuance.
// `netProfitLoss = wallet + positions − issuance` exactly (server: tiles.ts), so
// issuance is recovered in exact decimal space and the displayed P/L is derived
// from the DISPLAYED (rounded) operands — never each tile rounded independently.
// `displayNetProfitLoss` IS that derivation, so asserting its output against the
// operands' displayed sum minus issuance is the identity check (no JS floats).

describe("displayNetProfitLoss — §23 tile identity in displayed space (R2)", () => {
	it("wallet=0.4, positions=0.4 → 0 / 0 / 0 (naive would show 0 / 0 / 1)", () => {
		// issuance = 0.4 + 0.4 − 0.8 = 0. Independent rounding renders P/L as
		// round(0.8)=1 while wallet+positions render 0+0 → identity broken (1≠0).
		// The derived P/L closes it: displayed P/L = 0 (= 0 + 0 − 0).
		expect(formatDharma("0.4")).toBe("0"); // displayed wallet
		expect(formatDharma("0.4")).toBe("0"); // displayed positions
		expect(displayNetProfitLoss("0.4", "0.4", "0.8")).toBe("0");
	});

	it("whole-number tiles are unchanged (wallet=500, positions=120, PL=-30)", () => {
		// issuance = 500 + 120 − (−30) = 650; displayed P/L = 500 + 120 − 650 = -30.
		expect(displayNetProfitLoss("500", "120", "-30")).toBe("-30");
	});

	it("never renders a signed zero for the P/L tile", () => {
		// wallet=0.4, positions=0, netProfitLoss=0.4 → issuance=0, derived P/L=0.
		expect(displayNetProfitLoss("0.4", "0", "0.4")).toBe("0");
		expect(displayNetProfitLoss("0.4", "0", "0.4")).not.toBe("-0");
	});

	it("closes the identity when only one operand rounds up", () => {
		// wallet=0.6 (→1), positions=0.1 (→0), netProfitLoss=0.7, issuance=0.
		// Displayed identity: displayed P/L = 1 + 0 − 0 = 1.
		expect(formatDharma("0.6")).toBe("1");
		expect(formatDharma("0.1")).toBe("0");
		expect(displayNetProfitLoss("0.6", "0.1", "0.7")).toBe("1");
	});

	it("holds at 18-dp precision (no float drift)", () => {
		// wallet + positions − netProfitLoss must stay exact through issuance.
		const wallet = "500.100000000000000001";
		const positions = "120.200000000000000002";
		const netProfitLoss = "0.300000000000000003"; // issuance = 620
		// displayed wallet=500, positions=120 → displayed P/L = 500+120−620 = 0.
		expect(formatDharma(wallet)).toBe("500");
		expect(formatDharma(positions)).toBe("120");
		expect(displayNetProfitLoss(wallet, positions, netProfitLoss)).toBe("0");
	});

	it("degrades to the rounded raw P/L on a malformed operand", () => {
		expect(displayNetProfitLoss("—", "0.4", "0.8")).toBe(formatDharma("0.8"));
	});
});
