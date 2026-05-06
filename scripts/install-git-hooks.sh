#!/usr/bin/env bash
# Install repo-tracked git hooks into .git/hooks (SECRETS-004).
# Idempotent: re-runs replace prior symlink, do not overwrite developer
# customisations placed at .git/hooks/pre-commit.local (which the hook
# can opt-in to source if it grows).

set -euo pipefail

REPO_ROOT="$(git rev-parse --show-toplevel)"
SRC_DIR="$REPO_ROOT/scripts/git-hooks"
DST_DIR="$REPO_ROOT/.git/hooks"

mkdir -p "$DST_DIR"

for src in "$SRC_DIR"/*; do
  name="$(basename "$src")"
  dst="$DST_DIR/$name"
  chmod +x "$src"
  ln -sf "$src" "$dst"
  echo "installed $name → $dst"
done
