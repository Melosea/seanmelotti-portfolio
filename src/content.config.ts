import { defineCollection, z } from 'astro:content';
import { glob } from 'astro/loaders';

/**
 * `projects` — one entry per vehicle project write-up.
 *
 * Phase 1 defines the schema and seeds placeholder entries so the archive and
 * the homepage grid both render real data. Phase 2 replaces the copy and covers.
 *
 * `/projects` lists every non-draft entry newest-first on `date`; the homepage
 * shows the `featured` subset only.
 *
 * `coverImage` is a path under /public for now. When real photos land, consider
 * moving them into src/ and switching this field to Astro's `image()` helper so
 * covers get optimised and dimension-checked at build time.
 */
const projects = defineCollection({
  loader: glob({ base: './src/content/projects', pattern: '**/*.{md,mdx}' }),
  schema: z.object({
    title: z.string(),
    summary: z.string(),
    date: z.coerce.date(),
    coverImage: z.string(),
    /** Alt text for the cover. Falls back to a generated description if absent. */
    coverImageAlt: z.string().optional(),
    tags: z.array(z.string()).default([]),
    vehicle: z.string(),
    status: z.enum(['complete', 'in-progress', 'planned']),
    /** Featured entries surface on the homepage; the archive lists everything. */
    featured: z.boolean().default(false),
    /** Drafts are kept out of listings. */
    draft: z.boolean().default(false),
    /** Optional: 'skill' renders the skill-showcase template instead of the project template. */
    contentType: z.enum(['project', 'skill']).default('project').optional(),
  }),
});

/**
 * `skills` — capability showcase pages grouped by technique.
 * Each skill entry shares the same photo-column layout as projects
 * but is presented as a portfolio piece rather than a dated narrative.
 */
const skills = defineCollection({
  loader: glob({ base: './src/content/skills', pattern: '**/*.{md,mdx}' }),
  schema: z.object({
    title: z.string(),
    summary: z.string(),
    date: z.coerce.date(),
    coverImage: z.string(),
    coverImageAlt: z.string().optional(),
    tags: z.array(z.string()).default([]),
    vehicle: z.string().optional(),
    status: z.enum(['complete', 'in-progress', 'planned']).default('complete'),
    featured: z.boolean().default(false),
    draft: z.boolean().default(false),
  }),
});

export const collections = { projects, skills };
