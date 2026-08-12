// @ts-check
import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';
import tailwindcss from '@tailwindcss/vite';
import { soloIndexables } from './src/lib/sitemap.js';

const site = 'https://ahorroalvolante.es';

export default defineConfig({
  site,
  integrations: [sitemap({ filter: soloIndexables(site) })],
  vite: {
    plugins: [tailwindcss()],
  },
});
