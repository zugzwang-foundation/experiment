# Act VII — The Last Mile
*n286–346 · 3 – 18 August 2026*

By the start of August the thing works. Bets settle, arguments rank, the pages look like the drawings. What's left is the last mile — every surface compared against its mockup, one at a time, until they match.

That's when the project starts finding things that were never there.

On the second of July, production had quietly begun serving itself. A switch controlling whether the real site goes live had drifted into the on position, unnoticed, and for a while the live site ran against a database missing a change it needed. Nobody broke anything. A switch was somewhere nobody had put it.

Six weeks later, the larger one. In May it was decided that everything would run in Mumbai. The app went to Washington — not because anyone chose Washington, but because nobody wrote down Mumbai, and Washington is where things go when nobody says. For three months, every database call crossed an ocean and came back.

Both faults are the same shape, and the commit that fixed the second names it better than I can: a config file that is *silent* is indistinguishable from a correct one. Every check reads what's written. Neither of these was ever written.

Act VII is where the project stops trusting what it reads and starts measuring.

---

---

### Not Yet Live
`POLISH-1a — global header + shell: ten ratified deltas` · 3 August 2026 · week 15

Ten small corrections to the header, and one of them is a sentence. The mockup labelled a control with what it says when it is working; this build never turns it on, so the label promised something the product could not deliver. It now says the thing is not live yet. Copying a mockup verbatim is one of the ways a product ends up lying.

---

### It Stays In The Flow
`POLISH-1b — page container primitive + sticky header` · 4 August 2026 · week 15

One container primitive replaces the page frames each surface had grown for itself. The header is made to stay at the top the gentler way — remaining part of the page's normal flow rather than being lifted out of it — so nothing underneath has to be repositioned to compensate. The decision is written down first, in its own commit, before any of the code.

---

### Verified After The Copy
`POLISH-1-DOCS — six W2 close-outs, Đ-cluster authority, SPEC.1 1.0.28` · 4 August 2026 · week 15

Six records supplied from outside land byte-identical, each checksummed after the copy rather than before — so the check proves what arrived, not what was sent.

---

### Preconditions Written Out
`docs(runbook): deploy-pipeline §2.5 — preconditions, run selection, no-op green` · 4 August 2026 · week 15

The deploy runbook gains a section on what must be true before a run, how to choose which one to make, and what a run that correctly does nothing looks like.

---

### Eight Rulings Approved
`docs(plans): PRIMITIVES-1 — plan, rulings D1–D8, and the §10.8 rider text` · 4 August 2026 · week 15

The plan for the shared primitives, with eight rulings and a piece of specification text, was ratified and merged. The commit itself carries none of it.

---

### One Name For Two Contracts
`PRIMITIVES-1 — Đ digit grouping product-wide, avatar ring token binding` · 5 August 2026 · week 15

Numbers get thousands separators everywhere a person reads one. The rename that comes first is the better part: two functions, two files apart, shared a name and disagreed about their job — one kept full precision for the export, the other rounded for display. Nothing was broken yet. A name that can be imported by mistake is a defect that has not happened.

---

### Staging Moved Up
`chore(logs): PRIMITIVES-1 — session log, execute closed + staging advanced` · 5 August 2026 · week 15

The primitives work is recorded as finished, and the rehearsal environment is advanced so that it runs what was just merged rather than something older.

---

### It Was Never In The Repository
`docs(polish): commit the POLISH document family — canon moves to GitHub` · 5 August 2026 · week 15

Four documents governing this entire phase existed only in the founder's notes and on somebody's disk. The check is blunt: a search of the whole history confirms not one of them had ever been added. They land now, because the next task's build target was one of them and could not be read. A plan nobody can open cannot be executed, and it took a blocked task to notice.

---

### Drive The Real Engine
`docs(plans): STAGING-PARITY — rebuild the staging fixture set by driving the real engine` · 5 August 2026 · week 15

The plan for rebuilding the rehearsal data — not by writing rows into tables, but by driving the actual engine and keeping whatever it produces. Nothing is to be hand-written.

---

### Runners That Are Not Tests
`docs(adr): ADR-0035 guarded staging reset + ADR-0036 vitest-context operational runners` · 5 August 2026 · week 15

Two decisions in one commit. The first permits something otherwise forbidden — suspending the rules that make tables append-only — narrowly, in one place, inside a single transaction, so counterfeit data can be removed. The second names a category the project did not have: files that borrow the test harness but are not tests, point at a live database, and must never run by accident.

---

### Five Guards Before It Runs
`feat(staging): STAGING-PARITY Slice A — the guarded staging reset` · 6 August 2026 · week 16

The reset that clears the rehearsal database refuses to start unless five separate things are true: that somebody meant it, that it points at the right target, that the environment is the expected one, that the connection is live, and that it can check itself afterwards. The commit states plainly that it has not yet been run against anything at all.

---

### Merged Before Running
`chore(staging): log session — STAGING-PARITY Slice A, merged and closed out` · 6 August 2026 · week 16

The reset is recorded as merged and closed, having still never been pointed at the database it was written for.

---

### It Didn't Recognise Itself
`STAGING-PARITY — the no-direct-writes assertion` · 6 August 2026 · week 16

The test database has to be built the way the real one is — by asking the actual product to do the actual work, bet by bet. If the test could write rows directly, every check afterwards would only be confirming that the test agreed with itself.

So there is a guard. It watches every write and asks who is calling. Product code, fine. Test code, refused.

To do that it has to step over its own frames, or it catches itself. It recognised itself by looking for its own name in the path.

Then a new file arrived with a similar name — the guard's own test. The guard stepped over that too, kept walking, landed somewhere it had been told to allow, and let through the exact write it exists to refuse.

It failed silently. Nothing went red. It was caught on the first run of the very test that had broken it.

The note in the fix is the lesson: recognising yourself by name is a guess about what else might be named similarly. The first thing named similarly was itself.

---

### Six Gates And A Rename
`feat(staging): STAGING-PARITY Slices C+D — the full §2 fixture set, all six gates` · 6 August 2026 · week 16

The rest of the rehearsal data, and the six checks deciding whether it is right. One check had been described as reconstructing state from the event history. It does not do that, and the description is corrected rather than the check — what it actually reads is a stored value, because that value is derived nowhere and has to be kept rather than recomputed.

---

### The Description Was Behind
`docs(agents): correct AGENTS.md §9 staging drift + two dockets` · 7 August 2026 · week 16

A standing document described the rehearsal setup as it had been rather than as it now is. Corrected, with two items filed and a close-out drafted rather than finished.

---

### The Ceiling Would Not Reproduce
`docs(pool): close POOL-2 — deploy-churn falsified, PERF-1 opened` · 8 August 2026 · week 16

A connection ceiling had been blamed for instability and a remedy sized against it. So somebody went and tried to hit the ceiling: a hundred and eighty requests, concurrency climbing to thirty, across five different route mixes. Nothing failed. The system sat comfortably above the number the remedy assumed. The hypothesis is recorded as falsified, and a different investigation opens in its place.

---

### A Blocker Named
`docs(staging): D.5 close-out + POOL-1 rulings + PERF-1 go-live blocker` · 8 August 2026 · week 16

Closed, carrying two rulings and one new item marked as blocking launch: the front page taking roughly thirty-five seconds to serve.

---

### Passed At The Gate
`chore(shell): log — HEADER-PORTFOLIO close-out, Gate C PASSED` · 8 August 2026 · week 16

The header's second figure is recorded as finished and passed at its review gate.

---

### It Read As Missing
`docs(sync): SYNC-1 — truth pass, the D.4 V-renumber, and the docket` · 8 August 2026 · week 16

Three separate lists of numbered lessons were all using the same short form, each with its own second entry. A reference to one resolved to nothing — and read as a typo rather than as an ambiguity, which is the worse failure, because nobody investigates a typo. The cause underneath: the list that should have arbitrated lived in a document the repository could not see.

---

### It Ran To The Edge
`POLISH.2 — Discovery parity: 30 deltas built, 20 classified (Gate C)` · 9 August 2026 · week 16

Thirty corrections to the front page, the first of them the plainest: the mockup gives the page an inset and the build had none, so the grid ran flush to the edge of the screen on every load. The commit is careful that this does not reopen a settled ruling — an inset is not a container, and the page still takes none.

---

### Nothing Was Wrong
`PERF-1 — apply the ratified Mumbai region` · 10 August 2026 · week 16

In May it was decided that everything would run in Mumbai. Database, cache, storage, the app. Written down, agreed, closed.

Three of the four went to Mumbai.

The app went to Washington, D.C. — because nobody typed a line saying otherwise, and Washington is where things go when nobody says. For three months every database call crossed twelve thousand kilometres and came back.

| | |
|---|---|
| **Before** | 362 milliseconds per round trip |
| **After** | 5 |

Here's why nothing caught it. The file wasn't wrong. It was *silent*. There's no test for a missing line, no review that flags an absence, no health check that reads back where the thing is actually running and compares it against what was agreed. Every check passed for three months because every check reads what's written, and the problem was what wasn't.

The record puts it better than I can: a silent config file is indistinguishable from a correct one.

---

### Dead Numbers Struck
`PERF-1 close-out — health reports region, dead numbers struck, blocker closed` · 10 August 2026 · week 16

Closed, with the health endpoint now reporting which region it runs in, and the measurements that no longer mean anything struck through rather than deleted.

---

### The Defect Did Not Exist
`docs(runbook,parked): §2.5 is NOT vacuous — record the misread` · 10 August 2026 · week 16

A defect was reported to the founder: a precondition check appeared to be computing against a missing reference and passing anyway. It was not. The command had been handed two arguments where it takes one, and its complaint about that was read as the reference being absent. The correction is recorded at greater length than the original claim, because a wrong diagnosis delivered confidently costs more than the thing it was about.

---

### Everything Remaining In One
`docs(plans): DISCOVERY-COMPLETE — one plan for everything remaining on Discovery` · 10 August 2026 · week 16

One plan for everything still owed on the front page, gathered together rather than left scattered as rows across several documents.

---

### Backwards In Public
`DISCOVERY-COMPLETE — the pole guard` · 10 August 2026 · week 16

Black means YES. White means NO. It's the one thing the visual language says, and it isn't decoration — it's the only way to see which side an argument is on.

On two pages it rendered exactly backwards. YES came out near-white, NO near-black, colour and text both. Two files had each hand-rolled their own side label, both reached for generic components named "default" and "secondary" — and the greys those resolve to sit on the wrong sides.

One of those pages needs no login. Anyone could load it and read every side inverted.

The test that found it was committed deliberately failing, and left failing across two commits. It went green because both faults were fixed — not because either file was added to a list of exceptions. There is no such list.

Then a third way in turned up in the same stretch: a bar with a fixed colour, measuring a quantity whose meaning flips with the side. Its own comment claimed immunity, with the reason precisely backwards.

Four ways to get this wrong were eventually written down. The guard catches two. That's recorded in the guard itself, in capitals, so a green run is never read as an all-clear.

---

### Rows Reach Their End
`docs(polish): POLISH.2 rows to final disposition; carry-forwards homed` · 10 August 2026 · week 16

Thirty rows given their final disposition, the leftovers homed against later work, and the lane itself left deliberately open rather than declared finished.

---

### Verified On The Live Site
`docs(polish,parked): V17 pole fix verified live; broken thumbnails filed` · 10 August 2026 · week 16

A fix confirmed on the running site rather than in a test, two problems filed, and one gap in the rehearsal data recorded against the person able to close it.

---

### A Template For The Rest
`docs(polish): POLISH-0 v1.1, the surface template, and the phase tracker` · 10 August 2026 · week 16

The method document reaches its second version, gaining a per-surface template and a tracker for the phases still to come.

---

### Absorbed Or Not
`chore(polish): log session — POLISH-TEMPLATE close-out + the STRATUM absorption audit` · 11 August 2026 · week 16

Closed, with an audit of which parts of an earlier document were genuinely absorbed into the new one and which had quietly not been.

---

### The Seam Pass Approved
`docs(plans): PRIMITIVES-2 — the shared-primitive pass` · 11 August 2026 · week 16

The plan for the shared-primitive pass was ratified and merged with nothing recorded about what it contains.

---

### The Browser's Own Broken Glyph
`fix(discovery): MarketThumb — one owner of null · error · loaded at all three Discovery image sites` · 11 August 2026 · week 16

An image address that has expired or lost its file produces the browser's own broken-image icon, and none of the three places showing pictures on the front page had any answer for that. Each checked only whether an address existed, never whether it worked. One component now owns all three states — nothing, broken, loaded — at every site, so the answer cannot vary by location.

---

### Nothing Left To Spend
`PRIMITIVES-2 PR-B — the seam pass: SideBadge presets, the emphasis ladder` · 11 August 2026 · week 16

A conditional becomes a lookup, and that is the entire change: no value moves, no number changes, nothing is added. It is isolated into its own commit precisely because it has nothing in it. A proof that the output is unchanged means something only when the change could not have altered the output in the first place.

---

### Exit Criteria Discharged
`docs(polish,parked,plans): PRIMITIVES-2 close-out — exit criteria discharged` · 11 August 2026 · week 16

Closed against the criteria it set itself, the register row shut, and the next surface named in the same breath.

---

### Committed Before Being Read
`POLISH.7a — auth surfaces: the machine phase` · 12 August 2026 · week 16

The auth surfaces rebuilt in one continuous run of eight commits, the first of which is the plan itself — committed verbatim, checksummed against the supplied file, proven identical rather than eyeballed. The reviewers who gate the rest of the run are handed that document and read it out of the repository. If it is not there, they read nothing.

---

### What It Actually Cost
`POLISH.7a — close-out: squash SHA, V-8, the coordinate sweep, and the measured cost` · 12 August 2026 · week 16

Closed with the merge reference, a numbered lesson, a sweep of coordinates that had drifted, and — unusually — the measured cost of having worked this way.

---

### Nobody Can Report Anything
`MOD-REPORT-PATH — user-facing reporting ruled out of scope` · 12 August 2026 · week 16

No button anywhere lets a participant report something. That was never
decided — two separate correct decisions collided and left a gap that read
as an oversight.

This closes it by ruling rather than building, with the conditions that
would reopen it written beside it.

What it admits is the point: a check sees content, not context, so for this
experiment the operator reading the corpus is the only thing watching for
harm that only makes sense in context. That sentence is in the commit, not
inferred from it.

---

### The Document Was A Phantom
`SPEC.CHART / R13 — ruled: C-CHART-1 mints the chart overlay's presentational baseline` · 12 August 2026 · week 16

A ruling had been blocked for weeks on a specification document nobody could locate. The search settles it: the document does not exist and never did. But the conclusion drawn from its absence was wrong too — what it was supposed to contain sat in another document all along, in a section the halted work had already cited without reading.

---

### Applied After The Merge
`docs(polish,canon): SPEC.CHART / R13 — Gate C's two amendments, applied post-merge` · 12 August 2026 · week 16

Two amendments that arrived after their commit had already merged, applied verbatim in a follow-up rather than folded quietly into something later.

---

### Two Of Eight Refused
`POLISH.8 — Admin Centre machine phase (6 shipped / 2 halted)` · 12 August 2026 · week 16

Eight items on the admin surface: six ship, two are halted, and the halts are named rather than carried quietly forward. The plan is committed verbatim first — unnormalised, unrenumbered, not reworded — so what the reviewers read is precisely what was ratified rather than a tidied version of it.

---

### Twenty-Eight Rows Routed
`POLISH.8 close-out — correct §3's row, mint PD-8-01…28, route ten destinations` · 12 August 2026 · week 16

Closed, correcting one row, minting twenty-eight findings and routing ten of them to the documents that will have to answer for them.

---

### Six Ruled Before Building
`POLISH.3 commit 0 — mint PD-3-05…15, rule six, route three (doc-only)` · 13 August 2026 · week 17

A doc-only opening commit: eleven findings minted, six ruled on the spot, three routed elsewhere, and nothing built until that is settled.

---

### A Control Nobody Could Reach
`POLISH.3 PR 1 — FRAME · /m/[slug] · six items` · 13 August 2026 · week 17

The frame of the market page, six items. One is a deletion worth keeping: a betting control in a fallback header that no live path could ever render, because both places mounting the view supply their own. Unreachable code that looks like a feature is worse than none — eventually somebody maintains it, or worse, trusts it.

---

### The Frame Recorded
`chore(polish): log session — POLISH.3 PR 1 FRAME` · 13 August 2026 · week 17

The frame work is recorded as finished, with its findings and the destinations they were routed to.

---

### It Looks Like A Receipt
`POLISH.5/.6 commit 0 — seven commits; X3′ partial` · 14 August 2026 · week 17

The plan is committed to the main line first, before anything else, and the reason is exact. Reviewers are handed a path to that document — and the same run forbids them from reading anything under the plans directory on its own branches. Without this commit they open nothing, find nothing, and approve a plan they never saw. A review that comes back green having read nothing is worse than no review at all, because it looks like a receipt.

---

### The Guard Worked As Designed
`POLISH.5 PR A — COMPLETE (8/8): items 2·3·4·5·6·15·17` · 14 August 2026 · week 17

Eight items on the profile surface, all shipped — and the commit opens with a halt. One item reddened three assertions in a test that scans the source for a pattern, and that test appeared on no list authorising it to change. The run stopped rather than adjusting the guard to suit the change. The guard's own comment says it exists to stop somebody. It did.

---

### Forty-Seven Units Anchored
`DOC-1 · THE AMENDMENT SET — doc-only, before PR B branches` · 15 August 2026 · week 17

A doc-only amendment set applied before the next branch is cut: forty-seven separate edits, each anchored to a quoted string rather than a line number, so that none of them can drift.

---

### Placeholders Become Blocks
`POLISH.5 PR B — items 1·7·8·9·10·11 · Gate C amendment (B8+B9)` · 15 August 2026 · week 17

Six more items across profile and bookmarks. The pattern worth keeping is in the first: generic loading placeholders are replaced by a named shared block, and each keeps the marker the old one carried, so every test that identified them still can. A replacement that breaks its own tests is not a replacement, it is a rewrite.

---

### Composition Only
`HTML-FINISH · DISCOVERY — mockup arrangement parity (rows 1,2,4–10)` · 15 August 2026 · week 17

The front page matched against its mockup, ten rows of it. The first is the largest: the price chart leaves the tile it had been sitting inside, which changes where everything below it starts.

---

### Only The Word Changed
`POLISH.6 · /bookmarks — six items onto the state primitives` · 15 August 2026 · week 17

Six items on the bookmarks surface. The first is a single word — a column heading — and the commit is careful to state what did not change with it. The figure underneath is the same figure, produced by the same function; only the literal text beside it moved. A changed label and a changed number look identical in a screenshot.

---

### Nothing Absent
`POLISH.3 · PR 2 — the debate card surfaces (C0…C13 + Gate C riders)` · 15 August 2026 · week 17

The debate cards, fourteen items and two rulings. The plan lands verbatim first, and the commit stamps its checksum, line count and section count into the message — because a file cannot carry its own checksum, and a plan arriving with one section quietly missing would look exactly like a plan that was whole.

---

### Read The Register First
`docs(claude): mint O-9 — a §-citation edit is a same-commit-rider trigger` · 15 August 2026 · week 17

A new standing rule: editing prose that cites another document by section is editing a claim about that document, and the change has to ride with a correction to it. The unusual part is the paragraph explaining why the author was entitled to mint the rule at all — they went and read the register rather than assuming it worked like its neighbour, and the two turn out not to be symmetrical.

---

### The Value Goes Above
`HTML-FINISH · PROFILE — mockup arrangement parity (15 of 18 rows; 3 blocked)` · 15 August 2026 · week 17

The profile matched to its mockup: fifteen rows, three blocked and named as blocked rather than skipped. One row is a pure swap of two sibling elements, so a number sits above its label instead of below it — and both keep their class strings byte for byte.

---

### The Second Half Refused
`HTML-FINISH · BOOKMARKS — the Profile arrangement replicated (C1–C7)` · 16 August 2026 · week 17

The same arrangement replicated onto bookmarks — and half of one item refused. The commit carries the quote requesting it directly alongside the verdict declining it, so that a reader meets the request and the refusal together instead of finding an item that silently never happened.

---

### Guards Beside Each Item
`POLISH.5 PR C — the chart lane: items 12·13·14·16` · 16 August 2026 · week 17

Four items in the chart lane, each landing with a guard beside it: a rule about filling both poles, a three-armed check where a marker used to carry its side in an attribute, and a count assertion on gridlines. The reviewer's findings are absorbed in the same run — including a claim made in the commit's own text that turned out not to hold.

---

### Chart Lane Ends
`chore(polish): log session — POLISH.5 PR C complete` · 16 August 2026 · week 17

The chart lane is recorded as complete, with its merge reference and nothing else.

---

### Nobody Was Awake To Do It
`fix(db): bound the pool — ⛔ MITIGATION, DO NOT MERGE` · 16 August 2026 · week 17

The database allows fifteen open connections. Hand them back when you're done and it's fine.

Staging kept running out a few minutes after every deploy, then recovering the next time somebody deployed.

The first cause was a good one: the setting that closes an idle connection was off by default, and off means the timer that would close it never starts. Not "fires late" — never runs. So a fix was written. Close after twenty seconds, and force-close after ten minutes regardless.

Then it was measured. A connection sat idle for six hundred and twenty seconds against both.

Because the app doesn't stay awake. Between requests the whole thing is suspended, and a suspended program runs no timers. The twenty-second countdown was sitting inside something frozen. Nobody was awake to hand the connection back.

So the fix stopped being a timer and became a limit on how much any one copy of the app may take — which needs nobody awake to enforce.

The commit says in its own subject line that this is a mitigation and must not be merged. It knows it's a smaller blast radius, not a solution.

---

### Landed Then Amended
`POLISH.4 PR A — THE RECORD + the HTML-FINISH fold` · 17 August 2026 · week 17

A plan written in one session and never committed lands verbatim here, and is then amended inside the same commit with four ratified decisions and a fold of one piece of work into another.

---

### Red Captured First
`feat(composer): POLISH.4 — d5 composer parity (grid · travelling Đ · counters · c2Strip)` · 17 August 2026 · week 17

The composer matched to its mockup. The run takes its one authorised exception deliberately: the failing tests are written and their output captured before any fix exists, so the record shows exactly what was broken rather than only that it is now fixed. Four files failing, nine tests, all written down before the first repair.

---

### The Header Was Blind
`HTML-FINISH · MARKET DETAIL (/m/[slug]) — 35 rows across two rounds` · 17 August 2026 · week 17

The market page has two modes, and everything inside its header swaps between them — the two sets share nothing at all. The build had the header rendering outside that choice entirely, blind to which mode it was in, with the second mode's header stacked underneath the first. Five later rows all needed to land inside that header, and none of them could until this. Which is why the first row is a restructure rather than a nudge.

---

### It Can Only Grow
`PROFILE + BOOKMARKS · dimensional parity R2 — the 52px colhead floor` · 17 August 2026 · week 17

Four panel headings sat ten pixels out of line, because two of them hold controls and two hold only a title. The fix is a minimum height, which can only ever lift the shorter one — a fixed height would have clipped the taller. The measurement was taken again on this branch rather than inherited from the attempt before it, which had been closed unmerged.

---

### Correct Five Times
`PROFILE + BOOKMARKS · FULL HTML-FINISH` · 18 August 2026 · week 17

Something on a page would not fit. It was ruled impossible five separate times.

Every one of those five was measured, and every one was right. Nobody guessed —
each refusal was a real number against a real constraint, and each concluded
correctly that within the question it had been handed there was no answer.

The question had a boundary. It covered how large the text could be and how the
pieces sat beside each other. It did not cover the box holding them.

That box had a border and some padding. Thirty-two pixels, about a sixth of the
whole thing. The design being copied never gave it either — it frames the
contents and not the holder, and reading that as decoration is what cost four
rounds.

Take the frame away and the space appears. It had been there the whole time,
outside the boundary of every question that went looking for it.

Five right answers. One wrong fence.

---
