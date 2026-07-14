#!/usr/bin/env bash
# verify-handover-links.sh — EXTAUDIT-05 handover-deck verifier (plan §6).
#
# Four checks over docs/handover/EXTAUDIT-05_HANDOVER-DECK.{md,html}:
#   1. SHA resolution   — every …/commit/<40-hex> link in both files exists
#                         AND is an ancestor of PIN (no orphan/branch SHAs).
#   2. PR resolution    — the ledger PR multiset equals the census set derived
#                         live from `git log --first-parent` (+ the three
#                         suffix-less squashes #143/#144/#178; #58/#146 are
#                         closed-unmerged and must be absent), each PR exactly
#                         once, and every census PR is MERGED per one cached
#                         `gh pr list` pass (rate-limit-tolerant: single call).
#   3. Ledger complete  — two-way multiset: the Part-B ledger SHAs ==
#                         `git log --first-parent --format=%H <PIN>` exactly —
#                         no commit missing, none twice.
#   4. md↔html parity   — the h2/h3 heading sequences of the .md and the
#                         generated .html are identical.
#
# Ledger-line grammar (the extraction contract — only ledger lines may match):
#   ^- [`<7-hex>`](<repo>/commit/<40-hex>) · [#<N>](<repo>/pull/<N>) — …
# The deck's own PR link in the epilogue is outside PIN history by
# construction and is deliberately NOT a ledger line (plan §6).
#
# Usage: scripts/verify-handover-links.sh [PIN_SHA]   (default: origin/main)
#   SKIP_HTML=1  skips check 4 during .md-only authoring (never pre-PR).
# Exit: non-zero on any failure. git + gh only — no tsx, no DB, no env chain.

set -euo pipefail

REPO_DIR="$(cd "$(dirname "$0")/.." && pwd)"
cd "$REPO_DIR"

MD="docs/handover/EXTAUDIT-05_HANDOVER-DECK.md"
HTML="docs/handover/EXTAUDIT-05_HANDOVER-DECK.html"
PIN="${1:-$(git rev-parse origin/main)}"
TMPDIR_V="$(mktemp -d)"
trap 'rm -rf "$TMPDIR_V"' EXIT

fail() { echo "FAIL: $*" >&2; exit 1; }
[ -f "$MD" ] || fail "missing $MD"

echo "PIN = $PIN"

# ── Check 1 — SHA resolution ────────────────────────────────────────────────
files=("$MD")
[ -f "$HTML" ] && files+=("$HTML")
grep -ohE '/commit/[0-9a-f]{40}' "${files[@]}" | sed 's|/commit/||' | sort -u \
  > "$TMPDIR_V/commit-links.txt"
n_links=$(wc -l < "$TMPDIR_V/commit-links.txt" | tr -d ' ')
[ "$n_links" -gt 0 ] || fail "check 1: no commit links found"
while read -r sha; do
  git cat-file -e "${sha}^{commit}" 2>/dev/null \
    || fail "check 1: $sha does not exist"
  git merge-base --is-ancestor "$sha" "$PIN" \
    || fail "check 1: $sha is not an ancestor of PIN"
done < "$TMPDIR_V/commit-links.txt"
echo "check 1 OK — $n_links distinct commit links exist and are ancestors of PIN"

# ── Ledger extraction (shared by checks 2 + 3) ──────────────────────────────
# Ledger lines: '- [`xxxxxxx`](…/commit/<full>)' at line start, .md only.
grep -E '^- \[`[0-9a-f]{7}`\]\(' "$MD" > "$TMPDIR_V/ledger-lines.txt" || true
n_ledger=$(wc -l < "$TMPDIR_V/ledger-lines.txt" | tr -d ' ')

# ── Check 2 — PR resolution ─────────────────────────────────────────────────
grep -oE '/pull/[0-9]+\)' "$TMPDIR_V/ledger-lines.txt" \
  | grep -oE '[0-9]+' | sort -n > "$TMPDIR_V/ledger-prs.txt"
# Census set, derived live: trailing "(#N)" on first-parent squash subjects,
# plus the three suffix-less squashes resolved at plan time.
git log --first-parent --format='%s' "$PIN" \
  | grep -oE '\(#[0-9]+\)$' | grep -oE '[0-9]+' > "$TMPDIR_V/census-prs.txt"
printf '143\n144\n178\n' >> "$TMPDIR_V/census-prs.txt"
sort -n "$TMPDIR_V/census-prs.txt" -o "$TMPDIR_V/census-prs.txt"
if ! diff -u "$TMPDIR_V/census-prs.txt" "$TMPDIR_V/ledger-prs.txt" \
    > "$TMPDIR_V/pr-diff.txt"; then
  cat "$TMPDIR_V/pr-diff.txt" >&2
  fail "check 2: ledger PR multiset != live census PR multiset"
fi
sort -nu "$TMPDIR_V/ledger-prs.txt" > "$TMPDIR_V/ledger-prs-uniq.txt"
cmp -s "$TMPDIR_V/ledger-prs.txt" "$TMPDIR_V/ledger-prs-uniq.txt" \
  || fail "check 2: a PR appears in more than one ledger line"
for bad in 58 146; do
  grep -qx "$bad" "$TMPDIR_V/ledger-prs.txt" \
    && fail "check 2: closed-unmerged PR #$bad present in ledger"
done
# One cached gh pass — every census PR must be MERGED.
GH_CACHE="$TMPDIR_V/merged-prs.txt"
if ! gh pr list --state merged --base main --limit 400 --json number \
    --jq '.[].number' 2>/dev/null | sort -n > "$GH_CACHE"; then
  fail "check 2: gh pr list unavailable (network/auth) — rerun when gh works"
fi
missing=$(comm -23 "$TMPDIR_V/ledger-prs.txt" "$GH_CACHE" | tr '\n' ' ')
[ -z "$missing" ] || fail "check 2: ledger PRs not in merged set: $missing"
n_prs=$(wc -l < "$TMPDIR_V/ledger-prs.txt" | tr -d ' ')
echo "check 2 OK — $n_prs ledger PRs == live census, all MERGED (one gh call)"

# ── Check 3 — two-way ledger completeness ───────────────────────────────────
grep -oE '/commit/[0-9a-f]{40}' "$TMPDIR_V/ledger-lines.txt" \
  | sed 's|/commit/||' | sort > "$TMPDIR_V/ledger-shas.txt"
git log --first-parent --format='%H' "$PIN" | sort > "$TMPDIR_V/main-shas.txt"
if ! diff -u "$TMPDIR_V/main-shas.txt" "$TMPDIR_V/ledger-shas.txt" \
    > "$TMPDIR_V/sha-diff.txt"; then
  cat "$TMPDIR_V/sha-diff.txt" >&2
  fail "check 3: ledger SHA multiset != git log --first-parent $PIN"
fi
echo "check 3 OK — $n_ledger ledger lines == $(wc -l < "$TMPDIR_V/main-shas.txt" | tr -d ' ') first-parent commits, exactly once each"

# ── Check 4 — md↔html heading parity ────────────────────────────────────────
if [ "${SKIP_HTML:-0}" = "1" ]; then
  echo "check 4 SKIPPED (SKIP_HTML=1 — authoring mode; never skip pre-PR)"
else
  [ -f "$HTML" ] || fail "check 4: missing $HTML"
  # Normalize both sides to "##|text" / "###|text" with inline markup
  # stripped (backticks/emphasis on the md side; tags/entities on the html
  # side), so parity is over heading *text*, not renderer syntax.
  grep -E '^##+ ' "$MD" | sed -E 's/^(##+) /\1|/' \
    | sed -E 's/[`*]//g' > "$TMPDIR_V/md-heads.txt"
  # HTML headings are emitted one-per-line by the generator.
  grep -oE '<h[23][^>]*>.*</h[23]>' "$HTML" \
    | sed -E 's/^<h2[^>]*>/##|/; s/^<h3[^>]*>/###|/' \
    | sed -E 's/<[^>]+>//g; s/&amp;/\&/g; s/&gt;/>/g; s/&lt;/</g' \
    | sed -E 's/[`*]//g' > "$TMPDIR_V/html-heads.txt"
  if ! diff -u "$TMPDIR_V/md-heads.txt" "$TMPDIR_V/html-heads.txt" \
      > "$TMPDIR_V/head-diff.txt"; then
    cat "$TMPDIR_V/head-diff.txt" >&2
    fail "check 4: md/html heading sequences differ"
  fi
  echo "check 4 OK — $(wc -l < "$TMPDIR_V/md-heads.txt" | tr -d ' ') headings identical in both files"
fi

echo "ALL CHECKS GREEN"
