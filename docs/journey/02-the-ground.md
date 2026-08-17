# Act II — The Ground
*n22–49 · 11 – 24 May 2026*

Two and a half weeks in, and nothing exists.

There's a licence. There's a draft of the specification. There's a file of instructions that has already been rewritten twice, arguing with itself about how carefully to work. There is no database, no pricing, no page.

What there mostly is, is silence. The first three commits carry no message at all — subject lines and nothing else. The fourth manages two lines covering three days. The licence commit, the one deciding how the whole thing will be given away, says nothing whatsoever.

Then the log stops for a week. The specification lands as a draft on the third of May and the next commit is the tenth.

Nobody wrote down what happened in between, which is a thing you will meet a lot in the early part of this. The habit of explaining yourself did not exist yet. It arrives late, and when it does it arrives as a rule, because by then somebody had noticed how much was missing.

Act II is where the abstractions get poured into concrete. And concrete here means specifically: a database built so that once something is written down, nobody — including the people who built it — can take it back.

---

---

### The Plan Came First
`docs(plans): add SCAFFOLD.2 execution plan` · 11 May 2026 · week 3

The database work got a written plan, committed on its own before any of it was built. The plan file is the entire commit, and the message attached to it says nothing at all.

---

### Forty Empty Files
`feat(scaffold-2): a — drizzle + supabase + flow skeletons` · 11 May 2026 · week 3

Eight dependencies, a database client, and forty empty files named for behaviours nobody had written yet. Two of the forty were struck out before they were ever filled in — created already crossed off.

---

### The Rules Explain Nothing
`chore(claude-md): rewrite with plan mode, /clear, per-session logs, handoff ritual` · 11 May 2026 · week 3

Three weeks in, writing code stopped being enough. This commit rewrites the file that says how work happens here: plan before touching anything, wipe the conversation between tasks, write a log at the end of every session, hand off deliberately instead of by accident. The rules are new and nobody knows yet which of them will hold. The commit that set them down carries no message — not one line about why any of it was needed.

---

### Flagged Rather Than Fixed
`chore(scaffold-2): log session — 3.A merged` · 11 May 2026 · week 3

The first session log written under the new rule. It records three places the work drifted from its plan, and one stale line in another document, flagged for a later sweep rather than quietly corrected on the way past.

---

### Before Anything Could Break Them
`feat(scaffold-2): b — drizzle schemas (21 tables, 10 domains, 11 files)` · 11 May 2026 · week 3

Twenty-one tables, and two of the project's promises written in as properties of the columns rather than as code. A bet cannot exist without an argument attached; the column pointing at the argument is not allowed to be empty. A balance cannot go below zero. Both were true before any of the product depending on them existed. One field was left deliberately loose — what kind of thing an event is — so new kinds would not each need a migration.

---

### A Rule You Have To Remember
`chore: replace the soak rule with a pre-PR audit` · 11 May 2026 · week 3

There was a rule. After finishing something, wait a day before merging it. Sleep on it, look again with fresh eyes.

It did not survive its first deadline.

The response was not to write the rule more firmly, or add a reminder, or resolve to try harder. The rule was deleted and replaced with a check that happens at the moment of writing — before there is anything left to be tempted about.

The same week turned up the same problem somewhere else: the reviewers meant to look at database changes weren't being asked to. So they stopped being something you invoke and became something that fires on its own the moment you touch what they cover.

Both fixes have one shape. **A rule you have to remember is not a rule.** It is an intention with good paperwork. The only ones that hold under pressure are the ones that fire without being called.

The two earlier commits that rewrote this same file say nothing at all. No message, no reason. Which is a strange thing to find in the document that exists because somebody eventually decided that was a problem.

---

### Nothing But The File
`chore(scaffold-2): log session — stratum 3.B complete` · 11 May 2026 · week 3

The log for the schema session. Its own message is empty; the file it adds is the whole of the commit.

---

### The Database Says No
`feat(scaffold-2): migrations, 26 triggers, system state` · 12 May 2026 · week 3

The promise was that nothing here gets rewritten. Bets, comments, the ledger — written once, never edited, never deleted.

Until now that was a promise. Code could break it. A stray line, a well-meaning fix, an admin with a good reason.

This moved it below the code. Twenty-six triggers across thirteen tables, installed in the database itself. An attempt to change one of those rows isn't caught by the application and politely refused — it's rejected by the storage, underneath everything the application can reach.

There's a nice detail in the rules. Setting a value to what it already is gets through, because it changes nothing. A *second* attempt to set the same field is refused. Not "don't edit history" — history can happen once.

Also here: six of the decision documents this commit cites by number don't exist yet. One was on disk. The thinking had been done, agreed, and built before anybody wrote it down.

---

### Four Fixed Three Deferred
`docs(logs): SCAFFOLD.2-3C session log` · 12 May 2026 · week 3

A closing log for the migrations session, carrying a catalogue of seven things that had drifted out of true. Four were fixed on the spot. Three were written down and left for later, which is a decision, not an oversight.

---

### Nobody Expected A Failure
`feat(scaffold-2): d — trigger tests (14 files, 51 cases) + INV-4` · 12 May 2026 · week 3

The rules that reject bad writes had gone in the same day, and they worked — which is the exact point at which people stop checking. Fifty-one cases went in anyway. The commit is blunt that they were written after the thing they test, backwards by this project's own standard, and declares it as an exception rather than dressing it up. They match on the error's code rather than its wording, so a later rewrite of a message cannot quietly turn a test green.

---

### Overwritten And Unfindable
`chore(scaffold-2): e — close-out + log` · 12 May 2026 · week 3

The database foundation closes, five parts across five reviews. The same commit rescues an earlier session log that a later rewrite had overwritten, leaving it technically present and impossible to find by looking.

---

### Whoever Trips Over It
`chore(precursor-5): doc + tooling sweep` · 14 May 2026 · week 4

Seven small edits across documents and tooling, no code touched. One of them writes down a rule for everything after: mess gets cleaned up by whoever trips over it, inside the same piece of work.

---

### Deliberately The Wrong Colours
`feat(scaffold-1): Tailwind v4 + shadcn/ui + Turbopack plumbing` · 14 May 2026 · week 4

The interface needed somewhere to stand before anyone had decided what it should look like. So the styling layer went in with its colours filled by placeholders — values chosen to be replaced, with a later job carrying the debt of replacing them. It is an odd thing to ship on purpose: every colour in the product knowingly wrong, held that way so that deciding and building could happen at once instead of one waiting on the other.

---

### Three Hours Of A Day
`chore(scaffold-1): log session — SCAFFOLD.1 close` · 14 May 2026 · week 4

Three hours against a day's estimate. The log records ten decisions and five questions left open, including one earlier claim retracted outright rather than quietly amended.

---

### Twice The Intended Length
`feat(scaffold-14): auth vendor env wiring (9 keys)` · 14 May 2026 · week 4

Nine keys for five outside services. Two of the secrets arrived split across two lines and were pasted back together at double the intended length, which the commit notes is more randomness than was asked for, not less.

---

### The Mistake Was Kept
`chore(scaffold-14): log session — SCAFFOLD.14 close` · 15 May 2026 · week 4

The log for the keys. It leaves an inaccurate description sitting in an earlier commit exactly as written, on the reasoning that a preserved mistake teaches more than a silent correction does.

---

### Two Ways To Break
`feat(scaffold-4): Upstash Redis substrate (rate-limit middleware + idempotency cache)` · 15 May 2026 · week 4

Two guards landed together with opposite instructions for what to do when they fail. If the thing counting requests goes down, requests are let through — someone hammering the site is a smaller problem than everybody being locked out of it. If the thing that stops one click being counted twice goes down, everything stops instead. One failure is irritating. The other takes money from someone twice, and there was no version of that worth risking.

---

### The Name Stays Taken
`feat(scaffold-3): auth wiring — 6 flows + session-deferral hook` · 16 May 2026 · week 4

Signing in, six ways, plus a separate door for the administrator that shares nothing with the one everyone else uses. The interesting part is a hole they found and kept: assigning someone their name happens in a different unit of work from creating their account, so a signup that fails halfway leaves the person gone and the name still spoken for. No fix. A sweep collects abandoned names after thirty days, and the gap goes in the record rather than being smoothed over.

---

### The Database Falls Asleep
`chore(tracker): v8 → v9 sweep — SCAFFOLD.3 close + 13 MAINT rows` · 16 May 2026 · week 4

A planning sweep and thirteen maintenance items. One job jumps the queue for an entirely unglamorous reason: the free database tier switches itself off after a week without use.

---

### The Error Was The Proof
`feat(scaffold-13-a): Vercel DATABASE_URL wired to Supabase Pro` · 17 May 2026 · week 4

The subject says the database got connected. The repository did not do that — someone connected it by hand through a web dashboard, out of order, and the commit says so plainly: the state is right and the procedure broke. It also records a defect that was reported, withdrawn, then resolved from an unlikely direction. An error complaining about the wrong data format turned out to be proof the connection worked, because something has to be reachable before it can complain.

---

### Nine Hundred Lines Of Plan
`chore(scaffold-13-b): promote plan` · 18 May 2026 · week 4

A plan for replacing every credential and keeping them in one place. It grows to nine hundred lines across four rounds of amendment before a single step of it is carried out.

---

### Do Not Trust The Default
`plan(scaffold-13-b): amend15 — B5c clean-slate + B0 yield cascades` · 18 May 2026 · week 4

A fifth round of amendments to the same plan. A reviewer found the recovery step quietly relying on a checkbox being ticked already; the plan now says to tick it yourself and check that you did.

---

### The Claim Was Checked
`chore(scaffold-13-b): execute close-out + maintenance.md routing extension` · 20 May 2026 · week 4

The credential work closes. A reviewer caught the log claiming a file was locked down tighter than it actually was, so the permissions were tightened for real — and the claim was verified rather than believed.

---

### Its Own Address
`chore(scaffold-12): zugzwangworld.com domain cutover` · 21 May 2026 · week 5

The project gets its own address. The same commit rewrites a note in the code promising something this task would never do, and commits the reviewer's verdict in full rather than a summary nobody can check.

---

### The Bug Behind The Bug
`fix(scaffold-3-followup-1): Better Auth 415 + captcha coverage` · 23 May 2026 · week 5

Sign-in was sending one format and the server only accepted another, so it refused every attempt. That fix is small. What it uncovered is not: behind the refusal sat a crash firing on every attempt to email someone a code, invisible the entire time because the first failure stopped anything from ever reaching it. Removing the outer problem is what made the inner one visible. Two bugs, and only one of them could ever have been found first.

---

### Two More Things
`docs(scaffold-3-followup-1): execute-phase close-out log` · 23 May 2026 · week 5

The close-out for the sign-in fix. Trying it by hand afterwards turned up two things the work had not: a typo in one secret, and a table that was completely empty when it should not have been.

---

### A Brake On The Cleaner
`feat(scaffold-15): R2 storage substrate + signed-URL endpoint + orphan-sweep` · 24 May 2026 · week 5

Letting someone upload a picture means handing out a temporary permission to write one file. People take that permission and never use it, so a scheduled job goes looking for the files that were promised and never arrived. The job has a brake on it: five failures in a row and it stops itself. If everything is broken, a cleaner running in a loop is not help — it is a second problem, with a bill attached.

---

### Nine Things Checked Off
`docs(scaffold-15): operator-substrate clearance + execute review close-out` · 24 May 2026 · week 5

The last log of the act. Nine prerequisites confirmed outside the repository, three surprises absorbed on the spot instead of deferred, and the order of the next three jobs settled before any of them began.

---
