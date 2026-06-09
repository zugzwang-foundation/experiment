import { v7 as uuidv7 } from "uuid";
import { z } from "zod";
import { buildBetMetadata, runBetEndpoint } from "@/server/bets/endpoint";
import { InvalidRequestBodyError } from "@/server/bets/errors";
import { sell } from "@/server/bets/sell";
import { runBetTransaction } from "@/server/bets/transaction";
import { CpmmDecimal } from "@/server/cpmm/decimal";
import { numericString } from "@/server/events/schemas";

// POST /api/bets/sell — F-BET-3 (comment-free sell). Runs the §3.1 stack via
// `runBetEndpoint`, MINUS moderation (sell carries no comment → skips step 6),
// then the `sell` unwind inside `runBetTransaction` (step 7).

const sellBodySchema = z.object({
	marketId: z.string().uuid(),
	shares: numericString,
});

export async function POST(request: Request): Promise<Response> {
	return runBetEndpoint(request, async (ctx) => {
		// 5. Body validate. Sell carries NO comment → NO moderation (skips step 6).
		const parsed = sellBodySchema.safeParse(ctx.rawBody);
		if (!parsed.success) {
			throw new InvalidRequestBodyError();
		}
		const { marketId, shares } = parsed.data;
		if (!new CpmmDecimal(shares).greaterThan(0)) {
			throw new InvalidRequestBodyError("shares must be > 0");
		}

		// Retry-purity: the single event_id + the synthetic sale id + metadata,
		// ONCE here, closed over the callback.
		const sellEventId = uuidv7();
		const syntheticBetId = uuidv7();
		const metadata = buildBetMetadata({
			requestId: ctx.requestId,
			flowId: "F-BET-3",
			userId: ctx.userId,
			idempotencyKey: ctx.idempotencyKey,
			ip: ctx.ip,
			userAgent: ctx.userAgent,
		});

		// 7. Transaction — the comment-free unwind inside the W-1 wrapper.
		const result = await runBetTransaction(
			{ marketId, flow: "F-BET-3" },
			(txCtx) =>
				sell(txCtx, {
					userId: ctx.userId,
					marketId,
					shares,
					sellEventId,
					syntheticBetId,
					metadata,
				}),
		);

		return { status: 200, body: { ok: true, data: result } };
	});
}
