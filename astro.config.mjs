// @ts-check
import { defineConfig } from 'astro/config';
import mdx from '@astrojs/mdx';
import tailwindcss from '@tailwindcss/vite';
import react from '@astrojs/react';
import fs from 'node:fs';
import fsAsync from 'node:fs/promises';
import path from 'node:path';
import { localDateStamp } from './src/lib/local-date.mjs';

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
    const PAGES_DIR = path.join(ROOT, 'src', 'content', 'pages');

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
      // projects, and are not listed. diskCount is reported alongside so the
      // sidebar can show a "pending import" badge, but it is never authoritative.
      // NOTE: the GET guard is load-bearing — POST /projects is handled below.
      if ((url.pathname === '/projects' || url.pathname === '/projects/') && req.method === 'GET') {
        try {
          await fsAsync.mkdir(STUDIO_DIR, { recursive: true });
          const files = (await fsAsync.readdir(STUDIO_DIR).catch(() => [])).filter(f => f.endsWith('.json'));
          const projects = [];
          for (const f of files) {
            try {
              /** @type {{ slug?: string, photos?: unknown[], status?: string, title?: string, type?: string, contentType?: string, draft?: boolean }} */
              const sidecar = JSON.parse(await fsAsync.readFile(path.join(STUDIO_DIR, f), 'utf-8'));
              const slug = sidecar.slug || f.replace(/.json$/, '');
              // Only read disk for slugs that already have a sidecar — never discover folders.
              const diskCount = (await fsAsync.readdir(path.join(PHOTOS_DIR, slug)).catch(() => []))
                .filter(x => /.(jpg|jpeg|png|webp)$/i.test(x) && !x.startsWith('manifest')).length;
              projects.push({
                slug,
                title: sidecar.title ?? slug,
                status: sidecar.status ?? 'in-progress',
                // Same test the exporter uses. Untyped entries are projects.
                type: sidecar.type === 'skill' || sidecar.contentType === 'skill' ? 'skill' : 'project',
                // Publish gate, using the exporter's exact default (`draft ?? false`):
                // a sidecar with no `draft` key is Live. Sent on the list payload so
                // the sidebar can show live/draft without opening every entry.
                draft: sidecar.draft === true,
                canvasCount: Array.isArray(sidecar.photos) ? sidecar.photos.length : 0,
                diskCount,
                manifest: null,
              });
            } catch { /* unreadable sidecar — skip */ }
          }
          projects.sort((a, b) => a.slug.localeCompare(b.slug));
          res.end(JSON.stringify({ projects }));        } catch (e) {
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
          execFileSync('node', [path.join(ROOT, 'scripts', 'export-mdx.mjs'), slug], {
            cwd: ROOT, stdio: 'inherit',
          });
          // The exporter routes skills to src/content/skills — report where the
          // file actually landed rather than assuming it was a project.
          /** @type {{ type?: string, contentType?: string }} */
          let sidecar = {};
          try {
            sidecar = JSON.parse(await fsAsync.readFile(path.join(STUDIO_DIR, `${slug}.json`), 'utf-8'));
          } catch {}
          const collection = sidecar.type === 'skill' || sidecar.contentType === 'skill' ? 'skills' : 'projects';
          res.end(JSON.stringify({ ok: true, path: `src/content/${collection}/${slug}.mdx` }));
        } catch (e) {
          res.writeHead(500);
          res.end(JSON.stringify({ error: String(e) }));
        }
        return;
      }

      // POST /api/studio/projects — create a new blank sidecar JSON
      if (url.pathname === '/projects' || url.pathname === '/projects/') {
        if (req.method !== 'POST') {
          res.writeHead(405);
          res.end(JSON.stringify({ error: 'Method not allowed' }));
          return;
        }
        let body = '';
        for await (const chunk of req) body += chunk;
        try {
          const { name } = JSON.parse(body);
          if (!name || !name.trim()) throw new Error('Project name is required');
          const slug = name.trim().toLowerCase()
            .replace(/[^a-z0-9\s-]/g, '')
            .replace(/\s+/g, '-')
            .replace(/-+/g, '-')
            .replace(/^-|-$/g, '');
          if (!slug) throw new Error('Name produces an empty slug — use letters or numbers');
          const filePath = path.join(STUDIO_DIR, `${slug}.json`);
          // Reject duplicates
          try {
            await fsAsync.access(filePath);
            res.writeHead(409);
            res.end(JSON.stringify({ error: `Project "${slug}" already exists` }));
            return;
          } catch { /* file doesn't exist — good */ }
          const today = localDateStamp();
          const sidecar = {
            slug,
            title: name.trim(),
            summary: '',
            date: today,
            tags: [],
            vehicle: '',
            status: 'in-progress',
            featured: false,
            draft: true,
            heroFilename: null,
            specStrip: [],
            seqOrder: [],
            photos: [],
          };
          await fsAsync.mkdir(STUDIO_DIR, { recursive: true });
          await fsAsync.writeFile(filePath, JSON.stringify(sidecar, null, 2), 'utf-8');
          res.end(JSON.stringify({ ok: true, slug }));
        } catch (e) {
          if (!res.headersSent) res.writeHead(400);
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

      // POST /api/studio/create-project — create new project or skill sidecar + photo folder
      if (url.pathname === '/create-project' && req.method === 'POST') {
        let body = '';
        for await (const chunk of req) body += chunk;
        try {
          const { name, type } = JSON.parse(body);
          if (!name?.trim()) throw new Error('Missing name');
          // `type` is optional so older callers that only send a name keep working.
          const entryType = type ?? 'project';
          if (!['project', 'skill'].includes(entryType)) {
            throw new Error('Invalid type. Valid: "project", "skill"');
          }
          const slug = name.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
          if (!slug) throw new Error('Invalid name — could not generate slug');
          const filePath = path.join(STUDIO_DIR, `${slug}.json`);
          try {
            await fsAsync.access(filePath);
            throw new Error(`Entry "${slug}" already exists`);
          } catch (e) {
            if (String(e).includes('already exists')) throw e;
            // access threw ENOENT — good, file doesn't exist
          }
          const sidecar = {
            slug,
            // The exporter reads `type` to choose src/content/skills vs projects.
            type: entryType,
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
          res.end(JSON.stringify({ ok: true, slug, title: name.trim(), type: entryType }));
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
          /** @type {{ status?: string, slug?: string }} */
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

      // GET /api/studio/page-content/:page — read page content JSON
      // POST /api/studio/page-content/:page — write page content JSON
      const pageContentMatch = url.pathname.match(/^\/page-content\/([a-z0-9-]+)$/);
      if (pageContentMatch) {
        const page = pageContentMatch[1];
        const allowedPages = ['home', 'about', 'contact', '404'];
        if (!allowedPages.includes(page)) {
          res.writeHead(400);
          res.end(JSON.stringify({ error: `Unknown page: ${page}` }));
          return;
        }
        const filePath = path.join(PAGES_DIR, `${page}.json`);
        if (req.method === 'GET') {
          try {
            const data = await fsAsync.readFile(filePath, 'utf-8');
            res.end(data);
          } catch {
            res.writeHead(404);
            res.end(JSON.stringify({ error: 'Page content not found' }));
          }
          return;
        }
        if (req.method === 'POST') {
          let body = '';
          for await (const chunk of req) body += chunk;
          try {
            JSON.parse(body); // validate JSON
            await fsAsync.mkdir(PAGES_DIR, { recursive: true });
            await fsAsync.writeFile(filePath, body, 'utf-8');
            res.end(JSON.stringify({ ok: true }));
          } catch (e) {
            res.writeHead(400);
            res.end(JSON.stringify({ error: String(e) }));
          }
          return;
        }
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
    server: {
      watch: {
        // Sidecar saves from the Studio must NOT trigger a dev-server reload
        ignored: ['**/src/content/_studio/**'],
      },
    },
  },
});
