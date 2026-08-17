# Act III — The Engine
*n50–134 · 25 May – 16 June 2026*

The ground is laid, and it's unusually stubborn ground.

The rule that nothing gets rewritten now lives below the code, in the database itself — twenty-six triggers across thirteen tables, refusing edits that the application never even gets the chance to attempt. Fifty thousand names sit in a pile waiting to be dealt out, each with its little picture already made. Storage works, sign-in works.

Then the log goes quiet for five days at the end of May. When it comes back, the first thing it does is write down seventeen decisions that had already been made — a single commit backfilling the record for choices the code had been living with for weeks.

That is the shape of this whole project in one commit. The thinking happens, the building happens, and then somebody goes back and makes the reasoning survivable. Sometimes weeks later. Sometimes, as you have seen, never.

There is also a rule quietly installed back in Act II that explains a lot of what follows: mess gets cleaned up by whoever trips over it, inside the same piece of work. It is why so many commits from here on carry an unrelated fix riding along in the subject line.

Act III is the money. Prices, bets, the ledger, what happens when a market ends. The largest stretch of work in the entire history, and the one where every number becomes load-bearing — because after this, being wrong about arithmetic means being wrong about what somebody owns.

---

---

### Seven Places Doing It Themselves
`feat(engine-6): events helper + per-event-type Zod schemas + 6-site emission migration` · 25 May 2026 · week 5

Recording what happened had been done by hand in seven places, each carrying a note promising to come back and do it properly. This is coming back. One helper now writes every event: it checks what it is given against a shape defined for that kind of event, takes the timestamp out of the identifier instead of the clock, and ignores a repeat of something already written. The seven notes were cashed in the commit that made them unnecessary.

---

### You Don't Pick Your Name
`feat(scaffold-17): identity pool seed + low-water alarm` · 25 May 2026 · week 5

Fifty thousand names were generated before anybody signed up. A colour, an animal, a number — CrimsonHeron314 — with the little picture that goes with it already made and sitting in storage, waiting.

You don't choose one. You're dealt the next off the top.

That's a deliberate refusal of something every other platform hands you. A username you pick is a thing you've *said* — a joke, a claim, a brand, a hint. Here your name carries no information, because it wasn't a decision. Whatever standing you have has to come from the argument underneath it.

Names are never reissued. When one is scrubbed it doesn't return to the pile, and there's a test whose only job is catching anyone who puts one back.

And something in the database counts the pile every five minutes and raises an alarm below five percent. Fifty thousand is a lot of names. Somebody still built the thing that notices them running out.

---

### Two Rows For The Operator
`chore: SCAFFOLD.17 post-merge log + tracker entries` · 25 May 2026 · week 5

A short record of a merge that had already happened before the work began. Two maintenance items are written out in full so the operator can paste them into a tracker that lives outside the repository entirely.

---

### Eleven Surfaces With Owners
`feat(scaffold-16): LD-3 text/image Track A carve-out + F-γ-thin §15 F-ADMIN-4 extension` · 26 May 2026 · week 5

A scope decision: six things in, eleven left out. Each of the eleven is written against the name of whoever will own it later, alongside a further list of twelve ruled out entirely.

---

### Two Vendors Watching
`feat(scaffold-finish-bundle-1): observability stack (SCAFFOLD.5 + .6 + .7)` · 26 May 2026 · week 5

The project gains the ability to see itself — error reporting and product analytics, both wired in and pinned to exact versions. One of those pins sits above a floor forced by the bundler rather than chosen.

---

### The Checks Nobody Added
`feat(ci): expand CI with Postgres service + migration apply (SCAFFOLD.18)` · 27 May 2026 · week 5

Every change now runs through install, formatting, types and tests before it can merge. The commit also names what was deliberately left out — browser testing, secret scanning, a security scanner — each deferred rather than forgotten.

---

### Fourteen Hundred Lines First
`docs(scaffold-8): land brief + plan + plan-mode review log` · 27 May 2026 · week 5

Before the second environment is built, it is described: a brief in eight sections and a document running to fourteen hundred lines, both agreed on a single day.

---

### Four Attempts At Green
`chore(logs): SCAFFOLD.18 execute review session log` · 27 May 2026 · week 5

Four rounds before the checks passed. The database image chosen for them had to be abandoned for a plain one, with the statements it could not run stripped out of a migration on the way through.

---

### The Step That Gates Itself
`feat(scaffold-8): staging environment` · 28 May 2026 · week 6

A second environment, and a script written to stand in front of its own setup. Mixing settings entered by hand with settings a service manages for you breaks both in ways that are hard to see afterwards, so the script goes hunting for hand-entered ones and exits failing if it finds any. The step it guards cannot run until somebody has dealt with what it found.

---

### Let The Money In
`docs(adr): backfill ADRs 0003-0019 and ADR template` · 2 June 2026 · week 6

We had to decide what shows up at the top of a debate.

The easy fix was obvious: don't let big bets count toward ranking. Then nobody can buy the top spot. One line of code, problem gone.

We didn't do it.

The whole project is a bet that good arguments beat big money in a fair fight. Quietly stacking the deck would mean we don't actually believe that.

So there are three ways to reach the top, and money is one of them:

| Reach the top by | |
|---|---|
| **Volume** | the most people replying |
| **Money** | the most Dharma staked |
| **Heat** | a fight still too close to call |

Win any one of these clearly and you're up there. So yes — someone rich can take the money route. But every bet here comes with a written argument attached. They land at the top in public, reasoning exposed, sitting right next to the post that beat them on numbers alone.

The decision was made on the thirty-first of May and written down on the second of June — in a commit that also wrote down sixteen other decisions nobody had got round to recording.

Money can top the page. It just can't do it quietly.

---

### Nine Records Arrive Late
`docs(logs): backfill SYNC-arc session logs + gitignore recon scratch` · 2 June 2026 · week 6

Nine accounts of earlier work, written at the time and committed now, filed under names that mirror where they belong. Scratch material from the same effort is excluded so the formatter stops tripping over it.

---

### Nothing Critical Found
`chore(review): cold repo review + comments.betId index` · 2 June 2026 · week 6

An outside read of the whole repository: nothing critical, nothing high, twenty-one smaller findings recorded. The only code change is a single index, added because the review noticed it was missing.

---

### Whose Name Goes On It
`docs(sync): SYNC.10 — canonical spec/meta/log bundle` · 3 June 2026 · week 6

A bundle of documents brought to one agreed state, and a rule written down while the bundle was open: commits here carry a single author and no second name. The rule outlives the sweep that produced it.

---

### Both Drafts Turn One
`docs(spec): promote SPEC.1 + SPEC.2 to v1.0 (PRECURSOR.4 lock)` · 3 June 2026 · week 6

Two specifications leave draft together. On the way through, a field is renamed in three places, twenty-three scattered error references are aligned to one catalogue, and the eventual public dataset is given a licence.

---

### Locked Without Comment
`docs(log): PRECURSOR.4 spec-lock-review close-out` · 3 June 2026 · week 6

The review that froze both specifications at their first full version finished here. What it examined, and what it let through, appears nowhere in the commit.

---

### Zero Deletions
`docs(adr): friendly-fire removal reconciliation` · 3 June 2026 · week 6

There used to be a way to agree with someone for free. A small thumbs-up on a post, costing nothing, feeding into how posts got ranked.

It was killed — because a free signal is one anybody can manufacture in bulk, and the whole premise here is that opinions cost something.

Here's the odd part. The document describing the old design was not edited. Not one character. The commit that removed the feature **added thirty-five lines and deleted zero** — a block on top saying which parts below are now wrong, everything below left exactly as written.

The rule for the product is that you never rewrite what already happened. Somewhere along the way the project started applying it to itself.

---

### Phases Added And Removed
`docs(spec): tracker sweep — SPEC.2 §23/§0 + SPEC.1 status reconciled to v11` · 3 June 2026 · week 6

Editorial reconciliation of the phase table: two added, two moved out to a later record, one renamed, one renumbered. No architecture was reopened — the map is corrected, not the territory.

---

### Copied Back Into The Repository
`chore(spec): log session — tracker-sweep-v11 §23/§0 reconciliation closed` · 3 June 2026 · week 6

The sweep's own paperwork, including a copy of a document that had been living outside the repository. One orphaned row was fixed while the file was open.

---

### Four Documents Before Any Design
`docs(design): add VISUAL backbone — language, workflow, handoff, planner` · 3 June 2026 · week 6

Four documents about how design will happen: a shared language, a manual for producing surfaces, a contract for handing one over, and a running order. None contains a design. That is derived later, from work that does not exist yet.

---

### Naming Everything That Can Happen
`feat(events): ENGINE.0 — event-type vocabulary expansion (+10 schemas, numericString)` · 3 June 2026 · week 6

Eleven new kinds of thing the system can record, each with a shape it must match. The kickoff supplied names for them and the names were wrong — not badly wrong, just not the ones the specification already used — so they were corrected to match rather than the specification being widened to accept them. Numbers travel as text throughout, with one validator at the boundary checking they are numbers.

---

### Folded In Without A Word
`docs(design): bump design backbone to v0.2 — fold in CD high-fidelity research` · 4 June 2026 · week 7

The design documents move up a version to absorb outside research. What the research said, and what changed because of it, is not recorded.

---

### Credit Where It Was Taken
`docs(specs): ENGINE.1 — cpmm.md v1.0.0 + third-party notices` · 4 June 2026 · week 7

The pricing document reaches its first full version, and notices for the outside work it draws on land beside it. Which work, and what was owed for it, the commit does not say.

---

### Closed The Same Day
`chore(spec): log session — ENGINE.1 session B (cpmm.md landing) closed` · 4 June 2026 · week 7

The pricing document's work is marked finished. Nothing else about it was written down — not what was decided, not what was left over.

---

### Pinned To One Version
`docs(plans): ENGINE.2 — CPMM module implementation plan (founder-ratified)` · 4 June 2026 · week 7

The plan for the pricing module: four files, tests before code, and one dependency pinned to an exact version rather than a range — a rounding change in a later release would be invisible and would matter.

---

### Ratified And Merged
`chore(engine): log session — ENGINE.2 plan ratified + merged` · 4 June 2026 · week 7

The plan was approved and merged. Whatever was said in approving it left no trace in the commit that records it happening.

---

### The Price Of Yes Is How Much No
`feat(cpmm): the pure pricing module` · 4 June 2026 · week 7

The price of YES doesn't measure how much anyone wants YES. It measures how much NO is left.

Two pools. Buy YES and you take some out, so what remains gets scarcer and dearer. Price is scarcity, and scarcity is a subtraction. There is no opinion anywhere in the arithmetic.

Two details worth having.

Every fraction rounds **against** you. Shares you receive, money you're paid — floored, always down. The difference is a fraction of a trillionth and it stays in the pool. Round in the user's favour enough times and the pool owes more than it holds. This direction can't do that.

And the maths library is pinned to one exact build, with no room to move. Not "10.6 or later" — 10.6.0, that one. Because a routine upgrade could quietly change how a square root rounds, and every price in the system would shift underneath markets nobody touched.

It's the engine's first outside dependency. It gets no latitude at all.

---

### Appended, Never Overwritten
`chore(engine): log session — ENGINE.2 execute merged` · 4 June 2026 · week 7

The account of building the pricing module is added underneath the account of planning it. The earlier entry is left untouched; the file grows downward and never rewrites itself.

---

### Every Claim Gets A Test
`docs(plans): ENGINE.3 — CPMM property-suite plan (founder-ratified)` · 5 June 2026 · week 7

The plan for testing the pricing maths maps each claim the document makes onto a named test, one for one. Nothing is tested that was not claimed, and nothing claimed is left untested.

---

### Ten Questions And Twelve Fixes
`chore(engine): log session — ENGINE.3 plan ratified + merged` · 5 June 2026 · week 7

The record of getting that approved: ten questions answered, twelve amendments applied, and the exact starting point for the next person written at the bottom.

---

### Tests That Write Themselves
`test(cpmm): ENGINE.3 — CPMM property suite (fast-check)` · 5 June 2026 · week 7

Until now the maths had been checked against five worked examples, which proves five things. This adds tests that invent their own inputs — thousands of them, across sizes from tiny to enormous — and assert the relationships hold whatever goes in. A review caught the generators clustering in the comfortable middle, so they were stratified to force the extremes to show up. Examples prove a case. These prove a claim.

---

### Green And Gone
`chore(engine): log session — ENGINE.3 execute merged` · 5 June 2026 · week 7

The generated tests passed and the work closed. The commit marking that says nothing further.

---

### A State Nothing Yet Writes
`plan: ENGINE.4 — market state machine (reviewed)` · 5 June 2026 · week 7

The plan for the seven conditions a market can be in. One is real and has no writer — the frozen state exists in the model from the start, with nothing yet able to put a market into it.

---

### Scope Arrested Twice
`chore(engine): log session — ENGINE.4 plan merged` · 5 June 2026 · week 7

The record of approving that, including two separate moments where the work was caught expanding past what had been agreed and was stopped where it stood.

---

### Eight Legal Moves
`feat(markets): ENGINE.4 — market state machine` · 6 June 2026 · week 7

A market can be in one of seven conditions, and there are exactly eight moves between them. Everything else is refused. The module deciding this touches nothing — no clock, no database, no network — so it can be tested exhaustively and cannot behave differently on a Tuesday. Every write that changes a market's condition has to ask it first. The whole set of legal moves fits on one screen, which is the point of it.

---

### Three Findings Left Alone
`chore(engine): log session — ENGINE.4 execute merged` · 7 June 2026 · week 7

The building account filed under the planning one. A reviewer raised four things: three were ruled no-action with reasons attached, and the fourth was kept with both sides of the argument written out.

---

### A Sign That Cannot Flip
`plan: ENGINE.5 — Dharma append-only ledger (reviewed)` · 7 June 2026 · week 7

The plan for the ledger, amended once before merging to add a guard: one kind of entry may only ever be negative, and a positive one is rejected as a mistake rather than stored as a fact.

---

### Rulings Carried Forward
`chore(engine): log session — ENGINE.5 plan merged` · 7 June 2026 · week 7

The approval record for the ledger: three founder rulings, nine amendments, four resolved questions, and six things noted to be dealt with later by somebody else.

---

### Only Ever Gains Rows
`feat(dharma): ENGINE.5 — Dharma append-only ledger` · 7 June 2026 · week 7

The record of who has what, built so that it can only grow. Nothing in it is updated and nothing is deleted; a correction is a new line pointing at the old one. There is a single function that turns a number into its written form, so the same amount cannot be spelled two ways and quietly fail to match itself. A separate check adds the whole thing up and asks whether it still balances.

---

### Kept For A Later Task
`chore(engine): log session — ENGINE.5 execute merged` · 7 June 2026 · week 7

The building account. Reviewers found nothing to block it and two boundary concerns worth keeping, which were recorded against a later task rather than fixed in passing.

---

### Delegated To The Builder
`plan: ENGINE.11 — Position layer logic (reviewed)` · 8 June 2026 · week 7

The plan for tracking what each person holds. Two decisions were handed deliberately to whoever implemented it rather than settled in advance, with the argument written out both ways for each.

---

### One Finding Holds It Up
`chore(engine): log session — ENGINE.11 plan merged` · 8 June 2026 · week 7

The approval record, including two trial runs — one abandoned because the local database was down, the other turning up the load-bearing detail about what the automated checks have to strip out before they can run at all.

---

### Two Ways Of Counting
`feat(positions): ENGINE.11 — position layer (compute · persist · read · drift cron)` · 8 June 2026 · week 7

What someone holds is worked out from what they did, rather than kept as a running total that could quietly go wrong. To catch it going wrong anyway, a nightly job recomputes every holding two separate ways — one of them from an entirely different source — and compares the answers. Review caught two blockers before it shipped, one of them a piece of error handling that could never actually be reached.

---

### An Empty File Committed
`chore(engine): log session — ENGINE.11 execute merged` · 8 June 2026 · week 7

The building account. A late review caught two serious problems: a configuration file that had been committed completely empty, and dead error handling. Both were fixed before the merge.

---

### One Door
`plan(engine-7): the single write path` · 9 June 2026 · week 7

The rule was always that you can't say anything here without putting something behind it.

A rule can be broken. This week made it impossible to break instead.

There were going to be two ways into the database — one for placing a bet, one for leaving a comment without one. The second was retired. Everything written now goes through a single entrance, and that entrance takes a stake.

So there's no longer a rule saying you must stake to speak. There's just no way to type a sentence into this system that isn't attached to one. The nearest thing to a loophole was closed by removing the corridor it would have run down.

Killed quietly in the same block: the last trace of that free thumbs-up, still holding a slot in the order things get locked. Five became four.

---

### Nothing About The Approval
`chore(engine): log session — ENGINE.7 plan merged` · 9 June 2026 · week 7

The plan for the guarded write path was approved and merged. The commit recording that fact records nothing else about it.

---

### Decide Who You Are First
`feat(bets): ENGINE.7 — W-1 bet-transaction wrapper (transaction.ts + errors.ts)` · 9 June 2026 · week 7

When two people write at the same instant, one of them loses and has to try again. Trying again here means the whole piece of work runs from the top — so anything decided partway through gets decided a second time, differently. The rule that fixes it is about when identity is settled: the identifier for a write is generated before the first attempt and carried unchanged into every retry. Get that wrong and a retry stops being a retry and becomes a separate thing that also happened.

---

### Where The Error Code Hides
`chore(engine): log session — ENGINE.7 execute merged` · 9 June 2026 · week 7

The building account. Among its decisions: the library wraps the database's own error inside another one, so the check for which failure occurred has to look underneath before it looks at the surface.

---

### Reviewed And Silent
`plan(engine-8): bet-flow handlers + §3.1 stack — reviewed plan` · 9 June 2026 · week 7

The plan for the two things a person can actually do here was reviewed and merged, and nothing about that review survives in the commit.

---

### A Step Without An Account
`chore(engine): log session — ENGINE.8 plan reviewed` · 9 June 2026 · week 7

The review of the plan for placing and selling is marked as having happened. What the reviewer looked at, and what they said about it, is not written down here or anywhere the commit points to.

---

### Two Things You Can Do
`feat(bets): ENGINE.8 — F-BET bet-flow handlers (place/sell + §3.1 stack)` · 10 June 2026 · week 7

Everything above this exists so a person can do one of two things: put money on a side, or take it back off again. Here they become real. Both run through the same guarded path, both check the floor below which a stake is not worth recording at all, and both fail in a shape the front end can rely on rather than whatever the underlying failure happened to look like.

---

### Shipped Without A Note
`chore(engine): log session — ENGINE.8 execute merged` · 10 June 2026 · week 7

The two actions merged and the work closed. The commit saying so contains nothing beyond the fact that it happened.

---

### A Different Hand
`chore: move CC harness to Claude Fable 5 (model pins, effort policy, contract docs)` · 10 June 2026 · week 7

The thing writing the code changes. Not the people and not the process — the model itself, named in four files so a session cannot quietly start on something else. The same commit sets how hard it should think by default, and retires an environment variable able to override that from outside, on the grounds that a setting which outranks the written one is a setting nobody can see.

---

### Nothing On The Allowance
`docs(plan): ENGINE.12 daily-credit accrual — founder-ratified plan` · 10 June 2026 · week 7

The plan for the daily allowance was ratified and committed. Why it takes the shape it does is not in this commit.

---

### A Marker With No Content
`docs(log): ENGINE.12 plan-session log` · 10 June 2026 · week 7

The approval of the daily-allowance plan is marked as done. The commit is a marker that a step occurred and nothing more — what was approved, and on what grounds, is not in it.

---

### It Waits Until You Arrive
`feat(dharma): ENGINE.12 — Daily Credit lazy accrual (place() tx + I-DAILY-ONCE-001)` · 10 June 2026 · week 7

A daily allowance that is not handed out daily. Nothing runs at midnight. Instead, the next time you do anything, the system works out how many days you were owed and credits them then. It costs nothing while you are away and cannot drift out of step with a clock. The test that matters is the one where two of your actions arrive in the same instant, and exactly one credit exists afterwards.

---

### Five Surprises In Order
`chore(engine): log session — ENGINE.12 execute merged` · 10 June 2026 · week 7

The building account, carrying a numbered trail of five things that surprised the work as it went, each with what was decided about it at the time it appeared.

---

### Checked Against The Code
`chore(sweep): reconciliation 2026-06 — SPEC.2 §19.4.1 riders + doc truth-up` · 10 June 2026 · week 7

A documentation sweep that changed no behaviour and corrected itself twice while running: two claims about what a record contains were checked against the actual code and found to name the wrong fields.

---

### Where Disk Wins
`chore(sweep): log session — reconciliation sweep 2026-06 merged` · 10 June 2026 · week 7

The account of that sweep. Where the documents and the repository disagreed, the rule applied was that the repository is right, and seven disagreements were settled that way.

---

### Once Per Person Forever
`ENGINE.13 plan — initial grant at first ToS acceptance (docs-only)` · 11 June 2026 · week 8

The plan for the one-time grant everyone receives on accepting the terms. It is to be paid inside the same piece of work that records the acceptance, so the two cannot come apart, and never paid a second time.

---

### Six Checks Before Drafting
`ENGINE.13 plan — session log (docs-only)` · 11 June 2026 · week 8

The approval record: six checks that the ground had not moved, then a survey, then rulings, then a draft. The order is the substance — nothing was written until the state of the world had been confirmed.

---

### The Index Is The Promise
`feat(dharma): ENGINE.13 — initial grant at first ToS acceptance (F-AUTH-4 tx)` · 11 June 2026 · week 8

Everyone starts with the same amount, granted once, at the moment they accept the terms. The interesting part is that the code is not trusted to keep that promise. A rule in the database permits exactly one such grant per person, for all time, so a bug that tried to pay twice would fail loudly instead of succeeding quietly. Code carries the intent; the database carries the fact.

---

### Two Old Problems Named
`chore(engine): log session — ENGINE.13 execute merged` · 11 June 2026 · week 8

The building account. Two low-severity problems predating this work were found, and rather than being absorbed silently they were written down with an owner each and left exactly where they were.

---

### Three Endings Planned
`ENGINE.9 plan — resolution trio + F-ADMIN-3 trigger (docs-only)` · 11 June 2026 · week 8

The plan for how a market finishes: paid out, corrected, or called off. It carries the arithmetic that has to balance in each case, and a rule that a market may terminate exactly once.

---

### A Defect Found In Review
`ENGINE.9 plan — session log (docs-only)` · 11 June 2026 · week 8

The approval record for the endings: two rounds of review, one defect found and fixed between them, and a claim made in the first round retracted after being checked in the second.

---

### Admitting It Got It Wrong
`ENGINE.9 — resolution trio (settle/correct/void) + F-ADMIN-3 trigger, W-3 wrapper` · 12 June 2026 · week 8

Three ways a market can end: pay out, take it back and pay out differently, or call the whole thing off and refund. The middle one is unusual to build at all. It exists so a wrong result can be undone in public — as new entries reversing the old ones, never by editing what was already published. Everything paid out is proportional, and the total is checked against what came in.

---

### A Slip Of Prose Recorded
`ENGINE.9 execute — session log (docs-only)` · 12 June 2026 · week 8

The building account for the endings. It includes a note of a wording slip in the session's own writing, kept on the record rather than corrected away.

---

### Byte-For-Byte Untouched
`ENGINE.14 plan — market lifecycle writes (docs-only)` · 12 June 2026 · week 8

The plan for creating, opening and closing markets, with an unusual condition attached: three existing files are to be left byte-for-byte unchanged, and that is a requirement of the plan rather than an aspiration in it.

---

### Halted Mid-Intake
`ENGINE.14 plan — session log (docs-only)` · 12 June 2026 · week 8

The approval record, which notes that the work stopped partway through taking the task in and resumed afterwards — the halt written down rather than smoothed out of the account.

---

### Nobody Opens It By Accident
`feat(engine-14): market lifecycle writes — W-4 wrapper + create/open/close + sweep` · 13 June 2026 · week 8

Markets get created, opened and closed by somebody, and this settles who. Every one of those writes passes a guard demanding a named administrator, because the alternative is a system where a market can open with no answer to the question of who opened it. The same work fixes when identifiers are generated: once, at the entrance, before anything begins — the rule the guarded write path already lived by.

---

### Deviations On The Record
`chore(logs): log session — ENGINE.14 execute complete` · 13 June 2026 · week 8

The building account, with a register of every place the work departed from its plan and who approved each departure. Two lessons close it, both about checking a claim before relying on it.

---

### Riders Held Back
`ENGINE.15 plan — HTTP/cron/admin wiring (docs-only)` · 13 June 2026 · week 8

The plan for wiring the outside surfaces, deliberately code-free. The document changes it implies are held back to land with the work itself rather than arriving ahead of it.

---

### Thirteen Anchors Checked
`ENGINE.15 plan — session log (docs-only)` · 13 June 2026 · week 8

The approval record. Thirteen claims the plan rests on were each checked against the repository before it was ratified, and all thirteen held up.

---

### Found Open In Review
`feat(engine-15): HTTP/cron/admin wiring — admin actions + pages + close-due cron` · 13 June 2026 · week 8

The administrative surface gets built: the pages, the actions behind them, and a scheduled job closing markets when their time runs out. The part worth keeping is the last commit in the sequence, where a review found the pages listing markets could be read without an administrator's session at all. It was fixed inside the same piece of work that introduced it.

---

### Nothing From That One
`chore(engine-15): execute session log` · 13 June 2026 · week 8

The account of building the administrative surface, including the hole found in it, is blank.

---

### Renumbering A Tally
`docs(engine-15): fix deviation-tally numbering in execute log` · 14 June 2026 · week 8

A correction to the numbering of a list inside the previous account. What was miscounted, and by how much, the commit does not say.

---

### Three Forks Ruled One Way
`docs(engine-16): plan — conclusion-freeze read-guard (participant-only gate + cron)` · 14 June 2026 · week 8

The plan for the ending: three choices, all decided the same way. Only participants are stopped, the switch is a flag in the database rather than a clock, and nothing writes that flag automatically.

---

### Two Fixes Before Passing
`chore(engine-16): plan session log (docs-only)` · 14 June 2026 · week 8

The approval record for the freeze. Two corrections were required before it passed, one of them changing what a scheduled job should answer once the freeze is on.

---

### What Stays On Afterwards
`feat(engine-16): conclusion-freeze read-guard — isFrozen() + bet 410 + cron 200` · 15 June 2026 · week 8

The experiment has an end date, and this is the code enforcing it. Afterwards, an attempt to bet is refused with the answer reserved for something that used to exist and is deliberately gone. Everything else keeps working — reading, signing in, the administrative side. The scheduled job still runs and still reports success, because the alternative is an alarm going off every hour for a month after the thing has properly ended.

---

### No Word On The Ending
`chore(engine-16): execute session log (docs-only)` · 15 June 2026 · week 8

The freeze was built, and the account of building it holds nothing — not the choices, not the checks, not how long any of it took.

---

### Collisions On Purpose
`docs(engine-10): plan — correctness-at-scale exit gate + SPEC.2 §3 rider` · 15 June 2026 · week 8

The plan for the final check on the engine: drive the real thing into deliberate collisions at scale, then reconcile everything afterwards. It is the exit condition for the whole stretch of work.

---

### Folded In At The Gate
`chore(engine-10): plan session log (docs-only)` · 15 June 2026 · week 8

The approval record for that: a survey, three scope rulings, a draft, and three amendments folded in at the gate before it was allowed through.

---

### Nothing Was Created Or Destroyed
`feat(engine-10): correctness-at-scale exit-gate harness (tests/scale)` · 15 June 2026 · week 8

The last thing built before the engine could be called finished. It runs the real code rather than an imitation of it, and forces many people onto a handful of markets in the same instant on purpose. Afterwards it adds everything up two independent ways and checks the two agree. What it proves is a negative — that under deliberate collision, no money appeared and none went missing.

---

### Residual Zero
`chore(engine-10): execute session log + build-gate report (docs-only)` · 15 June 2026 · week 8

Two accounts: what happened, and the gate report behind it. The reconciliation came out at exactly zero difference, which is the number that had to appear before the stretch could be called done.

---

### Everything Gathered In One Place
`docs(logs): add consolidated ENGINE-phase record` · 16 June 2026 · week 8

A single consolidated account of the entire engine stretch is added to the repository. The commit adding it describes neither what it contains nor why it was wanted.

---

### What The Next Part Inherits
`docs(logs): add forward-contract section to ENGINE record` · 16 June 2026 · week 8

A section is added to that account, setting out what the work after it is required to honour. What it requires is not stated here.

---
