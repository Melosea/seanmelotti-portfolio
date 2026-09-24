#!/usr/bin/env node
/**
 * Round-trip guard: every photo reference in every content entry must resolve
 * to a real file that the page resolver's glob actually picks up.
 *
 * It walks src/content/{projects,skills} for .md/.mdx, pulls coverImage,
 * hero.src, steps[].src and gallery[].src out of the frontmatter, and for each
 * one asserts:
 *   1. it normalises to a photo key (not a stray /public path or a URL),
 *   2. the file exists on disk,
 *   3. the extension is one the page glob actually matches.
 *
 * It also rejects an entry whose every reference is a placeholder — that page
 * builds fine but shows no real photo, which is the failure this whole change
 * exists to prevent.
 *
 * With --sidecars it closes the Studio loop too: every non-cut photo in every
 * studio sidecar must resolve, so an export can only ever emit good paths.
 *
 * Usage:
 *   node scripts/check-image-refs.mjs
 *   node scripts/check-image-refs.mjs --sidecars
 *
 * Exit 0 = every reference resolves. Exit 1 = at least one is broken.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parse as parseYaml } from 'yaml';
import {
  toPhotoKey,
  PHOTO_ROOT,
  PHOTO_EXTENSIONS,
  photoRefs,
} from '../src/lib/photo-path.mjs';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const CONTENT_DIRS = ['src/content/projects', 'src/content/skills'];
const STUDIO_DIR = path.join(ROOT, 'src', 'content', '_studio');

function readFrontmatter(file) {
  const raw = fs.readFileSync(file, 'utf-8');
  const m = raw.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  return m ? parseYaml(m[1]) : null;
}

const failures = [];
let resolved = 0;
let placeholders = 0;

function checkRef(source, field, src) {
  const label = source + ' :: ' + field;

  const key = toPhotoKey(src);
  if (!key) {
    // A placeholder is only tolerable on coverImage, where the card and the
    // legacy layout deliberately fall back to it. Anywhere else the figure is
    // silently dropped from the page, which is worse than a visible gap.
    if (typeof src === 'string' && src.startsWith('/placeholders/')) {
      if (field !== 'coverImage') {
        failures.push(
          label + ": '" + src + "' is a /public placeholder — " + field +
            ' renders nothing at all for it. Use a real photo or drop the entry.'
        );
        return false;
      }
      const abs = path.join(ROOT, 'public', src.replace(/^[/]/, ''));
      if (!fs.existsSync(abs)) {
        failures.push(label + ": placeholder '" + src + "' is missing from /public.");
        return false;
      }
      placeholders++;
      return 'placeholder';
    }
    failures.push(
      label + ": '" + src + "' is not a resolvable photo path (expected 'slug/file.jpg')."
    );
    return false;
  }

  const ext = key.slice(key.lastIndexOf('.')).toLowerCase();
  if (!PHOTO_EXTENSIONS.includes(ext)) {
    failures.push(label + ": '" + src + "' has extension '" + ext + "', which the page glob ignores.");
    return false;
  }
  if (!key.startsWith(PHOTO_ROOT)) {
    failures.push(label + ": '" + src + "' resolves outside " + PHOTO_ROOT + '.');
    return false;
  }
  const abs = path.join(ROOT, key.replace(/^[/]/, ''));
  if (!fs.existsSync(abs)) {
    failures.push(label + ": '" + src + "' -> " + key + ' does not exist on disk.');
    return false;
  }
  resolved++;
  return true;
}

let entryCount = 0;

for (const dir of CONTENT_DIRS) {
  const abs = path.join(ROOT, dir);
  if (!fs.existsSync(abs)) continue;
  for (const file of fs.readdirSync(abs).filter((f) => /[.]mdx?$/.test(f))) {
    const rel = dir + '/' + file;
    let data;
    try {
      data = readFrontmatter(path.join(abs, file));
    } catch (e) {
      failures.push(rel + ': frontmatter did not parse — ' + e.message);
      continue;
    }
    if (!data) {
      failures.push(rel + ': no frontmatter block found.');
      continue;
    }
    entryCount++;

    const refs = photoRefs(data);
    if (refs.length === 0) {
      failures.push(rel + ': no photo references at all — the page would render bare.');
      continue;
    }

    let realPhotos = 0;
    for (const { field, src } of refs) {
      if (checkRef(rel, field, src) === true) realPhotos++;
    }
    if (realPhotos === 0) {
      failures.push(
        rel + ': no reference resolves to a real photo — the page would render placeholders only.'
      );
    }
  }
}

if (process.argv.includes('--sidecars') && fs.existsSync(STUDIO_DIR)) {
  for (const file of fs.readdirSync(STUDIO_DIR).filter((f) => f.endsWith('.json'))) {
    const sidecar = JSON.parse(fs.readFileSync(path.join(STUDIO_DIR, file), 'utf-8'));
    const slug = sidecar.slug ?? file.replace(/[.]json$/, '');
    for (const photo of sidecar.photos ?? []) {
      if (photo.destination === 'cut') continue;
      checkRef('_studio/' + file, 'photos[' + photo.filename + ']', slug + '/' + photo.filename);
    }
  }
}

if (failures.length) {
  console.error('BROKEN IMAGE REFERENCES (' + failures.length + '):');
  for (const f of failures) console.error('  x ' + f);
  console.error(
    entryCount + ' entries | ' + resolved + ' resolved | ' + placeholders + ' placeholders'
  );
  process.exit(1);
}

console.log(
  'All image references resolve - ' +
    entryCount +
    ' entries | ' +
    resolved +
    ' photos | ' +
    placeholders +
    ' placeholders.'
);
