# PROJECT KNOWLEDGE — what the mirror is for

**Version** 1.0 · **Supersedes** the mirror-only `Project_Knowledge_Protocol`
**Owner** founder · **Scope** the Experiment phase

> **The one sentence.** Project knowledge is a *working set*, not an archive: it holds what a
> session must read in order to decide, and nothing that a session would instead verify against the
> live repository.

---

## §1 · The rule

GitHub is canonical. The mirror lags, always. A document in the mirror is a convenience copy whose
only job is to be readable without a tool call — it is never the source, never the tiebreaker, and
never the thing a ruling is checked against.

**Include** — a session must read it to decide:

| Include | Why |
|---|---|
| `SPEC.1`, `SPEC.2`, `cpmm`, `RANKING` | The product contract |
| ADRs | The decisions and their consequences |
| `docs/records/` + `STATE.md` | What exists, where, and what proves it |
| `docs/decisions/` | Rulings, and the operating model |
| Design documents | The design system governs every surface |
| Runbooks, `CLAUDE.md`, `AGENTS.md`, `parked.md` | Operating |
| The participant-facing terms | A legal document under review |
| Campaign specs | Live through the window |

**Exclude** — the session would verify it against the repository anyway, or it does not exist:

| Exclude | Why |
|---|---|
| Session logs and close-out documents | **These no longer exist in this project.** The lane records and the commit log are the record |
| Plans | The lane records carry what landed; open plans live in the repository |
| Skeleton or placeholder documents | A document with no content under a confident title reads as specified. It is worse than a gap |
| Renderings — HTML dashboards, PDFs of a markdown source | A rendering is not a source |
| Anything binary or non-text | The mirror renders it as plain text, which helps nobody |
| Narrative and delivered handover packages | Written once, read never |

---

## §2 · The hazard

**⚠ The mirror can hold more than one record at a single path, and the panel shows only one.**
Reads and deletes both collapse silently to the newest, with no signal that others exist. A delete
therefore looks like it worked and the name reappears.

**A filename census and a record census are different measurements.** Any name-deduplicated
listing — including a mounted snapshot, which also normalises `.` to `_` in filename stems —
undercounts records and surfaces the *oldest* record at a duplicated path.

Three consequences, each earned:

1. A hash sweep proves a **staged** file is correct. It proves nothing about a stale twin at the
   same path in the mirror.
2. **Purge each duplicated path to zero**, then re-drag. "Keep the newest, delete the older" is
   unexecutable, because delete removes the newest.
3. **Anything that exists only in the mirror goes to the repository before any purge.** This was
   learned by destroying a file and paying to restore it.

---

## §3 · The refresh

1. The executor stages `~/Desktop/zz-pk-refresh-<TASK.ID>/` from `origin/main` **after** the merge.
2. Flat directory — the mirror has no folders. Collisions are detected **before** any byte is
   written, the copy refuses to overwrite an existing destination, and every rename is reported.
3. `MANIFEST.md` carries one row per file: staged name · repository path · lines · hash · first
   heading · the glob it came from. Its footer names every exclusion and why.
4. Every hash is verified by re-reading the **staged copy on disk**. Hashing the repository blob
   twice proves only that git is deterministic.
5. The founder purges and drags. **The executor never deletes from the mirror.**
6. After dragging, open `MANIFEST.md`. Any surviving record whose name appears there is a stale
   twin — delete it.

**Staged names are a mirror convention, not repository basenames.** Three files are named
`README.md` in this repository; flattened, that is a silent three-way overwrite. Disambiguate by
parent directory — and only where a collision actually exists, because prefixing files that did not
collide breaks every citation that names them by basename.

---

## §4 · When to refresh

At the close of any task that changed a document in the include list. Not on a schedule — a
schedule produces refreshes with nothing in them and misses the ones that mattered.

*End.*
