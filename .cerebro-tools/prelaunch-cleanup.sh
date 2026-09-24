#!/usr/bin/env bash
# Pre-launch cleanup — STAGED, run only after Zulu's COVER RENDER mission completes.
# Decisions locked by Sean 2026-09-24.
set -euo pipefail
cd "$(dirname "$0")/.."

echo "== 1/3 Remove phone number (email-only contact) =="
# src/consts.ts:41  -> delete the Phone CONTACT_METHODS entry
# src/pages/contact.astro:18 -> strip 'or call 443-480-8889' from meta description
grep -n "443-480-8889\|tel:+1443" src/consts.ts src/pages/contact.astro || echo "  (already clean)"

echo "== 2/3 Remove empty test photo folder =="
[ -d "src/assets/photos/test" ] && rmdir "src/assets/photos/test" && echo "  removed" || echo "  (absent)"

echo "== 3/3 Delete Portfolio Inbox (173 MB — Sean has originals elsewhere) =="
[ -d "src/assets/photos/Portfolio Inbox" ] && rm -rf "src/assets/photos/Portfolio Inbox" && echo "  deleted" || echo "  (absent)"
echo "  NOTE: scripts/convert-heic.mjs references this dir — make it tolerate a missing Inbox."

echo "== verify =="
npm run build
