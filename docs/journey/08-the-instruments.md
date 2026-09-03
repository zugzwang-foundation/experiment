# Act VIII — The Instruments
*n347–433 · 18 August – 3 September 2026*
<!--
ACT VIII — the machinery a reader who cares can recover, kept out of the way of
one who does not.

SPAN            n347 – n433, 87 commits on the first-parent spine.
DATES           18 August – 3 September 2026.

DATE BASIS      Committer-local (+05:30), NOT UTC. This is the basis the other
                341 mono lines already use — measured, not assumed: zero of them
                disagree with the committer-local calendar date and 64 disagree
                with the UTC one. It is deliberate and it is not a correction.
                Switching basis mid-document would shift an unknown subset of
                dates by one day while every entry still looked plausible, and
                would put two conventions in a document read one entry at a time
                with no way to tell which one you are in.

WEEK FORMULA    week = floor((committer-local calendar date − 2026-04-23) / 7) + 1
                Week 1 is 23–29 April 2026. The epoch is the first commit's own
                date. Applied to all 341 existing mono lines it agrees with 340;
                the same formula on UTC dates agrees with only 337, which is what
                rules UTC out on the week test as well as the date test.

KNOWN EXCEPTION One existing mono line disagrees and is left uncorrected, because
                correcting it would mean editing a published entry: Act VI's
                `The Second Door`, dated 23 July 2026, states week 13 where the
                formula gives 14. It sits on a week boundary, and it is bracketed
                on both sides by entries that state the formula's value — nine
                others dated 23 July say 14, and every entry dated 22 July says
                13. It is an isolated transcription slip, recorded here so nobody
                derives a rival formula from it.

THE NAME        Chosen by the rule stated in advance, not by feel. Across all 87
                commits in the act — not a shortlist, because a selection rule
                that hunts for a theme returns that theme — count the bodies
                recording an instrument, a proof, a measurement or a stated claim
                that turned out wrong and was corrected. At or above 25% the act
                is The Instruments; below it, The Start Line.

                Count 49 of 87 = 56.3%.  Threshold 25%.  Selected: The Instruments.

                Every candidate was put to three independent readers instructed
                to refute it, and six of an initial 55 did not survive: a guard
                ADDED where none existed is an absence, not a wrongness; a draft
                IMPROVED across review rounds is not a landed claim corrected;
                and a risk AVOIDED in advance is not an error. A completeness
                pass over the 32 negatives proposed no promotions. The margin is
                wide enough that none of the six changes the answer.
-->

By the middle of August the product is finished enough that the work changes shape. There is a market page, a price chart, a profile, a way in and a way to argue. What is left is not building it, but finding out whether everything that says it works is telling the truth.

A month earlier the project stopped trusting what it read and started measuring. This is what that turns up, and it is not the reassuring half. More than half the commits here record an instrument, a proof, a measurement or a written claim that turned out to be wrong and had to be corrected. A frame counter reporting the screen's speed rather than the drawing's. A guard sitting green for exactly the reason it exists to detect. A test that still passed with the defect put back in. Four documents confidently describing a repository that had moved out from under them.

None of it is dramatic, and that is the problem. A broken instrument is quiet. The greener it reads, the longer it stays.

Two things to carry in. The live site is still serving a build from the second of July, which nobody had written down until somebody counted. And one proof in here was real and one clause short of what it read as — a check was deleted on the strength of it and had to be put back. Every measurement here rests on the same kind of reasoning. The window finds out.

---

---

### Carried, Not Composed
`docs(convention): §5.13.1 — the constant "Instructions for AI" block` · 18 August 2026 · week 17
<!-- TIER: CHAPTER -->

The brief for reading these commits could have lived in a prompt, off the repository. A prompt is something you have to remember to supply. A paragraph in the message is something you cannot fail to receive.

The words never change. Regenerated per commit they would drift, handing a reader several hundred slightly different briefs. They instruct reading only — one that instructed behaviour would turn the log into something that gives orders. No exemption by type: the moment one class of commit skips it, the guarantee is worth nothing.

---

### A Fifth Say Nothing
`docs(journey): the plain-language companion — eight acts, 340 entries` · 18 August 2026 · week 17
<!-- TIER: CHAPTER -->

Five commits get no entry at all, deliberately. A commit without one is a decision here, not an omission. The act covering the experiment's live run is a bridge and nothing else — writing its entries before the window has run would be inventing the thing the whole document exists to avoid.

The finding nobody legislated is a proportion. A fifth of the commits behind this explain nothing about themselves. Over half in the first three weeks, one in twenty in the last two.

---

### Followed Before Approved
`docs+test(journey): correct the both-sides commit, guard the discovery path` · 18 August 2026 · week 17
<!-- TIER: CHAPTER -->

One commit had been described as sitting outside the convention. It is not. Its message carries the block twenty-nine times, once per squashed commit, and it merged eight minutes before the rule did — from a branch cut while the rule was unmerged. Somebody read it there and applied it with nothing ratified.

A single paragraph is the whole route to the notes, and nothing fails on disk if a character goes missing. So the test builds two throwaway repositories and runs whatever that paragraph says.

---

### The Login That Never Comes
`docs(spec): §21.9 — the deck gets a spec before a line of code` · 18 August 2026 · week 17
<!-- TIER: CHAPTER -->

Nothing in either specification said how the deck behaves, and the one sentence that came close called it skippable, which on first login it deliberately is not. Written afterwards, the specification would have contradicted the product, and the contradiction would have surfaced whenever somebody read that sentence looking for something else.

The section also records a fact about signing in rather than about the deck: a session lasts four hundred days, against a live window of roughly fifty-one. Anything specified for next login fires once, at signup.

---

### Wrong Twice, Same Shape
`docs(runbook): the staging precondition tests content, not directions` · 18 August 2026 · week 17
<!-- TIER: CHAPTER -->

This check has named a symptom and treated it as the property, twice. First a rejected push was taken to mean the rehearsal branch held something of its own; it does not, and that rejection happens routinely. Its replacement counted differences in two directions, and failed on its first real run — a hundred and forty-one additions that were only the old text of edited files, read backwards.

So it stops counting anything. Two commands ask the question directly instead, at both the places the wrong one had reached.

---

### Closed On Card One
`feat(onboarding): the deck — a first-login gate that cannot be dismissed` · 18 August 2026 · week 17
<!-- TIER: CHAPTER -->

The right place to record that somebody has seen the deck was a column on the person — once per human, not once per browser. It was rejected on cost, the better option in plain view: a migration, a spec row, a review gate, all for a fact nothing else reads. A cookie holds it instead.

The mark is written at the end, never at the open — otherwise it records somebody as having read rules they closed on card one, the outcome the gate exists to prevent.

---

### One Person, Two Units
`VIEWS-1: header label visitors -> views (SPEC.1 §21.1 rider)` · 19 August 2026 · week 17
<!-- TIER: CHAPTER -->

The counter goes up once per page load. It carried a word that names people, and one person moving between pages on the rehearsal site took it from 813 to 814.

Of the three words available, only one names something this mechanism can produce: another names a session metric, and producing that would mean keeping an identifier it deliberately refuses to hold. Everything underneath keeps the old name, the stored key included — renaming that would zero the number the word describes.

---

### The Note Argued Back
`VIEWS-1c — the docblock says what the label says` · 19 August 2026 · week 17
<!-- TIER: CHAPTER -->

A counter's label had changed to match what it counts, and the comment above it went on describing the old word. That comment opens by citing the rule it now contradicted — a false claim about a governing document, in the sentence that names it.

The noun was the deeper fix. The comment called the number total page visits; a visit measures a session, and this counter holds no session identifier and deliberately cannot acquire one. Five internal names keep the old word on purpose.

---

### Measured, And Wrong
`VIEWS-1d — the squash SHA, and the O-11 that was never missing` · 19 August 2026 · week 17
<!-- TIER: CHAPTER -->

The brief said a standing rule had been cited but was not in the repository. It was — and it was there in the tree the earlier report says it measured. Somebody went looking for the stale copy that would make that claim true. There isn't one.

What is protected here is the standing of the word measured. The brief restated the rule in prose instead, and six clauses did not survive the paraphrase — including the ones that matter when a session dies mid-run.

---

### Zero Looks Like Failure
`feat(shell): the GitHub star control — and the 0-vs-unavailable contract` · 19 August 2026 · week 17
<!-- TIER: CHAPTER -->

The repository is public and nothing in the product pointed at it. The header gets a link, and a count beside it.

The count is the whole risk. Zero is a real answer, a failed read is a different one, and zero is the value the language reads as nothing. Collapse the two and the header claims a failure whenever the count is genuinely zero — which is what it is today, so the bug would have shipped looking correct. Two tests hold that line from opposite sides.

---

### There Was No Ladder
`feat(onboarding): the deck's visual pass — a measure set by the copy` · 19 August 2026 · week 17
<!-- TIER: CHAPTER -->

The request was one step up the size ramp. There is no ramp — the design language leaves that part blank and the token contract says it is not a slot. A step up an imaginary ladder is an invented number wearing a ruling's clothes, so the sizes stand and the reason is recorded instead.

What did move is the width. The first card's argument broke five clauses mid-thought, so the frame stopped being a given and the copy set the measure.

---

### Right Outputs, Wrong Reason
`feat(shell): the star count reads compact, and the rounding that reads as a defect` · 19 August 2026 · week 17
<!-- TIER: CHAPTER -->

The number belongs to GitHub, which shortens it at a thousand, so the header does too — follow the link and the shape matches. What gets read aloud keeps every digit; an announced string is under no width pressure.

The ruling that asked for this had its mechanism backwards. It said the shortening chops digits off. It rounds. The one setting that chops contradicts another of that ruling's examples, so nothing could satisfy both. The five outputs it named hold. Only the explanation changed, into a measurement.

---

### Not The Same Unit
`SYNC-3 · the scale premises — the four sizings that hung off a concurrency number` · 20 August 2026 · week 18
<!-- TIER: CHAPTER -->

The target moved: a hundred thousand signups, two million page loads, no spending ceiling for the live window. The old figure was five thousand at once; the new ones are totals across fifty-two days.

Calling the old number falsified would have been tidy and wrong. It still holds — that averages under half a request a second. What fails is the four sizing decisions that leaned on it, since how many arrive together says nothing about how many arrive in all. Those reopen. The number stays.

---

### The Reviewer Never Saw It
`SYNC-3 · CLOSE — the namespace ruling, and a Gate C exception on the record` · 20 August 2026 · week 18
<!-- TIER: CHAPTER -->

A change merged after three rounds of review without its diff ever reaching the reviewer. The approval was not careless: it rested on a path list that never left the documents, a green run named by its identifier, and every changed byte quoted in two reports.

Those substitutes are load-bearing only because there was no behaviour to reason about — precisely the condition that will not hold next time. So it goes on the record as an exception. An undocumented one becomes the way things are done.

---

### Anonymous On The Way Home
`fix(auth): issue the participant session on F-AUTH-4 Continue` · 21 August 2026 · week 18
<!-- TIER: CHAPTER -->

Accept the terms, get sent to the front page, and arrive as nobody — every new arrival had to sign in a second time. The requirement was written down, and a decision record had already named this as wiring never done. Two review passes turned up four more faults, one of which this fix would otherwise have introduced itself. A fifth is flagged and left alone: an earlier ratified decision now carries higher stakes than when it was made, and reversing it sits outside what this change may touch.

---

### The Carousel That Never Spun
`feat(discovery): the market-detail header reads a second row` · 21 August 2026 · week 18
<!-- TIER: CHAPTER -->

The market's own page and the tile that links to it drew on one read, so a market carrying more than one image showed the same one at both sizes. The header now has a read of its own; the tile's is untouched to the line. The better part is a promise narrowed to fit — the specification described a carousel advancing through every image, and no build has ever shipped one. It now describes the single picture that exists. The carousel is deferred, not dropped.

---

### Unreachable By Construction
`feat(lots): a holding stops being one number with nothing beneath it` · 21 August 2026 · week 18
<!-- TIER: CHAPTER -->

Ten steps land as one commit rather than in sequence, deliberately. Between the step that creates the pieces a holding is made of and the step that can sell them, the tree sits in a state where they exist and nothing can reduce them. Merged one at a time it stays in the history for somebody hunting a bug to land on.

Two documents claimed a safety net that does not exist. Both now say the true thing — a comment that reads as protection is worse than none.

---

### Both Halves Were Wrong
`fix(lots): the CHECK says how big a lot may be, not which way it may move` · 22 August 2026 · week 18
<!-- TIER: CHAPTER -->

A comment claimed two constraints enforced a direction, and that this was stronger than checking against the previous value, which storage supposedly cannot see. Both halves were false, and the second was disprovable by opening a file already in the repository. Nothing stops the number climbing back up.

The same sentence sat in six places, and a correction had already been aimed at it. The search that went looking was line-based and the sentence wraps, so it reported absence when what it had was silence.

---

### Rescued Before The Reset
`feat(composer): bring the image slot back onto the branch everything is cut from` · 22 August 2026 · week 18
<!-- TIER: CHAPTER -->

Three changes were merged into the rehearsal copy, never into the main line. They work and they are live, which is not the point: the mirror had started holding what the original never had, and the reset that rebuilds it does not ask. It wipes and regenerates from the main line, and whatever lived only there is gone with nothing to say it existed.

Not a feature. The same three changes copied across word for word, and the only checkable claim is that the two now differ by nothing.

---

### Two Ways To Say Nothing
`fix(bets): one spelling per meaning on the sell wire` · 22 August 2026 · week 18
<!-- TIER: CHAPTER -->

Two ways of saying no argument in particular were both accepted, and each fingerprinted differently — so one request carried two identities under a single key. A retry reaching for the fuller form misses the cache and is told the key was reused, which a client may read as an instruction to pick a new one. That turns a completed sale into a second one. Only a test ever sent the wider form. The test is inverted rather than deleted: a narrowing resting on nothing gets generously widened back later.

---

### Five Rows We Cannot Read
`docs(parked): the LOTS-1 arc's unpaid rows` · 22 August 2026 · week 18
<!-- TIER: CHAPTER -->

Twelve unpaid items lived in reports the main line has never held. Five cannot be summarised here: the document defining them is absent, reachable only through somebody's downloads folder. Writing five plausible summaries would have looked more useful and been wrong. The row records the register as unreachable, and that is the finding.

A surprise found while looking for something else: the gate guarding production is stuck on a hash that no longer matches, because somebody edited a comment saying never to edit the file it sits in.

---

### Measured Against Almost Nothing
`chore(perf-1): re-verify region fix, correct the Discovery gauge` · 22 August 2026 · week 18
<!-- TIER: CHAPTER -->

A fix is only verified against the tree it was measured on, and more had landed since. So it is checked again, three ways, against what the rehearsal site serves today. The check caught its own gauge: the timing being quoted measured the page frame arriving, not the ranking work behind it. And a new item is opened admitting that every measurement so far, this one included, ran against about ten bets and ten comments — so the work being timed barely ran.

---

### The Slot Stayed Bought
`fix(ranking): rank follows the money that stayed, not the money that came` · 22 August 2026 · week 18
<!-- TIER: CHAPTER -->

You could buy the top of a debate and then take the money back. There is no fee on the round trip, so a large reply took the best-argument slot and exiting returned everything but dust, while the ranking read on from a stake nobody was standing behind. Three things ranked on that number, one named in no document and, in a young market, deciding the whole order. The same capture lives on the counting side, written up rather than fixed — not a four-in-the-morning call.

---

### The Table Outlives The Feature
`chore(unwire-1): remove the bookmark module and the Profile Dharma graph` · 22 August 2026 · week 18
<!-- TIER: CHAPTER -->

Two finished features come out on a ruling: the bookmark surface entire — its page, its components, its server side, the icon on the debate page — and the graph on the profile. Eleven thousand lines gone. The database table behind bookmarks stays, deliberately, with nothing changed about it; the record says it is kept and does not say what for. A download control that had been bundled with the bookmark icon is lifted out and preserved unchanged. Three places pointing at the deleted code were ones no merge could flag.

---

### Two Edits Not Made
`docs(amend-1): record UNWIRE-1 and amend the clauses it supersedes` · 22 August 2026 · week 18
<!-- TIER: CHAPTER -->

Paperwork catching up with a deletion: one decision record retires another, and the specs are brought level with what shipped. Eight amendments were asked for. Two of them name text that does not exist in the form the request assumed, and are left untouched rather than guessed at. Other stale references turned up outside the brief and were reported instead of quietly swept, on the stated grounds that neither leaving things out nor reaching past the ask was what was wanted.

---

### Confess The Late Fixes
`docs(overnight-run): removing the operator relocates the checking` · 23 August 2026 · week 18
<!-- TIER: CHAPTER -->

A rule about how the work gets checked has to live where somebody is already reading, not in an attachment somebody has to remember to bring. So it lands in the repository, byte for byte as it was written elsewhere. The change is a removal: the reviewer used to be run again over its own fix, dropped for costing too much time. What replaces it is confession — the session names every fix it wrote after the reviewer that would have caught it, and the gate reads those first.

---

### You Argued There
`feat(profile): POSREV-1 — the Positions surface counts arguments, not markets` · 23 August 2026 · week 18
<!-- TIER: CHAPTER -->

The holdings table answered which markets you are in. What people did here was argue, and a market with three arguments behind it collapsed into one row carrying one number. Now the unit is the argument, one tile each — and exited markets come back in, dropped for holding nothing left to value, which stops being a reason once the row is not a value. Pricing each tile by its own sell quote was refused: the parts would sum to more than the whole, on the surface built to stop that.

---

### Invisible, Not Absent
`feat(profile): give the tile its height back and let it say where it is` · 23 August 2026 · week 18
<!-- TIER: CHAPTER -->

A week earlier the table had gained a header naming each market once instead of once per argument. Right instinct, wrong trade — it ate a band of height from every group, so it goes and the question moves back inside the tile. Nothing else records what that cost: the market totals rode that header and now appear nowhere, while the arithmetic making the tiles add up to them is deliberately left alone. The parent went invisible, not absent. An unmoved position gets a sign meaning neither direction.

---

### Nothing To Divide By
`feat(profile): make the sell field look editable and the delta say which way` · 23 August 2026 · week 18
<!-- TIER: CHAPTER -->

Green and red were proposed for direction and refused — the surface is monochrome by ruling — so a trending mark carries it alone, with the direction also spelled out in words for anyone who cannot see it.

Two cases deliberately get no percentage. A holding that has not moved shows a dash rather than a nought: no movement is a different fact from movement that rounds to nothing. One whose recorded cost has been rounded away has nothing to divide by, and says nothing rather than inventing a denominator.

---

### A Refusal Read As Agreement
`chore(scripts): S-1 Gate-C follow-ups — the two instruments S-5 needs` · 25 August 2026 · week 18
<!-- TIER: CHAPTER -->

An instrument reported the opposite of what was happening — a connection being handed around read as pinned — and it was believed twice, on separate days, before anyone doubted the tool rather than the thing it pointed at. It now carries its own control, which has to be run before a quiet screen is allowed to mean anything.

The same commit strikes a page of guarantees nobody had. The endpoint that would confirm them answers with a refusal, and a refusal had been read as agreement for eleven days.

---

### Missing Looks Like Chosen
`fix(db): transaction-pooler migration behind DB_POOLER_MODE (S-1)` · 25 August 2026 · week 18
<!-- TIER: CHAPTER -->

The obvious shape is a fallback — use the new setting if present, otherwise the old one. It is the one thing forbidden here. It makes a setting somebody forgot to create identical to a setting somebody chose, so the environment would run against the wrong thing while every check reported fine. The mode is named outright instead, and an absent value stops the run and names itself.

The plan this ran from had gone stale, and would have walked its reader into diagnosing success as failure.

---

### The Cheaper Wrong Guess
`feat(ui): INFO-1 — one gloss per term, on an affordance that works on a phone` · 26 August 2026 · week 18
<!-- TIER: CHAPTER -->

Two pieces each do half the job: one opens on hover and never on tap, the other on tap and never on hover. Which one appears is decided per reader, and unknown defaults to the phone — a phone handed the hover one cannot open it, a desktop handed the tap one still works. Wrong guesses are not the same size.

One control keeps the old hint: its click opens a modal that hides the page, leaving the gloss no window to open in.

---

### Right And Redundant
`Ritam-s4` · 26 August 2026 · week 18
<!-- TIER: CHAPTER -->

The front page asked the database ninety-seven questions every time it loaded, all of them correct and all of them the same for everybody looking. So it stops asking and hands out one copy.

Two things stay out of it. Price, because a stale one misquotes what a bet will actually cost. And the plain-text export of a debate, which a standing decision forbids caching at all: a cache is a window in which content just removed keeps being served.

---

### Removed And Still Serving
`fix(cache): S-4 F1–F8 — the invalidation fixes #405 merged without` · 27 August 2026 · week 19
<!-- TIER: CHAPTER -->

A branch was squashed while its own review fixes sat uncommitted in a working copy, so what landed was the reviewed design with the reviewed defect still in it.

The call that clears the cache when a comment is removed set the content to expire in a year, and clearing only removes what has already expired. A moderator removing something got a success and the removed text kept being served. Live as the repair is written, which is what makes this a follow-up rather than a later pass.

---

### The Dot Stays Put
`feat(chart): CHART-1 — the market price chart, concluded` · 27 August 2026 · week 19
<!-- TIER: CHAPTER -->

The two lines are labelled where they end rather than by a key, which breaks on a market with no bets: the two prices are identical and the labels collide. Every market starts there.

The labels get pushed apart. The dots do not. A moved label is still unambiguous beside its own dot; a moved dot is a false statement about a price. Where the two lines really are the same line, they are drawn as one — separating them to look tidier would invent a difference.

---

### A Trailer For The Terms
`RESO-1 — four blocks, relocated bar, no criterion excerpt` · 27 August 2026 · week 19
<!-- TIER: CHAPTER -->

Two clamped lines of the terms of a bet sat in the header of the market page — a trailer for a document the page gives you no way to open. They go. Four blocks replace them, empty and unclickable: the destinations do not exist, one field has no column, and another is market content this project refuses to invent.

The right-hand column shipped empty anyway, because asking whether a chart exists and asking whether the object describing one exists are different questions.

---

### Something Needed Not Adding
`CRIT-1 — the resolution criterion returns to /m/[slug], collapsed` · 27 August 2026 · week 19
<!-- TIER: CHAPTER -->

The terms a participant stakes against appeared nowhere on the market they bind, reachable only as a download. They come back, collapsed.

The brief ruled one attribute onto the panel and called that the whole point. The attribute is never cleared when a panel opens, so the panel could never have opened — clicking does nothing. Every screenshot shows the closed state. Nothing needed adding.

The claim that page search reaches the hidden text is recorded as an inference, not a measurement. We had measured our own earlier click.

---

### Renaming An Unchanged Picture
`Ritam-r2` · 27 August 2026 · week 19
<!-- TIER: CHAPTER -->

A signed link carries a timestamp, so asking twice gives two addresses for one unchanged picture, and browsers cache by address. The market page refreshes every fifteen seconds, so a picture nobody touched was fetched two hundred and forty times an hour per open tab, and paid for each time. Signing was never the cost. Renaming was.

Two things are deliberately left alone. Profile pictures already work by a simpler route, so making the two consistent would only endanger the one that is fine.

---

### Held By The Same Receipts
`RESO-2 + RESO-3 — proportions, labels, criterion disclosure removed` · 28 August 2026 · week 19
<!-- TIER: CHAPTER -->

The terms of the bet leave the page on a founder ruling: a closed row on a one-screen page was costing the debate the height it needs. The component stays in the repository, unrendered, and its guards are inverted rather than deleted — so the removal is held by the same receipts that used to hold the mount.

A column that does not render leaves a gap the blocks were spreading into. Reserving that space and rendering the thing that fills it make the same pixels and different futures.

---

### Each Waiting For A Second
`S-3 · Fix Google OAuth signup connection deadlock` · 28 August 2026 · week 19
<!-- TIER: CHAPTER -->

Four unauthenticated requests were enough to wedge an instance, and a wedged instance answers nothing. Signing up held one pooled connection while a step inside it asked the same four-slot pool for a second. Four at once, each holding one and waiting for another. Nothing ended it.

The ceiling is deliberately not raised — the deadlock fires at the limit, whatever the limit is, so a bigger pool moves the line and keeps the fault. The cost is recorded: signing up is no longer one indivisible write.

---

### One Clause Short
`fix(bets): scope idempotency to the user who holds the key` · 28 August 2026 · week 19
<!-- TIER: LANDMARK -->

Send a bet twice by accident and the second must not place a second bet. A key made on the phone stops it.

The server remembered the key and nothing else. Two people holding the same key was unlikely and never impossible. The second would have been handed the first one's trade, and their own would never have run. The repair is small: remember whose key it is.

The harder thing rode along. A double charge was suspected. An earlier pass proved it impossible and deleted the live check on the strength of that proof.

The proof was real. It covered what one request can do to itself. It did not cover what a stored answer can do after the request that wrote it is gone — and there is a moment, by design, when the newer one cannot see the older one's receipt.

| | |
|---|---|
| **Review passes over one repair site** | four |

The check went back in, with a test that builds that alignment rather than arguing it away. Four passes is not the plan. It is what happens when a plan has a hole nobody names until somebody goes looking.

---

### Spending A Budget Nobody Watched
`fix(debate): the text column is a choice` · 29 August 2026 · week 19
<!-- TIER: CHAPTER -->

All four block labels were clipping. The square took its size from the height of the block and paid for it out of the width — two numbers from different places, so a decision about how tall something is spent a budget nobody was watching, and the text got the remainder.

The column is forty-eight pixels now because that is what the longest label needs, which is the repair: somebody decided it. The guard holding the old shape is flipped rather than dropped, and both reversals are written down.

---

### Narrower Than Promised
`CHART-2 — the chart's line ends, and the aspect lock CHART-1 broke` · 29 August 2026 · week 19
<!-- TIER: CHAPTER -->

Two words at the ends of the line lived inside a drawing that three surfaces stretch differently, so a label declared at ten pixels arrived at just over four — the smallest type in the product. They are plain text beside the plot now, where ten means ten.

The plan said pulling them out would hand the plot back the width it lost. It got narrower: a legible label needs more room than a squashed one. Three places written to the optimistic version are corrected where they stand.

---

### The Same Drawing Sixteen Times
`feat(art): WARLI-1 — an interactive Warli-inspired hero (unmounted)` · 30 August 2026 · week 19
<!-- TIER: CHAPTER -->

The ring is not sixteen designs. It is one body drawn sixteen times, and the only things that differ are the angle of the limbs and what is in the hand — the argument put into the code rather than a caption. Four figures carry nothing and are told apart by pose alone. Those are the harder half to draw and the half worth keeping: a ring where identity is only ever an object would be saying people are what they hold, and that is a smaller idea.

---

### Sixty Either Way
`WARLI-2 — density, character and the legible debate` · 30 August 2026 · week 19
<!-- TIER: LANDMARK -->

A drawing was going behind the sign-in page, and the only question that mattered was what it costs to keep it moving.

The first attempt at measuring said sixty frames a second. It said sixty for a version loaded with effects that cannot possibly be free.

| Measured | |
|---|---|
| The shipped drawing | sixty a second |
| A version that cannot be free | sixty a second |

It was reading the screen, not the work. Monitors refresh sixty times a second, so a counter tied to the refresh keeps reporting sixty while the drawing falls further behind it. A confident green number is worse than no number, because nobody re-checks a green one.

The replacement counts frames that actually arrived. It is trusted for one reason: take the moving parts out and it reports two-tenths of a frame a second. A control that cannot fail is not measuring anything.

That bought the answer the design needed — the expensive-looking part is near enough free at ten times this drawing's size — so the piece got denser instead of hedging. The parts that ended up densest are the parts that never move.

---

### Seven Do Not Travel
`perf(debate): shift the poll's phase, never its period` · 30 August 2026 · week 19
<!-- TIER: CHAPTER -->

Nine changes sat on a branch. Two travel. Six revert for reasons the record says are unrelated to code quality, and one waits on a measuring tool that does not exist. The branch stays frozen — not merged, not rebased — as the record.

The new check earns its place by being broken twice. The blunt break reddens a neighbouring test as well, and a break several guards catch says nothing about which one caught it. The subtle one leaves it the only red in the repository.

---

### Corrected, Not Unfinished
`docs(parked): file WARLI-3 — the composition notes, before they stop being true` · 30 August 2026 · week 19
<!-- TIER: CHAPTER -->

There is a gap between the ring and the field, and it looks like something nobody finished. It is the opposite: the placement had been treating a figure as a disc around its feet, when a figure is drawn upward from them, so correcting it pushed the field out. Written down that way, the next person fills the gap. Written down as a gap, they shrink the clearance and put the crowd back on top of the field. Five such notes, filed while they are still obvious.

---

### The Reading Looks Healthy
`docs(registers): land the WARLI verification lessons, and say who wrote them` · 30 August 2026 · week 19
<!-- TIER: CHAPTER -->

Three lessons, one shape. A check whose two sides come from the same source agrees perfectly while the error reaches both. An instrument returns a plausible number for a load that cannot possibly be cheap. A renderer stays deterministic while its output changes, because what moved was the input. Every reading looks healthy, and the reason it looks healthy is the defect.

A version block already missing from the record stays missing. Its content belongs to somebody else, and backfilling it would be the failure the record names.

---

### Let The Edges Go
`fix(art): fit the artwork by filling the frame, not by shrinking it into one` · 1 September 2026 · week 19
<!-- TIER: CHAPTER -->

One fix was never on the table. Stretching the drawing to the shape of the window would fit any viewport exactly and turn the rings into ellipses, which is the one thing this drawing cannot survive.

On a phone the whole composition had collapsed into a band behind a card wider than the outer ring. The border bands now leave the screen, and the frame stops reading as a closed rectangle — a judgement rather than a bug, and one attribute, so a disagreement reverts one line.

---

### Ratified Elsewhere
`feat(composer): apply T3 ratified rulings (pixel guard dropped)` · 1 September 2026 · week 19
<!-- TIER: CHAPTER -->

Rulings ratified somewhere else are applied here, one of them dropping a guard measured in pixels. Where they were ratified, what was argued, and why that guard went are all absent. Since the middle of August every commit in this repository is supposed to carry its reasoning; this one is a subject line with nothing under it. Whatever was ratified stayed wherever it was ratified.

---

### The Half We Wanted Most
`CHART-3 — the genesis fallback was measured unsound and does not ship` · 1 September 2026 · week 19
<!-- TIER: LANDMARK -->

Every market opens at a price. Months later a chart wants to draw that first point, and nobody kept it.

There was an obvious way to get it back. The pool holds a number the opening price can be worked out from, and that number is meant to hold steady while people trade. Recover it, recover the price.

It does not hold steady. Every trade rounds a fraction the pool's way, so it creeps up and never comes back down. Two trades are enough to put the recovered price off the real one, and every market carrying a bet was long past two.

So the half that was most wanted is the half that cannot be built. Better said plainly than softened: those charts stay blank.

| Where the answer already was | |
|---|---|
| **The pricing notes** | state the rule and give it a number |
| **Both pricing functions** | say it again in their own comments |
| **A passing test** | measures the exact amount gained per trade |

Three places, and the work was planned as though none of them existed.

Building the shortcut is what found a real fault it would have hidden — markets that lose their chart with no way to tell — and that fault now has a test standing over it.

---

### Nobody Had Run It
`fix(tests): stop two test comments from looking like real Tailwind classes` · 1 September 2026 · week 19
<!-- TIER: CHAPTER -->

Somebody ran the application locally — no task asked for it, and nobody in this lane had. Every page had been failing to compile since the chart work landed; the finished build only warns, so nobody had seen it.

Two test comments carry an example of styling syntax, and the scanner hunting style names cannot tell a comment from code — so it tried to build real styling out of placeholder dots. The durable fix waits: six days from freeze, a two-line unblock does not touch build settings.

---

### Taller Meant Narrower
`BLOCK-3 — resolution block refinements` · 1 September 2026 · week 19
<!-- TIER: CHAPTER -->

A panel took its width from the header's height, so a taller window left the text beside it less room, not more. On a narrow screen it wanted more than the whole row, and the text column collapsed to nothing. Width now comes from the row.

Every value's type size had been fitted against a column measured earlier in the same task. A later change widened that column. A wider column can only let more fit, so nothing was broken — and every size was fitted again anyway.

---

### Didn't Want To Oversell
`feat(scripts): the frontend bundle instrument (HO-T4)` · 1 September 2026 · week 19
<!-- TIER: CHAPTER -->

An instrument for weighing what a browser must download, and two findings from its first run. Two watching services are forty-three per cent of what every page carries — established by pulling them out, remeasuring, putting them back, and checking the file matched. Wrapping a component so it loads later does not automatically shrink a page: one attempt made its route heavier, the wrapper costing more than the component saves.

Nothing here rebuilds, so the check compares committed numbers rather than measuring again. Said plainly, not oversold.

---

### Correct By Coincidence
`CHART-6 — the labels travel with their dots; the window contains its data` · 1 September 2026 · week 19
<!-- TIER: CHAPTER -->

For two weeks every rehearsal market drew its opening price outside the picture. The window began four days after the data. A window narrower than its data does not error, does not warn and reddens nothing — it just stops drawing.

The label naming each line's end sat at a fixed spot while the dot it names was placed from the data. Those matched only while the line reached the right edge. Once it stopped, labels drifted up to nine-tenths of the plot from their marks, nothing red.

---

### Three Free, One Not
`BLOCK-4 — every resolution block is one line` · 1 September 2026 · week 19
<!-- TIER: CHAPTER -->

Three of the four second lines were saying nothing the first did not. The fourth was the time of day trading stops on the closing date, and it is recorded as a real subtraction rather than filed beside the free ones.

The premise underneath was wrong. The row's height had never been its contents — it was whatever the neighbours left over, which was the point back when these blocks were empty chrome. That ruling is reversed, written into the declaration it contradicts.

---

### Six Holes In The Checks
`CHART-7 — marks left, one-line label, calendar anchors` · 1 September 2026 · week 19
<!-- TIER: CHAPTER -->

An audit found nothing wrong with the chart and six holes in the checks around it, each proved by breaking the code and watching the suite stay green. Five of the six are one thing said twice: a position asserted, and whatever makes it mean anything not.

Review also caught a two-character change we had defended at length. Moving a column of numbers to the other side deleted the gap beside them rather than moving it — the padding and the alignment stopped being on opposite edges, and cancelled.

---

### The Instrument Said No
`feat(profile): code-split PositionsTable via next/dynamic (HO-T5)` · 1 September 2026 · week 19
<!-- TIER: CHAPTER -->

The interesting number is not the twenty-two kilobytes one page sheds. It is that what every page shares is unchanged to the byte, so nothing was quietly moved onto the surfaces that never asked for it. An earlier reading said otherwise, taken against an old measurement rather than a control.

The other candidate was tried twice, made its page heavier both times, and ships unsplit. The guard forbidding this is not deleted — it names one exception and refuses everything else.

---

### A Deletion That Claims Nothing
`feat(chart): remove the post nodes, and everything that existed only for them` · 2 September 2026 · week 19
<!-- TIER: CHAPTER -->

A ruling takes the circles marking each side's top argument of the day off every surface. The delete goes further up than the drawing: the selector goes too, or it would keep walking the whole ranked list on every read with nothing rendering the result.

The chain stops there, and saying where is the point. The database trips do not move — twelve cold, two warm, measured on both sides. What was saved is work inside a read already being paid for, and that is all the record claims.

---

### Describing It Broke It
`test(design): compile the stylesheet in CI, because nothing here ever did` · 2 September 2026 · week 19
<!-- TIER: CHAPTER -->

Every route died in local development for twenty-plus commits and every gate stayed green, because none compiles a stylesheet. Found by a person running the app by hand — not a control.

The cause was a comment. The scanner that hunts for style names searches plain text and cannot tell prose from code, so an example written to explain a test became a real, broken rule.

Writing the guard broke the build again, on its first run. Its own explanation quoted the thing it was written to catch.

---

### Reconstructions That Say So
`NIGHT-1 — three logs never written, and the distance to production` · 2 September 2026 · week 19
<!-- TIER: CHAPTER -->

Three sessions merged and left no log. These are written afterwards from whatever survived — the pull requests, the diffs, reports somebody kept — and each one says in its own words that it is a reconstruction, naming what a real log would have held that it cannot. One of them cannot even establish whether its review ran.

The distance nobody had written down: production is serving a build from the second of July, three hundred and sixteen commits back. Every gate this project has measured was measured on staging.

---

### Nobody Else Showed Up
`fix(ranking): a post attracting its own author is not attracting anything` · 2 September 2026 · week 19
<!-- TIER: CHAPTER -->

The counts that decide what tops a debate are taken over rows that can never be removed, so unlike money they cannot fall. Post at the minimum, reply to yourself enough, take the top slot, sell out, get the stake back. Measured: a ten-Dharma post beat a hundred-Dharma one.

Letting the counts decay was available and refused: a number that drops when someone leaves says the argument was never made. So a self-reply keeps its stake, and loses only its claim on anyone's attention.

---

### An Empty Box Looks Deliberate
`BLOCK-5b — the block gets its glyph, and the plate stops being a colour` · 2 September 2026 · week 19
<!-- TIER: CHAPTER -->

Thirteen marks arrive, one per kind rather than one per market, each baked onto a plate of a slightly different grey. Dropped in as they came, eight of the thirteen would have shown a square inside the block — worse than the empty box they replace, because an empty box at least looks deliberate. The plates are keyed out rather than repainted; they were never part of the mark.

The colour check is handed a coloured image and must reject it. Thirteen already-grey files would pass a blind one.

---

### Blind And Long Enough
`fix(design): the CSS guard was green for the reason it exists to detect` · 2 September 2026 · week 19
<!-- TIER: CHAPTER -->

The guard proving the stylesheet compiles checked that it was long enough to be real. That floor sits below what the tool emits when it reads no source files, so the scanner could have gone blind and every assertion would have passed — in the file written to be the answer to that failure.

The replacement is a token the test file owns, which the stylesheet can only contain if the scanner walked out of the source tree. Both findings came from a review still running when the work merged.

---

### Wrong By The Same Amount
`fix(scripts): count the chunks Turbopack actually lists, not the webpack fallback` · 2 September 2026 · week 19
<!-- TIER: CHAPTER -->

An instrument measuring how much the page weighs had been reading the wrong list, and every absolute per-route figure it ever gave was four thousand six hundred bytes light. Every comparison it gave is sound — both sides were short by the same chunk. It was trusted for the question it could answer, which is how the other stayed invisible.

The correction deliberately leaves the ceilings failing. Re-pinning rides its own commit with a reason written against each number, so nobody can mistake a counting fix for growth.

---

### The Tell Was Already There
`fix(profile): give the split component a boundary, so one chunk stops holding the page` · 2 September 2026 · week 19
<!-- TIER: CHAPTER -->

A component was split out to make the page lighter, and nobody passed it a placeholder, so it got no boundary. The whole page waited instead — the identity card, the tiles and the argument list all behind one file none of them needed.

The evidence was already in the test suite: assertions on a neighbour that was never split had to be rewritten to wait, and that was read as ordinary adaptation. Still open — a failed load takes the whole page down, and only a full reload recovers it.

---

### Press It To Find Out
`AIMODE-1 — the debate .md export becomes the AI mode button` · 3 September 2026 · week 20
<!-- TIER: CHAPTER -->

The label used to say what the control did — download a file. The replacement is two words, and the sentence explaining them hangs off a tip that exists only while it is open. On a touch screen the one way to open that description is to press the control, which is also the thing that starts the download.

So the person who most needed telling a file was coming was the one who could not be told. The explanation moved into the name itself.

---

### Some Of Them Lie
`docs: ADR-0045 + MOBILE-1 plan — responsive read surfaces, mobile auth gate` · 3 September 2026 · week 20
<!-- TIER: CHAPTER -->

Phones and tablets get readable pages and a wall at signup. Except that a tablet can deliberately report itself as a desktop computer, and no check on the server can tell it from a real one without turning real ones away. Recorded as a serious finding, not smoothed over.

Two rounds of review moved the wall earlier. One mechanism spends a scarce identity on a signup meant to be refused; the obvious placement would grant a starting balance to an account nobody can sign into.

---
