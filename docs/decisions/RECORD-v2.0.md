# ZUGZWANG · DECISION RECORD

**Version** 2.0 · **Opened** 2026-08-23 · **Last ruling** 2026-09-03
**Scope** Hardening decisions for the Experiment phase — go-live 15 Sep 2026, freeze 5 Nov 2026
**Status** 15 numbered · 2 collapsed · **13 live, all ruled** · 2 accepted without measurement · 0 open

> **What this document is.** The standing record of how Hrishikesh has ruled on every
> capacity, cost and degradation question raised during hardening. It exists so that no ruling
> has to be re-derived from a conversation, and so that anyone joining the work — a developer, a
> reviewer, a future session — inherits the reasoning and not just the conclusion.
>
> **Precedence.** SPEC.1 / SPEC.2 > ADRs > this document > tracker. Where this contradicts a
> spec, the spec wins and the contradiction is a finding.
>
> **How to read a ruling.** Each carries the question, the ruling, the reasoning that produced
> it, what it changes elsewhere, and what remains open. The reasoning is load-bearing: a ruling
> whose reasoning no longer holds should be reopened, not applied mechanically.
>
> **How to read v2.0.** Three kinds of ruling appear. *Ruled with reasoning* — the founder
> chose between options on stated grounds. *Delegated* — the founder assigned the decision to
> the dev team; guidance is carried but is not binding. *Accepted without measurement* — the
> founder ruled a capacity question closed while the measurement that would have answered it
> has not been run. Each is a legitimate ruling. The record names which is which so that on
> 5 November nobody mistakes the third kind for the first.

---

## 0 · The docket at a glance

| # | Decision | Settles risk | Status | Ruled |
|---|---|---|---|---|
| **D-0** | Degradation ladder | governs all | 🔒 **FROZEN** | 2026-08-23 |
| **D-1** | Money posture | 4 · 7 · 10 | 🔒 **FROZEN** | 2026-08-25 |
| **D-2** | Moderation throughput | 5 | 🔒 **FROZEN** | 2026-08-24 |
| **D-3** | Signup capacity | 1 · 11 | ⚠️ **accepted without measurement** | 2026-09-03 |
| **D-4** | Bet contention ceiling | 3 | ⚠️ **accepted without measurement** | 2026-09-03 |
| **D-5** | Adversarial posture | 2 | ✅ ruled — no special posture | 2026-09-03 |
| **D-6** | Nov 5 + Nov 6 | 4 | ✅ collapsed into D-1 | 2026-08-24 |
| **D-7** | External ceilings | 7 | ✅ collapsed into D-1 | 2026-08-25 |
| **D-8** | Read caching scope | 6 · 12 | ✅ **CLOSED** | 2026-09-03 |
| **D-9** | Growth bounds | 8 | ✅ ruled — uncapped | 2026-09-03 |
| **D-10** | Observability floor | 9 | ✅ delegated to dev team | 2026-09-03 |
| **D-11** | Identity pool | 11 | ✅ ruled — handled | 2026-09-03 |
| **D-12** | Deploy discipline | 12 | ✅ **ruled — supersedes 25 Aug** | 2026-09-03 |
| **D-13** | Live-window ownership | — | ✅ ruled — founder owns | 2026-09-03 |
| **D-14** | Opening price (SEED-RULING) | — | ✅ ruled — 10/90, provisional | 2026-09-03 |

**The live-window posture, as it now stands — read this before anything else on 15 September.**

| Concern | Who | Ruling |
|---|---|---|
| What breaks first under load | fixed order | D-0: ledger → bet → own markets → browsing → signup → live-ness |
| Capacity decisions | **founder** | D-13: no rota, no escalation path; alarms route to the founder unless the dev team designates otherwise |
| Observability | **dev team** | D-10: delegated; no founder floor |
| Deploys during the window | **dev team** | D-12: permitted at dev-team discretion; Doppler is therefore in the request path on every deploy |
| Infrastructure changes during the window | nobody | D-1: none — sized before go-live, untouched after |
| Moderation | founder via Admin Control Centre | D-2: OpenAI advisory only, zero latency budget |

---

# D-0 · Degradation ladder

**🔒 FROZEN — 2026-08-23**

### The question

When demand exceeds capacity, what breaks first and what is protected last?

### Why it had to be answered first

Before S-1's transaction-pooler flip, overload produced errors — visible, countable, loud. Two
slot-exhaustion incidents (2026-08-07 and 2026-08-16) both fired at ordinary traffic and both
announced themselves.

After the flip, overload produces **queueing** instead. Almost nobody is refused; everybody
waits. That is an improvement in every respect except one: **the system stops telling you it is
in trouble**, and it degrades everyone equally — a participant composing a bet with real stake
behind it waits exactly as long as a bot scraping the landing page.

Unless a priority order is declared in advance, "everyone equally" is the default. D-0 declares it.

### The ruling

| Rank | Tier | Rationale |
|---|---|---|
| **1** | **Ledger integrity** | Append-only. A wrong entry can never be corrected, only followed by an admission. It *is* the Nov 6 dataset. Nothing outranks it. |
| **2** | **Placing a bet, selling** | "No stake, no voice" means every bet carries a written argument. A failed submission does not merely lose a transaction — it loses the thing the participant wrote. |
| **3** | **Reading your own markets** | Someone with money at stake needs to see what is happening to it. |
| **4** | **Anonymous browsing** | *Promoted from 5.* Nobody signs up for something they have not looked at. Browsing produces signup; it is not a lesser cousin of it. |
| **5** | **Signing up** | *Demoted from 4.* Someone who cannot join at 2pm can join at 3pm. Someone whose bet fails mid-composition has lost their argument. |
| **6** | **Live-ness, counters, stars** | Exists to make the room feel alive. **Sheddable automatically, without asking.** |

### The amendment, and why it was right

The ladder was first written with signup at 4 and browsing at 5, on the reasoning that a
participant who cannot act loses more than a visitor who bounces. That reasoning holds between
*betting* and *browsing*. It does not hold between *signup* and *browsing*.

Hrishikesh's correction: **a visitor should not be turned away, because nobody's first instinct
is to sign up — it is to look at the product.** Protecting signup while shedding browsing
protects a door nobody can find.

A second reason became true only after S-4 landed: before caching, protecting anonymous browsing
cost 97 database statements per visitor. After caching, one computation serves everybody.
**Promoting it now costs almost nothing** — which is why it would have been the wrong call a
month earlier and is the right one today.

### Attached condition

**Anonymous browsing is protected while it is served from cache.** An anonymous request that
would cost a fresh database round trip during pressure remains sheddable. Protecting the cheap
form of browsing is nearly free; protecting the expensive form would come directly out of rungs
1–3.

### Sub-rulings

| # | Question | Ruling |
|---|---|---|
| a | Is the ladder correctly ordered? | Yes, as amended |
| b | Is signup promoted by ladder position? | **No.** Signup pressure is answered by S-1 and by capacity, not by reordering |
| c | Does the ladder change during launch week? | **No. Fixed always.** A ladder that bends under pressure is a preference, and will be relitigated by whoever is most stressed |
| d | May devs shed rung 6 without asking? | **Yes, automatically.** A shedding rule that requires a phone call is not a rule |

### What this changes elsewhere

- Developers have a shedding rule they can apply without escalating
- **S-5 must measure time-to-degrade per tier**, not one aggregate — an aggregate can look healthy while betting is already failing
- S-8 knows what it is buying capacity *for*
- Every future "which do we optimise first" argument resolves against this table

### Still open

Nothing. D-0 is closed.

---

# D-1 · Money posture

**🔒 FROZEN — 2026-08-25** · absorbs **D-6** and **D-7**

### The question

When do we buy capacity instead of engineering around the limit?

### Why the normal instinct is wrong here

In an ongoing business, infrastructure spend recurs forever, so efficiency compounds and
engineering time pays for itself.

Zugzwang runs **15 September to 5 November** and the repository is archived on 8 November.
Nothing carries forward. Which inverts the arithmetic entirely:

- **Infrastructure cost is a one-time, ~7-week number.** Doubling it doubles a small number once.
- **Engineering time is consumed and never returns.** An hour making Discovery cheaper is an hour
  not spent on Terms and Privacy, which is still placeholder text and a hard go-live gate.
- **The genuinely scarce resource is the founder's serial attention** — roughly 25 non-
  parallelisable sessions stand between now and go-live, and that is what sets the schedule.
  Every engineering fix consumes a ruling, a plan review, a Gate C read. **A purchase consumes a
  credit card.**

### The trap in "buy it when we need it"

Some upgrades are not instant. A database compute resize involves downtime. Some vendor limit
increases involve a support ticket and a human. None of that is available at 11pm on 5 November
when eight markets are resolving and everyone is watching.

**Reactive buying only works for purchases that are instant and self-serve.** For everything
else, the decision point is before go-live.

Over 51 days the waste from over-provisioning is small and one-time. The cost of
under-provisioning is the experiment. **That asymmetry is not close.**

### The ruling

| # | Question | Ruling |
|---|---|---|
| a | Default posture at a limit | **Buy first. Engineer only where money cannot solve it.** |
| b | Provisioning timing | **Size for the peak before go-live.** No reactive scaling |
| c | Standing authorisation | A monthly ceiling exists; below it, no conversation |
| d | Does buying replace measuring? | **No — buy early, measure to confirm.** Otherwise you have bought a number, not a fix, and you find out on 5 November |
| e | The "money does not apply" list | **Bet contention · moderation throughput · correctness.** These go to a product decision, never a purchase order |

### D-6 absorbed · The Nov 5 freeze

The freeze is not one event. It is four spikes with four different remedies:

| | Spike | Rung | Remedy |
|---|---|---|---|
| 4a | Hours before the freeze — final positions on all eight markets | 2 | D-4's question, not a purchase |
| 4b | **23:59 — resolution.** Every position settles. One shot, no retry | **1** | **Rehearsal, not money** |
| 4c | Minutes after — everyone returns to see results | 3 | Caching (S-4) |
| 4d | 6 Nov — dataset release | 4 | Scrapped, see below |

**Rulings:**

| # | Ruling |
|---|---|
| **4.1** | **Size for 5 November from go-live and never change it.** No infrastructure change during the live window. **No scale-down either** — the experiment ends and everything is switched off |
| **4.2** | **Resolution rehearsal is required before go-live.** Dry run at realistic volume. Folded into testing, dev assigned |
| **4.3** | **Withdrawn.** The ADR-0025 export amendment existed to protect a Devcon-day spike. No Devcon, no spike |
| **4.4** | The pre-freeze betting rush is D-4's question |

**Why 4.1 rejects the obvious plan.** The intuitive approach is to run small and scale up around
1 November. Rejected for three reasons: during the live window there is no engineering lane and
one operator, so a scheduled infrastructure change on the highest-stakes week is itself a risk;
the saving is a higher tier for 51 days instead of 7, which is trivial; and **a scale-up can go
wrong, whereas not doing one cannot.**

**Why 4.2 outranks every purchase on this page.** At 23:59 on 5 November the system settles every
position across eight markets in one operation, writing to an append-only ledger that *is* the
dataset. If settlement fails partway, the ledger is partially settled, on the last night, with no
engineering lane and one operator awake. **No amount of compute rescues a logic failure in a
one-shot operation.**

### Standing principle — post-experiment scope

> **Post-5-November work receives the least effort on the ladder.** The dataset release happens;
> it is untimed and unbound by any external event. Devcon and the 6–8 November window are
> **scrapped entirely**. The `.md` export remains a live product feature throughout the
> experiment.

### D-7 absorbed · External ceilings

**Ten vendors, not four.** The initial list missed Supabase (filed mentally under "the pool"),
and conflated Upstash with Redis. Two kinds of ceiling behave differently:

| Kind | Behaviour | Danger |
|---|---|---|
| **Hard refusal** | A number is hit, the next request is rejected | **Loud.** You know immediately |
| **Soft capacity** | No refusal, everything slows | **Silent** — indistinguishable from "the site feels sluggish tonight" |

**Two traps found by looking rather than reasoning:**

1. **Free tiers from April.** The project began as a solo build. Several accounts were still on
   whatever tier was signed up for on day one — appropriate for one developer, not for 100,000
   signups. Production Supabase was on **Nano**, *below* staging's Micro.
2. **Spend caps as failure modes.** Supabase Pro enables a spend cap by default, and Pro includes
   100,000 monthly active users — **exactly the target number.** A protective setting configured
   in April becomes a switch-off at the moment of success.

**The governing rule that emerged, applied to every vendor since:**

> **Never let a billing control take the site down.** Caps that stop service come off. Alerts
> stay on. A larger invoice is the correct outcome of a surge; an outage is not.

---

## The vendor configuration — as ruled

### Supabase — the only significant purchase

| Setting | Was | Target | When |
|---|---|---|---|
| Plan | Pro | Pro | — |
| **Production compute** | **Nano** (0.5 GB, shared CPU) | **Large — 8 GB, dedicated CPU, $109.22/mo** | Micro today (free) → Large ~1 Sep |
| Disk | 2 GB | **8 GB** (within Pro) | with the Large upgrade |
| Spend cap | **On** | **Off** | before 15 Sep |
| `pool_size` | 15 | Raised **after** Large lands, sized by S-5 | 10–15 Sep |
| Region | ap-south-1 | unchanged | — |
| Staging | Micro | Micro; **Large for the S-5 load-run week** | — |
| Escalation | — | XL ($210) only if S-5 shows CPU saturation, **decided before 10 Sep** | — |

**Why Large and not Medium.** Both give enough memory. Large is the first tier with **dedicated
CPU**. Micro runs on a burstable instance that accumulates credits and throttles hard to a low
baseline when they run out — and sustained load across 51 days is exactly the workload that
drains them. That is the silent cliff: fine for the first hours of launch, then a step down that
no error announces.

**Why the upgrade was decoupled from the migration.** Compute size is independent of data — an
empty Large costs what a full one does. Resizing causes downtime, so doing it after the 10 Sep
migration would mean taking a populated production database offline in the final week. Moving it
forward ~10 days costs about $35 and removes a downtime event from launch week.

**Consequence:** S-8's Large-vs-XL ruling now has a hard date of **10 September**. After the
migration, a resize means downtime on live data.

### Vercel — no upgrade

| Setting | Value |
|---|---|
| Plan | **Pro** — already correct |
| Fluid compute | On — the reason compute is nearly free on an I/O-bound workload |
| Function CPU | **Standard.** S-5 may rule Performance, **decided by 10 Sep** (needs a redeploy) |
| Region | **`bom1`**, verified — PERF-1's entire result depends on it |
| Spend management | **Notifications on · Pause OFF · $200** — already correct |
| Firewall | **Rate limiting + AI Bots blocked — by 5 Sep** |
| Speed Insights | Not purchased |
| Expected cost | $20/mo + edge-request overage |

**Why there is no tier to buy.** Supabase is a fixed machine — when it is full you buy a bigger
one. Vercel is elastic; instances multiply with demand automatically. The failure mode is not
running out, it is **cost**, and **your database** — because more Vercel instances means more
connections against a fixed pool. **Vercel scaling up is how the database goes down.**

**The sleeper: the poll is the Vercel bill.** Pro includes 10 million edge requests; beyond that
they bill $2.00–3.20 per million. Every poll tick is an edge request. At 200 sustained concurrent
tabs that is ~59M across the window (~$100–160); at 1,000 it is ~295M (~$570–900). Compute and
bandwidth are noise by comparison. **The interval halves the bill when it doubles.**

**Firewall design.** Rules go in **Log-only first**, enforced only after observing real traffic
from 10–14 September. Thresholds tuned against a placeholder page are guesses, and the poll
generates a traffic pattern nobody has seen. Tight limits on expensive endpoints (export, OTP
request); generous limits on general browsing; Attack Mode reactive only, never pre-enabled.

### OpenAI — off the ladder

**No upgrade. No purchase. No rung.** See D-2.

### Resend — the one that cannot be bought late

| Setting | Was | Target |
|---|---|---|
| Plan | **Free** — 3,000/month, **hard 100/day cap** | **Pro, 100k slider — $35/mo** |
| Daily cap | 100 | **None** |
| Dedicated IP | — | **No** |
| Warming | Not started | **Begins on upgrade** |
| Cross-provider testing | — | Gmail, Outlook, Yahoo, Apple, regional — **global spread** |
| Timing | — | **This week, not 10 September** |

**Why the daily cap, not the monthly total, is the failure.** 3,000/month sounds survivable. 100
per day means launch day fails at the hundredth signup. Traffic here is bursty by nature; a daily
cap is the wrong shape for it. **Removing the cap is the purchase.**

**The part money cannot buy: three emails sent, all time.** The domain has effectively no sending
history. On 15 September it attempts a burst to Gmail, Outlook, Yahoo and others — a pattern
indistinguishable from a compromised domain. Providers do not bounce that mail; they route it to
spam or silently drop it. **Resend reports success. The app reports success. The user sees
nothing.** OTP silent-failure is already a confirmed go-live blocker in a smaller form.

Warming is the fix, it takes weeks, and it needs the daily cap removed first. **This is why the
upgrade is dated this week rather than 10 September.**

**Correction logged:** an earlier draft of this analysis assumed India-dominant traffic and
therefore Gmail dominance. **The project is global.** Corrected — cross-provider testing spans
providers, not one market.

### Google OAuth — $0, and currently broken for the public

| Setting | Now | Target |
|---|---|---|
| Publishing status | **Testing** — only listed test users can sign in | **In production** |
| User type | External ✅ | unchanged |
| Scopes | **unconfirmed** | `openid`, `email`, `profile` only |
| Verification | n/a | **Not required** if scopes are basic |
| Token grant rate | 10,000/day, raisable | fine |
| Cost | $0 | **$0** |

**The failure nobody would detect by testing.** Publishing status is Testing, so only explicitly
listed test users can sign in. It works perfectly for the operator and fails for everyone else.
**A working sign-in and a publicly available sign-in are indistinguishable from the inside.**

Google's documentation is clear that an app requesting only non-sensitive scopes is not required
to complete verification. **So the remedy is probably one button, not a review queue** — but that
hangs on the scopes, which must be confirmed before publishing.

⚠ The 100-user cap that applies to unverified apps with sensitive scopes is **lifetime and
non-resettable**. Currently at 1 of 100. Do not burn it before the scope question is settled.

**Correction logged:** an earlier escalation claimed LEGAL.1 was blocking OAuth verification.
Probably wrong — with basic scopes no verification is required. LEGAL.1 remains a go-live gate on
its own merits.

### Cloudflare R2 — $0, with two code items

| Setting | Value |
|---|---|
| Plan | **Free tier**; R2 Paid active, card on file as insurance |
| Storage forecast | ~4.5 GB of 10 GB at 100k posts |
| Writes | ~2.5% of the 1M/month allowance |
| **Reads** | **$0 if URLs are cacheable — the only variable** |
| Seeded image ceiling | 100 KB |
| Conversion | **Browser-side WebP, before upload** |
| Expected cost | **$0** |

**The finding: image links change on every render.** `mintImageUrls` signs a fresh SigV4 URL per
image per render. The signature embeds a timestamp, so the URL string differs each time — and
browsers cache by URL. Every 15-second poll tick refetches every image for byte-identical
content. Roughly 240 fetches per image per hour per tab.

Three costs at once: R2 reads, Vercel CPU for the HMAC presigns, and the participant
re-downloading images already on their device. **~$1,100 across the window, plus page weight.**

Fix: memoise the minted URL for 50 minutes against a 3600-second signature. **Nothing about
access control changes — the card is reused, the door is not left open.** Handed off as
`HO-R2MEMO`.

**Why browser-side conversion is the only option, not merely the best one.** Uploads go browser →
R2 directly, and participant PUTs carry `If-None-Match: "*"` — write-once immutability
(ADR-0028 Primitive 1). There is no point after upload at which anything can transform the bytes.
Server-side conversion would require either a second write, which write-once forbids, or proxying
bytes through a function, which the architecture deliberately avoids.

**Staging isolation — fixed 2026-08-24.** Doppler `stg` pointed at production buckets with
production credentials. Corrected: bucket names, access keys, and CORS policies all repointed and
verified by live upload. Root cause was benign — staging buckets did not exist when the CSAM
pipeline was first tested — but the drift had persisted.

⚠ **C-9 outstanding:** production PFPs resolve through an `r2.dev` development URL, which
supports **no edge caching** and is **rate-limited with 429 throttling**. PFPs are 1,000 shared
images rendered on every page — the most-served objects in the product, on the one access path
that cannot be cached. Needs a custom domain before 15 September.

### Turnstile — $0

**Fail closed, with an alert.**

Most products fail open on a bot check — do not let it close the front door. **This product is
different, because every signup consumes one pseudonym from a finite, pre-generated pool with no
mid-window replenishment.** A flood of bot signups during a Turnstile outage burns a resource
that cannot be replaced, and burns it fastest when nobody is watching. Turnstile outages are
brief; pool exhaustion is permanent within the window.

### Upstash Redis — Fixed 250MB

| Setting | Value |
|---|---|
| **Plan** | **Fixed 250MB — ~$10/month** |
| Type | **Regional**, unless a replica is justified |
| Read replicas | **None** — $50 each, and each doubles the command count on every write |
| Primary region | **Must be `ap-south-1` or nearest** ⚠ unverified, **unchangeable after creation** |
| Auto-upgrade | **ON** |
| Commands | Unlimited, to 10,000/sec |

**Why fixed and not Pay-as-You-Go — worth ~$5,000.** Metered billing is $0.20 per 100,000
commands. Rate limiting is ~2–3 commands per request and the poll fires four times a minute per
tab; at 3,000 concurrent that is ~2.2 million commands an hour, or ~$100 a day, or ~$5,300 across
the window. **Fixed plans bill nothing per command.** Pay-as-You-Go suits spiky, idle-heavy
traffic; this workload is the opposite.

**Why 250MB and not 5GB.** Redis here holds counters, not data — rate-limit windows, idempotency
keys, moderation reservations, one visitor tally. Megabytes, not gigabytes. The dimension that
matters is the operations ceiling, and it is **identical across the initial fixed plans** at
10,000/sec against a projected peak near 600/sec.

⚠ **The primary write region cannot be changed after creation.** Rate limiting and idempotency
are writes, and they always go to the primary. If it is not near Mumbai, every bet pays that
latency *inside a `SERIALIZABLE` transaction holding a Postgres connection open* — PERF-1's
failure moved onto the write path, where it is worse. The remedy would be a new database plus
credential change and redeploy: **a real task, not a toggle.**

### Doppler — no upgrade

Not parked with the observability tools, because it can take down every rung at once and in a way
nobody would recognise as a Doppler problem: an unavailable Doppler during a deploy produces an
app with missing configuration that **fails at runtime, not at build**.

**The mitigation is a schedule, not a purchase: no deploys during the live window.** With nothing
deploying between 15 September and 5 November, Vercel holds the already-synced variables and
Doppler is out of the request path entirely.

### Parked — non-user-facing

**Sentry · PostHog.** Deferred by ruling. Two caveats logged:

- **Sentry holds no rung, but its quota exhausts precisely when errors spike** — you go blind at
  the moment you most need sight.
- **PostHog needs one question answered:** if a flag cannot be read, does the feature default on
  or off? If off, a PostHog outage silently removes product surface — which makes it user-facing
  after all.

---

## Running cost

| Vendor | Change | Monthly delta |
|---|---|---|
| **Supabase** | Nano → Large + 8 GB disk | **+$100** |
| **Resend** | Free → Pro | **+$35** |
| **Upstash** | Free → Fixed 250MB | **+$10** |
| Vercel | no upgrade | $0 |
| Cloudflare R2 | free tier | $0 |
| Turnstile · Google OAuth · Doppler | no upgrade | $0 |
| Sentry · PostHog | parked | $0 |
| **Total** | | **~$145/month · under $300 for the experiment** |

**The money was never the problem.** Every remaining risk on the register is a schedule item —
warming, verification, firewall tuning, load runs — and the two with external queues (email
reputation, Google verification) are the two that cannot be bought late.

---

# D-2 · Moderation throughput

**🔒 FROZEN — 2026-08-24**

### The question

Mandatory commentary × pre-commit review × one operator. Which gives at scale?

### The ruling

| | |
|---|---|
| **Mechanism** | The **Admin Control Centre is the moderation system.** Manual review is the real control |
| **OpenAI's role** | An **advisory signal** to that control centre. Already tested. **Not a gate** |
| **Latency budget** | **Zero.** No moderation tooling adds latency to any participant action during the experiment phase |
| **On failure** | The signal stops. **The product does not.** No fallback path, no queue, no degradation |
| **Rung** | **None.** OpenAI is off the ladder |
| **Risk 5** | **Removed from the load register** |
| **Scope** | Covers the OpenAI advisory signal on arguments. **Image and upload paths were not part of this ruling** and do not inherit it |

### Where the earlier wrong model came from — logged because it can mislead again

The repository carries an ADR named `0014-pre-commit-moderation-flow`. Read alongside
"safety-critical", that name produces a picture of a gate content must pass through before being
accepted. **It is not one.**

If that misreading is available from the project material, a developer can make it — and a
developer who believes moderation is a gate will build one, or will defend a synchronous call
they find in the code rather than flagging it. **Worth a documentation pass to make the
non-blocking property explicit.**

### What this changed elsewhere

| | Before | After |
|---|---|---|
| OpenAI | Rung 2, fail-closed, tier-urgent | Advisory. No urgency, no purchase |
| Risk 5 | High severity, "worsens as the thesis succeeds" | Off the load register |
| Vendors on protected rungs | Four | **Three** — Supabase, Vercel, Resend |
| **Bet-path dependencies** | Postgres + Redis + OpenAI | **Postgres + Redis** |

That last row is the structural gain: **the bet path is one vendor shorter**, and the remaining
work on it is entirely about your own database.

### Still open

**One code check, not a decision:** is the moderation call `await`ed before the response returns,
or fired and forgotten? A call can be advisory in intent and still block in implementation. If it
is awaited, the zero-latency ruling is not yet implemented — a small fix, not a design change.

---

# D-8 · Read caching scope

**🟡 PARTIAL**

### The question

What is allowed to be stale, and by how much?

### Ruled

**R3 (v2) — amended, not excepted.**

> Price and pool reserves are **never served stale**. They may ride a cache boundary only where
> the cached value is content-addressed on live reserves such that any pool movement forces a
> miss. **TTL-based caching of price remains forbidden.**

The original wording said "never cached." What was meant was "never served stale." S-4's Design B
keys the cache on live reserves, so a hit is only possible when the pool provably has not moved —
a **stronger** guarantee than a TTL, because staleness changes the key and forces a miss.
Corroborated by measurement: prices byte-identical across cold and warm on all surfaces, to 18
decimal places.

**The tiering test.** The intuitive question — "how often does this change?" — is the wrong one.
The visitor counter changes constantly and does not matter; price changes rarely on a quiet market
and matters absolutely.

> **The question that decides it: what does the viewer *do* with this number?**

| Tier | What it is | Cost of staleness | Budget |
|---|---|---|---|
| **Decision input** | The viewer acts on it | Not a degraded experience — a **wrong action** | **Zero** |
| **Orientation** | Shapes understanding, not acted on directly | A slightly out-of-date picture | Generous |
| **Ambience** | Makes the room feel alive | Nearly free | Very generous |

**Exactly three things fail the test:** the price at the moment of betting, the spendable balance
(feeds the affordability gate), and the current value of a position being sold (feeds the sell
maths). Everything else — arguments, stakes, ranking, Support/Counter, totals, the chart, hero
posts, media — is a picture.

**Where that line falls matters:** the elements carrying K·n > C are all on the cacheable side.
**The thesis is not being traded for capacity.**

**The poll-interval floor argument.** The debate page refreshes every 15 seconds. Recomputing a
value faster than that is work nobody can see. **A floor equal to the poll interval is not
staleness — it is deleting invisible work.**

### The failure mode this exists to prevent

Tag invalidation alone looks strictly better than a time window. It is not, and it fails in
exactly the wrong direction.

Discovery's hero shows all eight markets, so a bet on *any* market invalidates it. At a bet a
second, effective cache lifetime is about one second and **everyone pays close to full cost.**
Peak reads and peak writes are the same moment, so **tag-only invalidation performs worst
precisely when load is highest** — a cache that works beautifully in testing and evaporates at
go-live.

A **minimum window** coalesces writes: fifty bets in thirty seconds become one recompute. The
window is not there to tolerate staleness. **It is there so the cost of a busy market stops
scaling with how busy it is.**

The arithmetic is a 1-over-n curve — going from nothing to ten seconds buys ninety percent of the
available saving; thirty to sixty buys one and a half percent. **The shortest window you are
comfortable with captures nearly all of it.**

### Closed 2026-09-03 — the two remaining questions

| # | Question | Ruling |
|---|---|---|
| a | Floor duration for orientation elements | **Delegated to HARDEN.6** number-tuning. Not a founder ruling. |
| b | Discovery's price bar — preview or decision input? | **Preview.** Floorable at the Discovery floor. |

**On (a), an implementation note carried to HARDEN, not a ruling.** Define the market-page floor
as `POLL_INTERVAL_MS_DEBATE_VIEW`, not as a separate literal. The floor's entire justification is
that recomputing faster than the poll is invisible work; that justification holds only while the
two numbers are equal, and the poll interval is itself still to be tuned. Tie them so they move
together. Discovery is not polled — it is cached per load — so its floor is independent and 30 s
was the recommendation on record.

**On (b), the condition that makes the ruling self-checking.** Discovery's card and hero carry
no bet affordance (design-language §3.2, SPEC.1 §22). Nobody can act on that number without
navigating to `/m/[slug]`, where the price is served live under R3. *If a bet affordance is ever
added to Discovery, that element becomes a decision input and its floor is zero.* The ruling
lapses the day the product changes, and should not be applied past that.

**Why preview and not decision input.** Anonymous browsing was promoted above signup on the
ladder (D-0 amendment) partly because caching had taken its per-visitor cost to near zero.
Ruling the price bar a decision input would put ~8 uncached statements back on every anonymous
visit — reintroducing the cost that justified the promotion.

---

# D-11 · Identity pool

**Ruled 2026-08-24:** finite pool, pre-determined order. **The identity is claimed inside the
transaction that creates the account, at the moment it succeeds** — not when the form opens, not
when Turnstile passes, not when the OTP is sent.

**Why nothing earlier is safe.** Anything that claims before completion leaks slots to abandoned
signups. Over 51 days of public traffic with normal abandonment, that could be a large fraction of
the pool, and it is unrecoverable.

**Pool composition, reconciled.** Two numbers that are both true. The *image* count is 1,000
(clarified 2026-08-24) — uniqueness comes from the name, not the image, and 1,000 shared objects
fill every CDN edge cache within minutes. The *namespace* — the number of assignable identities —
is 50,000 per ADR-0011 (50 colours × 100 animals × 10 numbers). ADR-0011 sized that namespace
against a 1,000–10,000 signup estimate; the target has since become 100,000 (ADR-0038).

**Ruled 2026-09-03 — closed.** Founder: *handled, working.* Exhaustion behaviour is unchanged
from SPEC.1 §13 F-AUTH-3 and is already specified and tested: signup returns a retryable
*"Signup temporarily unavailable; please try again shortly"*; a low-watermark alarm fires at 5%
unassigned (ADR-0007 alarm 5, `pg_cron`); the admin extends the pool.

**Fact of record.** The last documented namespace is 50,000 against a 100,000 target. ADR-0011
mints a numbers-first extension path to 100,000 — ten more number variants per pair, no new image
generation, minutes of compositing. The recommendation on record was to run it before 10
September. If the pool has been extended since ADR-0011, this paragraph should be amended with the
new count; if not, signup 50,001 receives the retryable message and the alarm gives ~2,500
signups of notice.

---

# D-12 · Deploy discipline

**Ruled 2026-08-24 — SUPERSEDED:** no deploys during the live window.

**Ruled 2026-09-03 — current.** *No hard rules. The dev team handles it.* Deploys are
**permitted during the live window at the dev team's discretion.** No founder gate. No
emergency-exception process is needed because no prohibition exists.

**What this changes elsewhere — stated because the original ruling was load-bearing for
something other than deploys.** The 24 August ruling was also what took Doppler out of the
request path for the whole window: with nothing deploying, Vercel held the already-synced
variables and Doppler was never asked for anything. That is why the vendor sweep parked Doppler
at "no upgrade" with a *schedule* as the mitigation rather than a purchase.

With deploys permitted, **Doppler is in the request path on every live-window deploy.** An
unreachable Doppler mid-deploy ships an app with missing configuration that fails at *runtime*,
not at build — the one failure that takes every rung of the ladder down at once, and in a way
nobody would recognise as a Doppler problem.

**Consequence carried, owned by the dev team.** Every live-window deploy verifies secrets sync
before it serves. The option of founder-authorised deploys only was offered and declined; this
paragraph is what stands in its place.

**Cold-cache cost at peak** — the other half of the 25 Aug open item — is unmeasured and is
absorbed into D-3/D-4's accepted-without-measurement posture.

---

# D-3 · Signup capacity — accepted without measurement

### The question

What signup rate do we build for, and what happens above it?

### The ruling

**2026-09-03. Founder: *taken care of.*** Recorded as accepted without measurement.

### The facts of record at the time of ruling

- The signup path deadlocks at **four concurrent users** (record, 25 Aug). The cause identified by
  the 2 Sep load report is the same: a database connection limit of 4, with pages that make many
  sequential calls per visit.
- The 2 Sep load report lists **signups under load — not done.** No signup rate has been measured
  against the real application.
- The report's number-one recommended fix — raise the connection limit — is the same work as S-1
  (transaction pooler) plus the `pool_size` raise sized in the Supabase ruling. S-1 was blocked on
  `DATABASE_URL_TXN` in Doppler `stg` from before 20 August through the date of this ruling.
- 100,000 signups over 51 days averages ~2,000 a day. Launch day is not an average day.

### What this means on 15 September

Signup capacity is whatever the connection-limit raise delivers, unverified. Above it, the
ladder applies: signup is rung 5 and sheds before browsing (D-0). The participant sees the
existing behaviour — waiting, then the retryable message — not a designed overflow state.

### Reopening condition

If a signup-load run is executed before go-live, this ruling should be replaced by its number.

---

# D-4 · Bet contention ceiling — accepted without measurement

### The question

What rate is acceptable on one hot market, and what does a participant see past it?

### The ruling

**2026-09-03. Founder: *tested.*** Recorded as accepted without measurement, with the correction
below stated on the record rather than absorbed.

### The facts of record at the time of ruling

- The 2 Sep load report lists **real writes under load — placing bets and comments at volume —
  not done**, held pending explicit founder authorisation as a new category of database write.
  Bets are writes. No bet-path load has been run.
- A CPMM market serialises its bets by construction (`SERIALIZABLE`, ADR-0013). There is a hard
  ceiling on bets per second on one market. It has not been measured. This remains, in the
  record's own words from 25 Aug, *the only risk on the register that no money and no caching
  can move.*
- D-14 opens every market at 10% YES. A winning NO bet returns ~11%; YES-side action is expected
  to dominate. Contention, if it comes, comes from one side pushing.

### What the participant sees past the ceiling

The existing behaviour, not a designed one: the bet transaction wrapper retries three times with
jittered backoff on serialisation failure, then returns **503** and raises ADR-0007 alarm 3
(`bet_serialization_exhausted`). No product surface exists beyond the error.

### Reopening condition

If a write-load run is authorised and executed, this ruling should be replaced by its number.

---

# D-5 · Adversarial posture

### The question

What do we shed, and what do we let through?

### The ruling

**2026-09-03. Founder: *not important.*** No platform-level shedding posture beyond what exists.

### What exists

- Per-request rate limiting and idempotency on Upstash (ADR-0015).
- Turnstile on signup — staging on the always-pass test key; production hostname list
  unverified (Appendix A).
- Per-market adversary models in each campaign spec's D4 section (the G9 instrument) — analytic
  record, not enforcement.
- The Vercel firewall in log-only mode was recommended with a 5 Sep date. Not ruled; optional.
  It blocks nothing and costs nothing; it is the only way to see hostile traffic after the fact.

### Recorded for 6 November

The doctrine's §9 limitations already carry: *where no manipulation occurs, the result shows that
none was observed, not that any was defeated.* D-5 as ruled does not change that sentence.

---

# D-9 · Growth bounds

### The question

Cap the comment list and the price replay, or carry the cost?

### The ruling

**2026-09-03: uncapped, both.** Comment list and price chart carry the full window. Growth is
met with capacity under the SCALE target — 100,000 signups, 2–5M page loads (ADR-0038) — not
with product limits.

### The evidence that made the comment half easy

The 2 Sep load report: a market page with 10 comments broke down almost as badly as one with
1,000. Content volume is not the read-path bottleneck at tested depth; connection count is.
Capping comments would also hide arguments, which is the one thing the product exists to show.

### The half that is untested

The price chart's cost scales with *bets*, not comments. No market has been tested with 51 days
of price history behind it. The recommendation on record was to serve the chart from periodic
snapshots rather than full event replay; declined. **Accepted without measurement** for the
chart at window-end depth.

---

# D-10 · Observability floor — delegated

### The question

What must we see before go-live, and during the window?

### The ruling

**2026-09-03. Founder: *no hard rules — my dev team will handle it.*** Delegated. No
founder-imposed floor.

### Why the question existed — carried so the dev team inherits the reasoning

ADR-0007 mints six Sentry alarms. **Every one fires on an exception:** append-only violation,
DEFAULT-partition insert, 40001-retry exhaustion, moderation upstream failure, identity-pool
watermark, vendor unreachable. After the S-1 pooler flip, overload produces waiting, not
exceptions. A fully saturated pool fires none of the six. The 2 Sep load test could see the
problem only because it ran *before* the flip, in the regime where the old instrumentation still
works.

ADR-0007 also explicitly excludes uptime monitoring of Vercel and Supabase — *Sentry cannot
observe its own host going down* — and flags it for HARDEN. Still unbuilt at this ruling.

### Guidance carried, not ruled

1. An external uptime monitor hosted off Vercel.
2. One alarm on market-page p99 latency — the alarm that would have caught what the load test found.
3. Sentry paid tier for quota headroom; the free quota exhausts exactly when errors spike.
4. Any further load run measures connection-wait time and latency percentiles, bet-path separate
   from read-path, ramped past the knee; and validates against a deliberately starved pool before
   a clean reading is trusted (V-2: a negative assertion needs a positive control).

Thresholds, wherever set, are HARDEN's (ADR-0007 §4 deferred them). Routing is the dev team's;
absent a designation, alarms reach the founder (D-13).

---

# D-13 · Live-window ownership

### The question

Who owns capacity from 15 September to 5 November?

### The ruling

**2026-09-03. Founder owns it.** No rota, no escalation path, no formal watch. *Skip* — recorded
as a ruling rather than an omission.

### What it combines with

With D-10 delegated and D-12 flexible, the dev team is available during the window in this
posture — a change from the 25 Aug assumption of no engineering lane. Capacity decisions remain
the founder's. Alarms, however routed, end at the founder unless the dev team names someone.

---

# D-14 · Opening price — SEED-RULING

### Where it came from

Every one of the eight campaign specs carries the line *"the actual opening price is fenced to
SEED-RULING and is not decided here."* CONTENT.3 — the seed posts — is blocked on it. Raised in
this docket on 3 Sep and closed here.

### The mechanism, in plain terms

The seed is symmetric: every market is born at exactly 50/50 and no dial exists to open it
elsewhere (cpmm.md §7.1). The price the public sees on 15 September is set by the **curation
slate** — operator-controlled participant accounts placing real, argued bets before the market is
visible, moving the price and seeding the debate at once. Their stakes deepen the pool. The
opening price is therefore a set of bets the operator authors.

### The finding that made it one decision, not eight

Every market's base rate sits beyond 85/15. From the specs:

| Market | Base-rate band, YES |
|---|---|
| MUM-01 · OKT-01 · CHE-01 | beyond 85/15 — long-shot slots 1, 2, 4 |
| MAT-01 | 5–15% |
| CLA-01 | 2–7% |
| YCP-01 | 2–6% |
| BTC-01 | 12–16%, spot-sensitive |
| GIT-01 | long-shot; band not stated |

Long-shot accounting was retired by founder ruling on 14 August. The slate is what it is.

### The ruling

**2026-09-03: all eight markets open at 10% YES / 90% NO. Provisional** — *"for now"* — and pins
with the economy constants at number-tuning.

### Options considered

| | Policy | Not chosen because |
|---|---|---|
| A | Open at base rate (2–16%) | Ruled, approximately: 10% is at or near the band for most markets |
| B | Open at 50/50 | Transparently wrong on these questions; rewards the first mover's speed over knowledge |
| C | Uniform floor at 20–25% | Recommended — keeps all eight live on the Contested lens and gives the informed side room to move. Declined |

### Consequences carried

1. **Slate accounts must be tagged in the dataset export.** Slate positions are real positions
   and a NO-heavy slate on eight NO-likely markets ends the window rich in Dharma. Harmless
   (soulbound, no market) — but undisclosed and discovered, it is the finding that discredits the
   result.
2. **The opening policy is disclosed** in the doctrine's §9 limitations as an operator design
   choice, item 6.
3. At 10%, a winning NO bet returns ~11%. **Expect YES-side action to dominate.** The
   manipulation-resistance test is live from day one; the price-discovery test is thin by
   construction.

---

## Appendix A · Recurring findings

Five settings were found correct in one environment and unverified in the environment that
matters. **This is a category, not five coincidences:**

| # | Setting | Found |
|---|---|---|
| 1 | Google OAuth redirect URI — production registered? | unresolved |
| 2 | Turnstile hostname list — production domain included? | unresolved |
| 3 | R2 CORS on staging buckets | **fixed** |
| 4 | R2 CORS on production buckets | unresolved |
| 5 | R2 credentials in `prd` | unresolved |

**Production has never run the real application.** It has served a placeholder since 2 July. Every
production-side setting is therefore unverified against real code, and 10 September is not a
migration with a deploy attached — **it is the first time the product runs on production
infrastructure at all.**

## Appendix B · Corrections logged

Recorded because each was a real error and each was caught by reading a dashboard rather than by
reasoning:

1. **Debate-page statement count** cited as 22–24; re-derived from source at 23–29
2. **Slot saturation** stated as ~750 tabs; correct figure ~1,560 — wall clock was used where
   slot-hold was meant
3. **India-centric assumptions** applied to a global project — firewall thresholds and email
   provider mix both corrected
4. **LEGAL.1 blocking OAuth verification** — probably false; basic scopes require no verification
5. **"PFPs are already correct"** — stable URL, yes, but on `r2.dev`, which supports no caching
   and throttles
6. **Documents cited as repository paths** (`RECON-1`, `RECON-2`, `HO-0`, `SCALE-TRACKER`) that do
   not exist in the repository
7. **v1.0 header status** read "1 partial · 9 open"; the docket table in the same document showed
   three partial. The table was right.
8. **v1.0 tracker header** counted 13 decisions and 5 open; D-13, marked "unraised", was dropped
   from the count. Fourteen numbered at v1.0; fifteen at v2.0 with D-14.
9. **Memory carried** 6 November as Devcon 8 plus the dataset release. D-6 (25 Aug) scrapped the
   Devcon window and untimed the release. The record wins over memory.
10. **"Load testing is complete"** — asserted 3 Sep; the 2 Sep report lists six items not done,
    including writes and signups. Recorded in D-3, D-4, D-10 rather than corrected silently.

## Appendix C · Change log

| Version | Date | Change |
|---|---|---|
| 1.0 | 2026-08-25 | Initial. D-0, D-1, D-2 frozen. D-6 and D-7 collapsed into D-1. D-8, D-11, D-12 partial. Vendor sweep complete across ten vendors. |
| **2.0** | **2026-09-03** | **Docket closed.** D-8 closed (a delegated to HARDEN, b preview). D-9 uncapped. D-10 delegated. D-11 handled. D-12 superseded — deploys permitted. D-13 founder owns. D-14 minted from SEED-RULING and ruled 10/90 provisional. D-3 and D-4 accepted without measurement. D-5 no special posture. Live-window posture table added to §0. Appendix B items 7–10. |
