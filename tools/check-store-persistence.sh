#!/usr/bin/env bash
#
# check-store-persistence.sh — store wiring contract checker.
#
# Guards the fixes for review 2026-11-02 (section 3.3, both P1s) against drift:
#   1. src/storage.ts exports load/save for all six collections
#      (videos / reports / reminders / folders / notes / aiConfigs).
#   2. src/store.tsx initialises folders / notes / aiConfigs from storage
#      (not a hard-coded []).
#   3. Every folder / note / AI-config mutation writes through to storage
#      (exact call-site counts).
#   4. The cloud-load effect re-runs when the auth user changes ([userId]).
#
# Usage:  tools/check-store-persistence.sh
# Exit:   0 = contract intact, 1 = drift detected
#
# The script only reads files; it never modifies them.

set -u

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
ROOT="$(dirname "$SCRIPT_DIR")"
STORAGE="$ROOT/src/storage.ts"
STORE="$ROOT/src/store.tsx"
FAIL=0

expect() { # expect <description> <pattern> <file>
  if ! grep -q "$2" "$3"; then
    echo "x $1"
    echo "    pattern not found in ${3#"$ROOT"/}: $2"
    FAIL=1
  else
    echo "ok $1"
  fi
}

expect_count() { # expect_count <description> <pattern> <file> <count>
  local n
  n=$(grep -c "$2" "$3" || true)
  if [ "$n" -ne "$4" ]; then
    echo "x $1"
    echo "    expected $4 call site(s) of '$2' in ${3#"$ROOT"/}, found $n"
    FAIL=1
  else
    echo "ok $1 ($n call sites)"
  fi
}

echo "Checking storage exports"
for fn in loadVideos saveVideos loadReports saveReports loadReminders saveReminders \
          loadFolders saveFolders loadNotes saveNotes loadAIConfigs saveAIConfigs; do
  expect "storage exports $fn" "export function $fn" "$STORAGE"
done

echo "Checking store initialisation"
expect 'folders initialise from storage'  'useState<Folder\[\]>(() => loadFolders())'    "$STORE"
expect 'notes initialise from storage'    'useState<Note\[\]>(() => loadNotes())'        "$STORE"
expect 'aiConfigs initialise from storage' 'useState<AIConfig\[\]>(() => loadAIConfigs())' "$STORE"

echo "Checking mutation write-through"
expect_count 'saveFolders write-through'   'saveFolders(next)'   "$STORE" 3
expect_count 'saveNotes write-through'     'saveNotes(next)'     "$STORE" 3
expect_count 'saveAIConfigs write-through' 'saveAIConfigs(next)' "$STORE" 4

echo "Checking cloud reload on auth change"
expect 'store imports useAuth'              "import { useAuth } from './lib/auth'" "$STORE"
expect 'cloud-load effect depends on user'  '}, \[userId\]);'                      "$STORE"

if [ "$FAIL" -ne 0 ]; then
  echo
  echo "x store persistence contract violated"
  exit 1
fi
echo
echo "All store persistence checks passed."
