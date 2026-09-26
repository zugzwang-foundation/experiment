# What We Built for AWS, and Why

**For:** the client and anyone reviewing the AWS work
**Date:** 17 September 2026
**Status:** ✅ written and verified on our machines · ❌ **nothing deployed to AWS** · ❌ **no application code changed**

---

## 1. In one paragraph

Zugzwang runs on Vercel today. To move it to AWS we did **not** start by clicking around the AWS console. We first read the whole codebase to find everything that only works because it is on Vercel, and then wrote the AWS setup **as code** — 10 files that describe every server, network rule, alarm and scheduled job the project needs. That code has been checked and produces a valid AWS plan, but it has not been run against AWS, and the application itself is untouched.

---

## 2. Why we wrote code instead of clicking in the AWS console

Setting up AWS by hand looks faster on day one. It costs you later, in ways that are hard to recover from.

| Doing it by hand | Doing it as code (what we did) |
|---|---|
| Nobody can say exactly what was set up, or why | The whole setup is 10 readable files in the repository |
| Staging and production drift apart silently | Both come from the same code, with the differences in one small file |
| A misconfiguration is discovered in production | Misconfiguration surfaces **before anything is created**, on a laptop, in seconds |
| Rebuilding after a disaster means remembering | Rebuilding is running one command |
| Review is impossible | Changes are reviewed like any other code |

The tool is **AWS CDK**, AWS's own infrastructure-as-code tool, written in TypeScript — the same language as the rest of the project, so the team maintains one language, not two.

---

## 3. What we wrote, file by file

Everything lives in a new `infra/` folder, separate from the application.

| File | What it sets up | Why it exists |
|---|---|---|
| `bin/zugzwang.ts` | The entry point: builds the whole setup twice, once for staging and once for production | One description, two environments — they can never drift apart by accident |
| `lib/network-stack.ts` | The private network: address ranges, two data centres, firewall rules | So the application is reachable **only** through the load balancer, and nothing else can connect to it |
| `lib/security-stack.ts` | Image storage, the password vault reference, log storage, and the two identities the app runs as | Keeps identity and permissions in one place. **The app's own identity has zero AWS permissions**, because it only talks to Supabase, Upstash, R2, OpenAI, Resend, Sentry and PostHog — none of which are AWS |
| `lib/compute-stack.ts` | The server that runs Next.js, the load balancer, HTTPS, health checks, and a separate job for database migrations | This is the application itself. It also enforces migrations-before-serving and automatic rollback |
| `lib/scheduler-stack.ts` | The three scheduled jobs from `vercel.json` | **Most important file for safety.** Without it, markets would never close at their deadline |
| `lib/monitoring-stack.ts` | Alarms and a dashboard | So a failure reaches a person instead of waiting for a user to complain |
| `config/staging.ts` | Staging's values | Smaller, cheaper, shorter log retention |
| `config/production.ts` | Production's values | Bigger, with NAT and a firewall, longer log retention |
| `config/types.ts` | The list of settings each environment must provide, plus the cron list and the secret names | If someone adds an environment and forgets a setting, it fails to compile instead of failing in production |
| `README.md` | How to run and deploy it | So this does not live only in our heads |

**Two supporting documents** were written as well: `AWS-CDK-DESIGN.md` (the technical audit and design) and `ARCHITECTURE-OVERVIEW.md` (how the whole project works).

---

## 4. The decisions we made, and the reasoning

| Decision | Why |
|---|---|
| **ECS running on EC2 instances** | You own the machines — the team's preference — while ECS still schedules the container, so automatic rollback, health checks and the migration job all stay. Cheaper per month than serverless capacity; in exchange your team owns the operating system and its patching. |
| **Region pinned to Mumbai (`ap-south-1`)** | Supabase is there. Your project already measured the difference: moving compute next to the database took a database round trip from 361 ms to 5 ms. Compute in the wrong region would throw that away. |
| **One server, not several** | Not to save money. Next.js keeps its page cache **inside each server**, so with two servers, removing a comment on one would not clear it on the other — a moderated comment could stay visible. Running more than one needs a shared cache first, and the code says so in writing. |
| **The app's AWS identity has no permissions** | It never calls AWS. If a future feature needs one, it gets added deliberately rather than being there "just in case". |
| **Passwords and keys stay out of the code** | The AWS files contain only the **name** of the vault entry, never a value. Doppler stays the source of truth, and rotating a key needs no deployment. We checked the generated AWS plan: zero secret values in it. |
| **Scheduled jobs call the app over HTTPS with a secret header** | Your cron routes already check `Authorization: Bearer …`. So the schedules move to AWS with **no change to the application**. |
| **An alarm for a cron that goes quiet** | A failing job raises an error somebody can see. A job that simply stops raises nothing — markets would just never close. That alarm is the one that catches it. |
| **30 seconds to shut down** | Your app finishes some work after the response is already sent. Killing it instantly would drop that work. |
| **Health check on `/api/health`** | The project already treats this endpoint as the source of truth for deployments, so AWS uses the same signal. |
| **Migrations run before new code serves** | This is your existing rule (ADR-0024). The deployment order enforces it: if the migration fails, the old version keeps serving and nothing breaks. |
| **Automatic rollback** | If a new version fails its health checks, AWS puts the previous one back without waiting for a human. |
| **NAT in production, not in staging** | NAT costs about $32/month. Production gets it; staging uses a cheaper arrangement with the same inbound protection. |
| **Firewall (WAF) and CDN optional** | Cloudflare already sits in front of your domain. Two CDNs in series causes more problems than it solves, so it is off by default and can be switched on in one line. |

---

## 5. What the audit found — the things that would have broken

We read the application code before writing any AWS code. Five findings would have caused real incidents:

1. **The scheduled jobs.** `close-due-markets` runs **every minute**, and nothing else closes markets. Recreated on AWS with an alarm.
2. **The deployment check would have gone blind.** `/api/health` reports which version is live by reading a value **only Vercel provides**. On AWS it would return empty, and the check that says "the right version is live" would quietly stop working. The AWS code supplies a replacement value; the application needs a one-line change to read it.
3. **An image belongs to one environment.** Some settings are baked in when the app is built, so a staging build can never be promoted to production. The deployment flow accounts for this.
4. **Missing monitoring key = crash loop.** If one Sentry setting is absent, the app refuses to start. It is now in the required list.
5. **IP addresses in logs** come from a Vercel-only helper. On AWS that log field would be empty until a small change is made.

---

## 6. What the validation step flagged

Two risks that come with AWS tooling defaults, both surfaced by generating and checking the plan.

1. **Resource ordering.** AWS refuses a setup where two groups of resources each need the other first — a normal constraint once logging, permissions and the cluster sit in separate groups. The check surfaced it in seconds; on a console build it appears halfway through a deployment, with resources already created.
2. **Region is pinned, not inherited.** AWS tooling defaults to whatever region the operator's profile uses — `us-east-1` (Virginia) here. Left at the default, the application would sit on the other side of the world from its database, undoing the biggest performance fix the project has made. The region is now fixed in code and cannot be inherited by accident, on anyone's machine.

Neither would have been visible by clicking through the console.

---

## 7. How we checked the work

| Check | Result |
|---|---|
| Does the AWS plan generate? | ✅ All **10 environment setups** produce valid AWS plans |
| Does the code compile? | ✅ Type check passes |
| Code style | ✅ Passes the project's checker |
| Staging and production really separate? | ✅ Different networks, sizes, secrets, image stores and log retention |
| Any secrets in the generated plan? | ✅ None — 31 secrets, all references |
| Application code touched? | ✅ Not one file |
| Deployed anything? | ✅ No |

---

## 8. Cost estimate (Mumbai, list prices)

| Item | Monthly |
|---|---|
| EC2 `t3.medium` (2 vCPU, 4 GB, always on) | ~$30 (~$18 with a 1-year commitment) |
| Load balancer | ~$18 – 25 |
| NAT (production only) | ~$32 |
| Image storage, logs, data transfer | ~$5 – 10 |
| Firewall (optional) | ~$8 |
| **Production total** | **~$90 – 100** |
| **Staging total (`t3.small`, no NAT, no firewall)** | **~$45 – 55** |

AWS Activate credits for a startup are typically **$1,000** ($5,000 with an accelerator or investor), which covers roughly 10–15 months. The one number we still need for a proper comparison is **your current Vercel bill**.

---

## 9. What is still needed before going live

**Small changes to the application (not made — we did not touch the app):**
1. Turn on Next.js "standalone" output, one line.
2. Make `/api/health` read the AWS-supplied version value, so the deployment check keeps working.
3. Make the IP log field fall back to the standard header.
4. Write the `Dockerfile` that packages the app.

**Setup work on AWS:**
5. Create the two password vault entries and fill them from Doppler.
6. Supply the HTTPS certificate and decide on DNS.
7. Give an email address for alarms.
8. Write the deployment pipeline in GitHub Actions.

**Then:** deploy staging, test it for 24 hours, and only then plan a production cutover.

⚠ **Timing matters.** The experiment is live until the write-freeze on **5 November 2026**. A cutover should happen in a quiet window well before that date, or after it. Running it during a seeding run, or in the final days, is not worth the risk.

---

## Appendix — where everything is

| Document | What it covers |
|---|---|
| `infra/` | The AWS code itself |
| `infra/README.md` | How to run and deploy it |
| `docs/reports/AWS-CDK-DESIGN.md` | The technical audit and design, with every finding and its evidence |
| `docs/reports/ARCHITECTURE-OVERVIEW.md` | How the whole project works today |
| `docs/reports/aws-migration-proposal.html` | The original migration proposal |
