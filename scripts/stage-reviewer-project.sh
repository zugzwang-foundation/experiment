#!/usr/bin/env bash
# stage-reviewer-project.sh — EXTAUDIT-06: stage the reviewer Claude-Project folder.
#
# Stages the ratified 60-file knowledge base (48 repo + 5 external package + 7 kit)
# flat into DEST, from the COMMITTED tree at SHA (git show), never the working tree.
# Deterministic + rerunnable; writes DEST/STAGING-RECEIPT.txt and aborts unless the
# staged set matches both the embedded manifest count and SOURCES.md's row list.
#
# Usage: scripts/stage-reviewer-project.sh [--force] [--dest DIR] [--sha REF]
#   --force  clear a non-empty DEST before staging (default: refuse)
#   --dest   override DEST (default: ~/Desktop/zz-reviewer-project); used by dry-runs
#   --sha    override the pin (default: origin/main after a fetch); used by pre-merge
#            dry-runs, where the kit files exist on the branch but not origin/main yet
#
# macOS /bin/bash is 3.2 — no mapfile/associative arrays here.

set -euo pipefail

DEST="${HOME}/Desktop/zz-reviewer-project"
SHA_REF=""
FORCE=0

while [ $# -gt 0 ]; do
	case "$1" in
		--force) FORCE=1 ;;
		--dest)
			shift
			[ $# -gt 0 ] || { echo "ERROR: --dest needs a value" >&2; exit 1; }
			DEST="$1"
			;;
		--sha)
			shift
			[ $# -gt 0 ] || { echo "ERROR: --sha needs a value" >&2; exit 1; }
			SHA_REF="$1"
			;;
		*) echo "ERROR: unknown argument: $1" >&2; exit 1 ;;
	esac
	shift
done

cd "$(git rev-parse --show-toplevel)"

# --- Resolve the pin -------------------------------------------------------
if [ -z "$SHA_REF" ]; then
	git fetch origin --quiet || echo "warn: git fetch failed; using local origin/main" >&2
	SHA_REF="origin/main"
fi
SHA="$(git rev-parse --verify "${SHA_REF}^{commit}")"
echo "Staging from: $SHA ($SHA_REF)"

# --- The manifest (single source of truth) ---------------------------------
# 19 fixed repo paths + derived globs: docs/adr/00*.md (expect 29, _template.md
# excluded by the 00 prefix), docs/handover/project-kit/*.md (expect 7), and
# ~/Downloads/EXTAUDIT-0[0-4]_*.md (expect 5). Total content files: 60.
FIXED_REPO_FILES=(
	"AGENTS.md"
	"CLAUDE.md"
	"README.md"
	"SECURITY.md"
	"docs/specs/SPEC.1.md"
	"docs/specs/SPEC.2.md"
	"docs/specs/cpmm.md"
	"docs/specs/RANKING.md"
	"docs/specs/debate-export.md"
	"docs/handover/EXTAUDIT-05_HANDOVER-DECK.md"
	"docs/references/manifold.md"
	"docs/runbooks/dataset-release.md"
	"docs/runbooks/DEBATE.7-moderation-smoke.md"
	"docs/parked.md"
	"docs/logs/ENGINE-phase-record.md"
	"docs/logs/INCIDENT-2026-07-02-prod-migration-drift.md"
	"docs/logs/SYNC-SWEEP.md"
	"docs/logs/EXTAUDIT-05.md"
	"docs/briefs/SCAFFOLD.16-technical-research-brief.md"
)
EXPECTED_ADR=29
EXPECTED_KIT=7
EXPECTED_EXTERNAL=5
EXPECTED_TOTAL=60

ADR_FILES=()
while IFS= read -r p; do ADR_FILES+=("$p"); done < <(
	git ls-tree -r --name-only "$SHA" -- docs/adr/ | grep -E '^docs/adr/00[0-9]{2}-.*\.md$' | sort
)
[ "${#ADR_FILES[@]}" -eq "$EXPECTED_ADR" ] || {
	echo "ERROR: expected $EXPECTED_ADR ADR decision files at \$SHA, got ${#ADR_FILES[@]}" >&2
	exit 1
}

KIT_FILES=()
while IFS= read -r p; do KIT_FILES+=("$p"); done < <(
	git ls-tree -r --name-only "$SHA" -- docs/handover/project-kit/ | grep -E '\.md$' | sort
)
[ "${#KIT_FILES[@]}" -eq "$EXPECTED_KIT" ] || {
	echo "ERROR: expected $EXPECTED_KIT kit files at \$SHA under docs/handover/project-kit/, got ${#KIT_FILES[@]}" >&2
	echo "       (pre-merge dry-run? pass --sha <branch-ref> so the kit files are in the tree)" >&2
	exit 1
}

EXTERNAL_FILES=()
for p in "${HOME}"/Downloads/EXTAUDIT-0[0-4]_*.md; do
	[ -f "$p" ] && EXTERNAL_FILES+=("$p")
done
[ "${#EXTERNAL_FILES[@]}" -eq "$EXPECTED_EXTERNAL" ] || {
	echo "ERROR: expected $EXPECTED_EXTERNAL external package files at ~/Downloads/EXTAUDIT-0[0-4]_*.md, got ${#EXTERNAL_FILES[@]}" >&2
	exit 1
}

REPO_FILES=("${FIXED_REPO_FILES[@]}" "${ADR_FILES[@]}" "${KIT_FILES[@]}")

# --- Basename-collision guard (flat DEST) ----------------------------------
ALL_BASENAMES=""
for p in "${REPO_FILES[@]}"; do ALL_BASENAMES="${ALL_BASENAMES}$(basename "$p")"$'\n'; done
for p in "${EXTERNAL_FILES[@]}"; do ALL_BASENAMES="${ALL_BASENAMES}$(basename "$p")"$'\n'; done
DUPES="$(printf '%s' "$ALL_BASENAMES" | sort | uniq -d)"
[ -z "$DUPES" ] || {
	echo "ERROR: destination basename collision(s):" >&2
	echo "$DUPES" >&2
	exit 1
}
printf '%s' "$ALL_BASENAMES" | grep -qx "STAGING-RECEIPT.txt" && {
	echo "ERROR: a content file collides with STAGING-RECEIPT.txt" >&2
	exit 1
}

# --- DEST handling ----------------------------------------------------------
mkdir -p "$DEST"
if [ -n "$(find "$DEST" -mindepth 1 -print -quit)" ]; then
	if [ "$FORCE" -eq 1 ]; then
		echo "DEST non-empty; --force given, clearing $DEST"
		find "$DEST" -mindepth 1 -delete
	else
		echo "ERROR: $DEST is not empty (rerun with --force to clear it)" >&2
		exit 1
	fi
fi

# --- Stage ------------------------------------------------------------------
for p in "${REPO_FILES[@]}"; do
	git show "${SHA}:${p}" > "${DEST}/$(basename "$p")"
done
for p in "${EXTERNAL_FILES[@]}"; do
	cp "$p" "${DEST}/$(basename "$p")"
done

STAGED_LIST="$(printf '%s' "$ALL_BASENAMES" | sort)"
STAGED_COUNT="$(printf '%s\n' "$STAGED_LIST" | grep -c . | tr -d ' ')"

# --- Assert: manifest count -------------------------------------------------
[ "$STAGED_COUNT" -eq "$EXPECTED_TOTAL" ] || {
	echo "ERROR: staged $STAGED_COUNT content files, expected $EXPECTED_TOTAL (48 repo + 5 package + 7 kit)" >&2
	exit 1
}

# --- Assert: staged set == SOURCES.md row list ------------------------------
# SOURCES.md's contract: every content row starts '| `<staged-basename>`'.
SOURCES_LIST="$(sed -nE 's/^\| `([^`]+)`.*/\1/p' "${DEST}/SOURCES.md" | sort)"
SOURCES_COUNT="$(printf '%s\n' "$SOURCES_LIST" | grep -c . | tr -d ' ')"
if [ "$STAGED_LIST" != "$SOURCES_LIST" ]; then
	echo "ERROR: staged set != SOURCES.md manifest rows ($STAGED_COUNT staged vs $SOURCES_COUNT rows)." >&2
	echo "diff (< staged | > SOURCES.md):" >&2
	diff <(printf '%s\n' "$STAGED_LIST") <(printf '%s\n' "$SOURCES_LIST") >&2 || true
	exit 1
fi

# --- Receipt ----------------------------------------------------------------
if command -v md5sum > /dev/null 2>&1; then
	MD5_CMD="md5sum"
else
	MD5_CMD="md5 -r"
fi
RECEIPT="${DEST}/STAGING-RECEIPT.txt"
{
	echo "zz-reviewer-project staging receipt"
	echo "date:       $(date -u '+%Y-%m-%dT%H:%M:%SZ')"
	echo "staged-from: $SHA ($SHA_REF)"
	echo "dest:       $DEST"
	echo "files:      $STAGED_COUNT content files (expected $EXPECTED_TOTAL = 48 repo + 5 package + 7 kit)"
	echo ""
	(cd "$DEST" && printf '%s\n' "$STAGED_LIST" | while IFS= read -r f; do $MD5_CMD "$f"; done)
	echo ""
	echo "TOTAL: $STAGED_COUNT"
} > "$RECEIPT"

echo "OK: staged $STAGED_COUNT content files to $DEST (receipt: $RECEIPT)"
