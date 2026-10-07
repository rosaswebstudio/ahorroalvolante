// Fecha de última modificación de cada URL para el sitemap.
//
// Por qué importa: `lastmod` es la señal con la que Google decide a qué URLs vuelve y a
// cuáles no. Un sitemap sin `lastmod` obliga al rastreador a descubrir por su cuenta, una
// a una, que 364 páginas han cambiado.
//
// Por qué no se pone la fecha del build en todo: porque entonces es mentira la mayor parte
// del tiempo, y Google deja de hacer caso a un `lastmod` que no se corresponde con cambios
// reales. La regla de esta casa es que la fecha tiene que poder defenderse página a página:
//
//   - Lo que se regenera con los precios del Ministerio cada día (municipios, provincias,
//     marcas, combustibles, portada) cambia de verdad a diario. Ahí la fecha del build es
//     exacta.
//   - Una guía cambia el día que se revisa su texto, y esa fecha ya existe en guias.js.
//   - Las páginas legales cambian el día que se tocan, y casi nunca se tocan.
//
// Y sobre todo: cuando se reescribe la PLANTILLA de un tipo de página, ese día cambian de
// golpe todas sus páginas aunque su contenido propio sea antiguo. Para eso está
// REVISION_PLANTILLA: es la fecha de la última reforma de fondo del sitio, y actúa como
// suelo. Hay que subirla cuando se vuelva a reformar, y no antes.
import { GUIAS } from './guias.js';

/**
 * Última reforma de fondo de las plantillas.
 * 2026-10-07: análisis propio por municipio, provincia y marca (src/lib/analisis.js),
 * 12 guías nuevas, autor nombrado y reescritura de Quiénes somos y Contacto.
 */
export const REVISION_PLANTILLA = '2026-10-07';

// Páginas sin datos del día: su fecha es la del último cambio real de su texto.
// Se mantienen a mano porque son pocas y porque leerlas de git no es fiable en un build
// de Vercel, que clona en superficial y puede no tener el commit que tocó el fichero.
const ESTATICAS = {
  '/aviso-legal/': '2026-07-20',
  '/privacidad/': '2026-07-20',
  '/cookies/': '2026-07-20',
  '/quienes-somos/': '2026-10-07',
  '/contacto/': '2026-10-07',
};

// Rutas cuyo contenido se recalcula en cada build con los precios del día.
const CON_DATOS_DEL_DIA = [
  '/',
  '/gasolineras-baratas/',
  '/marcas/',
  '/precios/',
  '/calcular-gasto-gasolina/',
  '/diesel-o-gasolina/',
];

const porSlug = new Map(GUIAS.map((g) => [g.slug, g.actualizada]));

/** La más reciente de dos fechas ISO cortas. */
const masReciente = (a, b) => (a > b ? a : b);

/**
 * @param {string} ruta - ruta del sitio con barras inicial y final ("/guias/adblue/")
 * @param {string} fechaBuild - fecha del build en ISO corto ("2026-10-07")
 * @returns {string} fecha ISO corta para el <lastmod>
 */
export function lastmodDe(ruta, fechaBuild) {
  if (ESTATICAS[ruta]) return masReciente(ESTATICAS[ruta], REVISION_PLANTILLA);

  const guia = ruta.match(/^\/guias\/([^/]+)\/$/);
  if (guia) {
    const propia = porSlug.get(guia[1]);
    // El índice de guías (/guias/) no es una guía: cambia cuando se añade una.
    if (propia) return masReciente(propia, REVISION_PLANTILLA);
  }

  if (CON_DATOS_DEL_DIA.some((p) => (p === '/' ? ruta === '/' : ruta.startsWith(p)))) {
    return fechaBuild;
  }

  // Cualquier ruta que no encaje en nada conocido (un índice, una página nueva sin
  // clasificar): la fecha de la última reforma, que es lo único que se puede afirmar.
  return masReciente(REVISION_PLANTILLA, ESTATICAS[ruta] ?? REVISION_PLANTILLA);
}

/**
 * Serializador para @astrojs/sitemap. Se queda con la fecha del build una sola vez, para
 * que todas las páginas del mismo build compartan la misma y no haya saltos de un
 * segundo entre unas y otras.
 *
 * @param {string} site - la misma URL que `site` en astro.config.mjs
 */
export function conLastmod(site) {
  const base = new URL(site).href.replace(/\/$/, '');
  const fechaBuild = new Date().toISOString().slice(0, 10);

  return (item) => {
    const ruta = item.url.startsWith(base) ? item.url.slice(base.length) : item.url;
    return { ...item, lastmod: lastmodDe(ruta || '/', fechaBuild) };
  };
}
