#!/bin/sh
# Refuse a non-fast-forward push to a protected branch.
#
# ⚠ THIS IS A DISCIPLINE WITH A MECHANISM, NOT A CONTROL. It runs client-side,
# in whichever clone happens to have Lefthook installed, and `--no-verify`
# walks straight past it. It cannot be relied on the way a server-side rule
# could be. It exists because there is no server-side rule to rely on:
# this repository has NO branch protection at all (CLAUDE.md §5.13 holds the
# measurement and its date — read it there, it is not restated here), so a
# force-push to `main` or `staging` would otherwise succeed silently and O-4
# would be the only thing standing in front of it. A rule in a document that
# nothing ever asks about is weaker than the same rule attached to the moment
# it would be broken. That is the whole of what this buys, and it is not more.
#
# ── WHY NON-FAST-FORWARD, AND NOT A SEARCH FOR `--force` ─────────────────────
#
# Git does not tell a pre-push hook which flags were typed. There is no
# argument, no environment variable, and no push option carrying `--force`, so
# any guard written to look for that string would be reading something that was
# never sent — and would pass, silently, on every force-push there is.
#
# What git DOES send, on stdin, is one line per ref: the local ref and sha it
# is pushing, and the sha the remote currently holds. That is enough, because
# git itself already rejects a non-fast-forward push unless it was forced. So a
# non-fast-forward reaching this hook IS a force-push, by construction, whether
# it arrived as `--force`, `--force-with-lease`, `+refs/...`, or a push spec
# nobody has invented yet. Detecting the effect rather than the spelling is
# what makes this hold against the next flag.
#
# ── WHAT IT DELIBERATELY DOES NOT BLOCK ──────────────────────────────────────
#
# Feature branches. All of them, force-push included. Rebasing a review branch
# and force-pushing it is ordinary work here — S-1's own `fix/pool-transaction-
# mode` was force-pushed legitimately during review — and a guard that broke it
# would be turned off within a day, taking the protected-branch half with it.
# Only `main` and `staging` are named, and they are named as REMOTE refs, so
# `git push origin HEAD:main` from any local branch is caught too.
#
# Branch deletion of a protected ref is refused on the same footing: the local
# sha is all-zeroes, which is not a fast-forward of anything.
#
# Exit 1 refuses the push. There is no override flag by design — the escape
# hatch is `--no-verify`, which is deliberately something you have to mean.

set -eu

PROTECTED='main staging'
ZERO='0000000000000000000000000000000000000000'
blocked=0

# stdin: <local ref> <local sha> <remote ref> <remote sha>, one line per ref.
# A closed or empty stdin yields no lines and no refusal — see the note below.
while read -r local_ref local_sha remote_ref remote_sha; do
	[ -n "${remote_ref:-}" ] || continue

	short_ref=${remote_ref#refs/heads/}
	is_protected=0
	for p in $PROTECTED; do
		[ "$short_ref" = "$p" ] && is_protected=1
	done
	[ "$is_protected" = "1" ] || continue

	# A brand-new remote branch has no history to lose.
	[ "$remote_sha" = "$ZERO" ] && continue

	# Deleting a protected branch: local side is all-zeroes.
	if [ "$local_sha" = "$ZERO" ]; then
		echo "⛔ REFUSED: deleting '$short_ref' on '$1'." >&2
		blocked=1
		continue
	fi

	# The test itself: is what the remote holds still reachable from what we
	# are about to put there? If not, the push discards remote history.
	if ! git merge-base --is-ancestor "$remote_sha" "$local_sha" 2>/dev/null; then
		echo "⛔ REFUSED: non-fast-forward push to '$short_ref' on '$1'." >&2
		echo "   remote has $(git rev-parse --short "$remote_sha" 2>/dev/null || echo "$remote_sha")," >&2
		echo "   which is NOT an ancestor of $(git rev-parse --short "$local_sha")." >&2
		echo "   This would discard commits from '$short_ref'." >&2
		blocked=1
	fi
done

if [ "$blocked" = "1" ]; then
	cat >&2 <<'MSG'

   `main` and `staging` are never force-pushed (CLAUDE.md §8, O-4). Nothing on
   the server will stop you — this hook is the only thing that will, and only
   in this clone.

   To advance `staging` past a divergence, cherry-pick onto it and push as a
   fast-forward. Do not rewrite the ref.
MSG
	exit 1
fi

exit 0
