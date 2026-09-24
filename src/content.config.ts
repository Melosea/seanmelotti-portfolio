import { defineCollection, z } from 'astro:content';
import { glob } from 'astro/loaders';

const stepSchema = z.object({
  src: z.string(),
  alt: z.string(),
  caption: z.string().max(90),
  chapter: z.string().optional(),
  orientation: z.enum(['landscape', 'portrait']).default('landscape'),
  pair: z.boolean().default(false),
});

const galleryItemSchema = z.object({
  src: z.string(),
  alt: z.string(),
});

const projects = defineCollection({
  loader: glob({ base: './src/content/projects', pattern: '**/*.{md,mdx}' }),
  schema: z.object({
    title: z.string(),
    summary: z.string(),
    date: z.coerce.date(),
    /**
     * Cover photo, in the same photo-root-relative form as hero/steps/gallery
     * ('slug/file.jpg'). Optional: pages fall back through hero -> first step ->
     * first gallery photo, so an entry with any photo still gets a real cover.
     * Legacy '/photos/...' and '/placeholders/...' values still parse — the
     * resolver rewrites the former and falls back for the latter.
     */
    coverImage: z.string().optional(),
    coverImageAlt: z.string().optional(),
    tags: z.array(z.string()).default([]),
    vehicle: z.string(),
    status: z.enum(['completed', 'in-progress', 'planned']).default('in-progress'),
    featured: z.boolean().default(false),
    draft: z.boolean().default(false),
    contentType: z.enum(['project', 'skill']).default('project').optional(),
    /** Phase 2: structured photo sequence */
    hero: z.object({ src: z.string(), alt: z.string() }).optional(),
    specStrip: z.array(z.string()).max(4).default([]),
    steps: z.array(stepSchema).default([]),
    gallery: z.array(galleryItemSchema).default([]),
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
    /**
     * Cover photo, in the same photo-root-relative form as hero/steps/gallery
     * ('slug/file.jpg'). Optional: pages fall back through hero -> first step ->
     * first gallery photo, so an entry with any photo still gets a real cover.
     * Legacy '/photos/...' and '/placeholders/...' values still parse — the
     * resolver rewrites the former and falls back for the latter.
     */
    coverImage: z.string().optional(),
    coverImageAlt: z.string().optional(),
    tags: z.array(z.string()).default([]),
    vehicle: z.string().optional(),
    status: z.enum(['completed', 'in-progress', 'planned']).default('in-progress'),
    featured: z.boolean().default(false),
    draft: z.boolean().default(false),
    hero: z.object({ src: z.string(), alt: z.string() }).optional(),
    specStrip: z.array(z.string()).max(4).default([]),
    steps: z.array(stepSchema).default([]),
    gallery: z.array(galleryItemSchema).default([]),
  }),
});

export const collections = { projects, skills };
