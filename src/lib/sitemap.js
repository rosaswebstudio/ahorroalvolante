// Filtro del sitemap: si una página se ha generado con noindex, no se ofrece al buscador.
//
// La regla de qué se indexa y qué no vive en un único sitio, la propia página. Aquí no se
// repite ese criterio (ni el umbral de estaciones ni ningún otro), solo se lee el
// resultado. Así no hay dos verdades que se puedan desincronizar el día que alguien
// cambie el umbral y se olvide de tocar la configuración.
//
// Se puede leer del HTML porque @astrojs/sitemap genera el fichero en `astro:build:done`,
// cuando dist ya está escrito en disco.
import fs from 'node:fs';
import path from 'node:path';

const TIENE_NOINDEX = /name="robots"[^>]*content="[^"]*noindex/i;

/**
 * @param {string} site - la misma URL que `site` en astro.config.mjs
 * @param {string} outDir - carpeta de salida del build
 * @returns {(url: string) => boolean} filtro para @astrojs/sitemap
 */
export function soloIndexables(site, outDir = 'dist') {
  const base = new URL(site).href.replace(/\/$/, '');
  const cache = new Map();

  return (url) => {
    const ruta = url.startsWith(base) ? url.slice(base.length) : url;
    const fichero = path.join(outDir, ruta.replace(/^\//, ''), 'index.html');

    if (!cache.has(fichero)) {
      let html;
      try {
        html = fs.readFileSync(fichero, 'utf8');
      } catch {
        // Si no hay fichero que leer (una ruta que no es una página), no se excluye:
        // este filtro solo está para quitar, nunca para añadir dudas.
        cache.set(fichero, true);
        return true;
      }
      cache.set(fichero, !TIENE_NOINDEX.test(html));
    }
    return cache.get(fichero);
  };
}
