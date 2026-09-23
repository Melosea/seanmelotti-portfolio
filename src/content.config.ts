import { defineCollection, z } from 'astro:content';
import { glob } from 'astro/loaders';

/**
 * `projects` — one entry per vehicle project write-up.
 *
 * Phase 1 defines the schema only; there is a single placeholder entry to prove
 * the collection compiles. Phase 2 fills it with real write-ups and photos.
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
    /** Drafts are kept out of listings. */
    draft: z.boolean().default(false),
  }),
});

export const collections = { projects };
