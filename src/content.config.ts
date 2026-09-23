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
    coverImage: z.string(),
    coverImageAlt: z.string().optional(),
    tags: z.array(z.string()).default([]),
    vehicle: z.string(),
    status: z.enum(['complete', 'in-progress', 'planned']),
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
    coverImage: z.string(),
    coverImageAlt: z.string().optional(),
    tags: z.array(z.string()).default([]),
    vehicle: z.string().optional(),
    status: z.enum(['complete', 'in-progress', 'planned']).default('complete'),
    featured: z.boolean().default(false),
    draft: z.boolean().default(false),
    hero: z.object({ src: z.string(), alt: z.string() }).optional(),
    specStrip: z.array(z.string()).max(4).default([]),
    steps: z.array(stepSchema).default([]),
    gallery: z.array(galleryItemSchema).default([]),
  }),
});

export const collections = { projects, skills };
