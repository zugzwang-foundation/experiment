# Act VI — The Face
*n227–285 · 16 July – 3 August 2026*

Everything to this point is machinery.

There is a working prediction market with an argument attached to every bet, and there is essentially nothing to look at. What exists is a placeholder shell, some scaffolding, and a very large quantity of correct behaviour behind a page nobody would want to open.

Act VI is the interface, and the ideology got there first. The colour came out back in June — brand colour deleted outright, palette down to black, white and grey, with a test that fails the build if anyone adds one back. What Act VI does is spend six weeks making every surface obey it.

Applying a refusal turns out to be more work than making one.

There is also a fortnight in the middle of this act where the project changes who is doing the work — twice — and the record of it is stranger than the change. That comes back at the end.

Then a week's silence in late July, and the face is finished in early August.

---

---

### The Lane Is Ordered
`docs(plans): UI.0 — ratified UI lane plan + Fable-5 window pin` · 16 July 2026 · week 13

A running order for the interface work: eight slots, each with the ritual it must follow, and a gate partway through. Two branches proven to contain nothing are deleted in the same commit.

---

### A Census Corrected
`chore(docs): log session — UI.0 close-out (PR #228 squash c588d17)` · 16 July 2026 · week 13

Closing the lane plan. The branch count that had been relayed was wrong, so it was measured instead: a hundred and seventeen local branches, not the eighty-four reported.

---

### Two Counts Pulled Apart
`chore(docs): UI-0 log — separate PK-card vs branch census; name the deferred-6 referent` · 16 July 2026 · week 13

Two things that had been counted as one are separated, and a deferred item finally gets a name. Which item, and what it defers, the commit does not say.

---

### The Foundation Approved
`docs(plans): UI.A1 — foundation plan (A1)` · 17 July 2026 · week 13

The plan for the interface foundation was approved and merged. Nothing about what it decided is in the commit.

---

### Every Button The Same Button
`feat(ui): UI.A1 — foundation: branded global header + shell polish + DEBATE.4 rebrand pass` · 17 July 2026 · week 13

Six button variants collapse into one system: a recessed resting state, one hover, one pressed, one focus ring, and a quiet variant for the things that should not shout. Cards and dialogs get the same treatment. It is the moment the interface stops being a set of library defaults and starts being one deliberate thing.

---

### Signed Off With A Surprise
`chore(docs): log session — UI.A1 close-out (PR #232 squash 096f9aa)` · 17 July 2026 · week 13

Closed, carrying a surprise about a component boundary nobody had noticed, six follow-ups owed, and a note that the window on the borrowed model was still open at merge.

---

### Never On The Way Out
`docs(plans): UI.A2 — composer substrate plan (A2)` · 17 July 2026 · week 13

The plan for a maximum stake. The cap applies to buying and adding only — selling is never clamped, because stopping someone leaving a position is a different thing from stopping them entering one.

---

### A Ceiling On The Way In
`feat(ui): UI.A2 — composer substrate (backend)` · 17 July 2026 · week 13

The machinery the composers sit on: a cap on how much can go into a bet, the reads that tell you what one would win, the viewer's own position and balance, and a link that opens a debate at a particular post. The commit explains none of it. Four mechanisms named in a subject line, and nothing underneath.

---

### Substrate Marked Done
`chore(docs): log session — UI.A2 execute + close-out (PR #235 squash 67101e7)` · 17 July 2026 · week 13

The substrate is recorded as finished. The commit says nothing else about it.

---

### Composers Approved
`docs(plans): UI.A3 — composers UI plan (A3)` · 17 July 2026 · week 13

The plan for the composers was approved and merged, and no part of the approval is written down.

---

### Where People Actually Type
`feat(ui): UI.A3 — Composers UI: Đ BET composer · reply composer · strip + sell · image attach` · 17 July 2026 · week 13

The place a person puts money on a side and says why. Pure logic first, each piece tested alone: how two fields become one message, how a repeated submission is recognised as the same one, when an amount is out of bounds. The surfaces come after. That order means the thinking can be proven correct before anything is drawn.

---

### Composers Signed Off
`chore(docs): log session — UI.A3 execute + close-out (PR #238 squash a01d328)` · 17 July 2026 · week 13

Closed, with the merged reference recorded so a later reader finds the squashed form rather than the branch it came from.

---

### Now It Can Be Tested
`chore(tests): OQ-7c tests-harness — RTL+jsdom render backfill, moderation surfaces` · 17 July 2026 · week 13

Two development dependencies and five files, and with them the ability to test an interface at all. Before this, nothing could assert what a component actually rendered. The suites go back over surfaces already shipped: every error state producing its exact wording, a hostile input appearing only where it was typed, a form preserving what somebody wrote when their submission failed.

---

### Exactly One Affordance
`chore(ui): suspended-modal X-close strip — enforce W2.11/CD-A single-OK anatomy` · 18 July 2026 · week 13

The dialog telling someone their account is suspended had two ways out: a button, and the small X every dialog gets for free. The ruled anatomy allows one, so the X goes. Nothing is lost — it did exactly what the button did — and the test now asserts that one control exists in total, rather than merely that the button does.

---

### Title And The Rest
`docs(specs): SPEC.1 §22 Discovery amendment + SPEC.2 R-2 route repoint` · 18 July 2026 · week 13

The front page needs to know what a market looks like from outside, and this settles it. An argument's text is a title plus an optional body, and the short version shown elsewhere is derived from that when read rather than stored a second time. The grid holds eight. One stored thing, two renderings — the same shape the whole document is built on.

---

### Seven Questions Folded
`docs(plans): UI-A4 Discovery plan v2 — RATIFIED (OQ-1..7 folded)` · 18 July 2026 · week 13

The plan for the front page, ratified with seven open questions answered and folded in. Execution waits on a separate chore landing first.

---

### The Front Door Opens
`feat(discovery): UI.A4 — Discovery front page at / (SPEC.1 §22, slices 1-6)` · 18 July 2026 · week 13

Until now there was no front page — you needed a link to a specific market to see anything. This builds it: the eight newest open questions, newest first, each card carrying its current price, how much is staked on it and how many people have argued. It ships uncached on purpose, with the faster version named as a follow-up rather than attempted here.

---

### Nobody Wrote It Down
`chore: re-pin subagents (post-Fable window)` · 19 July 2026 · week 13

In June the project brought in a different model to do the work. Three weeks later it lost access to it and went back.

In July it tried again — and this time wrote down the date it would stop, before starting. Not "we'll see how it goes." An expiry, agreed up front, logged as an obligation somebody would later have to discharge.

| | |
|---|---|
| **16 July** | window opens, three days |
| **17 July** | the log still says three days |
| **18 July** | closed |

Nothing anywhere says why.

Not the commit. Not the contract file, the maintenance log, the rulings ledger, or the session log written that same day. Five records note it ended early. None says what ended it.

An explanation was sitting one file away — a sentence about the June outage that would have fitted beautifully. The write-up on the day marked it as June's and left it there, rather than refresh it into a claim about July.

The reason was available. It just wasn't the right one.

---

### A Row Flipped
`docs(plans): UI-LANE §2 — flip A4 row done (PR #244 · 3b2d07d)` · 19 July 2026 · week 13

One row in the lane plan is marked done, with the merge reference beside it. The commit adds nothing else.

---

### Three Rows Backfilled
`docs(plans): UI-LANE §2 — back-flip A1-A3 rows done` · 19 July 2026 · week 13

Three earlier rows are marked done, having been finished but never recorded. The commit carries their references and no account of the lapse.

---

### What A Person Is Worth
`docs(spec): SPEC.1 1.0.18 — Profile surface (§23), net-worth basis (§10.8)` · 19 July 2026 · week 13

The profile surface is specified: what one person's page shows, and how the figure at the top of it is defined. Net worth turns out to need a definition at all — what you hold, valued how, counted from when. The amendment settles every part of that, and the commit explains none of it.

---

### Amendment Landed
`chore(spec): log session — SPEC-PROFILE amendment landed` · 19 July 2026 · week 13

The profile amendment is recorded as landed. That is the whole of the commit.

---

### Profile Approved
`plan: UI-A5 — Profile (ratified)` · 20 July 2026 · week 13

The plan for the profile page was ratified and merged with nothing written about why it takes the shape it does.

---

### Everything You Ever Did
`feat(profile): UI-A5 — Profile surface (/u/[pseudonym]) — §23 read-time vertical` · 20 July 2026 · week 13

A person's whole history on one page. The hard part is the arithmetic of an episode: you open a position, sell part of it, sell the rest, come back weeks later and open another. Each is a separate episode with its own basis, and a partial sell takes its share proportionally. The rules for ordering them are fixed exactly, so two readers always see the same sequence.

---

### Saving Somebody Else's
`docs(adr): ADR-0032 — bookmarks (A6 gate: storage + write + read spec)` · 20 July 2026 · week 13

A decision about bookmarks: where one is stored, how it is written, and what a reader gets back. The gate it passes is named in the subject, and nothing of the reasoning survives in the commit.

---

### Bookmarks Approved
`plan: UI-A6 — Bookmarks (ratified)` · 21 July 2026 · week 13

The plan for bookmarks was ratified and merged. Nothing about its content is recorded here.

---

### Only Other People's
`feat(bookmarks): UI-A6 — Bookmarks vertical — §23 cross-author read + migration 0024` · 21 July 2026 · week 13

Bookmarks, in five slices. You may save somebody else's argument and not your own — a deliberate rule rather than an oversight. Saving the same thing twice does nothing instead of failing. The read that assembles the page has to cross authors, which is the part that needed thirteen batched queries and a read model of its own.

---

### Skin Only
`chore(plans): UI-A7 — auth skin (ratified)` · 21 July 2026 · week 13

The plan for the sign-in surfaces, with its condition stated up front: no edits to authentication logic. The promise is zero logic changed, deliberately not zero files touched.

---

### Borrowed No Longer
`feat(auth): UI-A7 — auth skin (Option A: W2.1 card on the branded ground)` · 21 July 2026 · week 13

The three surfaces where a person signs in stop looking like a component library and start looking like the product. Presentation only; the flows underneath are untouched. The constraint is worth keeping for how it was phrased — not that few files would change, but that no authentication logic would, which is the version you can actually check.

---

### It Always Says It Worked
`fix(auth): AUTH-OTP-DELIVERY — reject sandbox OTP sender + surface failed sends` · 22 July 2026 · week 13

Sign-in codes could fail to send while the system reported success — not a bug in the code but a property of the library, which swallows the sender's error and answers with success regardless. Since a truthful answer to the person waiting is impossible, the guard moves earlier: the application now refuses to start at all if it is configured with a test-only sending address. What cannot be reported is prevented instead.

---

### Down To Two Tabs
`docs(spec): SPEC.1 1.0.19 — Admin Control Centre (§15 two tabs)` · 22 July 2026 · week 13

The admin surface is specified downward rather than up. A hub homepage is removed and what remains is two tabs. Two flows are marked as belonging to before launch and taken out of the centre entirely, their pages left working but unstyled. The live counter and the countdown move to the tab where somebody would actually be looking for them.

---

### The Centre Planned
`chore(plans): UI-6 — Admin Control Centre (§15 two-tab) build plan` · 22 July 2026 · week 13

The plan for the admin centre, written against the amendment that had just finished reducing it.

---

### Four Corrections Folded
`chore(plans): UI-6 — fold web-ratified corrections A1-A4 into the plan` · 22 July 2026 · week 13

Four ratified corrections folded into that plan before anything is built, one of them overruling an earlier answer about where an audit search has to look.

---

### A Contract Folded In
`chore(plans): UI-6 — fold S3-contract ruling R1–R5 into the plan` · 22 July 2026 · week 13

Five more rulings folded into the same plan, this time about a contract the surface has to honour. It is amended three times before a line of it exists.

---

### The Redirect Comes First
`feat(admin): UI-6 — Admin Control Centre (§15 two-tab: Moderation + Markets)` · 23 July 2026 · week 14

The admin centre gets built, and one structural choice runs through it: the tab bar is rendered by each page rather than by a shared layout. A shared layout would wrap the login page too, and send anyone trying to sign in around a loop forever. Visiting the root sends you to moderation — but only after the gate, never before it.

---

### The Second Door
`fix(admin): mask a removed parent in the review-feed snippet path` · 23 July 2026 · week 13

Content removed by a moderator is not supposed to be readable by anyone
afterwards.

The main query that fetches it knew that. A second lookup in the same file —
the one pulling the parent an argument is replying to — did not. So a live
reply could show you the body of the removed thing it was answering. Found on
staging by a check somebody had left running, not by anyone reading the code.

The obvious repair is to add the missing condition to the second query. That
was refused.

Instead the shape changed. A removed parent now arrives as an object with
nowhere to put a body — not an empty field, no field. Nothing downstream can
render it because there is nothing there to render, and forgetting to check
stops being a thing that can happen.

One line in the commit is the whole idea: withholding is a property of every
read of a body, not a property of rows.

And the test asserts the body is absent, not that the row is. Those two had
looked like the same assertion right up until they weren't.

---

### Counting Who Came
`feat(shell): UI-13 — visitor counter (SPEC.1 §21.1)` · 23 July 2026 · week 14

A number in the header for how many people have visited. Robots are filtered out and one address cannot inflate it more than sixty times a minute. The count lives under a key named for its environment, so the rehearsal site cannot quietly contaminate the real figure — the sort of care that is invisible unless somebody forgets it.

---

### A Chart Gets Specified
`docs(spec): SPEC.1 1.0.22 — §9 market-detail price chart + F-DEBATE-5` · 23 July 2026 · week 14

The market page is to carry a price chart. The specification names it, names the flow it belongs to, and stops. Why a chart, what question it answers for the person reading, and what was considered instead are all absent from the commit that decides it.

---

### Two Slices Planned
`chore(plans): UI.19 — market-detail price chart build plan (F-DEBATE-5)` · 23 July 2026 · week 14

The plan for the chart, split in two: the collapsed line first, the marks on top of it second.

---

### Moved To The Top Level
`docs(plan): UI.19 — reconcile model placement to top-level model.priceChart` · 23 July 2026 · week 14

The plan is corrected so the chart's data hangs off the top of the view model rather than inside another part of it — residue from a third revision that had not been carried through everywhere.

---

### Whole Numbers For People
`feat(debate): DROUND — 0-dp Đ display rounding (SPEC.1 §10.8)` · 23 July 2026 · week 14

Every amount a person sees is rounded to whole units, and only at the moment of display. The engine, the ledger, the read models and every message between them keep full precision, as do the exported file and the eventual public dataset. Rounding is a property of the view and of nothing else. Negative zero is guarded by name, because it is a real thing a computer produces and a nonsense thing to show anybody.

---

### The Last Point Must Agree
`feat(debate): UI.19 slice 1 — market-detail price chart (F-DEBATE-5)` · 23 July 2026 · week 14

A two-line chart of what the price has done, sitting above the bar showing what it is now. The final point of the line is stamped from the same figure the bar reads rather than computed alongside it, so the two cannot disagree on screen even by a rounding step. If the history fails to load the page still renders: the chart may be absent, never wrong.

---

### A Claim Withdrawn
`docs(plan): UI.19 — correct decision #1's typecheck claim` · 23 July 2026 · week 14

A statement in the plan about what the type checker had confirmed turns out not to have been true, and is corrected. What it originally claimed is not recorded.

---

### No Second Ranking Rule
`feat(debate): UI.19 slice 2 — expanded post nodes (F-DEBATE-5)` · 23 July 2026 · week 14

Opening the chart marks the arguments along it — the leading post for each side, on each day. The rule for choosing them is deliberately not a new one: it reuses the ordering the debate already has and takes the first eligible post in each bucket. Inventing a second way to rank would have meant a second thing to keep true forever.

---

### Outside The Export
`docs(adr): ADR-0034 — viewer-scoped debate reads outside the export-bound view model` · 30 July 2026 · week 15

A decision that reads depending on who is looking must stay outside the model the export is built from. An export has to be the same file for everyone, so anything viewer-specific has to live somewhere the export cannot reach. The commit records the decision and not one word of the argument for it.

---

### Chart Work Ends
`docs(logs): UI.19 close-out log` · 30 July 2026 · week 15

The chart work is recorded as finished, in a commit containing only that.

---

### The Button Was Never Wired
`feat(debate): BOOKMARK-ADD-WIRE — wire the bookmark add path on the debate view` · 30 July 2026 · week 15

The action that saves a bookmark had been written, tested and merged more than a week earlier with nothing anywhere able to call it. This connects it. Telling a card whether it is already saved costs two additional queries inside a transaction that was already running, and the existing loader is left with a zero-line diff — the surrounding code does not learn that anything changed.

---

### Proved Before Trusted
`chore(harness): repin CC and subagents to Opus 5` · 31 July 2026 · week 15

The model doing the work changes again, and this time the change is tested before it is believed. A session cannot test its own definitions — those load once, at the start — so a separate fresh session was run to confirm the new pin resolves and can actually use its tools. The old pin was checked too and still worked, which makes this hygiene rather than a rescue.

---

### Two Answers To One Price
`fix(debate): derive NO percent as 100 − YES` · 31 July 2026 · week 15

For a while this thing had two different ways of turning a price into a percentage, and they didn't have to agree with each other. In a place where the price is the entire product, that means the product could show you two answers to the same question. One of them was deleted. The other now derives NO from YES, so they can never drift apart again.

---

### Three Corrections Logged
`chore(debate): log session — PCT.ROUND complete` · 31 July 2026 · week 15

The percentage work is recorded as finished, with three corrections made before merge and one finding about a citation filed for somebody later.

---

### Stale Lines Corrected
`docs(design): commit CD-A pop-up close-out; correct stale mode-selector lines` · 31 July 2026 · week 15

A design record is committed, and some lines describing a selector that no longer exists are corrected. Which lines, and what they used to claim, is not recorded.

---

### It Refreshes Itself
`feat(debate): poll /m/[slug] on an interval so live markets refresh` · 1 August 2026 · week 15

A live market's page went stale the moment you stopped touching it. Now it refreshes on an interval — deliberately by re-running the read the page already does, rather than by adding an endpoint to fetch updates. The list of endpoints had been closed at eleven, and adding a twelfth to solve a display problem was the obvious answer and the worse one.

---

### Refresh Work Ends
`chore(debate): log session — F-DEBATE-4 complete` · 1 August 2026 · week 15

The refresh work is recorded as finished. Nothing about how it went is in the commit.

---

### Four Items In One
`docs(plans): SHELL-COMPLETE build plan` · 2 August 2026 · week 15

Four leftover pieces of the shell batched into a single gated plan rather than four separate ones, on the reasoning that they all live on the same surface.

---

### Only The Mechanism Moves
`docs(spec): withdraw the page-level footer` · 2 August 2026 · week 15

The strip along the bottom of every page is deleted. Not shortened, not
reduced to the legal minimum — gone, from every surface.

Except one thing in it could not go.

The licence chosen on day six obliges anyone running a modified version of
this as a service to offer their users the source. That obligation had been
discharged by a link in the footer. Remove the footer and the obligation does
not leave with it — so the link moves into the terms of service, and the
commit says why in four words: only the mechanism moves.

The rest is about what was not touched. Four lines change, and no
search-and-replace for the word "footer" was run at any point, because three
other things here are called footers and none of them is this one. A card has
a footer. A profile has a footer.

A blind find-and-replace would have caught all three, looked like a clean
deletion, and quietly broken two surfaces nobody was discussing.

---

### What A Visitor Meets
`feat(shell): 404 boundaries and header Dharma balance` · 2 August 2026 · week 15

Both error boundaries were missing entirely, against eight places in the code able to throw a page away. Two land, deliberately different from each other: the participant one branded and inheriting the header, the outer one bare — because the outer one has to work in the case where the thing that renders the header is what broke.

---

### The Join Marker Matched
`docs(plans): HEADER-PORTFOLIO build plan` · 3 August 2026 · week 15

The plan for the header's second figure, delivered in two parts. The commit records that the join between them matched exactly, so nothing in the middle had to be reconstructed.

---

### A Reference That Would Rot
`chore(plans): SHELL-COMPLETE — retire the ephemeral revert SHA` · 3 August 2026 · week 15

A plan cited a branch commit that will not survive its merge. The reference is retired before it can decay into something nobody can resolve.

---

### A Second Number Appears
`feat(shell): HEADER-PORTFOLIO — Σ open-position value in the signed-in Đ cluster` · 3 August 2026 · week 15

The header gains a second figure beside the balance: what everything you currently hold is worth. Both have to come from the same source, because two numbers assembled from different reads can disagree with each other between one page load and the next. That requirement is written into the tests before any of the code that satisfies it exists.

---
