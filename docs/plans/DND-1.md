# DND-1 — drag-and-drop onto the composer's image slot

## Context

On the live site, dragging an image onto the composer's **Add Image** box does nothing.
Measured cause, not inferred: `grep -rn "onDrop\|onDragOver\|dataTransfer\|DragEvent" src/`
returns **zero matches** — the application has never registered a drop handler anywhere.

The consequence is worse than "the box ignores it". With no handler, the *browser's* default
takes over and navigates the tab to the dropped file, so a near-miss (or a hit — they are the
same thing today) **destroys the argument already typed**. Mandatory commentary means there is
always a typed argument in that composer; the cost of a stray drop is never zero.

Two surfaces in the whole tree pick an image — the participant composer
(`src/components/debate/composer/ImageAttach.tsx`, mounted by `BetComposer` for post *and*
reply, desktop *and* phone) and the admin create-market uploader. **Founder ruling: the bet
composer only**; the admin page is out of scope for this task. Paste-to-attach is likewise out
of scope.

Intended outcome: a file dropped on the image panel attaches exactly as a file picked through
the dialog does, and a file dropped anywhere else while a composer is open does nothing at all.

**Not critical path** (CLAUDE.md §1 — this touches no `src/server/`, no schema, no ledger),
so no subagent review (§5.11 says not to invoke for non-critical work) and no ADR (§5.12 — a
new input path into an existing affordance is not an architectural change).

## Approach

### 1. The drop target — `src/components/debate/composer/ImageAttach.tsx`

The `<fieldset>` already IS the panel and already carries `cursor-pointer` and
`hover:border-n4`; it becomes the drop target. Four handlers, all gated on
`e.dataTransfer.types.includes("Files")` so a text/link drag is never intercepted (the
argument textarea sits one grid track over and must keep its native text-drop behaviour):

- `onDragOver` — `preventDefault()`, set `dropEffect = "copy"`, set the drag-active flag.
  Setting the flag here rather than on `dragenter` avoids the enter/leave counter and the
  flicker it exists to fix; `dragover` fires continuously over the element.
- `onDragLeave` — clear the flag only when the pointer actually left the fieldset
  (`!e.currentTarget.contains(e.relatedTarget as Node)`).
- `onDrop` — `preventDefault()`, clear the flag, then `onPick(dataTransfer.files[0])`.
- Blocked when `disabled || state.phase === "attaching"` — the identical condition that
  already disables the pick button, so a drop cannot start a second upload mid-flight.

**Reuse, no new validation.** `onPick` is `BetComposer.onPickImage`, which calls the existing
`attachImage()` in `composer/image-attach.ts`; that already runs `validateImageFile` (MIME +
byte cap), the T3 downscale, sign and PUT, and maps a rejection onto `phase: "error"` with the
route's own wire string. A dropped `.pdf` therefore reports "unsupported image type" through
the path that already exists. Nothing is duplicated.

**Drag-active styling uses a data-attribute variant, and that is deliberate.** The panel's
border is the arbitrary shorthand `[border:var(--hairline)]`; a bare `border-n4` is a base
utility competing with it at equal specificity, so which one paints depends on Tailwind's
emitted order. `data-[dragging=true]:border-n4` is a *variant*, so it lands in a later group
and wins the same way the existing `hover:border-n4` already does. No new visible copy — the
change is a border colour, so `design-canon.md` §6's copy register needs no amendment.

⛔ **`const panel = "…"` and `const attachedPanel = "…"` must stay plain double-quoted
literals.** `tests/unit/design/composer-fit.test.ts:512` finds the string by
`indexOf("const panel =")` and then takes the first `"…"` within 400 characters. Converting
either to a template literal or a `cn()` call silently breaks that guard's extraction. The new
variant token is appended *inside* the existing literal (inert until the attribute is set).

### 2. The stray-drop guard — `src/components/debate/composer/BetComposer.tsx`

A `useEffect` that, for the lifetime of an open composer, registers `dragover` and `drop` on
`document` and calls `preventDefault()` when — and only when — the drag carries `Files`. That
is what stops the browser navigating away; a miss becomes a no-op instead of a lost argument.

Scoped to the composer rather than to `(public)/layout.tsx` on purpose: the argument is the
only thing on the site a stray drop can destroy, and a listener that exists exactly while
there is something to protect needs no reasoning about the rest of the surface (§5.3).
It sits beside the existing `document.addEventListener("keydown", …)` Escape effect at
`BetComposer.tsx:276-284` and takes the same shape.

Note it is registered independently of the `image-attach-enabled` flag (ADR-0052): with the
brake applied there is nowhere to drop, but losing a typed argument is still the worse outcome.

### 3. Guards — `tests/unit/composer/render/attach-drop.test.tsx` (new)

Written **first**, red, before either edit — CLAUDE.md §5.6 names media upload a tests-first
surface. jsdom + RTL per AGENTS.md §9; **no `jest-dom`**, so assertions are plain DOM
(`getAttribute`, `textContent`). Renders `ImageAttach` directly for 1–4 and the real
`BetComposer` via `tests/unit/composer/render/_harness.tsx` for 5.

1. A file dropped on the panel calls `onPick` with that exact `File`.
2. A drop is ignored while `disabled`, and ignored while `phase: "attaching"`.
3. A `types: ["text/plain"]` drag is **not** intercepted — `defaultPrevented` is false and
   `onPick` is not called. (The control that proves the gate is a gate and not a blanket.)
4. `dragover` sets the drag-active attribute; `drop` and a real `dragleave` clear it.
5. While a composer is mounted, a document-level file `drop` ends with
   `defaultPrevented === true`; after unmount, the same event is **not** prevented — the
   negative arm is what proves the effect cleans up rather than leaking a global listener.

## Verification

```bash
pnpm vitest run tests/unit/composer tests/unit/design/composer-fit.test.ts
```
```bash
ZUGZWANG_ENV=preview just verify
```

Then a real browser pass (jsdom performs no layout and synthesises no drag), driving the dev
server through the built-in browser on `/m/<slug>` with a composer open:

- construct a `DataTransfer`, add a real `File`, dispatch `dragover` + `drop` on the panel,
  and confirm the slot moves to the attaching/attached phase with a live preview;
- dispatch the same `drop` on `document.body` and read back `defaultPrevented === true`, with
  the composer's typed title/body still present afterwards;
- confirm the drag-active border actually paints (capture the element, per AGENTS.md §9 —
  the paint is the arbiter, not the computed shorthand).

## Out of scope (stated, not silently dropped)

- The admin create-market uploader (`src/app/(admin)/admin/markets/new/create-market-form.tsx`)
  keeps the same gap, by ruling.
- Paste-to-attach (⌘V), by ruling.
- `docs/plans/DND-1.md` is committed in-repo at the end of Phase 1 per §5.1.
