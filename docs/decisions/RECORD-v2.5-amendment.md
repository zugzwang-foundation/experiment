# DECISION RECORD — amendment 2.5

**Amends** `RECORD-v2.0.md` · follows 2.1, 2.2, 2.3, 2.4 · **Opened** 2026-09-06
**Ruling** D-29

---

## D-29 · `SPEC.1` is rebaselined at 2.0.0

**Narrows** D-23 (2026-09-04) for `SPEC.1` only. `SPEC.2`'s rebuild stands.

**Ruling.** `SPEC.1` is a product contract, not a catalogue. §16.3–§16.5 (privacy, audit logs,
compliance), §17 (acceptance catalogue), §18 (out of scope), §19 (open questions) and §21–§23
(ancillary surfaces, Discovery, Profile) are removed; the repository carries the built surfaces
and the tests. The change log is reset; the 1.0.0–1.0.49 line stays in git history. Section
numbers are retained, with gaps, so cross-references elsewhere stay resolvable. Version 2.0.0.

Five prescriptive sentences survive by relocation: the append-only rule on `mod_actions` and
`admin_events` → §15; the AGPL-3.0 source link in the Terms → §13 F-AUTH-4; "removed content is
never rendered or exported" → §15; "no misinformation moderation" and the thesis-bearing
exclusions → §3.2 (NG6–NG15). Every flow keeps its inline Acceptance line.

**Consequences.** D-20's enforcement site `SPEC.1 §16.5` falls away; `SPEC.1 §14` is the sole
`SPEC.1` site. D-26's `SPEC.1 §21.4` survivor is honoured in code, not in a section. D-24 holds.
Number tuning (D-28 r1) and §10.6 are untouched. Moderation code conformance is `MOD-1`,
pending; the spec leads the code until it lands, and the 2.0.0 change-log row says so.
`CLAUDE.md` already carries the advisory posture (landed at the D-20…D-27 sweep) and is not
edited by this ruling.

**Enforced at** `SPEC.1` §0, §20 · `SPEC.2` §0 at the `SPEC.2` pass.

---

*End amendment 2.5.*
