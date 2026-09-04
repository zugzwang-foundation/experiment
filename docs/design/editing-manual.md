# Zugzwang — Claude Design: Design-System Editing Manual

> **v1.0** · operating guide · 2026-07-03
> **Scope.** How to edit the **Zugzwang Design System** in Claude Design — the published system in your project. This is the produce-side manual for *reimagining the global look*, before you build the 15 surfaces.

---

## How to read this

- **The headline answer to "do I type, or edit a page?" — you type.** The chat is the main way you change the system. Everything below expands on that.
- Claude Design is a research-preview tool; a few fine-grained behaviours (exactly what a given button does) can change under you. Where this says **"confirm on your screen,"** click it once and check — don't take the manual over what your screen shows.
- **Golden rule, before anything else:** you edit the *system*, and every screen updates from it. You do **not** re-style 15 screens by hand. Change the system once; the screens re-render.

---

## 1. The mental model — what you're actually editing

Your design system is a small bundle of files Claude Design generated (a readme, a colours-and-type stylesheet, a styles file, component/specimen files, the UI-kit app screens, a SKILL file). Together they **are** "the look." The app screens you see — the Discovery grid, the Mumbai Metro market — are the **preview**: they're rendered *from* the system, not the system itself.

Two levels, and keeping them straight is the whole game:

- **The system (global).** Fonts, colours, corner radii, spacing, how a card / button / nav / side-badge looks. Change these and *every* screen changes. You edit them from the **Design System view's chat** — where you are in the screenshot.
- **A single screen (local).** One surface's specific layout. You touch these later, in a design that *inherits* the system ("Use this system" → New design) — **not here**.

Right now you want the first one: reimagining the global look. That all happens from the Design System chat.

**Plain version:** the system is the master paint-and-parts kit; the screens are showrooms built from it. Repaint the kit, every showroom repaints. Repaint one showroom, only that room changes — and now it's off-model.

---

## 2. The main lever — the chat (this is where you live)

You change the system by **typing what you want** into the chat, the same way it was built. This is the recommended way for essentially everything, because it keeps the system **coherent**: ask for a font change and Claude updates the type tokens, the type-specimen cards, *and* re-renders every screen together. Hand-editing one file can leave the screens out of sync with the tokens; the chat doesn't.

**How to phrase an edit so it lands right** (the model takes you literally — be exact):

- **Name the exact thing and the exact value.** Not "make the font nicer" → "Set the interface font to Inter; keep the current type scale and weights."
- **Say what to preserve** so nothing drifts: "…and don't change the spacing or the card layout."
- **One coherent change at a time, then look.** Bundling five unrelated changes makes it hard to see what moved.
- **To reimagine broadly, describe the intent and let it propose:** "Give the whole system a slightly warmer, tighter feel — smaller corner radii, hairline borders, a bit more air between cards; keep it monochrome." Then react to what it returns.

**The loop:** type a change → it regenerates → look at a couple of real screens (Discovery, a market card, the reply view) → react in chat → repeat. When it's right, checkpoint (save/export a copy) and move on.

---

## 3. The direct levers — your toolbar (use sparingly)

From the open-screen toolbar you also have direct controls. These are for **surgical** tweaks, not for reimagining the system. Confirm exact behaviour on your screen:

- **Tweaks** — quick direct adjustments to the open screen (the fast "nudge it" controls). Good for "this padding is 2px off." Confirm which properties it exposes.
- **Edit** — opens the current file/screen for direct editing. Use if you know the one line you want to change. *Caveat:* a direct edit to a screen changes *that screen*, and a direct edit to a file may not re-render the others — so for anything global, use the chat; if you do edit directly, re-check another screen.
- **Comments / Mark up** — leave targeted notes on the screen, then ask Claude to act on them. *Caveat:* in this preview, comments can occasionally disappear — don't rely on them as a durable record; put anything important in the chat.
- **Present / 100% / Share** — viewing and sharing, not editing.

**Recommendation:** for *reimagining the system*, ignore these and drive from the chat. Reach for Tweaks / Edit only for a pixel-level fix on a specific screen.

---

## 4. What lives in which file (so you know what you're changing)

You don't have to touch files directly, but knowing where things live helps you phrase a chat request. Open any of these from the file dropdown next to "Design System":

- **Colours-and-type stylesheet (the token file)** — **fonts and colours live here.** This is the file behind most "look" changes.
- **Styles file** — broader component / layout styling.
- **Component / specimen files** — the button / card / nav / side-badge definitions and the specimen cards that show them.
- **UI-kit app screens** (index.html and the rest) — the rendered previews (Discovery, market, reply, etc.).
- **Readme / SKILL file** — the written description of the system + the portable instructions a coding agent reads.

Opening files is for *reading/understanding*; prefer chat for *changing*.

---

## 5. Worked examples

### 5a. Change the fonts (your question)

In the Design System chat, type the exact change, e.g.:

> "Replace the interface typeface with **Inter**. Change the display/heading typeface to **[X]**. Keep the current type scale, weights, and line-heights. Don't change spacing or layout."

Claude updates the type tokens, the type-specimen cards, and re-renders every screen. Then check the specimens + Discovery + a market card to confirm.

**Font caveat (matters for the real brand font):** if you name a font Claude can fetch (a Google Font), it uses it directly. If you name a **proprietary/licensed** foundry font, Claude will likely **substitute a close Google Font as a stand-in in the preview** — the preview won't be the exact licensed face. That's fine: put the *real* font name in your values-log (§6) and the actual licensed font gets wired in at the code build. (Geist today is a placeholder standing in for the eventual brand face.)

You *can* instead open the colours-and-type file and hand-change the font-family — but prefer chat (it keeps specimens + screens in sync). If you do hand-edit, re-verify the screens picked it up.

### 5b. Corner radius / borders

> "Halve all corner radii; use hairline (1px) borders on cards and inputs; keep everything else."

### 5c. Restyle a component

> "Restyle the market card: tighter internal padding, the handle and side-badge on one row, the mini price-chart flush to the card edge. Apply it everywhere the card is used."

### 5d. Add a logo / wordmark

Attach the SVG in the chat, then:

> "Use this as the Zugzwang wordmark in the header, replacing the text logo; keep the hourglass mark to its left; match the header height."

### 5e. Add an accent colour — READ THIS FIRST

Adding a colour is the one edit that **reopens a locked decision.** Your system's own readme says monochrome is the *language, not a placeholder* — black / white / true-neutral greys are the permanent look, and YES=black / NO=white are semantic and never restyled. Introducing an accent is a real product decision, not a tweak.

- If you decide to do it, that's your call — but it's deliberate, and `design-language.md` + the CD readme get updated so canon matches reality (otherwise the next build fights the doc). **Flag it and I'll sequence the doc change.**
- Discipline if you add one: keep it to a **single** accent, used sparingly (a common rule: accent on ≤10% of any screen), and **never** let it replace or tint the YES/NO poles.

### 5f. The one thing to leave alone

**Do not restyle the YES=black / NO=white poles.** They aren't styling — they encode which *side* of a bet a thing is on, they're frozen at post-time, and the whole product (and the design language) depends on them staying exactly black/white. Reimagine everything else freely; leave these unless you explicitly decide to reopen that decision with me.

---

## 6. The edit loop & discipline

- **Fresh chat per session.** Your current chat is at ~327k tokens (the tool is already warning you) — it'll get slow and sloppy. Hit **New chat**; the project and system persist, you lose nothing. Do heavy editing in a clean chat.
- **Validate on real screens** after each meaningful change: Discovery (the grid), one market card with YES/NO, and the reply view. If those three look right, the system's right.
- **Keep it coherent** — change the system, not one screen; let it propagate.
- **Log your values as you set them** — a running list: font names, any accent hex, corner-radius numbers, border weight, icon set, logo file. This short list is the **only** thing that has to survive out of Claude Design to the code build (the CD export itself is lossy). Keeping it as you go turns the eventual handoff into a copy-paste instead of a redo.
- **Fable 5 window.** You're editing on Fable 5 Max, which burns your allowance ~2× as fast as Opus, and the Fable window is set to close around **July 7** before shifting to usage credits — **verify the exact date/terms in-app** and front-load the heavy system work before then.

---

## 7. Locking the system

"Locked" means two things — one in Claude Design, one in the repo:

- **In Claude Design:** keep **Published** on (and **Default** if you want new designs to inherit it). That's the system being active. When you're happy with the reimagined look, you stop editing and leave it Published.
- **In the repo (the real lock for the build):** the final brand **values** — token values, font names, radii, any accent, plus logo/icon SVGs — get mirrored into the repo's token files so Claude Code builds against **canon**, not against Claude Design's export (which is proprietary and lossy). That's the export step we're deferring; your values-log (§6) is what makes it painless.

**So:** reimagine in the chat → validate on screens → *Published* stays on → values logged → (later) mirrored to the repo → then Claude Code builds the 15 surfaces against that. **"Done" = you're happy with the look AND the values are written down.**

---

## 8. Cheat sheet

| I want to… | Do this |
|---|---|
| Change fonts, colours, radii, spacing, a component's look | **Type it in the Design System chat** (global; propagates) |
| Reimagine the whole feel | Describe the intent in chat; react to what it returns |
| Nudge one pixel-level thing on one screen | **Tweaks** / **Edit** on that screen (local; re-verify) |
| Leave a targeted note | **Comments** (but keep anything important in chat — comments can vanish) |
| Add a logo / wordmark | Attach the SVG in chat; tell it where it goes |
| Add an accent colour | **Flag me first** — it reopens the monochrome decision; then chat |
| Restyle YES / NO | **Don't** — semantic + permanent, unless you reopen it with me |
| Make it stick | Keep **Published** on + log the values (repo mirror comes at export) |

---

*End v1.0. Claude Design is research-preview — confirm fine-grained button behaviour on your own screen; verify the Fable-5 window date in-app. The repo's token files remain the build source of truth; the CD export is a lossy reference.*
