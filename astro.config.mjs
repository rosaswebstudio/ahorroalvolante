// @ts-check
import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';
import tailwindcss from '@tailwindcss/vite';
import { soloIndexables } from './src/lib/sitemap.js';
import { conLastmod } from './src/lib/lastmod.js';

const site = 'https://ahorroalvolante.es';

export default defineConfig({
  site,
  integrations: [sitemap({ filter: soloIndexables(site), serialize: conLastmod(site) })],
  vite: {
    plugins: [tailwindcss()],
  },
});
