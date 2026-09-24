# COVER RENDER — mission notes (agent Zulu)

Branch: `cerebro/cover-render` (from `cerebro/heic-pipeline`). Never touched `main`.

## The bug, confirmed
`coverImage` held `/photos/<slug>/<file>.jpg` and was passed straight into `<img src>`.
`public/photos/` does not exist, so that URL only resolves in `astro dev`, where a Vite
middleware in `astro.config.mjs` serves `src/assets/photos` at `/photos`. Every cover
was a 404 in a production build. `hero`/`steps`/`gallery` were fine — they used
photo-root-relative paths through `import.meta.glob` + `astro:assets`.

Two conventions for the same asset. The fix is one convention and one resolver.

## What changed
- `src/lib/photo-path.mjs` — pure path normalisation. Plain `.mjs` so the Astro pages
  AND the Node-only checker import the *same* rules and cannot drift.
- `src/lib/photos.ts` — wraps the single `import.meta.glob` around it. `resolvePhoto`,
  `resolveCover` (coverImage -> hero -> steps[0] -> gallery[0]), `coverAlt`.
- `ProjectCard.astro` — takes `ImageMetadata | string`; renders `<Image>` for the former.
- `index.astro`, `projects/index.astro` — covers go through `resolveCover`.
- `projects/[...slug].astro`, `skills/[...slug].astro` — shared resolver; hero falls back
  to the cover; og:image is now a built URL via `getImage(...).src`, not an ESM object.
- `content.config.ts` — `coverImage` optional, documented as photo-root-relative.
- `scripts/export-mdx.mjs` — writes the relative form; the `/photos/...` legacy form is gone.
- `scripts/check-image-refs.mjs` + `npm run check:images` (wired as `prebuild`).

## Studio findings (the thing Sean asked about)
**The Studio never showed his 88 imported Giulietta photos.** By design: `loadProject`
builds the canvas *exclusively* from the sidecar JSON ("blank canvas"). But the sidebar
counter read the *folder* count, so it said `91` next to a canvas holding `3`. That
mismatch is what Sean was seeing.

Changed: the sidebar now shows the canvas count plus a separate `+88` for photos in the
folder that are not on the canvas, and the toolbar grows an
**"↓ Import 88 from folder"** button. Imported photos land as *Unassigned* with no
caption/alt, so nothing reaches the published page until it has been written.

**Giulietta's canvas was left as Sean curated it (3 photos).** The import button is
verified working; pressing it is his call, not mine.

Two real bugs found while driving the round-trip, both fixed:
1. `/api/studio/export` always reported `src/content/projects/...` even for skills. The
   file went to the right place; the alert lied.
2. `renderStudio()` hard-coded the save badge to "Saved", so an unsaved change made
   before a re-render (e.g. Import from folder) looked saved.

## Open, for Sean to decide
- **`/skills/welding-fabrication` is orphaned** — nothing on the site links to it. It
  renders correctly, but a visitor cannot reach it. Needs either a nav item, a section
  on `/projects`, or a `/skills` index. Out of this mission's scope; flagging it.
- The Studio has **no autosave** despite the "Saved/Unsaved" badge — you must press Save,
  Ctrl+S, or Export. Worth adding a debounce.
- `.cerebro-tools/caption-autosave.ps1` (pid in `watcher.pid`) is auto-committing
  `src/content/_studio/*.json` to whatever branch is checked out. It committed several
  times during this session.

---

# Cycle 2 — /skills section, honest save badge, collection-aware Studio

Commit `9765b5b` on `cerebro/cover-render`. 5 files, +345 / -39.

## What changed
- **`src/pages/skills/index.astro`** (new, 72 lines) — a copy of the projects
  archive in every structural respect: `PageHeader`, the `ProjectCard` grid,
  `!data.draft` filtering, `resolveCover` / `coverAlt` / `PLACEHOLDER_COVER`.
  No new layout, no `/photos/` literals.
- **`src/consts.ts`** — `{ label: 'Skills', href: '/skills' }` after Projects.
  `Header.astro` needed no change: its `path.startsWith(href)` helper already
  marks Skills current on both `/skills` and `/skills/<slug>` (verified).
- **`src/_studio/index.astro`** — the save badge now reads a `saveState`
  variable instead of being re-derived from `!isDirty` on every toolbar render.
  Four states, one of them new: `error`. Also a 1.2s debounced autosave, an
  export guard, and the new-entry dialog + grouped sidebar.
- **`astro.config.mjs`** — `create-project` takes an optional `type`;
  `GET /projects` returns `type`; two `let sidecar = {}` got JSDoc types.
- **`scripts/check-image-refs.mjs`** — see the trap below.

## The trap worth remembering
Sean was authoring in the Studio *while this cycle ran* and created three
photo-less skill stubs. The cycle-1 checker treated "entry has no real photo"
as a broken reference, so `npm run build` (which runs it via `prebuild`)
started failing on his own perfectly valid in-progress content.

Fixed by splitting the two ideas apart:
- **failure** = a reference that does not resolve to a file on disk. Still exits 1.
- **warning** = an entry with no real photo yet. Prints, exits 0.
- `--strict` promotes warnings back to failures, for a pre-launch sweep.
A `/placeholders/*.svg` cover is not a broken image — that asset exists and
renders. Confusing "unfinished" with "broken" blocks the author.

## Verification (all runtime, via `.cerebro-tools/cdp.py`)
`cdp.py` is a ~230-line CDP driver over `websocket-client` + headless Chrome:
real `Input.dispatchMouseEvent` clicks, keystrokes, `Network.setBlockedURLs`,
auto-answered `alert()`s, screenshots. Reusable — three verify scripts sit
next to it. Three gotchas it now handles, all of which cost time:
1. Chrome rejects a WS handshake carrying an `Origin` → `suppress_origin=True`.
2. **Never hard-code port 9222** — another agent (`lightframe`) runs its own
   headless Chrome there and you will silently drive theirs. Uses a free port.
3. Mouse events are viewport coordinates → `click()` scrolls into view first.
4. `'unsaved'.includes('saved')` is `true`. Assert the exact class string.

- `verify-site.py` — 5 built pages: 0 broken images each, correct nav
  highlight on each, then the first-visitor journey (click nav Skills → click
  the card → land on the entry). PASS.
- `verify-studio.py` — sidebar grouping; the add dialog (empty name, Escape,
  duplicate name probes); create a Skill → sidecar has `"type":"skill"`;
  create a Project → shape byte-identical to before; import 2 photos from
  folder → caption → **autosave lands on disk** → hero + main-seq persist;
  **blocked `/api/studio/sidecar/*` → badge goes red "Save failed" and stays
  red through further edits**; export refuses while failing; Ctrl+S after
  unblocking clears it; export → `src/content/skills/<slug>.mdx`. PASS.
- `verify-exported-page.py` — the exported skill is linked from `/skills` and
  renders its photo through astro:assets. PASS.
- `verify-mobile.py` — 390px: Skills in the hamburger, navigates, no
  sideways scroll, no broken images. PASS.
- `npm run build`: 11 pages, 0 errors. `astro check`: 22 errors, all
  pre-existing (was 26 — the JSDoc annotations removed 4).

## Open for Sean
- `cad-3d-printing`, `engine-building`, `machining` are **his** stubs from
  today. They are live on `/skills` with placeholder covers and empty
  summaries. Their `.mdx` files are **uncommitted** — deliberately not
  committed by an agent. Add photos, or set `draft: true` before launch.
- `caption-autosave.ps1` was stopped during verification and restarted
  (new pid in `watcher.pid`). It only auto-commits `_studio/*.json`.

---

# Cycle 3 — final sweep

## The proficiency directive does not apply to this repo
Command sent a subtractive directive: strip public proficiency badges from
`/skills` and `/skills/*`, keep the Studio dropdown and a shared
`PROFICIENCY_LEVELS` constant. **None of it exists here.** Evidence:

- `grep -ri proficien` over the working tree → 0 files.
- `git grep` + `git log --all -S proficien` over every branch and every
  commit → 0 hits. It was never written and then removed; it was never here.
- `src/content.config.ts` has no `tools`/`equipment`/proficiency field, and
  neither skills page renders a tools list.
- `grep -ri proficien dist/` after a fresh build → **0 matches**, so the
  public-HTML requirement ("no proficiency string leaks") is already met.

Asked Sean through the Cerebro ask API; the question timed out with no
answer (`agentq_5c187755046c`). Building the schema field, the Studio
dropdown and the constant would be *new feature work*, which this mission
explicitly forbids — so nothing was built and nothing was removed. If that
feature exists, it is in another repo or another agent's branch.

## A real defect — in the verification harness itself
`verify-site.py` pointed at a hard-coded `http://127.0.0.1:4330` that it never
started. Nothing was listening this cycle, so Chrome rendered its own error
page and the script measured *that*: `imgs=2 broken=0` on all five routes —
a dead server reported as a clean site. Same family of bug as the port-9222
trap from cycle 2. Fixed:

- The script now starts its own `ThreadingHTTPServer` on `dist/` at a **free**
  port, in-process, and shuts it down at the end. No external dependency, no
  port to collide over.
- Before trusting any measurement it asserts the page is *ours*:
  `document.title` must contain `Sean Melotti` and an `<h1>` must exist.
  An error page now fails loudly instead of passing quietly.
- `SimpleHTTPRequestHandler` 301-redirects `/skills` → `/skills/` for
  directory indexes; a real host serves the clean URL, so the journey
  assertions compare on `pathname.rstrip('/')`.
- Access log and Chrome's keep-alive `ConnectionResetError` tracebacks
  silenced — one line per asset was burying the findings.

## Final sweep results (all re-run this cycle)
- `npm run build` → 11 pages, 0 errors.
- `check-image-refs.mjs` → all refs resolve; 5 entries, 20 photos, 3
  placeholders, 3 of Sean's stubs warned (exit 0, by design).
- **Negative proof**: pointed welding's `coverImage` at
  `welding-fabrication/NOPE-does-not-exist.jpg` → exit **1**, naming file,
  field and missing path. Restored → exit 0.
- `verify-site.py` (hardened) → 5 routes, **0 broken images each**, correct
  nav highlight each, real optimized `.webp` covers (`IMG_6512…webp` on `/`
  and `/projects`, `welding-fabrication-011…webp` on the skill page), and the
  first-visitor journey nav → `/skills` → card → entry with `h1` intact.
  **ALL SITE CHECKS PASS.**
- `verify-studio.py` → **ALL STUDIO CHECKS PASS**, including export →
  `src/content/skills/zulu-roundtrip-check.mdx` whose `coverImage`/`hero`/
  `steps` all use the relative `slug/file.jpg` convention and resolve under
  the audit (6 entries / 23 photos while it existed). Artifacts removed
  afterwards — note the caption watcher had auto-committed the test
  sidecars, so their deletion is committed too.
