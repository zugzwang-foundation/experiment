# DECISION RECORD — amendment 2.11

**Amends** `RECORD-v2.0.md` · follows every amendment on disk before it (measured across `origin/main` and `origin/feat/ff-1`) · **Opened** 2026-09-23
**Rulings** D-53

---

## D-53 · MKT-MAT-01 loses its "on Zugzwang" premise; D-50 R2 kept in the rewording tool's own guard

**Ruled:** 2026-09-23 · **Task:** MAT-REWORD-2 · **Supersedes:** D-50 R2 (in the form of R2 below) · D-52 R4

### Context

On 19 September the founder approved a MKT-MAT-01 without "on Zugzwang" (v3.1). On 20 September D-50 R2 withdrew it, because production held a live stake placed under the v3.0 wording, and v3.2 restored v3.0. On 23 September he ruled it again: "Change it everywhere." The words are the market's premise, not only its title: the question asks whether problems are solved on Zugzwang, the rules require Thomas Bloom's confirmation to link to or name Zugzwang, and a clause defines what "on Zugzwang" means. MAT-REWORD-1 then measured that v3.1 was not v3.0 minus the premise: it restored v2.2's rule, which also moved the deadline from Bloom's confirmation to the solving, fixed the reference date to 15 September against the market's own "at market open" clause, and narrowed the confirmation to a single post.

### Decision

**R1 — MKT-MAT-01 v3.3 is v3.0 with the premise removed and nothing else changed:** the title's "on Zugzwang"; the question's closing "on Zugzwang"; the YES condition's link-or-name requirement and the matching NO case; the "On Zugzwang." clause; the Criterion's third element ("All three" becomes "Both"); and the Evidence item naming the Zugzwang argument. The deadline still binds Bloom's confirmation, a problem still counts only if listed as open when the market opened, and his confirmation may still span posts. v3.1 is not restored. The slug stays `math-erdos-solved-on-zugzwang`, so links and the slug-keyed resolution components keep working.

**R2 — No stake ever sits under wording it was not placed on.** The change is applied only through `scripts/apply-v3-market-specs.ts`, whose in-transaction guard refuses unless all five of its target markets carry no bets, comments or positions. Staging now. Production keeps v3.0 until that guard passes there, after production's test data is cleared before launch. This is D-50 R2's protection kept in the tool's form; D-50 R2's stop on the edit itself is superseded.

**R3 — D-52 R4 is superseded.** It planned a title-only change and said no edit path existed. The words are the premise, and the path exists.

### Consequences

**Positive.** Title, question and rules agree, and the change is exactly the premise: every other clause a bettor has read stays as written. D-50 R2's protection of bettors holds by construction.

**Negative.** Until production is cleared, staging and production ask different questions for this market. The market no longer tests whether solutions are published on Zugzwang; it tests Erdős progress anywhere. On production all five target markets carry test activity (Đ 99,344 · 1,328 posts · 1,306 replies as served on 2026-09-23), so the tool refuses there until the pre-launch clearing.

**Enforced at:** `docs/markets/MKT-MAT-01.md` (v3.3) · `docs/data/staging-markets-snapshot.json` · `docs/data/prod-markets-snapshot.json` · `docs/data/staging-markets-snapshot.md` · `tests/unit/staging/content-markets-source.test.ts` (the Math pin) · the staging database, through `scripts/apply-v3-market-specs.ts`.

---

*End amendment 2.11.*
