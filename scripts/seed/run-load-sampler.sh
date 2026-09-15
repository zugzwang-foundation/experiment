#!/usr/bin/env bash
# run-load-sampler.sh — launch scripts/seed/load-sampler.ts as a transient
# systemd --user unit, so every sample line lands in the journal AND in a JSONL
# file outside the repo. SEED-DEPTH2 (test branch, not for merge).
#
#   scripts/seed/run-load-sampler.sh --env staging|prod|local [sampler flags…]
#   scripts/seed/run-load-sampler.sh --env prod --slugs bitcoin-price-50k,claude-bundle-response --label seed-depth2
#
# Wrapper-only flags (not passed to the sampler):
#   --dry-run      print the command and the unit name, launch nothing
#   --no-systemd   skip systemd-run; use `nohup … | logger -t <tag>` (also journald)
#   --no-doppler   run staging/prod mode without Doppler: HTTP probes only, the
#                  DB / Upstash / Vercel probes report `unavailable`
#
# Doppler: staging → --config stg, prod → --config prd (never staging/production);
# local runs without Doppler against the local Supabase Postgres.
#
# ⚠ The unit runs under the user manager, not this shell: it does NOT inherit
# this shell's environment. Doppler must be authenticated through its config
# file (`doppler login` / `doppler setup` scoped to this directory), not only a
# DOPPLER_TOKEN exported here — if that is how you authenticate, use --no-systemd,
# which inherits the shell environment.
#
# ⚠ With `Linger=no` the user manager — and this unit — stops when your last
# login session ends. Keep the SSH session (or a tmux) open for the run.
set -euo pipefail

export PATH="$HOME/.local/share/mise/shims:$HOME/.local/bin:$PATH"
REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$REPO_ROOT"

env_name="" duration="17m" out="" dry_run=0 use_systemd=1 use_doppler=1
pass=()
while [[ $# -gt 0 ]]; do
	case "$1" in
	--dry-run) dry_run=1 ;;
	--no-systemd) use_systemd=0 ;;
	--no-doppler) use_doppler=0 ;;
	--env) env_name="${2:-}"; pass+=("$1" "${2:-}"); shift ;;
	--env=*) env_name="${1#*=}"; pass+=("$1") ;;
	--duration) duration="${2:-}"; pass+=("$1" "${2:-}"); shift ;;
	--duration=*) duration="${1#*=}"; pass+=("$1") ;;
	--out) out="${2:-}"; shift ;;
	--out=*) out="${1#*=}" ;;
	*) pass+=("$1") ;;
	esac
	shift
done

case "$env_name" in
local) doppler_config="" ;;
staging) doppler_config="stg" ;;
prod) doppler_config="prd" ;;
*) echo "usage: $0 --env local|staging|prod [sampler flags…]" >&2; exit 2 ;;
esac

# duration → seconds, mirroring the sampler's parser (ms|s|m|h, bare = s).
if [[ ! "$duration" =~ ^([0-9]+)(ms|s|m|h)?$ ]]; then
	echo "cannot parse --duration $duration (use an integer with ms|s|m|h)" >&2; exit 2
fi
n="${BASH_REMATCH[1]}"
case "${BASH_REMATCH[2]:-s}" in
ms) dur_s=$(( (n + 999) / 1000 )) ;;
s) dur_s=$n ;;
m) dur_s=$(( n * 60 )) ;;
h) dur_s=$(( n * 3600 )) ;;
esac
runtime_max=$(( dur_s + 120 ))

ts="$(date -u +%Y%m%dT%H%M%SZ)"
unit="zz-load-${env_name}-${ts}"
out="${out:-$HOME/zz-load-logs/${unit}.jsonl}"
mkdir -p "$(dirname "$out")"

pnpm_bin="$(command -v pnpm)"
cmd=()
if [[ -n "$doppler_config" && $use_doppler -eq 1 ]]; then
	doppler_bin="$(command -v doppler)" || { echo "doppler not on PATH" >&2; exit 2; }
	cmd+=("$doppler_bin" run --project zugzwang-experiment --config "$doppler_config" --)
fi
cmd+=("$pnpm_bin" exec tsx scripts/seed/load-sampler.ts "${pass[@]}" --out "$out")

if [[ $use_systemd -eq 1 ]]; then
	case "$(systemctl --user is-system-running 2>/dev/null || true)" in
	running | degraded) ;;
	*) echo "systemd --user is not available here; falling back to nohup | logger" >&2
		use_systemd=0 ;;
	esac
fi

if [[ "$(loginctl show-user "$USER" -p Linger --value 2>/dev/null || echo unknown)" != "yes" ]]; then
	echo "note: Linger is not enabled — the run stops if your last login session ends." >&2
fi

echo "unit/tag : $unit"
echo "jsonl    : $out"
printf 'command  :'; printf ' %q' "${cmd[@]}"; echo

if [[ $dry_run -eq 1 ]]; then
	echo "(dry run — nothing launched)"
	exit 0
fi

if [[ $use_systemd -eq 1 ]]; then
	systemd-run --user --unit="$unit" --same-dir --collect --quiet \
		-p RuntimeMaxSec="$runtime_max" \
		-p SyslogIdentifier="$unit" \
		-E PATH="$PATH" \
		"${cmd[@]}"
	cat <<EOF
launched as systemd --user unit $unit.service (RuntimeMaxSec=${runtime_max}s)

follow  : journalctl --user -u $unit -f -o cat
review  : journalctl --user -u $unit -o cat --no-pager
summary : journalctl --user -u $unit -o cat --no-pager | grep '"kind":"summary"'
status  : systemctl --user status $unit
stop    : systemctl --user stop $unit     # SIGTERM → the sampler writes its summary, exits 0
file    : tail -f $out
EOF
else
	nohup bash -c '"$@" 2>&1 | logger -t "$0"' "$unit" "${cmd[@]}" >/dev/null 2>&1 &
	pid=$!
	cat <<EOF
launched with nohup (pid $pid), output tagged $unit in the journal

follow  : journalctl -t $unit -f -o cat
review  : journalctl -t $unit -o cat --no-pager
stop    : pkill -TERM -f -- '--out $out'   # SIGTERM → summary, exit 0
file    : tail -f $out
EOF
fi
