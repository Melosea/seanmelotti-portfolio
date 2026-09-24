# seanmelotti.com

Portfolio site for Sean Melotti — custom vehicle projects, fabrication and restoration.
Built with [Astro](https://astro.build), styled with Tailwind CSS v4, deployed to
Cloudflare Pages.

## Commands

| Command           | Action                                              |
| :---------------- | :-------------------------------------------------- |
| `npm install`     | Install dependencies (Node 22.12+, see `.nvmrc`)     |
| `npm run dev`     | Dev server at `localhost:4321`                       |
| `npm run build`   | Production build to `./dist/`                        |
| `npm run preview` | Serve the production build locally                   |
| `npm run check`   | Type-check `.astro`/`.ts` with `astro check`         |

## Structure

```text
src/
├── components/        Site shell + UI components
│   ├── Header.astro   Sticky header, desktop nav, mobile menu
│   ├── Footer.astro   Site links + contact details
│   ├── PageHeader.astro  Eyebrow / title / lede band for inner pages
│   └── ProjectCard.astro Project card (image, title, summary, tags, status)
├── content/projects/  Project write-ups (MDX)
├── layouts/
│   └── BaseLayout.astro  <head> + SEO, skip link, header/main/footer
├── pages/             index, about, contact, 404
│   └── projects/      index (full archive) + [...slug] (write-up page)
├── styles/
│   └── global.css     ALL design tokens + component primitives
├── content.config.ts  `projects` collection schema
└── consts.ts          Site metadata, nav items, contact details, social links
```

## Design system

Every token lives in `src/styles/global.css`. Nothing else in the codebase should
introduce a one-off colour, font size or radius — add it there first.

- **Colours** — light canvas, cool neutral ink scale (`--color-ink-300` → `950`),
  three hairline weights (`--color-line-subtle|line|line-strong`), one restrained
  accent (`--color-accent`, indigo-blue `#2f56d9`) plus soft/line variants, and two
  semantic status colours for project state.
- **Type** — [Inter Variable](https://fontsource.org/fonts/inter) for UI and body,
  [JetBrains Mono Variable](https://fontsource.org/fonts/jetbrains-mono) for eyebrows,
  tags and meta. Both self-hosted via `@fontsource-variable/*` and bundled by Vite —
  no external font CDN. The scale runs `--text-2xs` → `--text-6xl`, with tighter
  leading and negative tracking on the display steps.
- **Layout** — `--container-max` (72rem), `--container-narrow` (46rem) and a
  responsive `--container-gutter`, consumed by the `.container-page` /
  `.container-narrow` classes.
- **Primitives** — `.btn` (`.btn-primary` / `.btn-secondary`), `.tag`, `.card`
  (+ `.card-interactive`, `.card-media`, `.card-cta`), `.status-pill`,
  `.hero-eyebrow`, `.contact-card`, `.cta-bubble`, `.prose-page`, `.eyebrow`,
  `.link-accent`, `.hairline`, `.skip-link`, `.section`.
- **Accessibility floors** — the contact email and phone are the site's most
  important characters: Inter, 2rem on desktop and never below 1.25rem, ink-950
  at 19.7:1, underlined at rest, in a target ~100px tall. Status pills clear
  6.4:1 on their own background, and the contact CTA bubble uses
  `--color-accent-hover` (8.1:1 on white) rather than `--color-accent` (6.1:1).

Tokens declared inside `@theme` also generate Tailwind utilities, so
`text-ink-500`, `border-line` and `bg-accent-soft` all resolve to the same values.

## Content

`src/content.config.ts` defines the `projects` collection:

| Field           | Type                                       |
| :-------------- | :----------------------------------------- |
| `title`         | string                                     |
| `summary`       | string                                     |
| `date`          | date                                       |
| `coverImage`    | string (path under `public/`)              |
| `coverImageAlt` | string, optional                           |
| `tags`          | string[]                                   |
| `vehicle`       | string                                     |
| `status`        | `complete` \| `in-progress` \| `planned`   |
| `featured`      | boolean, default `false` — surfaced on the homepage |
| `draft`         | boolean, default `false` — hidden from listings |

Add a project by dropping an `.mdx` file into `src/content/projects/`. `/projects`
lists every non-draft entry newest-first on `date` and is the full archive; the
homepage shows the three most recent `featured` entries.

## The About page

`/about` renders entirely from `PROFILE` and `DISCIPLINES` in `src/consts.ts` — the
page itself holds no copy, so it can be rewritten without touching markup.

`PROFILE.facts` entries are `null` until Sean supplies them. **A null fact is dropped
from the page, not printed as a placeholder**, and the whole fact block hides while
they are all null — the page reads as finished at every stage of filling it in.

What is still needed from Sean, in his own words:

| Field                 | What to supply                                                    |
| :-------------------- | :---------------------------------------------------------------- |
| `PROFILE.intro`       | 3–5 sentences: how he got into this work and the standard he holds it to. The current text is a neutral holding draft — it restates the positioning statement and makes no biographical claims. |
| `facts['Based in']`   | City / state, or region if he would rather not be precise.         |
| `facts['Working since']` | The year he started doing this work.                            |
| `facts['Shop setup']` | One line on where the work happens and the main equipment.         |
| `facts['Open to']`    | Whether he takes outside work at all, and of what kind. Leave null if not. |
| `DISCIPLINES[].description` | Sanity-check the four one-liners — they were written from the positioning statement, not dictated by him. |

## Assets

Placeholder covers live in `public/placeholders/`. The Open Graph card is generated
once by `node scripts/generate-og.mjs` and committed to `public/og-default.png`; re-run
it if the palette or wording changes.

## Contact & socials

`CONTACT_METHODS` in `src/consts.ts` holds Sean's email and phone; the footer and
`/contact` render it. `SOCIAL_LINKS` is intentionally empty — socials are off for
now. The rendering is still wired up in both places, so adding an entry there is
all it takes to bring them back.
