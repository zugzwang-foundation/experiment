# Zugzwang experiment — task runner.
# Run `just` (no args) or `just list` to see all recipes.
# Per Playbook §1: dev/build/typecheck/check are the canonical verification chain.

# Default recipe: list all available tasks.
default:
    @just --list

# Show all recipes with descriptions.
list:
    @just --list

# Start the Next.js dev server (Turbopack, hot reload, port 3000).
dev:
    pnpm dev

# Production build — verifies the full Next.js compile + type-check + page generation.
build:
    pnpm build

# TypeScript type-check across the whole codebase. Fast (~1 sec), no emit.
typecheck:
    pnpm tsc --noEmit

# Biome check across the whole repo. Lints + reports formatter diffs without writing.
check:
    pnpm exec biome check .

# Apply Biome's safe auto-fixes (formatter + safe lint fixes). Use before commit.
format:
    pnpm exec biome check --write .

# Full local verification chain — run before pushing if you skipped pre-push hooks.
verify: typecheck check build
    @echo "All checks passed."

# Install all project dependencies fresh — on first clone, after pulling.
setup:
    mise install
    pnpm install
    pnpm exec lefthook install
    @echo "Setup complete. Run just dev to start."

# Remove generated artifacts (build cache, type-cache).
# Does not delete dependencies — run just setup to reinstall after.
clean:
    rm -rf .next/ .turbo/ tsconfig.tsbuildinfo
    @echo "Cleaned build artifacts."