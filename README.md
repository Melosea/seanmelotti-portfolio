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
├── pages/             index, projects, about, contact, 404
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
- **Primitives** — `.btn` (`.btn-primary` / `.btn-secondary`), `.tag`, `.card`,
  `.eyebrow`, `.link-accent`, `.hairline`, `.skip-link`, `.section`.

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
| `draft`         | boolean, default `false` — hidden from listings |

Add a project by dropping an `.mdx` file into `src/content/projects/`.

## Assets

Placeholder covers live in `public/placeholders/`. The Open Graph card is generated
once by `node scripts/generate-og.mjs` and committed to `public/og-default.png`; re-run
it if the palette or wording changes.

## Contact & socials

`CONTACT_METHODS` in `src/consts.ts` holds Sean's email and phone; the footer and
`/contact` render it. `SOCIAL_LINKS` is intentionally empty — socials are off for
now. The rendering is still wired up in both places, so adding an entry there is
all it takes to bring them back.
