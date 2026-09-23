// @ts-check
import { defineConfig } from 'astro/config';
import mdx from '@astrojs/mdx';
import tailwindcss from '@tailwindcss/vite';

// https://astro.build/config
export default defineConfig({
  site: 'https://seanmelotti.com',
  integrations: [mdx()],
  // /builds was the original slug. Kept as a redirect so any link that already
  // went out — or a preview URL Sean shared — still lands on the right page.
  redirects: {
    '/builds': '/projects',
  },
  vite: {
    plugins: [tailwindcss()],
  },
});
