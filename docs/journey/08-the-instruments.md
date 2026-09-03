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

The brief could have lived in a prompt — something you have to remember to supply. A paragraph in the message is something you cannot fail to receive.

The words never change: regenerated per commit they would drift into several hundred slightly different briefs. They instruct reading only; one that instructed behaviour would turn the log into something that gives orders. The moment one class of commit skips it, the guarantee is worth nothing.

---

### A Fifth Say Nothing
`docs(journey): the plain-language companion — eight acts, 340 entries` · 18 August 2026 · week 17
<!-- TIER: CHAPTER -->

Five commits get no entry. A commit without one here is a decision, not an omission. The act covering the live run is a bridge and nothing else: writing its entries before the window has run would invent the thing the document exists to avoid.

A fifth of the commits behind it explain nothing about themselves. Over half in the first three weeks, one in twenty in the last two. Nobody legislated that.

---

### Followed Before Approved
`docs+test(journey): correct the both-sides commit, guard the discovery path` · 18 August 2026 · week 17
<!-- TIER: CHAPTER -->

One commit was described as outside the convention. It is not. Its message carries the block twenty-nine times, once per squashed commit, and it merged eight minutes before the rule did — from a branch cut while the rule was unmerged. Somebody read it there and applied it with nothing ratified.

One paragraph is the whole route to the notes, and nothing fails if a character goes missing. So the test builds two throwaway repositories and runs whatever that paragraph says.

---

### Forbidden To Fix It
`docs(sync-2): the doc truth pass — two register mints, a retired phase tracker` · 18 August 2026 · week 17
<!-- TIER: GROUNDWORK -->

The pass ran under a rule forbidding it to fix what it found. Ten places where instruction and repository disagree are written down instead. A silent correction teaches nobody anything.

---

### The Login That Never Comes
`docs(spec): §21.9 — the deck gets a spec before a line of code` · 18 August 2026 · week 17
<!-- TIER: CHAPTER -->

Nothing in either specification said how the deck behaves, and the one sentence that came close called it skippable, which on first login it deliberately is not. Written afterwards, the specification would have contradicted the product.

The section records a fact about signing in, not about the deck: a session lasts four hundred days, against a live window of roughly fifty-one. Anything specified for next login fires once, at signup.

---

### Wrong Twice, Same Shape
`docs(runbook): the staging precondition tests content, not directions` · 18 August 2026 · week 17
<!-- TIER: CHAPTER -->

A rejected push was taken to mean the rehearsal branch held something of its own; it does not, and that rejection happens routinely. Its replacement counted differences in two directions and failed on its first real run — a hundred and forty-one additions that were only the old text of edited files, read backwards. Both named a symptom and treated it as the property.

So it stops counting. Two commands ask the question directly, at both places the wrong one had reached.

---

### Closed On Card One
`feat(onboarding): the deck — a first-login gate that cannot be dismissed` · 18 August 2026 · week 17
<!-- TIER: CHAPTER -->

The right place to record that somebody has seen the deck was a column on the person: once per human, not once per browser. It was rejected on cost, the better option in plain view — a migration, a spec row, a review gate, for a fact nothing else reads. A cookie holds it instead.

The mark is written at the end, never at the open — otherwise it records somebody as having read rules they closed on card one.

---

### Nothing Lived Only There
`chore(onboarding): log session — O1-DECK closed, merged, staging returned to main` · 18 August 2026 · week 17
<!-- TIER: GROUNDWORK -->

Overwriting is where this project has lost work. What authorised this one was not whether the push would be refused, but whether anything existed only on the rehearsal branch. Nothing did.

---

### Making The Reference True
`docs(plan): land O1-DECK — the plan the execute ran from, which never reached main` · 18 August 2026 · week 17
<!-- TIER: GROUNDWORK -->

The log cites its plan by a path resolving to nothing; the plan sat on a branch nobody proposed. A governing document unreadable from the tree it governs is a claim, not a control.

---

### One Person, Two Units
`VIEWS-1: header label visitors -> views (SPEC.1 §21.1 rider)` · 19 August 2026 · week 17
<!-- TIER: CHAPTER -->

The counter goes up once per page load. It carried a word that names people, and one person moving between pages took it from 813 to 814.

Of the three words available, only one names something this mechanism can produce; another names a session metric, which would mean persisting an identifier it deliberately refuses to hold. Everything underneath keeps the old name, the stored key included — renaming that would zero the number the word describes.

---

### The Note Argued Back
`VIEWS-1c — the docblock says what the label says` · 19 August 2026 · week 17
<!-- TIER: CHAPTER -->

The label changed; the comment above it did not. That comment opens by citing the rule it now contradicted — a false claim about a governing document, in the sentence that names it.

The noun was the unasked fix. The comment called this total page visits; a visit is a session metric, and this counter holds no session identifier and deliberately cannot acquire one. Five internal names keep the old word on purpose.

---

### Measured, And Wrong
`VIEWS-1d — the squash SHA, and the O-11 that was never missing` · 19 August 2026 · week 17
<!-- TIER: CHAPTER -->

The brief said a standing rule had been cited but was not on disk. It was — in the very tree the earlier report says it measured. We went looking for the stale copy that would make the claim true. There is none.

What is protected is the standing of the word measured. The brief paraphrased the rule instead, and six clauses did not survive — including the ones that matter when a session dies mid-run.

---

### Zero Looks Like Failure
`feat(shell): the GitHub star control — and the 0-vs-unavailable contract` · 19 August 2026 · week 17
<!-- TIER: CHAPTER -->

The repository is public and nothing in the product pointed at it; the header gets a link, and a count.

Zero is a real answer, a failed read is another, and zero is what the language reads as nothing. Collapse them and the header reports a failure whenever the count is genuinely zero — which it is today, so the bug ships looking correct. Two tests hold the line from opposite sides.

---

### There Was No Ladder
`feat(onboarding): the deck's visual pass — a measure set by the copy` · 19 August 2026 · week 17
<!-- TIER: CHAPTER -->

Asked for one step up the size ramp: there is no ramp. The design language leaves it blank and the contract says it is not a slot, so a step up an imaginary ladder is an invented number wearing a ruling's clothes. The sizes stand and the reason is recorded.

The width did move: the first card's argument broke five clauses mid-thought, so the copy set the measure instead of the frame.

---

### Right Outputs, Wrong Reason
`feat(shell): the star count reads compact, and the rounding that reads as a defect` · 19 August 2026 · week 17
<!-- TIER: CHAPTER -->

GitHub shortens the number at a thousand, so the header does too: follow the link and the shape matches. What gets read aloud keeps every digit, being under no width pressure.

The ruling that asked for this said the shortening chops digits off. It rounds. The one setting that chops contradicts another of the ruling's own examples. The five outputs it named hold; only the explanation changed, into a measurement.

---

### Not The Same Unit
`SYNC-3 · the scale premises — the four sizings that hung off a concurrency number` · 20 August 2026 · week 18
<!-- TIER: CHAPTER -->

The target moved: a hundred thousand signups, two million page loads, no spending ceiling for the live window. The old figure was five thousand at once; the new ones are totals across fifty-two days.

Calling the old number falsified would have been tidy and wrong. It still holds — that averages under half a request a second. What fails is the four sizing decisions that leaned on it, and those reopen.

---

### The Reviewer Never Saw It
`SYNC-3 · CLOSE — the namespace ruling, and a Gate C exception on the record` · 20 August 2026 · week 18
<!-- TIER: CHAPTER -->

A change merged after three rounds of review without its diff ever reaching the reviewer. The approval was not careless: a path list that never left the documents, a green run named by identifier, every changed byte quoted in two reports.

They hold only because there was no behaviour to reason about — precisely the condition that will not hold next time. It goes on the record as an exception. An undocumented one becomes the way things are done.

---

### Counted, Not Computed
`SYNC-4 · SWEEP — the ADR index rebuilt to the files on disk` · 20 August 2026 · week 18
<!-- TIER: GROUNDWORK -->

Every count was read off the table. Arithmetic reproduces your assumption; reading reproduces the table. The note warning the count was stale had itself gone stale twice, once inside eleven days.

---

### Anonymous On The Way Home
`fix(auth): issue the participant session on F-AUTH-4 Continue` · 21 August 2026 · week 18
<!-- TIER: CHAPTER -->

Accept the terms, get sent home, and arrive as nobody — every new arrival signed in twice. It was in the specification, and a decision record had already named it as wiring never done. Two review passes turned up four more faults, one of which this fix would otherwise have introduced itself. A fifth is flagged and left alone: an earlier ratified decision now carries higher stakes than when it was made, and reversing it is out of scope here.

---

### The Carousel That Never Spun
`feat(discovery): the market-detail header reads a second row` · 21 August 2026 · week 18
<!-- TIER: CHAPTER -->

A market page and the tile linking to it drew on one read, so a market with more than one image showed the same one at both sizes. The page gets a read of its own; the tile is untouched to the line. The specification described a carousel advancing through every image, and no build ever shipped one; it now describes the single picture that exists. The carousel is deferred, not dropped.

---

### An Agreement That Was Wrong
`chore(onboarding): log session — O1-DECK-R2 closed, merged, staging returned to main` · 21 August 2026 · week 18
<!-- TIER: GROUNDWORK -->

Two lanes amended the spec from one base and minted the same version. Identical, the line merged silently; only the date beneath was flagged. A conflict display cannot show an agreement that is wrong.

---

### Unreachable By Construction
`feat(lots): a holding stops being one number with nothing beneath it` · 21 August 2026 · week 18
<!-- TIER: CHAPTER -->

Ten steps land as one commit, deliberately. Between the step that mints the pieces of a holding and the step that can sell them, the tree holds pieces nothing can reduce — and merged one at a time, that state would sit in the history for somebody hunting a bug to land on.

Two documents claimed a safety net that does not exist. Both now say the true thing: a comment that reads as protection is worse than none.

---

### Both Halves Were Wrong
`fix(lots): the CHECK says how big a lot may be, not which way it may move` · 22 August 2026 · week 18
<!-- TIER: CHAPTER -->

A comment claimed two constraints enforced a direction, and that this was stronger than comparing against the previous value, which storage supposedly cannot see. Both halves were false, and the second was disprovable by opening a file already in the repository. Nothing stops the number climbing back up.

The sentence sat in six places, and a correction had already been aimed at it. The search that went looking was line-based and the sentence wraps, so it reported absence and meant silence.

---

### Rescued Before The Reset
`feat(composer): bring the image slot back onto the branch everything is cut from` · 22 August 2026 · week 18
<!-- TIER: CHAPTER -->

Three changes were merged into the rehearsal copy, never into the main line. They work; the problem is where they live. The mirror had started holding what the original never had, and the reset that rebuilds it does not ask — it wipes and regenerates, and whatever lived only there is gone, with nothing to say it existed.

Not a feature. The same three changes copied across word for word, and the only checkable claim is that the two now differ by nothing.

---

### Nobody Would Be Told
`chore(lots): log session — MERGE-1, the cascade that ran late and what it found` · 22 August 2026 · week 18
<!-- TIER: GROUNDWORK -->

There is no way back to the eight markets: nothing reads the snapshot recording them. The rebuild does not merely empty them — it creates fifteen fixture markets instead, and its checks go green doing it.

---

### Two Ways To Say Nothing
`fix(bets): one spelling per meaning on the sell wire` · 22 August 2026 · week 18
<!-- TIER: CHAPTER -->

Two ways of saying no argument in particular were both accepted, and they fingerprint differently: one request, two identities under a single key. A retry reaching for the fuller form misses the cache and is told the key was reused, which a client may read as an instruction to pick a new one, turning a completed sale into a second one. Only a test ever sent the wider form. It is inverted rather than deleted: a narrowing resting on nothing gets generously widened back later.

---

### Five Rows We Cannot Read
`docs(parked): the LOTS-1 arc's unpaid rows` · 22 August 2026 · week 18
<!-- TIER: CHAPTER -->

Twelve unpaid items lived in reports the main line has never held. Five cannot be summarised: the document defining them is absent, reachable only through somebody's downloads folder. Writing five plausible summaries would have looked more useful and been wrong. The row records the register as unreachable; that is the finding.

A surprise found on the way: the gate guarding production is stuck on a hash that no longer matches, because somebody edited a comment saying never to edit the file it sits in.

---

### Measured Against Almost Nothing
`chore(perf-1): re-verify region fix, correct the Discovery gauge` · 22 August 2026 · week 18
<!-- TIER: CHAPTER -->

A fix is verified against the tree it was measured on, and more had landed since. So: checked again, three ways, against what the rehearsal site serves today. It caught its own gauge — the quoted timing measured the page frame arriving, not the ranking work behind it. A new item admits every measurement, this one included, ran against about ten bets and ten comments, so the work being timed barely ran.

---

### The Slot Stayed Bought
`fix(ranking): rank follows the money that stayed, not the money that came` · 22 August 2026 · week 18
<!-- TIER: CHAPTER -->

The top of a debate could be bought and then refunded. There is no fee on the round trip: a large reply took the best-argument slot, exiting returned all but dust, and the ranking read on from a stake nobody was standing behind. Three rulers read that number, one named in no document, and in a young market it decides the whole order. The same capture lives on the counting side, written up rather than fixed — not a four-in-the-morning call.

---

### The Table Outlives The Feature
`chore(unwire-1): remove the bookmark module and the Profile Dharma graph` · 22 August 2026 · week 18
<!-- TIER: CHAPTER -->

Two finished features come out on a ruling: the bookmark surface entire, and the graph on the profile. Eleven thousand lines gone. The table behind bookmarks stays, deliberately; the record says it is kept and does not say what for. A download control bundled with the bookmark icon is lifted out and preserved unchanged. Three references to the deleted code were ones no merge could flag.

---

### Two Edits Not Made
`docs(amend-1): record UNWIRE-1 and amend the clauses it supersedes` · 22 August 2026 · week 18
<!-- TIER: CHAPTER -->

Paperwork catching up with a deletion: one decision record retires another, and the specs are brought level with what shipped. Eight amendments were asked for. Two name text that does not exist in the form the request assumed, and are left untouched rather than guessed at. Stale references outside the brief were reported rather than quietly swept — neither omission nor over-reach being the ask.

---

### Confess The Late Fixes
`docs(overnight-run): removing the operator relocates the checking` · 23 August 2026 · week 18
<!-- TIER: CHAPTER -->

A rule about how work gets checked belongs where people already read, not in an attachment somebody must remember to bring. So it lands in the repository, byte for byte. The change is a removal: the reviewer used to be re-run over its own fix, dropped for costing too much time. What replaces it is confession — the session flags every fix written after the reviewer that would have caught it, and the gate reads those first.

---

### You Argued There
`feat(profile): POSREV-1 — the Positions surface counts arguments, not markets` · 23 August 2026 · week 18
<!-- TIER: CHAPTER -->

The holdings table answered which markets you are in. What people did here was argue: three arguments behind a market collapsed to one row carrying one number. Now the unit is the argument, one tile each. Exited markets come back in, dropped for having nothing left to value, which stops mattering once the row carries no value. Pricing each tile by its own sell quote was refused: the parts would sum to more than the whole, on the surface built to stop that.

---

### Invisible, Not Absent
`feat(profile): give the tile its height back and let it say where it is` · 23 August 2026 · week 18
<!-- TIER: CHAPTER -->

A week earlier the table gained a header naming each market once, not once per argument. Right instinct, wrong trade — it ate a band of height from every group, so it goes and the question returns inside the tile. Nothing else records the cost: the market totals rode that header and now appear nowhere, while the arithmetic making them sum is untouched. The parent went invisible, not absent. An unmoved position gets a sign meaning neither direction.

---

### Nothing To Divide By
`feat(profile): make the sell field look editable and the delta say which way` · 23 August 2026 · week 18
<!-- TIER: CHAPTER -->

Green and red were proposed for direction and refused — the surface is monochrome by ruling — so a trending mark carries it alone, with the direction in words too, for anyone who cannot see it.

Two cases deliberately get no percentage. A holding that has not moved shows a dash, not a nought: no movement is a different fact from movement that rounds to nothing. One whose recorded cost has been rounded away has nothing to divide by, and invents no denominator.

---

### A Refusal Read As Agreement
`chore(scripts): S-1 Gate-C follow-ups — the two instruments S-5 needs` · 25 August 2026 · week 18
<!-- TIER: CHAPTER -->

An instrument had its signal inverted, so a connection being handed around read as pinned. It was believed twice, on separate days, before anyone doubted the tool rather than what it pointed at. It now carries its own control, run before a quiet screen is allowed to mean anything.

The same commit strikes a page of guarantees nobody had: the endpoint that would confirm them answers with a refusal, and a refusal had been read as agreement for eleven days.

---

### Missing Looks Like Chosen
`fix(db): transaction-pooler migration behind DB_POOLER_MODE (S-1)` · 25 August 2026 · week 18
<!-- TIER: CHAPTER -->

The obvious shape — the new setting if present, otherwise the old — is the one thing forbidden here. It makes a setting somebody forgot to create identical to one somebody chose, so the environment would run against the wrong thing while every check reported fine. The mode is named outright instead; an absent value stops the run and names itself.

The plan this ran from had gone stale, and would have walked its reader into diagnosing success as failure.

---

### Empty Either Way
`chore(scale): S-1 close-out — the log, and the §3.3 install step` · 25 August 2026 · week 18
<!-- TIER: GROUNDWORK -->

A check planned as a dashboard reading closes without one: the database cannot say which route a connection takes, and the setting reads empty whether set or not. A count that looked decisive no longer settles anything.

---

### A Colour And An Animal
`PFP-Migration` · 26 August 2026 · week 18
<!-- TIER: GROUNDWORK -->

An identity becomes a colour and an animal, with a picture to match. The record does not say why: two subject lines and three copies of the same signature.

---

### The Cheaper Wrong Guess
`feat(ui): INFO-1 — one gloss per term, on an affordance that works on a phone` · 26 August 2026 · week 18
<!-- TIER: CHAPTER -->

Two pieces each do half the job: one opens on hover and never on tap, the other on tap and never on hover. Which one appears is decided per reader, and unknown defaults to the phone — a phone handed the hover one cannot open it, a desktop handed the tap one still works.

One control keeps the old hint: its click opens a modal that hides the page, leaving the gloss no window to open in.

---

### Right And Redundant
`Ritam-s4` · 26 August 2026 · week 18
<!-- TIER: CHAPTER -->

The front page asked the database ninety-seven questions every time it loaded, all correct, and all the same for everybody looking. So it stops asking and hands out one copy.

Two things stay out of it. Price, because a stale one misquotes what a bet will cost. And the plain-text export of a debate, which a standing decision forbids caching: a cache is a window in which content just removed keeps being served.

---

### Removed And Still Serving
`fix(cache): S-4 F1–F8 — the invalidation fixes #405 merged without` · 27 August 2026 · week 19
<!-- TIER: CHAPTER -->

A branch was squashed while its own review fixes sat uncommitted, so what landed was the reviewed design with the reviewed defect still in it.

The call that clears the cache when a comment is removed set the content to expire in a year, and clearing only removes what has already expired. A moderator removing something got a success, and the removed text kept being served — live as the repair is written.

---

### The Dot Stays Put
`feat(chart): CHART-1 — the market price chart, concluded` · 27 August 2026 · week 19
<!-- TIER: CHAPTER -->

The two lines are labelled where they end rather than by a key, which breaks on a market with no bets: identical prices, colliding labels. Every market starts there.

The labels get pushed apart; the dots do not. A moved label is still unambiguous beside its dot; a moved dot is a false statement about a price. Where the two lines are the same line, they are drawn as one — separating them to look tidier would invent a difference.

---

### A Trailer For The Terms
`RESO-1 — four blocks, relocated bar, no criterion excerpt` · 27 August 2026 · week 19
<!-- TIER: CHAPTER -->

Two clamped lines of the terms of a bet were a trailer for a document the page will not open. They go. Four empty, unclickable blocks replace them: the destinations do not exist, a resolver name has no column, and a closing date is market content this project refuses to invent.

The rail shipped empty anyway: asking whether a chart exists is not asking whether the object describing one exists.

---

### Something Needed Not Adding
`CRIT-1 — the resolution criterion returns to /m/[slug], collapsed` · 27 August 2026 · week 19
<!-- TIER: CHAPTER -->

The terms a participant stakes against appeared nowhere on the market they bind — only as a download. They come back, collapsed.

The brief ruled one attribute onto the panel and called it the whole point. It is never cleared when a panel opens, so clicking would have done nothing, and every screenshot shows the closed state. Nothing needed adding.

The claim that page search reaches the hidden text is recorded as an inference, not a measurement. We had measured our own earlier click.

---

### Renaming An Unchanged Picture
`Ritam-r2` · 27 August 2026 · week 19
<!-- TIER: CHAPTER -->

A signed link carries a timestamp, so asking twice gives two addresses for one picture; browsers cache by address. The market page refreshes every fifteen seconds, so a picture nobody touched was fetched two hundred and forty times an hour per open tab, and paid for each time. Signing was never the cost. Renaming was.

Two things are deliberately left alone. Profile pictures already work by a simpler route; making them consistent would only endanger the one that is fine.

---

### Nothing Underneath
`latest final caching part` · 28 August 2026 · week 19
<!-- TIER: GROUNDWORK -->

Six files change and the message is the subject line: nothing about what was cached, or why. By then every commit was meant to carry its own account.

---

### Held By The Same Receipts
`RESO-2 + RESO-3 — proportions, labels, criterion disclosure removed` · 28 August 2026 · week 19
<!-- TIER: CHAPTER -->

The terms of the bet leave the page on a founder ruling: a closed row on a one-screen page costs the debate height it needs. The component stays, unrendered, its guards inverted rather than deleted, so the removal is held by the same receipts that held the mount.

A column that does not render left a gap the blocks spread into. Reserving the space and rendering the thing that fills it make the same pixels and different futures.

---

### Each Waiting For A Second
`S-3 · Fix Google OAuth signup connection deadlock` · 28 August 2026 · week 19
<!-- TIER: CHAPTER -->

Four unauthenticated requests could wedge an instance, and a wedged instance answers nothing. Signing up held one pooled connection while a step inside it asked the same four-slot pool for a second — four at once, each holding one and waiting for another. Nothing ended it.

The ceiling is deliberately not raised: the deadlock fires at whatever the limit is, so a bigger pool moves the line and keeps the fault. The cost is stated: signing up is no longer one indivisible write.

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

All four block labels were clipping. The square took its size from the height of the block and paid for it out of the width — two numbers from different places, so a decision about how tall something is spent a budget nobody was watching.

The column is forty-eight pixels now because that is what the longest label needs: somebody decided it. The guard holding the old shape is flipped rather than dropped, and both reversals are written down.

---

### Narrower Than Promised
`CHART-2 — the chart's line ends, and the aspect lock CHART-1 broke` · 29 August 2026 · week 19
<!-- TIER: CHAPTER -->

The two words at the line ends lived inside a drawing three surfaces stretch differently, so a label declared at ten pixels arrived at just over four. They are plain text beside the plot now, where ten means ten.

The plan said pulling them out would hand the plot back the width it lost. It got narrower: a legible label needs more room than a squashed one. Three places written to the optimistic version are corrected where they stand.

---

### The Same Drawing Sixteen Times
`feat(art): WARLI-1 — an interactive Warli-inspired hero (unmounted)` · 30 August 2026 · week 19
<!-- TIER: CHAPTER -->

The ring is not sixteen designs but one body drawn sixteen times, differing only in the angle of the limbs and what is in the hand — the argument put into the code rather than a caption. Four carry nothing and are told apart by pose alone: the harder half to draw, and the half worth keeping, because a ring where identity is only ever an object would say people are what they hold — a smaller idea.

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

Nine changes on a branch. Two travel. Six revert for reasons unrelated to code quality, and one waits on a measuring tool that does not exist. The branch stays frozen — not merged, not rebased — as the record.

The new test earns its place by being broken twice. A blunt break reddens a neighbour too, and a break several guards catch says nothing about which caught it; the subtle one leaves it the only red in the repository.

---

### Corrected, Not Unfinished
`docs(parked): file WARLI-3 — the composition notes, before they stop being true` · 30 August 2026 · week 19
<!-- TIER: CHAPTER -->

The gap between ring and field looks like something nobody finished. It is the opposite: the placement treated a figure as a disc around its feet, when it is drawn upward from them, so correcting it pushed the field out. Written that way, the next person fills the gap; written as a gap, they shrink the clearance and put the crowd back on top of the field. Five such notes, filed while they are still obvious.

---

### The Reading Looks Healthy
`docs(registers): land the WARLI verification lessons, and say who wrote them` · 30 August 2026 · week 19
<!-- TIER: CHAPTER -->

Three lessons, one shape. A check whose two sides share a source agrees perfectly while the error reaches both. An instrument returns a plausible number for a load that cannot be cheap. A renderer stays deterministic while its output changes, because what moved was the input. Every reading looks healthy, and the reason it looks healthy is the defect.

The version block already missing stays missing; its content belongs to somebody else, and backfilling it would be the failure the record names.

---

### One Line For Sixteen Thousand
`Merge pull request #443 — feat/reconcile-staging` · 31 August 2026 · week 19
<!-- TIER: GROUNDWORK -->

Ninety-seven files and sixteen thousand added lines, accounted for by one line naming the lane they came from. What was reconciled, and against what, is not written down.

---

### Labelled Rather Than Gone
`Merge pull request #402 — chore/feed-doc-drift` · 31 August 2026 · week 19
<!-- TIER: GROUNDWORK -->

A plan already overtaken is now marked as overtaken, and a second record lands with it. Nothing is removed to do it — the superseded plan is labelled rather than gone.

---

### The Frame Gives
`Merge pull request #421 — feat/pfp-ui-1` · 31 August 2026 · week 19
<!-- TIER: GROUNDWORK -->

One file, eighty-two lines, and one line to account for them: the avatar takes the shape the asset already has. The container gives, not the picture.

---

### Say It In The File
`Merge pull request #442 — chore/poll-jitter-strictmode-note` · 31 August 2026 · week 19
<!-- TIER: GROUNDWORK -->

A deliberate randomness in when the page asks for fresh data is swallowed while you develop, and nothing says so. Ten lines in one file say it instead.

---

### Neither Lane Could See
`Merge pull request #446 — chore/register-1` · 31 August 2026 · week 19
<!-- TIER: GROUNDWORK -->

Two streams of work were handing out the same numbers to different things. Which numbers, and for what, the record does not say — only that the chart side moves. Twenty files change.

---

### It Said Leave Unmerged
`Merge pull request #448 — feat/warli-mount` · 1 September 2026 · week 19
<!-- TIER: GROUNDWORK -->

The line this merge carries ends with a marker saying not to merge. It was merged anyway. The artwork goes up on the sign-in pages, and the cost it was supposed to have is measured.

---

### A Noun Came Along
`Merge pull request #447 — feat/block-1-resolution-content` · 1 September 2026 · week 19
<!-- TIER: GROUNDWORK -->

The four resolution blocks get wired to their content, and a noun belonging to another piece of work is renamed on the way past. Twenty-three files; the record is one line.

---

### What Was Done, Not Why
`Merge pull request #449 — block-b-t3-image-optimize` · 1 September 2026 · week 19
<!-- TIER: GROUNDWORK -->

Pictures get made smaller in the browser. The body under this merge is one line, and it says what was done.

---

### Let The Edges Go
`fix(art): fit the artwork by filling the frame, not by shrinking it into one` · 1 September 2026 · week 19
<!-- TIER: CHAPTER -->

One fix was never on the table: stretching the drawing to the shape of the window would fit any viewport exactly and turn the rings into ellipses, the one thing this drawing cannot survive.

On a phone the composition had collapsed into a band behind a card wider than the outer ring. The border bands now leave the screen — a judgement rather than a bug, and one attribute, so a disagreement reverts one line.

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

Two test comments carry an example of styling syntax, and the style scanner cannot tell a comment from code — so it tried to build real styling out of placeholder dots. The durable fix waits: six days from freeze, a two-line unblock does not touch build settings.

---

### Taller Meant Narrower
`BLOCK-3 — resolution block refinements` · 1 September 2026 · week 19
<!-- TIER: CHAPTER -->

A panel took its width from the header's height, so a taller window left the text beside it less room, not more. On a narrow screen it wanted more than the whole row and the text column went to zero. Width now comes from the row.

Every value's type size had been fitted against a column a later change in the same task widened. Nothing broke — a wider column only lets more fit — and every size was fitted again anyway.

---

### Didn't Want To Oversell
`feat(scripts): the frontend bundle instrument (HO-T4)` · 1 September 2026 · week 19
<!-- TIER: CHAPTER -->

An instrument for weighing what a browser must download. Two watching services are forty-three per cent of what every page carries — established by pulling them out, remeasuring, putting them back, and checking the file matched. Wrapping a component so it loads later does not automatically shrink a page: one attempt made its route heavier, the wrapper costing more than the component saves.

Nothing here rebuilds, so the check compares committed numbers rather than measuring again, and says so.

---

### Correct By Coincidence
`CHART-6 — the labels travel with their dots; the window contains its data` · 1 September 2026 · week 19
<!-- TIER: CHAPTER -->

For two weeks every rehearsal market drew its opening price outside the picture: the window began four days after the data. A window narrower than its data does not error, does not warn and reddens nothing — it just stops drawing.

The end label's position was a constant and its dot's came from the data. They agreed only while the line reached the plot's right edge. Once it stopped, labels drifted up to nine-tenths of the plot from their marks, nothing red.

---

### Three Free, One Not
`BLOCK-4 — every resolution block is one line` · 1 September 2026 · week 19
<!-- TIER: CHAPTER -->

Three of the four second lines said nothing the first did not. The fourth was the time of day trading stops on the closing date, recorded as a real subtraction rather than filed beside the free ones.

The row's height had never been its contents — it was whatever the neighbours left over, which was the point when these blocks were empty chrome. That ruling is reversed, written into the declaration it contradicts.

---

### Six Holes In The Checks
`CHART-7 — marks left, one-line label, calendar anchors` · 1 September 2026 · week 19
<!-- TIER: CHAPTER -->

An audit found nothing wrong with the chart and six holes in the checks around it, each proved by breaking the code and watching the suite stay green. Five are one thing said twice: a position asserted, and whatever makes it mean anything not.

Review also caught a two-character change we had defended at length: moving a column of numbers to the other side deleted the gap beside them rather than moving it — padding and alignment no longer on opposite edges.

---

### The Instrument Said No
`feat(profile): code-split PositionsTable via next/dynamic (HO-T5)` · 1 September 2026 · week 19
<!-- TIER: CHAPTER -->

One page sheds twenty-two kilobytes. The number that matters is that what every page shares is unchanged to the byte, so nothing was quietly moved onto the surfaces that never asked for it. An earlier reading said otherwise, taken against an old measurement rather than a control.

The other candidate was tried twice, made its page heavier both times, and ships unsplit. The guard forbidding this is not deleted — it names one exception and refuses everything else.

---

### A Deletion That Claims Nothing
`feat(chart): remove the post nodes, and everything that existed only for them` · 2 September 2026 · week 19
<!-- TIER: CHAPTER -->

A ruling takes the circles marking each side's top argument of the day off every surface. The delete goes further up than the drawing: the selector goes too, or it would keep walking the whole ranked list on every read with nothing rendering the result.

The chain stops there. The database trips do not move — twelve cold, two warm, measured on both sides. What was saved is work inside a read already paid for, and that is all the record claims.

---

### Describing It Broke It
`test(design): compile the stylesheet in CI, because nothing here ever did` · 2 September 2026 · week 19
<!-- TIER: CHAPTER -->

Every route died in local development for twenty-plus commits and every gate stayed green, because none compiles a stylesheet. Found by a person running the app by hand — not a control. The cause was a comment: the scanner searches plain text, so an example written to explain a test became a real, broken rule.

Writing the guard broke the build again on its first run. Its own explanation quoted the thing it catches.

---

### The Explanation Was The Defect
`chore(docs): SYNC-5 — repair every measured-fact document the tree had outgrown` · 2 September 2026 · week 19
<!-- TIER: GROUNDWORK -->

Reviewers found defects in the repair. Every number was right; the wrong part was always the sentence bolted on to explain one. The logs were left uncorrected on purpose — correcting one destroys what it is for.

---

### Reconstructions That Say So
`NIGHT-1 — three logs never written, and the distance to production` · 2 September 2026 · week 19
<!-- TIER: CHAPTER -->

Three sessions merged and left no log. They are written afterwards from what survived, and each says in its own words that it is a reconstruction, naming what a real log would have held that it cannot. One cannot establish whether its review ran.

The distance nobody had written down: production serves a build from the second of July, three hundred and sixteen commits back. Every gate this project has measured was measured on staging.

---

### Nobody Else Showed Up
`fix(ranking): a post attracting its own author is not attracting anything` · 2 September 2026 · week 19
<!-- TIER: CHAPTER -->

The counts that rank a debate run over rows that can never be removed, so unlike money they cannot fall. Post at the minimum, reply to yourself enough, take the top slot, sell out, get the stake back. Measured: a ten-Dharma post beat a hundred-Dharma one.

Letting the counts decay was available and refused: a number that drops when someone leaves says the argument was never made. So a self-reply keeps its stake, and loses only its claim on anyone's attention.

---

### An Empty Box Looks Deliberate
`BLOCK-5b — the block gets its glyph, and the plate stops being a colour` · 2 September 2026 · week 19
<!-- TIER: CHAPTER -->

Thirteen marks arrive, one per kind rather than one per market, each baked onto a plate of slightly different grey. Untouched, eight of the thirteen would have shown a square inside the block — worse than the empty box they replace, because an empty box at least looks deliberate. The plates are keyed out, not repainted: they were never part of the mark.

The colour check is handed a coloured image and must reject it: thirteen already-grey files would pass a blind one.

---

### Blind And Long Enough
`fix(design): the CSS guard was green for the reason it exists to detect` · 2 September 2026 · week 19
<!-- TIER: CHAPTER -->

The guard proving the stylesheet compiles checked that it was long enough. That floor sits below what the tool emits when it reads nothing, so the scanner could have gone blind and every assertion would have passed — in the file written to be the answer to that failure.

The replacement is a token the test file owns, which reaches the stylesheet only if the scanner has left the source tree. Both findings came from a review still running when the work merged.

---

### Wrong By The Same Amount
`fix(scripts): count the chunks Turbopack actually lists, not the webpack fallback` · 2 September 2026 · week 19
<!-- TIER: CHAPTER -->

The instrument measuring page weight had been reading the wrong list, and every absolute per-route figure it ever gave was four thousand six hundred bytes light. Every comparison still stands — both sides were short by the same chunk — which is how the absolute error stayed invisible.

The correction deliberately leaves the ceilings failing. Re-pinning rides its own commit with a reason written against each number, so nobody can mistake a counting fix for growth.

---

### The Tell Was Already There
`fix(profile): give the split component a boundary, so one chunk stops holding the page` · 2 September 2026 · week 19
<!-- TIER: CHAPTER -->

A component was split out to make the page lighter, and nobody passed it a placeholder, so it got no boundary. The identity card, the tiles and the argument list then waited behind one file none of them needed.

The tell was in the test suite: assertions on a neighbour that was never split had to be rewritten to wait, and that was read as ordinary adaptation. Still open — a failed load takes the page down, and only a full reload recovers it.

---

### Press It To Find Out
`AIMODE-1 — the debate .md export becomes the AI mode button` · 3 September 2026 · week 20
<!-- TIER: CHAPTER -->

The label said what the control did: download a file. The replacement is two words, and the sentence explaining them hangs off a tip that exists only while open. On a touch screen the only way to open that description is to press the control, which also starts the download.

The person who most needed telling was the one who could not be told. The explanation moved into the name.

---

### Some Of Them Lie
`docs: ADR-0045 + MOBILE-1 plan — responsive read surfaces, mobile auth gate` · 3 September 2026 · week 20
<!-- TIER: CHAPTER -->

Phones and tablets get readable pages and a wall at signup. But a tablet can deliberately report itself as a desktop computer, and no server check can tell it from a real one without turning real ones away. Recorded as a serious finding, not smoothed over.

Two rounds of review moved the wall earlier. One mechanism spends a scarce identity on a signup meant to be refused; the obvious placement would grant a starting balance to an account nobody can sign into.

---
