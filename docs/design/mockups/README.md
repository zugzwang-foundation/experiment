# Build files at v1.0 — what these are, and the one mistake to avoid

These accompany `DESIGN_integration-shell_v1.0.html`. Read this before touching the build env
or deleting anything. Full context: `DESIGN-phase-record.md` §9 (Source-Drift).

## ⚠️ The critical distinction — built surfaces are NOT source mockups

The three `surface_*_v1.0.html` files are the **built OUTPUT** — the post-transform surfaces,
decoded byte-for-byte from the v1.0 shell's blobs. They are **not** the source mockups that
feed the build pipeline.

**Do NOT drop these in as `src/` mockups and re-run the pipeline.** The pipeline
(`add_reply_scroll → refine_reply → refine_d5`) would transform already-transformed content =
double-transform = breakage. These are a **reference / reconciliation target**, not pipeline
inputs.

## What's here (exported from this lock)

| File | What it is | Status |
|------|-----------|--------|
| `surface_discovery_v1.0.html` | Built Discovery surface at v1.0 | Authoritative output. = the v1.0 `discovery` blob (byte-verified). |
| `surface_d5_v1.0.html` | Built D5 surface (Market Detail + Reply) at v1.0 | Authoritative output. = the v1.0 `d5` blob (byte-verified). |
| `surface_profile_v1.0.html` | Built Profile surface at v1.0 (also the Bookmark page via bookmark mode) | Authoritative output. = the v1.0 `profile` blob (byte-verified). |
| `add_reply_scroll.py` | Reply-carousel transform | **Current** — includes the v0.33 column side-routing fix. |
| `post_scroll.py` | Market-carousel transform | Unchanged from PK (its logic was not edited v0.31→v1.0). |

## What is NOT here (only the operator's machine has these)

- `refine_d5.py`, `refine_reply.py`
- the three **source mockups** (`market_reply.html`, `profile.html`, the discovery source)
- a v1.0-correct `build.py` (PK has v0.28; bumping it needs the refine pipeline)

These were never available to the web lane, so they could not be regenerated here.

## What these exports DO and DON'T achieve

- **DO:** preserve the complete v1.0 surface content as readable HTML — so **nothing is lost
  when the old `v0_*` shells are deleted**, and you have a precise target to diff your stale
  source mockups against when you reconcile.
- **DON'T:** make the build env reproduce v1.0. `build.py` from current source still emits
  **v0.28**. Reconciliation (back-porting v0.29→v1.0 into the source mockups + refine scripts,
  then bumping `build.py`) is an **operator-side** task on the machine that holds those files.

## Note on v1.0 being self-contained

`DESIGN_integration-shell_v1.0.html` embeds these three surfaces as blobs and is **frozen and
self-contained** — it does not need the build env to run or be maintained. The build env only
matters if/when you want to **iterate or regenerate** from source (e.g. the eventual production
/ Claude Design handoff). For simply *holding* v1.0 as the locked truth, the build env is
archival.
