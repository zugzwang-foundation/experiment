# ZUGZWANG · WORKING PLAYBOOK — web Claude × Claude Code

**Version** 1.1 · **Date** 2026-10-08 (v1.0, 2026-09-23, was the Opus 5.5 Playbook) · **Owner** founder · **Author** web Claude
**Home** `docs/operating/WORKING-PLAYBOOK.md`, committed by MODEL-POLICY-1. The repository copy is canonical; project knowledge mirrors it.
**Precedence** Working guidance — not a spec, not a ruling, and it mints no identifiers. Where it disagrees with SPEC.1 / SPEC.2, an ADR, `CLAUDE.md`, `AGENTS.md` or the Overnight Run Doctrine, they win.
**Source** Addy Osmani, *Getting the most out of Opus 5.5 in Claude and Claude Code*, claude.dev, 2026-09-22 — <https://claude.dev/blog/getting-the-most-out-of-opus-5-5/>. This file applies that guide to Zugzwang; it does not reproduce it. The vendor's own examples live at the link.

> **In plain words.** The founder chooses the model for every chat and every Claude Code session; nothing in this project presets one. This file keeps the working practices that hold whichever model runs: how web Claude writes relays and reads reports, how Gate C is run, what to do when a message is "flagged" and handed to another model, and what the operator checks.
>
> **Claude Code never reads project knowledge.** It receives these practices only through the relays web Claude writes and through `CLAUDE.md`.

**How to use.** Web Claude reads §0–§3 before writing any relay. The operator reads §4–§5.

---

## §0 · Models — the founder's choice

The founder picks the model and the effort for each chat and each Claude Code session, to suit the task. Nothing in this project presets either: no pin in `CLAUDE.md`, none in `.claude/agents/*` (each declares `model: inherit` and no `effort`), and no model, effort or think-harder line in any relay. `CLAUDE.md` §6 is the binding statement for Claude Code; this file never states a model as a rule.

---

## §1 · Where each idea lands

**NOW** adopted · **HAVE** already covered, often more strictly · **SKIP** deliberately not adopted

| # | The idea, in one line | Zugzwang today | Verdict |
|--:|---|---|---|
| 1 | Hand over the whole task in one message, with the finish line and the conditions for stopping | Plans carry exit criteria; relays don't always name both | **NOW** — relay header (§3). Autonomy runs *inside* a ratified plan (`CLAUDE.md` §5.1), never instead of one |
| 2 | Drop "think harder" lines — depth comes from the effort setting | Retired at every site by MODEL-POLICY-1 (`CLAUDE.md` §5–§6, the doctrine's §5 skeleton) | **NOW** — no relay carries one |
| 3 | Say which stops you want — on long runs a model may pause to report, offer to continue, or list options that block nothing | Doctrine §1 (walls vs gates) and §2 (autonomy contract) classify every stop; daytime work is gated by design | **HAVE** — naming the three pause shapes as non-gates waits until a run actually stalls on one (§8) |
| 4 | Keep your own check before anything destructive, even when the model is told to keep going | Walls are prose; the destructive-command guards are not installed (`CLAUDE.md` §6; what is actually enforced — `AGENTS.md` §11) | **Open decision** (§7) — install before Claude Code gets longer unsupervised runs |
| 5 | Keep the task list in a file — a long run gets summarised and the scrollback stops being reliable | O-11 incremental report · doctrine §6 run file · `claude-progress.md` | **HAVE** — daytime reports add a ticked checklist (§3). Longer runs make automatic summarising likelier; the file is what survives it |
| 6 | Fan big audits out to subagents; check each one's evidence before accepting it | `CLAUDE.md` §5.11 explicit invocation · §6 delegation conditions · O-13 | **HAVE** — fan-out breadth stays governed by `CLAUDE.md` §6; this file changes nothing there |
| 7 | When a run ends, read what it needs from you before anything else | Doctrine §6 puts the founder's inheritance at the end of the report | **NOW** — web Claude reads it first (§2.2); daytime reports open with NEEDS (§3) |
| 8 | Have the model review the diff before a person does — blockers only, each with a way to show it fails | Gate C plus the subagent cascade | **NOW** — Gate C lens (§2.4). Effort is the founder's per-session choice (§0) |
| 9 | Ask it to mark what it could not confirm, and where it looked | O-13 · the NOT ESTABLISHED convention | **HAVE** for CC · **NOW** for web research answers (§2.5) |
| 10 | Attach the chart or screenshot instead of retyping it | O-11 (upload, never paste); UI rounds already use screenshots | **NOW** — extend to dashboards and before/after pairs (§4) |
| 11 | Ask it to check a long document for self-contradiction | Numbers decaying in prose is this project's most-recorded failure (O-15) | **NOW** — consistency sweep before any ratification (§2.6) |
| 12 | Ask for the finished file, not an outline | House law: full files, never diffs | **HAVE** |
| 13 | In long project chats, declare earlier answers settled — the guide itself exempts long analysis | This project *is* long analysis: later evidence overturns earlier conclusions (O-14) | **SKIP** — keep it out of the project instructions (§2.7) |
| 14 | For design, list the specific patterns to avoid — a vague "not generic" just swaps one default for another | `design-language.md` §1 constraints 9–10 already ban the house style by name, and adjectives outright | **HAVE** — and **do not import the guide's example list**: it bans pills and a mono face, both part of this design system (§2.8) |
| 15 | A flagged message may be moved to an older model | Described in the source guide | **NOW** for web and Claude Code (§5) |
| 16 | Don't ask it to reproduce its internal reasoning in the reply — that can be declined and is itself a flag category | None found in PK docs; the ambiguity register and git notes ask for a bounded *why*, which is fine | **HAVE** — keep it that way (§2.9) |
| 17 | Fast mode (`/fast`): same model, text sooner, higher per-token cost, needs extra usage enabled | Not used | **Optional** — the founder's call on cost; pointless for overnight runs, where nobody is waiting |

---

## §2 · Web Claude practice — applies now

**2.1 · Relays.** Every Claude Code relay opens with the §3 header. `DONE WHEN` names something observable — a green suite, a PR at a named head, a file in a named state — never an adjective. `STOP ONLY IF` names this relay's real gates and nothing else, because an unclassified prohibition gets read as a gate (doctrine §1).

**2.2 · Reading a CC report.** In this order: (a) the received line count against `LINES`, before reading anything (O-11); (b) what CC needs — the NEEDS section of a daytime report, or for an overnight run the wrong-premise section, the unreviewed-fix list and CARRIED / NOT DONE / OWED; (c) the rest. The operator-actions table is built from (b).

**2.3 · Know which model is answering.** If the chat shows a "Switched to" notice, web Claude says so at the top of the reply, before gating anything.

**2.4 · Gate C lens.** Ask for merge-blocking findings first, each with: location by symbol, line only as evidence (O-8); why it is wrong; the failing test or reproduction that proves it. Everything below merge-blocking goes in a second table. A blocker with no proof route is labelled as such — never dropped.

**2.5 · Research answers.** Every factual or version-sensitive claim either carries its source or is marked NOT ESTABLISHED, with where web Claude looked — the same vocabulary CC uses under O-13.

**2.6 · Consistency sweep.** Before the founder ratifies any long document — a SPEC or ADR amendment, a market spec, deck copy, an article, the terms — sweep numbers, dates (weekday included), names, versions and cross-document citations; quote each hit and locate it by heading. The founder can trigger it any time: *"Sweep this for contradictions — numbers, dates, names, versions. Quote each and say where."*

**2.7 · Re-open on new evidence.** No "earlier answers are settled" line goes into this project. When a CC report, a measurement or a screenshot bears on an earlier conclusion, web Claude re-opens it and says so — "the ground moved" and "I was wrong" are both live readings (O-14).

**2.8 · Design relays and mockups.** The exclusion list is `design-language.md` §1 constraint 9 (house style banned by name) together with constraint 10 (exact values, never adjectives), cited in every UI/UX relay and every mockup web Claude draws. Watch-list — defaults the guide names that constraint 9 does not yet cover: italic accent words inside headings; zero-padded numbered section labels (01, 02 …). One joins constraint 9 only after a round actually rejects it and the founder ratifies.

**2.9 · No reasoning dumps.** Never ask CC — or web Claude — to paste its internal reasoning. Ask for the decision plus a bounded *why*; the doctrine's ambiguity register (Chose · Rejected · Why) is the model.

---

## §3 · The relay header

```
TASK         «TASK-ID» — «one line»
DONE WHEN    «observable finish line»
STOP ONLY IF «plan ready for web review · a CLAUDE.md §3 refusal · a SURPRISE ·
              any destructive or out-of-repo action the plan does not name»
NOT DOING    «out-of-scope list»
REPORT       O-11 file. Body opens with NEEDS FROM WEB / OPERATOR (or "none"),
             then a checklist ticked as each item lands, then everything else.
```

- No model, effort or think-harder line goes in the header or anywhere in a relay (§0).
- Overnight runs keep the doctrine's own §5 skeleton and §6 section order — that report must open with the preview URL, so the NEEDS line does not apply there; web Claude reads the founder-facing sections first instead (§2.2).
- UI/UX rounds stay lean: this header is the only fixed overhead.

---

## §4 · Operator practice — Hrishikesh

- **New chat → check the picker shows the model you chose.** A chat can change model part-way.
- **Show, don't retype.** The AWS console, Cloudflare, Sentry, PostHog, the staging UI: attach the screenshot and ask one specific question. For UI rounds, send the before and after screenshots together and ask what changed. CC reports remain uploaded files, never pasted (O-11).
- **Quick question, quick answer.** For a simple question, add "answer directly".
- **When a CC run ends,** find what it is waiting on first — the NEEDS section, or for an overnight run the wrong-premise section and CARRIED / OWED. Then upload the file.
- **Typing into a running CC session:** only `continue`, or a line web Claude wrote for exactly that. Anything that changes scope goes through web Claude first. Tell web Claude what you typed — an unexplained change in a report costs a review cycle (the same spirit as O-14's reciprocal obligation).
- **CC stops and offers to continue, and nothing in the message is a question for you** → reply `continue`.
- **A "Switched to …" notice** → §5.

---

## §5 · Flags — when a message is moved to an older model

**What happens.** Some models carry stricter biology and cybersecurity safety checks; the source guide describes this for Opus 5.5. When a check flags a message, the reply usually comes from an older model, and the chat or CC session stays on that model. The check reads everything in the conversation, files and search results included, so the trigger can be earlier content rather than the last message. Reviewing source code for security holes is explicitly allowed, and the source acknowledges false flags and says the checks are being tuned.

**Why it matters here.** Web Claude gates critical-path decisions and runs Gate C. A gate that ran on a different model is a weaker gate nobody chose.

**Web Claude (claude.ai) — applies now**
- The notice begins "Switched to" and names the older model.
- Anything answered after a switch is unreviewed: re-ask on the model you chose before acting on it — above all a Gate C verdict or a relay.
- To return: choose your model in the picker. The flagged content may flag again; a fresh chat with a short handover avoids that.
- Ask-first mode: Settings → Capabilities → turn off "Switch models when a message is flagged". A flag then shows a paused card with options instead of switching. It is an account setting, so it applies to every chat (§7).

**Claude Code**
- The session shows a notice naming the older model and carries on with it.
- Back: `/model`. Retry: press Esc twice to edit the last message. Wrong flag: `/feedback`.
- Ask-first mode: `/config` → "Switch models when a message is flagged". The tradeoff is sharp for overnight runs — ask-first waits for morning; automatic carries on under a model nobody chose for that run. The founder's call (§7).
- Operator check, either way: before uploading a report, scan the session for a switch notice. If there is one, tell web Claude which phase ran on the older model; that phase is re-reviewed.

---

## §6 · Done by MODEL-POLICY-1 (2026-10-08)

- Every model pin and preset removed: `CLAUDE.md` §5–§7, the four `.claude/agents/*` (now `model: inherit`, no `effort`), the doctrine's skeleton and reviewer cascade, and the two design-process docs.
- `ultrathink` retired at every site.
- `CLAUDE.md`'s §6 and §7 now agree on dynamic workflows / `ultracode`: permitted by default off the seven areas, forbidden on them (D-17).
- This file renamed from the Opus 5.5 Playbook and committed to `docs/operating/`.

Not part of that task, and still open (§7): the destructive-command guards `CLAUDE.md` §6 prioritises, and the flag-switching settings.

---

## §7 · Open decisions — founder rules

| Decision | Recommended | Alternatives |
|---|---|---|
| Web flag setting | Ask-first — automatic switching off | Leave automatic switching on |
| Claude Code flag setting | Ask-first for daytime sessions; automatic for overnight runs, with the switch-notice check afterwards (§5) | One setting for every session |
| Destructive-command guards (`CLAUDE.md` §6) | Install before the first long unattended run | Waive, recorded |

Resolved by MODEL-POLICY-1: where this file lives (`docs/operating/`), and when Claude Code changes model (never preset — the founder's choice per session).

---

## §8 · Keeping this file honest

- It versions like any living operating document. v1.1 removed every model-specific rule (MODEL-POLICY-1).
- A row is added only when a real session hits it — the `CLAUDE.md` §7 trigger rule.
- When superseded, it is replaced, never stacked beside its successor.

*End.*
