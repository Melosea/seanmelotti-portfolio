#!/usr/bin/env node
/**
 * One-shot HEIC -> JPEG converter for giulietta-spyder-veloce gallery.
 * Reads originals from Portfolio Inbox, writes to src/assets/photos/giulietta-spyder-veloce/
 * Preserves originals untouched. Committed derivatives are the web-safe outputs.
 *
 * Why committed (not build-time): Cloudflare Pages build has no HEIC decoder;
 * committed JPEGs are deterministic and match the welding-fabrication precedent.
 *
 * Usage: node scripts/convert-heic.mjs
 */

import sharp from 'sharp';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const INBOX = path.join(ROOT, 'src', 'assets', 'photos', 'Portfolio Inbox', '1958 Alfa Romeo Giulietta Spyder Veloce');
const OUT_DIR = path.join(ROOT, 'src', 'assets', 'photos', 'giulietta-spyder-veloce');

// Only the three files currently referenced in the sidecar
const TARGETS = ['IMG_6512.HEIC', 'IMG_0279.HEIC', 'IMG_0280.HEIC'];

async function main() {
  await fs.mkdir(OUT_DIR, { recursive: true });

  let converted = 0;
  let failed = 0;

  for (const heicName of TARGETS) {
    const src = path.join(INBOX, heicName);
    const baseName = path.basename(heicName, path.extname(heicName));
    const dest = path.join(OUT_DIR, `${baseName}.jpg`);

    try {
      await fs.access(src);
    } catch {
      console.error(`MISSING source: ${heicName}`);
      failed++;
      continue;
    }

    try {
      const meta = await sharp(src).metadata();
      console.log(`  ${heicName}: ${meta.width}x${meta.height} (${meta.format})`);

      await sharp(src)
        .rotate()           // auto-orient via EXIF
        .jpeg({ quality: 88, mozjpeg: true })
        .toFile(dest);

      const stat = await fs.stat(dest);
      console.log(`  -> ${path.basename(dest)} (${(stat.size / 1024).toFixed(0)} KB)`);
      converted++;
    } catch (e) {
      console.error(`  ERROR converting ${heicName}: ${e.message}`);
      failed++;
    }
  }

  // Remove the double-extension .HEIC.heic debris files if present
  const debris = (await fs.readdir(OUT_DIR)).filter(f => /\.HEIC\.heic$/i.test(f));
  for (const f of debris) {
    await fs.unlink(path.join(OUT_DIR, f));
    console.log(`  Removed double-ext debris: ${f}`);
  }

  console.log(`\nDone: ${converted} converted, ${failed} failed, ${debris.length} debris removed`);
  if (failed > 0) process.exit(1);
}

main().catch(e => { console.error(e.message); process.exit(1); });
