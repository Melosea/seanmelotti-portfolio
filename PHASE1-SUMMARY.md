# Phase 1 — Design system and site shell

Branch `cerebro/phase1-design-system`, 21 commits off `main` (`471c8ad`, untouched).
**32 files changed, +3,912 / −141.** Live at
<https://cerebro-phase1-design-system.seanmelotti-portfolio.pages.dev>.

Nothing here is a pull request — the branch is for Sean to review first.

## What was built

Tailwind CSS v4 (via `@tailwindcss/vite`) and MDX are installed and configured. On top
of that: a token layer, a shell, six routes and a content collection.

**Routes**

| Route                | What it is                                                        |
| :------------------- | :---------------------------------------------------------------- |
| `/`                  | Compact hero, then the three featured projects — the grid reaches the first viewport on every tested width. Closes on a single contact CTA. |
| `/projects`          | The full archive, newest first on `date`, drafts excluded.         |
| `/projects/[slug]`   | Per-project detail page generated from the collection.             |
| `/about`             | Intro, the four disciplines, optional fact list, closing CTA.      |
| `/contact`           | Email and phone at headline size — see *Legibility* below.         |
| `/404`               | Styled dead end instead of Astro's bare default.                   |

**Components** — `BaseLayout` (full SEO head, skip link, landmarks), `Header`
(sticky, hairline and blur on scroll, mobile menu), `Footer`, `PageHeader`,
`ProjectCard` (image / title / summary / tags / vehicle / status / href, with a
`prominent` variant for the lead slot).

**Content** — `src/content.config.ts` defines the `projects` collection; six sample
MDX entries prove the schema compiles and give the grid something to lay out. All
copy in them is placeholder, waiting on Sean's photos and write-ups.

## Design token decisions

Every token is a CSS custom property in `src/styles/global.css`. Components consume
tokens; there are no scattered one-off hex values.

- **Accent** `#2f56d9` indigo-blue, hover `#2545b4`, soft tint `#eef1fd`. One accent,
  used sparingly — links, primary button, focus ring, interactive card cue.
- **Neutrals** a cool ink scale (300–950) over `canvas` / `surface` / `surface-sunken`.
- **Hairlines** three weights: `line-subtle #f0f1f3`, `line #e8eaed`, `line-strong #d8dbe0`.
- **Fonts** Inter Variable for UI and body, JetBrains Mono Variable for eyebrows, tags
  and meta. Both self-hosted via `@fontsource-variable` — no Google Fonts CDN, nothing
  render-blocking.
- **Type scale** 11px (`2xs`) through 64px (`6xl`), negative tracking on the display steps.
- **Containers** `--container-max` 72rem, `--container-narrow` 46rem, responsive gutter.

## Decisions worth flagging

**Legibility on `/contact`.** Sean asked for contact details that older eyes can read.
The email and phone render at 20px on mobile and 32px on desktop, in `ink-950`
(~19.7:1 contrast), underlined at rest, inside a 98–116px tall bordered target. No
hover needed to discover the link, nothing hidden behind an icon, phone digits tracked
wide.

**Hover is reserved for things that go somewhere.** `.card` is a static panel; the
lift-and-shadow hover lives on `.card-interactive`, applied only when the card has a
destination. A panel that rises under the cursor and does nothing when clicked is a lie.

**`twitter:card` meta tags are kept**, despite socials being off. They are not links,
accounts or a social presence — they only control how the URL renders when someone
texts or messages it. Without them a shared link renders as a bare URL. Annotated in
`BaseLayout`; a five-line delete if Sean disagrees.

**Socials are wired but empty.** `SOCIAL_LINKS` in `src/consts.ts` is an empty array,
and the footer and `/contact` render it only when it has entries. Adding a handle
there turns them back on — no markup to write.

## Deviations from the original spec

- Sean renamed **Builds → Projects** mid-mission. `/builds` does not exist; `/projects` does.
- **Added `/404`** — not in scope, but Astro's default was an unstyled dead end.
- **Added `/projects/[slug]`** detail pages — Sean asked for the cards to click through
  to something rather than nowhere.
- **Schema extras**: `coverImageAlt` (optional) and `draft` (default `false`).
- **`coverImage` is a string path** under `public/`, not Astro's `image()` helper.
  Phase 2 should migrate when real photos land.
- **One hex literal survives outside `global.css`**: `<meta name="theme-color" content="#ffffff">`
  in `BaseLayout`, which cannot take a CSS variable.
- **Added `scripts/generate-og.mjs`** and committed `public/og-default.png`, so the
  Open Graph card is a real PNG rather than an SVG social platforms ignore.

## Verified

`npm run build` exits 0 (11 pages). Driven in headless Chrome over CDP against the
**live Cloudflare deploy**, not just localhost: six routes × five widths
(320 / 375 / 768 / 1440 / 1920) = 30 cells, all clean — zero console errors, zero
failed requests, zero horizontal overflow, `header`/`main`/`footer`/`nav` + skip link
+ exactly one `h1` on every cell, no image missing `alt`.

Interaction was walked with a real pointer and real keystrokes: cards click through to
their detail pages, both `/about` CTAs land, the 375px mobile menu opens with all five
links and no focus trap, tab order is logical on every page with a visible focus ring
at every stop, and `prefers-reduced-motion` suppresses every transform (the border and
shadow cues stay).

## What Phase 2 should pick up

1. **Real photos** from Sean's Drive folder, and migrating `coverImage` to Astro's `image()`.
2. **Real copy** — the six project write-ups, and the `/about` fields listed in the
   README table (the page is built to absorb them one field at a time).
3. **`@astrojs/sitemap` + `robots.txt`.**
4. **Re-enable socials** when the accounts are ready — one array in `src/consts.ts`.
5. **The editing path Sean asked about** — an admin panel, or agent-assisted edits.
