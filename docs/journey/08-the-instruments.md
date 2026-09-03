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
