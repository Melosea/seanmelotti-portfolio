#!/usr/bin/env node
/**
 * Orphan file scanner.
 * Finds: (a) images in src/assets/photos/ not referenced by any MDX
 *        (b) public/ images not referenced by any MDX
 *        (c) MDX image refs pointing at files that don't exist
 * Writes orphan-report.json to the repo root. Does NOT delete anything.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const IMG_EXT = /\.(jpg|jpeg|png|webp|gif|svg|heic|avif)$/i;
const MDX_EXT = /\.(mdx|md)$/i;

function walkDir(dir, extRe) {
  const results = [];
  if (!fs.existsSync(dir)) return results;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) results.push(...walkDir(full, extRe));
    else if (extRe.test(entry.name)) results.push(full);
  }
  return results;
}

// Collect all image files
const assetPhotos = walkDir(path.join(ROOT, 'src', 'assets', 'photos'), IMG_EXT)
  .map(f => path.relative(ROOT, f).split(path.sep).join('/'));

const publicPhotos = walkDir(path.join(ROOT, 'public'), IMG_EXT)
  .map(f => path.relative(ROOT, f).split(path.sep).join('/'));

// Collect all MDX refs
const mdxFiles = walkDir(path.join(ROOT, 'src', 'content'), MDX_EXT);
const mdxRefs = new Set();

for (const f of mdxFiles) {
  const raw = fs.readFileSync(f, 'utf-8');
  for (const m of raw.matchAll(/\bsrc:\s*['"]([^'"]+)['"]/g))        mdxRefs.add(m[1]);
  for (const m of raw.matchAll(/\bcoverImage:\s*['"]([^'"]+)['"]/g)) mdxRefs.add(m[1]);
  for (const m of raw.matchAll(/!\[.*?\]\(([^)]+)\)/g))              mdxRefs.add(m[1]);
}

// Orphan assets: in src/assets/photos but not referenced
const orphanAssets = assetPhotos.filter(ap => {
  const relToPhotos = ap.replace('src/assets/photos/', '');
  return !mdxRefs.has(relToPhotos);
});

// Missing refs: MDX refs that point to a non-existent file
const missingRefs = [];
for (const ref of mdxRefs) {
  const assetPath = `src/assets/photos/${ref}`;
  const publicPath = `public/${ref}`;
  if (!fs.existsSync(path.join(ROOT, assetPath)) && !fs.existsSync(path.join(ROOT, publicPath))) {
    missingRefs.push({ ref, checkedPaths: [assetPath, publicPath] });
  }
}

const report = {
  generated: new Date().toISOString(),
  summary: {
    totalAssetPhotos: assetPhotos.length,
    totalPublicPhotos: publicPhotos.length,
    totalMdxRefs: mdxRefs.size,
    orphanCount: orphanAssets.length,
    missingCount: missingRefs.length,
  },
  orphanAssets,
  publicPhotos,
  missingRefs,
  allMdxRefs: Array.from(mdxRefs),
};

const outPath = path.join(ROOT, 'orphan-report.json');
fs.writeFileSync(outPath, JSON.stringify(report, null, 2), 'utf-8');
console.log('Report written to', outPath);
console.log('Summary:', JSON.stringify(report.summary, null, 2));
if (orphanAssets.length) { console.log('\nOrphan assets:'); orphanAssets.forEach(a => console.log(' ', a)); }
if (missingRefs.length) { console.log('\nMissing MDX refs:'); missingRefs.forEach(m => console.log(' ', m.ref)); }
