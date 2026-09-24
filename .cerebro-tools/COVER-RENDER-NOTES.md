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
