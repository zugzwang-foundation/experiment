# Act IV — The Argument
*n135–195 · 16 June – 2 July 2026*

The machine works.

You can put money on a side and the price moves. The price moves because you took something out of a pool, not because anybody voted. Markets close, resolve, and pay. The ledger balances, and there is only one door into it — a single write path that takes a stake, so there is no way to leave a sentence in this system without one attached.

All of which describes a market. None of which describes what this project is for.

A market that only takes bets is a casino with extra steps. The claim being tested here is that informed argument beats concentrated money — and there is currently nowhere to argue.

Act IV builds that. The debate surface, the reply model, and the thing that decides what you see first.

That last one matters more than it sounds. Ordering is not presentation. Whatever gets sorted to the top is what most people read, which means the sort function is where the ideology either survives contact with a database query or quietly dies in one.

It also builds the parts nobody enjoys: what happens when someone posts something that must never be published, and how any of this reaches the internet at all.

---

---

### Approved And Blank
`plan(DEBATE.2): INV-1 atomicity + reply-as-bet write path (DEBATE.1+.2)` · 16 June 2026 · week 8

The plan for making an argument and its stake inseparable was reviewed and merged. The commit carries no account of what was decided in getting there.

---

### Both Or Neither
`feat(debate): reply-as-bet write path + INV-1 atomicity (DEBATE.1+.2)` · 17 June 2026 · week 8

An argument with no money behind it is not allowed here, and neither is money with no argument. This makes that true in the only way that survives a crash halfway through: both records are written inside one piece of work that either completes entirely or leaves nothing at all behind. An empty argument is refused by name rather than by a generic complaint, so the person is told what is actually wrong.

---

### Claiming It Twice
`fix(comments): image-attach terminal_state guard + place() CAS assertion (DEBATE.2)` · 17 June 2026 · week 8

An adversarial review found a picture could be attached that had already been spoken for — used by an earlier argument, or already finished with for some other reason. Two guards close it. The lookup now refuses anything that has reached an end state, and the attachment is claimed in a way that fails outright if somebody else claimed it first. The failure looks identical to every other bad request, deliberately.

---

### The Wrong Tree Merged
`docs(logs): DEBATE.1+.2 execute-session close-out` · 17 June 2026 · week 8

The record of that pair. Its most useful part is a lesson about a merge that landed the wrong content because a commit had never been pushed, and the check added to prove a merge matches what was reviewed.

---

### Nothing To Build
`chore(debate): DEBATE.3 — INV-3 side-freeze ratified (comments Bucket-A)` · 17 June 2026 · week 8

The task was to stop an argument moving to the other side after it was posted. The survey found it already impossible — the table refuses every update, and the side is written at the moment of posting. So nothing was built. A narrower rule guarding only that one column was refused, for weakening the wider rule that already held. What landed is a single test asserting the impossibility, so that if it ever stops being true, something says so.

---

### Voice, Not Balance
`docs: decoupled removal, then reactive moderation` · 18 June 2026 · week 9

Somebody breaks the rules badly enough to be thrown out. What happens to the money they staked?

Nothing. A ban takes away your ability to speak. It does not touch your position, your balance, or a single bet you placed. Being wrong about the rules and being wrong about the market are different offences, and only one of them is on trial.

The machinery for delivering that lasted one day.

First: a review queue. Flagged things wait, a person decides — approve, discard, block. Written down, agreed, ratified.

The next commit, the same day, superseded it. No queue. The check says yes or no in the moment, and anything that slips through is dealt with after it is live, in the open, where you can see that it happened.

Both records are still there. The one that survived a day sits beside the one that replaced it, neither erased.

The principle held. The mechanism didn't. That is nearly always which way round it goes.

---

### Voice, Not Balance
`docs: decoupled removal, then reactive moderation` · 18 June 2026 · week 9

Somebody breaks the rules badly enough to be thrown out. What happens to the money they staked?

Nothing. A ban takes away your ability to speak. It does not touch your position, your balance, or a single bet you placed. Being wrong about the rules and being wrong about the market are different offences, and only one of them is on trial.

The machinery for delivering that lasted one day.

First: a review queue. Flagged things wait, a person decides — approve, discard, block. Written down, agreed, ratified.

The next commit, the same day, superseded it. No queue. The check says yes or no in the moment, and anything that slips through is dealt with after it is live, in the open, where you can see that it happened.

Both records are still there. The one that survived a day sits beside the one that replaced it, neither erased.

The principle held. The mechanism didn't. That is nearly always which way round it goes.

---

### What Isn't Built Yet
`feat(moderation): wire the reactive-moderation gate` · 19 June 2026 · week 9

Anything a participant writes or attaches is checked before it is published. Not held in a queue for someone to look at later — checked first, and if it fails, it never becomes visible at all. There is no window in which it is live.

The most serious category does not wait for a person. The account closes automatically, in the same moment, on the same path.

A ban here removes the ability to post. It does not touch their balance or their positions. That separation holds everywhere in the system: moderation removes voice, never money.

The rest of this entry is about a placeholder.

Where the code should report the most serious material onward to the authorities, there is no report. There is a marker, a note, and an internal alert that reaches nobody outside the project. The commit says so in its own message, names what is absent, and records it as owed.

That was the honest state of it on this date. It is written here rather than left to be inferred, for the same reason it was written there — a gap that is recorded can be closed, and a gap that reads as finished cannot.

---

### The Guard Ate The Request
`fix(auth): email-OTP send no longer short-circuited by Turnstile before-hook` · 20 June 2026 · week 9

A check meant to keep robots out was quietly swallowing the thing it was supposed to be guarding. Sign-in codes were never sent, because the guard returned nothing where it should have returned permission to continue. One line. The fix is smaller than the test written to prove it, which drives the real endpoint rather than a stand-in — a stand-in is what let this through in the first place.

---

### Eleven Behind
`feat(ops): prod migrate path (per-migration-tx) + schema-drift guard + staging runbook` · 20 June 2026 · week 9

Production had quietly fallen eleven database changes behind, because the only tool for applying them pointed somewhere else and the deploy never ran them. Applying them all at once then failed: one of the changes cannot share a transaction with the ones after it. So they are applied one at a time, each committing before the next begins, behind a guard that refuses to run unless it is pointed at the right database.

---

### Silently Dropped
`fix(auth): declare user.additionalFields so signup persists pseudonym/pfp/googleId` · 20 June 2026 · week 9

Signing up failed for everybody, and the cause was a library doing exactly what it had been told. It writes only the fields it has been given a description of. The extra ones being attached on the way in had never been declared, so they were discarded before the insert, and the database then refused a row missing values it required. Nothing was broken. Something had simply never been mentioned.

---

### Longer Than Allowed
`fix(auth): cap session expiresIn at 400 days (cookie Max-Age limit)` · 20 June 2026 · week 9

Sessions were set to last a hundred years, which sounds generous and is in fact a crash. The value is handed straight to the cookie, and both the library writing it and every modern browser reject anything past four hundred days. Nobody hit it while signing up, because a new person takes a different path. It fired only for people coming back — the worst possible group to break for.

---

### Indefinite Becomes Four Hundred Days
`docs: DEBATE.7 smoke close-out + session doc sweep` · 21 June 2026 · week 9

Paperwork catching up with that cap: four places describing a session as indefinite are corrected to say what it actually is. No new decision — the word had simply stopped being true.

---

### Showing That Someone Left
`feat(debate-view): DEBATE.5 — three-state Flipped/Exited marker read-loader` · 22 June 2026 · week 9

Reading a debate now shows what became of the people in it — whether the author of an argument later changed sides, or sold out of the market entirely and walked away from what they wrote. The state is worked out at the moment of reading, from what actually happened, rather than stamped onto the argument when it was posted. It stays true afterwards without anything having to go back and update it.

---

### Marked Done
`chore(debate): session log — DEBATE.5` · 22 June 2026 · week 9

That work is recorded as finished. The recording is the entire contents of the commit — there is nothing else inside it.

---

### Gathered Into One Document
`docs(ranking): DEBATE.8 — author RANKING.md + reconcile SPEC.1/SPEC.2/ADR-0017` · 23 June 2026 · week 9

The ordering model, which until now lived across a decision record and two specifications, is written out as a document of its own. Nothing about it changes; it stops being something a reader must assemble from three places.

---

### The Ranking Remembers Nothing
`feat(ranking): read-time ranking model` · 23 June 2026 · week 9

Ranking used to keep a note. When you posted, it wrote down how much you'd staked at that moment and held on to the number.

That column was deleted.

Now nothing about ordering is stored anywhere. Every time someone opens a debate, the order is worked out fresh from the ledger — who staked what, on which side — and thrown away again.

A saved number is a number that can quietly stop matching reality, and a number somebody could write to. A number that exists only for the length of a page load can't drift and can't be edited, because between one reader and the next it isn't there at all.

The order you see isn't a record of what the ranking decided. It's the ledger, sorted, right now.

---

### Nothing Beside It
`chore(debate): session log — DEBATE.8` · 23 June 2026 · week 9

The account of that day is empty. The document landed, and the commit says only that it did.

---

### Still On Disk
`chore(debate): DEBATE.9 — drop orphaned friendly_fire_events schema (migration 0018)` · 24 June 2026 · week 9

A feature had been declared gone for weeks. The specification said so; everything written since had moved on. The table was still sitting there. This is the code catching up with the paperwork — table dropped, its type dropped, its tests deleted. The care is in what was left alone: a shared function that twelve other tables depend on was explicitly kept, and the drop was written without cascade after checking nothing else leaned on it.

---

### Filed Without Detail
`chore(debate): session log — DEBATE.9` · 24 June 2026 · week 9

The removal is marked complete. Nothing about how it went is written anywhere in the commit.

---

### Drafts Stay Invisible
`docs(plan): SHELL/UI.0 — participant shell bootstrap + DESIGN.7 token mint plan` · 24 June 2026 · week 9

The plan for the first thing the public will see: a shell, one market page, and a lookup that refuses to return a market still in draft. Nobody outside can reach a question that has not been opened yet.

---

### Delete The Brand
`feat(ui): participant shell + the token mint` · 24 June 2026 · week 9

Every market you have ever looked at was green for up and red for down. You know which way things are going before you have read a word. That is the entire point of it.

For a while this one had green and red too — placeholders, sitting there waiting.

They were replaced with black and white. And black does not mean good. It means YES. White means NO. The colour tells you which side a bet is on, not whether anybody approves of it.

Then, in the same change, the brand colour was deleted. Not muted, not softened. Removed from the file, along with the note that had been sitting above it telling everyone not to use it yet.

There is no colour in this product. Black, white, grey. And there is a test that fails the build if anyone adds one.

Colour reaches you before the argument does. That is the thing this place was built to stop.

---

### A Heading Stops Being True
`docs(debate): DEBATE.9 close-out — §D framing fixes + session-log close-out` · 24 June 2026 · week 9

Two wording fixes, both about a heading outliving its meaning. A section named for things the specification had not caught up with no longer held any, so it was renamed to describe what it actually contains now.

---

### One Place To Withhold
`docs(plan): DEBATE.4 — participant debate view (read-only render) plan` · 24 June 2026 · week 9

The plan for the readable view of a debate, with one structural rule: withholding removed content happens in exactly one place, and the thread stays intact around the gap rather than the conversation losing its shape.

---

### The Gap Keeps Its Shape
`feat(debate-view): DEBATE.4 — participant debate view (read-only render)` · 25 June 2026 · week 10

The first page a visitor can actually read. The safety-critical part is not what it shows but what it cannot: a removed argument becomes a different kind of thing entirely, one carrying no body, no title, no picture and no author, so there is nothing for a later page to render by accident. The reply that answered it still sits where it always sat, pointing at a space.

---

### Superseded In Part
`ADR-0024 — deploy pipeline + migration sequencing (+ SPEC.2 §22 catch-up, D1 plan)` · 25 June 2026 · week 10

A decision about how things reach production, and an unusual way of replacing the one before it. Rather than retiring the earlier decision, two specific lines are lifted out and replaced and the rest is inherited untouched — the old record stays accepted, annotated with exactly what no longer applies. Nothing is rewritten. The reader is told which sentences stopped being true.

---

### It Could Not Tell You
`fix(health): D1 #2/#3 — per-hash migration drift on /api/health + prepare:false` · 25 June 2026 · week 10

The check for whether the database matched the code compared a single marker: the most recent change applied. Two databases can agree on that and disagree about everything else, because a change in the middle can be skipped without moving it. The check now compares the whole set by content. It exists because the tool that applies those changes reports success in precisely that situation.

---

### Corrections To A Decision
`docs(adr): ADR-0024 errata + D1.md §3 addendum — D1 close` · 26 June 2026 · week 10

Corrections to a decision written the day before, plus an addition to its plan. What was wrong the first time is legible only from the names of the files it touches.

---

### Advice Becomes A Wall
`feat(ci): D2 — CI required-check gate + journal/drift checks + env-parity audit` · 26 June 2026 · week 10

Until now the automated checks had opinions. This makes them binding: nothing merges until they pass. Two new ones join them — one comparing the recorded database changes against the code, one comparing settings across environments. A fourth is deliberately switched off at birth, wired but inert, so the thing that will eventually deploy on its own exists before it is allowed to act.

---

### Two Checks We Cannot Run
`fix(ci): D2 env-audit descope — drop sync-health (c)+(d); two config-scoped Doppler tokens` · 26 June 2026 · week 10

Two of the environment checks needed an account tier the project does not pay for. Rather than leave them failing, or quietly pretend they were passing, they were removed and recorded as deferred, and the broad credential they used was replaced by two narrower ones scoped to a single environment each. What remains still fails closed. The gap is a line in a document instead of a check that never really ran.

---

### No Wildcards Allowed
`fix(ci): D2 env-audit — exempt 3 Sentry↔Vercel integration keys` · 26 June 2026 · week 10

Three settings that legitimately have no source are exempted from the audit — listed by their exact names rather than by a pattern, so nothing arriving later can be excused automatically by a wildcard nobody revisits.

---

### The Last One That Serves
`docs(deploy): D3 — staging-as-replica pipeline (plan + deploy-pipeline runbook)` · 26 June 2026 · week 10

The plan for making the second environment a rehearsal of production, and the runbook beside it. The commit names itself as it lands: the last change that will reach the public automatically, with that path switched off directly afterwards.

---

### Proof The Switch Did Nothing
`chore(deploy): log session — D3 staging-as-replica un-shadowing EXECUTED` · 26 June 2026 · week 10

The gate passed. The record carries before-and-after evidence that turning off automatic serving stranded nothing — the live site kept answering, still running the same version it had been running beforehand.

---

### A Stub Becomes A Section
`docs(deploy): fold web-authored prod-promote section into deploy-pipeline runbook` · 27 June 2026 · week 10

A placeholder in the runbook is replaced by the real procedure, written elsewhere and pasted in unchanged. One line at the bottom is corrected because it still described the section as a placeholder.

---

### Failing A Healthy Thing
`chore(deploy): fix stale bare-SHA canary assertions in smoke-staging + sibling drifts` · 27 June 2026 · week 10

A verification script kept reporting the second environment as broken. It was not. The script was checking for a version string in a format the system had stopped producing a week earlier, when the source of that string changed underneath it. It now checks for a full-length identifier and can be told to demand an exact match. The tooling had gone stale, not the thing it was pointed at.

---

### One Item Left Open
`chore(deploy): log session — D3 OD-1 stale-canary chore MERGED` · 27 June 2026 · week 10

The record of that repair, with a table proving the check now fires when it should and passes when it should. One unrelated finding is marked open rather than quietly resolved, and handed to a later review.

---

### Empty Before It Fills
`docs(plan): D5 ratified — prod-DB drift remediation + verify-before-serve gate` · 27 June 2026 · week 10

The plan for bringing the production database up to date and exercising the promotion gate once, for real. It runs behind a condition that the database is still empty — the safest moment to apply twelve accumulated changes.

---

### A Banner Flipped
`docs(deploy): activate prod-promote runbook §3 banner (D6)` · 28 June 2026 · week 10

A marker in the runbook is switched from draft to active. What made it ready on that day rather than another is not recorded.

---

### It Went Live
`chore(deploy): log session — D5 prod migrate + first gated promote (#176 → prod)` · 28 June 2026 · week 10

The first promotion to production ran, by hand, through the gate built for it. This is the commit recording the project reaching the public — and nobody wrote a word about how it went.

---

### Everything That Went Stale
`docs: reconcile pipeline-workflow + CC model contract (Fable→Opus) after D1–D6` · 28 June 2026 · week 10

A sweep of everything the deploy work left out of date: a ceiling number, a migration head, one flag spelled wrong in five places, a superseded document given its banner, and the name of the model doing the work.

---

### Wider And Smaller At Once
`docs(spec): debate .md export (ADR-0025) + §21.6 descope` · 29 June 2026 · week 10

A decision to let anyone take a debate away as a file, not only the operator. In the same breath it gets smaller: pictures are dropped, and what was going to be an archive becomes a single text file. Shipped alongside is a small context document, pinned to a version, meant to travel with the export so whatever reads it later knows what it is looking at.

---

### Take The Argument With You
`feat(debate-export): GET /m/[slug]/export — debate .md export (EXPORT.1)` · 30 June 2026 · week 10

The export becomes real: one address, one file, everything a debate held in the order it happened. It inherits its withholding rules from the page it mirrors instead of implementing them again, which is the only reason it is safe. Removed content cannot reappear in a download built from the same masked model the page itself reads.

---

### Built And Unremarked
`chore(export): log session — EXPORT.1 debate .md export build` · 30 June 2026 · week 10

The export was built, and the commit noting its completion notes nothing else about it.

---

### Pictures Chosen In Advance
`docs: ADR-0026 market media + SPEC.1/SPEC.2 riders` · 30 June 2026 · week 10

A decision about pictures on a market. The administrator sets a small pool of them when the market is created, exactly one is the default, and a participant attaching an image to an argument picks from that pool rather than bringing their own. A video may be linked but never hosted. The set is fixed before anybody arrives.

---

### A Missing Row Backfilled
`docs: ADR-0026 close-out + CLAUDE/AGENTS ADR-ceiling -> 0026` · 30 June 2026 · week 10

Housekeeping after that decision: two range references move up, and a row for an earlier decision is added to the list of decisions, having been missed at the time it landed.

---

### The Plan Rewritten Mid-Task
`feat(markets): MEDIA.1 — admin market-media creation (ADR-0026/0027)` · 30 June 2026 · week 10

The picture pool gets built. What is notable is what happened during the building: a decision written days earlier was superseded partway through, and the plan was rewritten to match rather than the work quietly diverging from its own record. Three of the six commits here are the plan changing shape. The finished thing matches the document describing it, which is not the usual outcome.

---

### Absorbed Into The Canon
`docs: MEDIA.1 footprint into canon (market_id_conflict, admin-media rate-limit surface)` · 1 July 2026 · week 10

What the picture work implied for the standing documents is folded into them. Which corrections were made is legible only from the subject line; the commit itself carries nothing.

---

### A Ceiling Ticks Up
`chore: MEDIA.1 close-out + ADR ceiling → 0027` · 1 July 2026 · week 10

The picture work closes and a ceiling number moves up by one. Nothing else is recorded about it.

---

### Description Meets Reality
`docs: BC.1 — reconcile descriptive docs to main` · 1 July 2026 · week 10

The descriptive documents are brought back into line with what the repository actually contains. What had drifted apart is not enumerated anywhere in the commit.

---

### Finished And Undescribed
`chore(docs): log session — BC.1 close-out (PR #187 squash 3979ccb)` · 1 July 2026 · week 10

The reconciliation of the descriptive documents is marked finished. Nothing records what was reconciled, what was found, or whether anything surprised the person doing it.

---

### A Route That Never Existed
`docs: BC.2 — reconcile prescriptive specs + drift ledger` · 1 July 2026 · week 10

The prescriptive documents get the same treatment, and one correction stands out: an address the specification described had never actually been built. It was removed from the document rather than added to the code.

---

### One Sentence Off The List
`docs: BC.2.1 — finish §22 ADR-index range (0001, 0003–0027)` · 1 July 2026 · week 10

A single sentence missed by the sweep before it, because that sweep worked from a list of places to edit and this sentence was not on the list. Corrected without a version bump, since nothing about the meaning changed.

---

### Deleting What Never Ran
`refactor(rate-limit): remove vestigial write-budget/write-burst limiters (BC.3)` · 2 July 2026 · week 11

Two rate limiters are removed for the offence of never having been used. The specification had already declared them gone; the code still carried them, referenced by nothing except a test that existed to test them. Both are excised. The notable part is that deleting code which provably did nothing took a plan, a review and a blast-radius check first.

---

### Excised And Silent
`chore(docs): log session — BC.3 close-out (PR #191 squash b6e1aea)` · 2 July 2026 · week 11

The removal is marked complete in a commit containing nothing beyond the fact of the marking.

---

### The Task Was Not Needed
`chore(docs): log session — BC.4 close-out (no-op-with-writeup; premise not held)` · 2 July 2026 · week 11

A task closed having done nothing, because the thing it existed to fix turned out not to be true. The write-up explaining that lives elsewhere; this commit records only that it happened.

---

### Frozen So Nothing Reformats Them
`docs(design): DC.3 — commit design canon, token contract, design-language v0.5` · 2 July 2026 · week 11

The design documents and fifteen frozen stills are committed, with one line excluding them from the formatter. They are records of what was approved rather than code, and reformatting them would quietly alter the thing being preserved.

---

### Reviewed After Merging
`chore(docs): log session — DC.3 close-out (PR #195 squash 5b28c49)` · 2 July 2026 · week 11

The record of that, including a mid-task halt when the accessibility checker objected to the frozen stills, and an honest note that this one was merged before it was reviewed rather than after.

---
