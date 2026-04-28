# ADR-0001: Use AGPL-3.0-or-later for the experiment-phase repo

**Status:** Accepted

## Decision Drivers

* **D1 — Foreclose closed-source SaaS forks.** A fork that runs as a
  hosted competitor without publishing its modifications privatises
  the knowledge layer the thesis requires to remain shared. The
  license must require source disclosure when the software is
  operated as a network service, not only when binaries are
  distributed.
* **D2 — Frictionless personal, study, and research use.** Individuals
  running, reading, modifying, and contributing to the code must face
  zero compliance overhead. Builders propagating the idea is the win
  condition.
* **D3 — Foundation transition compatibility.** When Zugzwang
  Foundation incorporates, the license must not block the Foundation
  from being the steward, must not preclude future dual-licensing for
  commercial paths, and must be consistent with the collective-
  copyright phrasing "The Zugzwang Authors" used in `LICENSE`.
* **D4 — GitHub, SPDX, and ecosystem legibility.** GitHub's license
  picker, SPDX identifiers, npm metadata, and corporate dependency
  scanners must all recognise the choice without manual configuration.
* **D5 — Patent grant from contributors.** The license must include
  an explicit patent licence so contributors cannot later assert
  patents reading on their contributions against downstream users.
* **D6 — Clean precedent.** The license must have a deployment history
  without retraction, retroactive relicensing, or use as a weapon
  against forks of the kind Zugzwang would be.

## Decision Outcome

Chosen option: "AGPL-3.0-or-later".

AGPL-3.0 is GPL-3.0 plus §13. §13 obligates an operator who lets
users interact with a modified version of the software over a network
to offer those users the corresponding source. This is the only
mechanism in the considered set (MIT, Apache-2.0, GPL-3.0,
AGPL-3.0-or-later) that closes the closed-source SaaS-fork gap — D1,
the load-bearing driver. MIT and Apache-2.0 explicitly permit
closed-source hosted derivatives; GPL-3.0 leaves the SaaS gap open
because running a modified version on a server is not "distribution"
under GPL-3.0.

§13 fires only on *modified* versions hosted as a network service, so
personal use, study, research, contribution, and unmodified hosting
trigger nothing — preserving D2. The §11 patent grant inherited from
GPL-3.0 covers D5. AGPL-3.0 is recognised by GitHub, SPDX, npm, and
dependency scanners — D4. It has a long deployment history (MongoDB
pre-2018, Grafana pre-2021, Mastodon, Plausible, Nextcloud) without
retraction or retroactive relicensing — D6. The strict §13 obligation
makes a future commercial-license offering valuable to potential
purchasers, preserving Foundation-phase dual-license optionality — D3.

The license file applies AGPL-3.0 with the FSF "or any later version"
clause and copyright held collectively as "The Zugzwang Authors".
This is in place at the repo root as of FOUND.3 (PR #6), with the
canonical AGPL-3.0 body originally landing in FOUND.2's initial
commit (`4f4d746`). Source files going forward carry the SPDX header
`SPDX-License-Identifier: AGPL-3.0-or-later`; no retroactive sweep on
existing files.
