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

      // GET /api/studio/projects — list projects from sidecar files (source of truth) + photo folders
      if (url.pathname === '/projects' || url.pathname === '/projects/') {
        try {
          // Build map slug → entry; seed from photo directories first
          const map = new Map();
          const dirEntries = await fsAsync.readdir(PHOTOS_DIR, { withFileTypes: true }).catch(() => []);
          for (const e of dirEntries) {
            if (!e.isDirectory()) continue;
            const photos = (await fsAsync.readdir(path.join(PHOTOS_DIR, e.name)).catch(() => []))
              .filter(f => /\.(jpg|jpeg|png|webp)$/i.test(f) && !f.startsWith('manifest'));
            if (photos.length > 0) {
              map.set(e.name, { slug: e.name, photoCount: photos.length, status: 'in-progress', title: e.name });
            }
          }
          // Overlay with sidecar data; also creates entries for projects with no photos yet
          await fsAsync.mkdir(STUDIO_DIR, { recursive: true });
          const sidecars = (await fsAsync.readdir(STUDIO_DIR).catch(() => []))
            .filter(f => f.endsWith('.json'));
          for (const file of sidecars) {
            const slug = file.replace(/\.json$/, '');
            let sidecar = {};
            try { sidecar = JSON.parse(await fsAsync.readFile(path.join(STUDIO_DIR, file), 'utf-8')); } catch {}
            const existing = map.get(slug) ?? { slug, photoCount: 0 };
            map.set(slug, {
              ...existing,
              slug,
              status: sidecar.status ?? 'in-progress',
              title: sidecar.title ?? slug,
            });
          }
          res.end(JSON.stringify({ projects: Array.from(map.values()) }));
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
            const originalExt = path.extname(f.name);
            const ext = originalExt.toLowerCase() || '.jpg';
            // path.basename strips exactly the string passed — use the original case so
            // 'IMG_6512.HEIC' stripped with '.HEIC' gives 'IMG_6512', not 'IMG_6512.HEIC'.
            const base = path.basename(f.name, originalExt).replace(/[^a-zA-Z0-9._-]/g, '_');
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

      // POST /api/studio/create-project — create new project sidecar + photo folder
      if (url.pathname === '/create-project' && req.method === 'POST') {
        let body = '';
        for await (const chunk of req) body += chunk;
        try {
          const { name } = JSON.parse(body);
          if (!name?.trim()) throw new Error('Missing name');
          const slug = name.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
          if (!slug) throw new Error('Invalid name — could not generate slug');
          const filePath = path.join(STUDIO_DIR, `${slug}.json`);
          try {
            await fsAsync.access(filePath);
            throw new Error(`Project "${slug}" already exists`);
          } catch (e) {
            if (String(e).includes('already exists')) throw e;
            // access threw ENOENT — good, file doesn't exist
          }
          const sidecar = {
            slug,
            title: name.trim(),
            summary: '',
            status: 'in-progress',
            heroFilename: null,
            specStrip: [],
            seqOrder: [],
            photos: [],
          };
          await fsAsync.mkdir(STUDIO_DIR, { recursive: true });
          await fsAsync.writeFile(filePath, JSON.stringify(sidecar, null, 2), 'utf-8');
          await fsAsync.mkdir(path.join(PHOTOS_DIR, slug), { recursive: true });
          res.end(JSON.stringify({ ok: true, slug, title: name.trim() }));
        } catch (e) {
          res.writeHead(400);
          res.end(JSON.stringify({ error: String(e) }));
        }
        return;
      }

      // POST /api/studio/set-status — update status field only (sidebar status dropdown)
      if (url.pathname === '/set-status' && req.method === 'POST') {
        let body = '';
        for await (const chunk of req) body += chunk;
        try {
          const { slug, status } = JSON.parse(body);
          if (!slug || !['in-progress', 'completed'].includes(status)) {
            throw new Error('Missing or invalid slug/status. Valid: "in-progress", "completed"');
          }
          const filePath = path.join(STUDIO_DIR, `${slug}.json`);
          let sidecar = {};
          try { sidecar = JSON.parse(await fsAsync.readFile(filePath, 'utf-8')); } catch {}
          sidecar.status = status;
          sidecar.slug = sidecar.slug ?? slug;
          await fsAsync.mkdir(STUDIO_DIR, { recursive: true });
          await fsAsync.writeFile(filePath, JSON.stringify(sidecar, null, 2), 'utf-8');
          res.end(JSON.stringify({ ok: true }));
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
