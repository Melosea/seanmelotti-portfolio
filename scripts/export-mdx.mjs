#!/usr/bin/env node
/**
 * Export a studio sidecar JSON to a valid MDX entry in src/content/projects/.
 *
 * Usage:
 *   node scripts/export-mdx.mjs giulietta-spyder-veloce
 *   node scripts/export-mdx.mjs --all
 *
 * The exported MDX must validate against the zod schema in src/content.config.ts.
 * Idempotent: re-running overwrites cleanly.
 */

import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');
const STUDIO_DIR = path.join(ROOT, 'src', 'content', '_studio');
const PROJECTS_DIR = path.join(ROOT, 'src', 'content', 'projects');
const SKILLS_DIR = path.join(ROOT, 'src', 'content', 'skills');

async function loadSidecar(slug) {
  const p = path.join(STUDIO_DIR, `${slug}.json`);
  const raw = await fs.readFile(p, 'utf-8');
  return JSON.parse(raw);
}

function buildFrontmatter(sidecar) {
  const cover = sidecar.photos.find((p) => p.isCover) ?? sidecar.photos[0];
  const coverPath = cover
    ? `/photos/${sidecar.slug}/${cover.filename}`
    : `/placeholders/project-01.svg`;

  const date = sidecar.date ?? new Date().toISOString().slice(0, 10);

  // For skill type
  if (sidecar.type === 'skill') {
    return {
      title: sidecar.title,
      summary: sidecar.summary ?? '',
      date,
      coverImage: coverPath,
      coverImageAlt: cover?.caption || sidecar.title,
      tags: sidecar.tags ?? [],
      vehicle: sidecar.vehicle ?? 'Various',
      status: sidecar.status ?? 'complete',
      featured: sidecar.featured ?? false,
      draft: sidecar.draft ?? false,
      contentType: 'skill',
    };
  }

  return {
    title: sidecar.title,
    summary: sidecar.summary ?? '',
    date,
    coverImage: coverPath,
    coverImageAlt: cover?.caption || sidecar.title,
    tags: sidecar.tags ?? [],
    vehicle: sidecar.vehicle ?? '',
    status: sidecar.status ?? 'complete',
    featured: sidecar.featured ?? false,
    draft: sidecar.draft ?? false,
  };
}

function buildPhotoSection(sidecar) {
  if (!sidecar.photos || sidecar.photos.length === 0) return '';

  let lines = [];
  for (const photo of sidecar.photos) {
    const src = `/photos/${sidecar.slug}/${photo.filename}`;
    const alt = photo.caption || sidecar.title;
    const caption = photo.caption || '';
    lines.push(`<figure class="photo-entry">`);
    lines.push(`  <img src="${src}" alt="${alt.replace(/"/g, '&quot;')}" loading="lazy" />`);
    if (caption) {
      lines.push(`  <figcaption>${caption}</figcaption>`);
    }
    lines.push(`</figure>`);
    lines.push('');
  }
  return lines.join('\n');
}

function yamlValue(v) {
  if (typeof v === 'boolean') return String(v);
  if (typeof v === 'number') return String(v);
  if (Array.isArray(v)) {
    if (v.length === 0) return '[]';
    return `[${v.map((x) => `'${String(x).replace(/'/g, "''")}'`).join(', ')}]`;
  }
  // String — use single quotes, escape inner single quotes
  const s = String(v).replace(/'/g, "''");
  return `'${s}'`;
}

function buildMdx(sidecar) {
  const fm = buildFrontmatter(sidecar);

  const fmLines = Object.entries(fm)
    .map(([k, v]) => `${k}: ${yamlValue(v)}`)
    .join('\n');

  const intro = sidecar.summary ? `${sidecar.summary}\n\n` : '';
  const photos = buildPhotoSection(sidecar);

  return `---\n${fmLines}\n---\n\n${intro}${photos}`.trimEnd() + '\n';
}

async function exportSlug(slug) {
  const sidecar = await loadSidecar(slug);

  const isSkill = sidecar.type === 'skill';
  const outDir = isSkill ? SKILLS_DIR : PROJECTS_DIR;
  await fs.mkdir(outDir, { recursive: true });

  const outPath = path.join(outDir, `${slug}.mdx`);
  const mdx = buildMdx(sidecar);
  await fs.writeFile(outPath, mdx, 'utf-8');
  console.log(`Exported: ${path.relative(ROOT, outPath)}`);
}

async function main() {
  const args = process.argv.slice(2);

  if (args.includes('--all')) {
    const files = await fs.readdir(STUDIO_DIR).catch(() => []);
    const slugs = files.filter((f) => f.endsWith('.json')).map((f) => f.replace('.json', ''));
    if (slugs.length === 0) {
      console.log('No sidecar files found in src/content/_studio/');
      return;
    }
    for (const slug of slugs) {
      await exportSlug(slug);
    }
  } else if (args.length > 0) {
    for (const slug of args) {
      await exportSlug(slug);
    }
  } else {
    console.log('Usage: node scripts/export-mdx.mjs <slug> [<slug2>...] | --all');
    process.exit(1);
  }
}

main().catch((e) => {
  console.error(e.message);
  process.exit(1);
});
