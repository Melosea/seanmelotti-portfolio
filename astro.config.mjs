// @ts-check
import { defineConfig } from 'astro/config';
import mdx from '@astrojs/mdx';
import tailwindcss from '@tailwindcss/vite';
import react from '@astrojs/react';
import fs from 'node:fs';
import fsAsync from 'node:fs/promises';
import path from 'node:path';

/** Inject /studio route in dev only — excluded from production build. */
const studioDevIntegration = {
  name: 'studio-dev',
  hooks: {
    /** @param {{ command: string, injectRoute: Function }} opts */
    'astro:config:setup': ({ command, injectRoute }) => {
      if (command !== 'dev') return;
      injectRoute({
        pattern: '/studio',
        entrypoint: './src/_studio/index.astro',
      });
    },
  },
};

const MIME = {
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.webp': 'image/webp',
  '.heic': 'image/heic',
  '.gif': 'image/gif',
  '.json': 'application/json',
};

/** Vite plugin: serves src/assets/photos/ at /photos/ in dev server and
 *  provides /api/studio/* endpoints for the caption studio autosave. */
const studioVitePlugin = {
  name: 'studio-dev-api',
  configureServer(server) {
    const ROOT = process.cwd();
    const PHOTOS_DIR = path.join(ROOT, 'src', 'assets', 'photos');
    const STUDIO_DIR = path.join(ROOT, 'src', 'content', '_studio');

    // Serve photos at /photos/*
    server.middlewares.use('/photos', (req, res, next) => {
      const filePath = path.join(PHOTOS_DIR, decodeURIComponent(req.url || '/'));
      fs.readFile(filePath, (err, data) => {
        if (err) return next();
        const ext = path.extname(filePath).toLowerCase();
        res.setHeader('Content-Type', MIME[ext] || 'application/octet-stream');
        res.setHeader('Cache-Control', 'public, max-age=3600');
        res.end(data);
      });
    });

    // Studio API at /api/studio/*
    server.middlewares.use('/api/studio', async (req, res) => {
      res.setHeader('Content-Type', 'application/json');
      const url = new URL(req.url || '/', 'http://localhost');

      // GET /api/studio/projects — list projects from studio sidecars.
      // Blank-canvas doctrine: the picker count is the CANVAS count (sidecar
      // photos array), never the number of files sitting on disk. Folders
      // without a sidecar (e.g. "Portfolio Inbox") are source material, not
      // projects, and are not listed.
      if (url.pathname === '/projects' || url.pathname === '/projects/') {
        try {
          const files = await fsAsync.readdir(STUDIO_DIR).catch(() => []);
          const projects = [];
          for (const f of files) {
            if (!f.endsWith('.json')) continue;
            try {
              const sidecar = JSON.parse(await fsAsync.readFile(path.join(STUDIO_DIR, f), 'utf-8'));
              const slug = sidecar.slug || f.replace(/\.json$/, '');
              projects.push({
                slug,
                photoCount: Array.isArray(sidecar.photos) ? sidecar.photos.length : 0,
                manifest: null,
              });
            } catch { /* unreadable sidecar — skip */ }
          }
          projects.sort((a, b) => a.slug.localeCompare(b.slug));
          res.end(JSON.stringify({ projects }));
        } catch (e) {
          res.writeHead(500);
          res.end(JSON.stringify({ error: String(e) }));
        }
        return;
      }

      // GET /api/studio/photos/:slug — list photos in a folder
      const photosMatch = url.pathname.match(/^\/photos\/([^/]+)$/);
      if (photosMatch) {
        const slug = photosMatch[1];
        const dir = path.join(PHOTOS_DIR, slug);
        try {
          const files = (await fsAsync.readdir(dir))
            .filter((f) => /\.(jpg|jpeg|png|webp)$/i.test(f) && !f.startsWith('manifest'))
            .sort();
          const manifestPath = path.join(dir, 'manifest.json');
          let manifest = null;
          try { manifest = JSON.parse(await fsAsync.readFile(manifestPath, 'utf-8')); } catch {}
          res.end(JSON.stringify({ slug, photos: files, manifest }));
        } catch {
          res.writeHead(404);
          res.end(JSON.stringify({ error: 'Not found' }));
        }
        return;
      }

      // GET /api/studio/sidecar/:slug — read saved sidecar
      const getMatch = url.pathname.match(/^\/sidecar\/([^/]+)$/);
      if (getMatch && req.method === 'GET') {
        const slug = getMatch[1];
        const filePath = path.join(STUDIO_DIR, `${slug}.json`);
        try {
          const data = await fsAsync.readFile(filePath, 'utf-8');
          res.end(data);
        } catch {
          res.writeHead(404);
          res.end(JSON.stringify({ error: 'No saved data' }));
        }
        return;
      }

      // POST /api/studio/sidecar/:slug — save sidecar
      const postMatch = url.pathname.match(/^\/sidecar\/([^/]+)$/);
      if (postMatch && req.method === 'POST') {
        const slug = postMatch[1];
        const filePath = path.join(STUDIO_DIR, `${slug}.json`);
        let body = '';
        for await (const chunk of req) body += chunk;
        try {
          JSON.parse(body); // validate JSON
          await fsAsync.mkdir(STUDIO_DIR, { recursive: true });
          await fsAsync.writeFile(filePath, body, 'utf-8');
          res.end(JSON.stringify({ ok: true }));
        } catch (e) {
          res.writeHead(400);
          res.end(JSON.stringify({ error: String(e) }));
        }
        return;
      }

      // POST /api/studio/export — run MDX export for a slug
      if (url.pathname === '/export' && req.method === 'POST') {
        let body = '';
        for await (const chunk of req) body += chunk;
        try {
          const { slug } = JSON.parse(body);
          if (!slug) throw new Error('Missing slug');
          const { execFileSync } = await import('node:child_process');
          const outPath = path.join(ROOT, 'src', 'content', 'projects', `${slug}.mdx`);
          execFileSync('node', [path.join(ROOT, 'scripts', 'export-mdx.mjs'), slug], {
            cwd: ROOT, stdio: 'inherit',
          });
          res.end(JSON.stringify({ ok: true, path: `src/content/projects/${slug}.mdx` }));
        } catch (e) {
          res.writeHead(500);
          res.end(JSON.stringify({ error: String(e) }));
        }
        return;
      }

      // POST /api/studio/upload — receive base64-encoded files, write to src/assets/photos/<slug>/
      if (url.pathname === '/upload' && req.method === 'POST') {
        let body = '';
        for await (const chunk of req) body += chunk;
        try {
          const { slug, files } = JSON.parse(body);
          if (!slug || !Array.isArray(files)) throw new Error('Missing slug or files');
          const destDir = path.join(PHOTOS_DIR, slug);
          await fsAsync.mkdir(destDir, { recursive: true });
          const uploaded = [];
          for (const f of files) {
            if (!f.name || !f.data) continue;
            // f.data is a base64 data URL: data:<mime>;base64,<data>
            const base64 = f.data.split(',')[1];
            if (!base64) continue;
            const buffer = Buffer.from(base64, 'base64');
            const ext = path.extname(f.name).toLowerCase() || '.jpg';
            const base = path.basename(f.name, ext).replace(/[^a-zA-Z0-9._-]/g, '_');
            // Deduplicate: append _N if file already exists
            let filename = base + ext;
            let counter = 1;
            while (true) {
              try {
                await fsAsync.access(path.join(destDir, filename));
                filename = `${base}_${counter}${ext}`;
                counter++;
              } catch { break; }
            }
            await fsAsync.writeFile(path.join(destDir, filename), buffer);
            uploaded.push({ filename, originalName: f.name });
          }
          res.end(JSON.stringify({ ok: true, uploaded }));
        } catch (e) {
          res.writeHead(400);
          res.end(JSON.stringify({ error: String(e) }));
        }
        return;
      }

      res.writeHead(404);
      res.end(JSON.stringify({ error: 'Unknown endpoint' }));
    });
  },
};

// https://astro.build/config
export default defineConfig({
  site: 'https://seanmelotti.com',
  integrations: [mdx(), react(), studioDevIntegration],
  vite: {
    plugins: [tailwindcss(), studioVitePlugin],
  },
});
