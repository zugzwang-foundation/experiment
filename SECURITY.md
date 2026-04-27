# Security Policy

Zugzwang is an open-source prediction market protocol stewarded by the
Zugzwang Foundation (in formation). This document explains how to report
security issues responsibly.

## Scope

Zugzwang is currently in its **experiment phase** (April 2026 – November 2026)
— a public web2 implementation built to test the protocol's core hypotheses.
There are no real funds at stake during this phase, no smart contracts, and
no chain.

In scope for security reports:

- Vulnerabilities in the experiment app (XSS, CSRF, injection, auth bypass,
  privilege escalation, IDOR, SSRF, etc.) on the deployed surface or in the
  source code.
- Cryptographic or protocol-level flaws in the market logic, ledger, or
  resolution mechanism.
- Privacy issues (unintended data exposure, leakage of bet positions or
  identity).
- Build-pipeline or supply-chain vulnerabilities.

Out of scope:

- Theoretical attacks on systems that don't exist yet (testnet smart
  contracts, mainnet L1 chain, Artha tokenomics). These will be in scope
  when those systems are built.
- Social-engineering attacks against project maintainers or contributors.
- Denial-of-service attacks via volume.
- Bugs that require physical access to a maintainer's device.
- Issues in third-party services we depend on (host these with the relevant
  vendor).

## How to Report

Send security reports to **foundation@zugzwangworld.com**.

Please include:

- A clear description of the issue.
- Steps to reproduce, ideally with a minimal proof-of-concept.
- The affected version, commit SHA, or deployed URL.
- Your assessment of impact and severity.
- Whether you've discussed this with anyone else.

**Do not file public GitHub issues for security vulnerabilities.** Public
disclosure before we've had a chance to address the issue puts users at risk.

## What to Expect

We are a small team. We will:

- Acknowledge receipt of your report within a few days.
- Investigate and confirm or refute the issue.
- Keep you informed of progress as we work on a fix.
- Credit you publicly when the fix lands, unless you prefer to remain
  anonymous.

We don't currently offer monetary bug bounties. A formal bounty program may
be introduced in later phases of the project.

## Disclosure

We follow a coordinated-disclosure model. We ask that reporters give us a
reasonable window to address issues before public disclosure. For severe
vulnerabilities (active exploitation, user-fund risk in later phases) we
will work with you on an accelerated timeline; for low-severity issues we
ask for at least 90 days.

Once a fix is deployed and any affected users have had time to update, we
will publish a brief disclosure note acknowledging the issue and crediting
the reporter.

## Our Commitment to Researchers

We will not pursue legal action against researchers acting in good faith
who:

- Make a reasonable effort to avoid privacy violations, data destruction,
  or service degradation while testing.
- Only interact with accounts they own or with explicit permission of the
  account holder.
- Report findings privately via the channel above.
- Give us reasonable time to address issues before public disclosure.

We treat security research as a public good and want to make it safe to
help us.
