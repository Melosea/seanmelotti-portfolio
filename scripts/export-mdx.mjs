#!/usr/bin/env node
/**
 * Export a studio sidecar JSON to a valid MDX entry in src/content/projects/
 * or src/content/skills/.
 *
 * Usage:
 *   node scripts/export-mdx.mjs giulietta-spyder-veloce
 *   node scripts/export-mdx.mjs --all
 *
 * The exported MDX validates against the extended Phase 2 schema:
 *   hero, specStrip, steps, gallery — all optional, Phase 1 entries still validate.
 * Idempotent: re-running overwrites cleanly. A sidecar missing `date` gets one
 * backfilled on first export so the date never churns on subsequent runs.
 */

import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { localDateStamp } from '../src/lib/local-date.mjs';

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
  // Determine hero from heroFilename field (v2) or legacy isCover (v1)
  const heroPhoto = sidecar.heroFilename
    ? sidecar.photos?.find(p => p.filename === sidecar.heroFilename)
    : sidecar.photos?.find(p => p.isCover);

  // One convention for every photo field: photo-root-relative, so the page
  // resolver hands it to astro:assets. The old `/photos/...` form only worked
  // against the dev-server middleware and 404'd in a production build.
  const coverPath = heroPhoto
    ? `${sidecar.slug}/${heroPhoto.filename}`
    : `/placeholders/project-01.svg`;

  // A dateless sidecar is backfilled by exportSlug() before we get here, so
  // this fallback is a last resort only (e.g. buildMdx called directly).
  const date = sidecar.date ?? localDateStamp();

  const base = {
    title: sidecar.title,
    summary: sidecar.summary ?? '',
    date,
    coverImage: coverPath,
    coverImageAlt: heroPhoto?.alt || heroPhoto?.caption || sidecar.title,
    tags: sidecar.tags ?? [],
    vehicle: sidecar.vehicle ?? (sidecar.type === 'skill' ? 'Various' : ''),
    featured: sidecar.featured ?? false,
    draft: sidecar.draft ?? false,
  };

  // Skills are a capability showcase, not a dated build log: no status pill,
  // so the field is written for projects only.
  if (sidecar.type !== 'skill') base.status = sidecar.status ?? 'complete';

  if (sidecar.type === 'skill') {
    base.contentType = 'skill';
  }

  // Phase 2 structured fields
  // Build steps from seqOrder (v2) or all photos (v1 fallback)
  const hasV2 = Array.isArray(sidecar.seqOrder);

  if (hasV2) {
    // Hero
    if (heroPhoto) {
      // alt falls back to caption, then title — never drop the hero for missing alt.
      const heroAlt = heroPhoto.alt?.trim() || heroPhoto.caption?.trim() || sidecar.title;
      base.hero = { src: coverPath, alt: heroAlt };
    }

    // Spec strip
    if (sidecar.specStrip && sidecar.specStrip.length > 0) {
      base.specStrip = sidecar.specStrip;
    }

    // Steps — every photo in seqOrder. Canvas is source of truth: a missing
    // alt falls back to caption/title instead of silently dropping the photo.
    const steps = [];
    let backfilled = 0;
    for (const fn of sidecar.seqOrder) {
      const photo = sidecar.photos?.find(p => p.filename === fn);
      if (!photo) continue;
      let alt = photo.alt?.trim();
      if (!alt) {
        alt = photo.caption?.trim() || sidecar.title;
        console.warn(`  step ${fn}: missing alt — using fallback`);
        backfilled++;
      }
      steps.push({
        src: `${sidecar.slug}/${fn}`,
        alt,
        caption: photo.caption ?? '',
        ...(photo.chapter ? { chapter: photo.chapter } : {}),
        ...(photo.orientation && photo.orientation !== 'landscape' ? { orientation: photo.orientation } : {}),
        ...(photo.pair ? { pair: true } : {}),
      });
    }
    if (steps.length > 0) base.steps = steps;
    if (backfilled > 0) console.warn(`  ${backfilled} step(s) used fallback alt text`);

    // Gallery — photos with destination='gallery'. Same fallback rule: never drop.
    const gallery = [];
    for (const photo of (sidecar.photos ?? [])) {
      if (photo.destination !== 'gallery') continue;
      const alt = photo.alt?.trim() || photo.caption?.trim() || sidecar.title;
      gallery.push({ src: `${sidecar.slug}/${photo.filename}`, alt });
    }
    if (gallery.length > 0) base.gallery = gallery;
  }

  return base;
}

function yamlValue(v) {
  if (v === null || v === undefined) return 'null';
  if (typeof v === 'boolean') return String(v);
  if (typeof v === 'number') return String(v);
  if (Array.isArray(v)) {
    if (v.length === 0) return '[]';
    // If array of strings, inline
    if (v.every(x => typeof x === 'string')) {
      return `[${v.map(x => `'${String(x).replace(/'/g, "''")}'`).join(', ')}]`;
    }
    // Array of objects — multi-line YAML
    return null; // handled separately
  }
  const s = String(v).replace(/'/g, "''");
  return `'${s}'`;
}

function yamlObject(obj, indent = '  ') {
  return Object.entries(obj)
    .filter(([, v]) => v !== undefined && v !== null)
    .map(([k, v]) => {
      if (typeof v === 'boolean' || typeof v === 'number') return `${indent}${k}: ${v}`;
      if (Array.isArray(v)) {
        if (v.length === 0) return `${indent}${k}: []`;
        if (v.every(x => typeof x === 'string')) {
          return `${indent}${k}: [${v.map(x => `'${String(x).replace(/'/g, "''")}'`).join(', ')}]`;
        }
        // Array of objects
        const items = v.map(item => {
          const lines = Object.entries(item).filter(([, val]) => val !== undefined).map(([ik, iv]) => {
            if (typeof iv === 'boolean') return `      ${ik}: ${iv}`;
            return `      ${ik}: '${String(iv).replace(/'/g, "''")}'`;
          });
          return lines[0].replace(/^      /, '    - ') + '\n' + lines.slice(1).join('\n');
        });
        return `${indent}${k}:\n${items.join('\n')}`;
      }
      if (typeof v === 'object') {
        const inner = Object.entries(v).map(([ik, iv]) => `    ${ik}: '${String(iv).replace(/'/g, "''")}'`).join('\n');
        return `${indent}${k}:\n${inner}`;
      }
      return `${indent}${k}: '${String(v).replace(/'/g, "''")}'`;
    })
    .join('\n');
}

function buildMdx(sidecar) {
  const fm = buildFrontmatter(sidecar);

  const fmLines = Object.entries(fm).map(([k, v]) => {
    if (v === null || v === undefined) return null;
    if (typeof v === 'boolean') return `${k}: ${v}`;
    if (typeof v === 'number') return `${k}: ${v}`;
    if (Array.isArray(v)) {
      if (v.length === 0) return `${k}: []`;
      if (v.every(x => typeof x === 'string')) {
        return `${k}: [${v.map(x => `'${String(x).replace(/'/g, "''")}'`).join(', ')}]`;
      }
      // Array of objects (steps, gallery)
      const items = v.map(item => {
        const entries = Object.entries(item).filter(([, val]) => val !== undefined);
        if (entries.length === 0) return '';
        const [firstK, firstV] = entries[0];
        const firstLine = `  - ${firstK}: '${String(firstV).replace(/'/g, "''")}'`;
        const rest = entries.slice(1).map(([ik, iv]) => {
          if (typeof iv === 'boolean') return `    ${ik}: ${iv}`;
          return `    ${ik}: '${String(iv).replace(/'/g, "''")}'`;
        });
        return [firstLine, ...rest].join('\n');
      });
      return `${k}:\n${items.join('\n')}`;
    }
    if (typeof v === 'object') {
      const inner = Object.entries(v).filter(([, iv]) => iv !== undefined).map(([ik, iv]) => `  ${ik}: '${String(iv).replace(/'/g, "''")}'`).join('\n');
      return `${k}:\n${inner}`;
    }
    // String
    const s = String(v).replace(/'/g, "''");
    return `${k}: '${s}'`;
  }).filter(Boolean).join('\n');

  return `---\n${fmLines}\n---\n`.trimEnd() + '\n';
}

async function exportSlug(slug) {
  const sidecar = await loadSidecar(slug);

  // Sidecars created before the date field existed have no `date`. Without
  // this backfill the frontmatter fallback re-stamps "today" on EVERY export,
  // so the MDX date silently churns on every autosave and shows up as a dirty
  // file forever. Persist the stamp once; from then on the export is stable.
  if (!sidecar.date) {
    sidecar.date = localDateStamp();
    await fs.writeFile(
      path.join(STUDIO_DIR, `${slug}.json`),
      JSON.stringify(sidecar),
      'utf-8',
    );
    console.log(`  backfilled missing sidecar date: ${sidecar.date}`);
  }

  const isSkill = sidecar.type === 'skill' || sidecar.contentType === 'skill';
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
    const slugs = files.filter(f => f.endsWith('.json')).map(f => f.replace('.json', ''));
    if (!slugs.length) { console.log('No sidecar files found.'); return; }
    for (const slug of slugs) await exportSlug(slug);
  } else if (args.length > 0) {
    for (const slug of args) await exportSlug(slug);
  } else {
    console.log('Usage: node scripts/export-mdx.mjs <slug> [<slug2>...] | --all');
    process.exit(1);
  }
}

main().catch(e => { console.error(e.message); process.exit(1); });
