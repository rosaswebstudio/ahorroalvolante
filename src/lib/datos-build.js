// Carga y agregación de precios para generar las páginas de provincia EN EL BUILD.
// No importar desde el navegador: descarga el listado nacional entero (~12 MB).
// Fuente: misma API oficial del Ministerio que usa el buscador (ver gasolineras.js).
import { API_BASE, COMBUSTIBLES, PROVINCIAS, slugProvincia, slugify } from './gasolineras.js';

// A partir de cuántas gasolineras un pueblo tiene página propia. Por debajo, la página
// sería demasiado pobre (un "ranking" de una o dos estaciones no informa), así que esos
// pueblos solo aparecen mencionados dentro de la página de su provincia.
export const MIN_ESTACIONES_MUNICIPIO = 3;

// Descarta precios absurdos (registros mal comunicados) antes de hacer medias.
const PRECIO_MIN = 0.4;
const PRECIO_MAX = 4;

const precio = (e, campo) => {
  const n = parseFloat(String(e[campo] ?? '').replace(',', '.'));
  return Number.isFinite(n) && n >= PRECIO_MIN && n <= PRECIO_MAX ? n : null;
};

const coord = (v) => {
  const n = parseFloat(String(v ?? '').replace(',', '.'));
  return Number.isFinite(n) ? n : null;
};

const media = (xs) => xs.reduce((a, b) => a + b, 0) / xs.length;

let cache = null;

/** Descarga el listado nacional completo, con reintentos. Se cachea por proceso. */
export async function cargarNacional() {
  if (cache) return cache;
  let ultimo;
  for (let intento = 1; intento <= 3; intento++) {
    try {
      const res = await fetch(`${API_BASE}/EstacionesTerrestres/`, {
        headers: { Accept: 'application/json' },
      });
      if (!res.ok) throw new Error('HTTP ' + res.status);
      const json = await res.json();
      const lista = json.ListaEESSPrecio || [];
      // Guarda contra respuestas truncadas: el listado real ronda las 11.500 estaciones.
      if (lista.length < 5000) throw new Error('respuesta incompleta (' + lista.length + ')');
      cache = { fecha: json.Fecha || '', estaciones: lista };
      return cache;
    } catch (err) {
      ultimo = err;
      if (intento < 3) await new Promise((r) => setTimeout(r, 2000 * intento));
    }
  }
  throw new Error(
    'No se pudieron descargar los precios del Ministerio para el build: ' + ultimo.message
  );
}

// Algunas estaciones comunican el rótulo como "-" o vacío: sin letras ni números
// no es un nombre, y en la web se vería una gasolinera sin identificar.
const rotulo = (v) => {
  const s = String(v ?? '').trim();
  return /[\p{L}\p{N}]/u.test(s) ? s : 'Sin rótulo';
};

function reducir(e) {
  return {
    idMuni: String(e['IDMunicipio'] ?? '').trim(),
    rotulo: rotulo(e['Rótulo']),
    dir: (e['Dirección'] || '').trim(),
    muni: (e['Municipio'] || '').trim(),
    horario: (e['Horario'] || '').trim(),
    lat: coord(e['Latitud']),
    lng: coord(e['Longitud (WGS84)']),
    p: Object.fromEntries(COMBUSTIBLES.map((c) => [c.id, precio(e, c.campo)])),
  };
}

/**
 * Agrupa las estaciones por provincia y municipio, asignando a cada municipio un slug
 * de URL estable. El slug se calcula sobre TODOS los municipios de la provincia y en
 * orden fijo (por id), de modo que no cambia aunque cambie el umbral: así los enlaces
 * provincia -> pueblo y la URL de la página siempre coinciden.
 */
function agruparPorMunicipio(estaciones) {
  const provincias = new Map(); // idProv -> Map(idMuni -> { idMuni, nombre, lista })
  for (const raw of estaciones) {
    const idProv = String(raw['IDProvincia'] ?? '').padStart(2, '0');
    const est = reducir(raw);
    const idMuni = est.idMuni || est.muni;
    if (!provincias.has(idProv)) provincias.set(idProv, new Map());
    const munis = provincias.get(idProv);
    if (!munis.has(idMuni)) munis.set(idMuni, { idMuni, nombre: est.muni, lista: [] });
    munis.get(idMuni).lista.push(est);
  }
  for (const munis of provincias.values()) {
    const usados = new Set();
    const orden = [...munis.values()].sort((a, b) => a.idMuni.localeCompare(b.idMuni));
    for (const m of orden) {
      const base = slugify(m.nombre) || 'muni-' + m.idMuni;
      let slug = base;
      let i = 2;
      while (usados.has(slug)) slug = `${base}-${i++}`; // colisión (muy rara)
      usados.add(slug);
      m.slug = slug;
    }
  }
  return provincias;
}

/** Medias por municipio para un combustible, de más barato a más caro. */
function porMunicipio(lista, fuel, minEstaciones = 3) {
  const g = new Map();
  for (const e of lista) {
    if (e.p[fuel] == null || !e.muni) continue;
    if (!g.has(e.muni)) g.set(e.muni, []);
    g.get(e.muni).push(e.p[fuel]);
  }
  return [...g.entries()]
    .filter(([, v]) => v.length >= minEstaciones)
    .map(([muni, v]) => ({ muni, n: v.length, media: media(v) }))
    .sort((a, b) => a.media - b.media);
}

/** Estadísticas de un combustible dentro de una provincia. */
function resumirCombustible(lista, fuel, topN) {
  const con = lista.filter((e) => e.p[fuel] != null);
  if (!con.length) return null;
  const precios = con.map((e) => e.p[fuel]);
  return {
    n: con.length,
    min: Math.min(...precios),
    max: Math.max(...precios),
    media: media(precios),
    baratas: [...con].sort((a, b) => a.p[fuel] - b.p[fuel]).slice(0, topN),
  };
}

/**
 * Agrupa el listado nacional por provincia y calcula lo que necesita cada página.
 * Devuelve un array listo para getStaticPaths.
 */
export async function resumenPorProvincia() {
  const { fecha, estaciones } = await cargarNacional();
  const agrupado = agruparPorMunicipio(estaciones);

  const porId = new Map();
  for (const raw of estaciones) {
    const id = String(raw['IDProvincia'] ?? '').padStart(2, '0');
    if (!porId.has(id)) porId.set(id, []);
    porId.get(id).push(reducir(raw));
  }

  return PROVINCIAS.map((prov) => {
    const lista = porId.get(prov.id) ?? [];
    const combustibles = {};
    for (const c of COMBUSTIBLES) {
      // Más filas para los dos combustibles principales, menos para el resto.
      combustibles[c.id] = resumirCombustible(lista, c.id, c.id === 'g95' ? 12 : 8);
    }
    const municipios = porMunicipio(lista, 'g95');
    // En provincias pequeñas (Ceuta, Melilla) hay muy pocos municipios: si no dan para
    // dos listas separadas, se omite la de más caros para no repetir los mismos nombres.
    const hayParaDosListas = municipios.length >= 8;

    // Municipios con página propia, para enlazarlos desde la provincia (hub de rastreo).
    const munis = agrupado.get(prov.id);
    const municipiosConPagina = munis
      ? [...munis.values()]
          .filter((m) => m.lista.length >= MIN_ESTACIONES_MUNICIPIO && m.nombre)
          .map((m) => ({ nombre: m.nombre, slug: m.slug, total: m.lista.length }))
          .sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'))
      : [];

    return {
      prov,
      slug: slugProvincia(prov),
      fecha,
      total: lista.length,
      combustibles,
      municipiosBaratos: municipios.slice(0, 5),
      municipiosCaros: hayParaDosListas ? municipios.slice(-5).reverse() : [],
      municipiosConPagina,
    };
  });
}

/**
 * Un objeto por pueblo con página propia (>= MIN_ESTACIONES_MUNICIPIO gasolineras).
 * Listo para getStaticPaths de /gasolineras-baratas/[provincia]/[municipio].
 */
export async function resumenPorMunicipio() {
  const { fecha, estaciones } = await cargarNacional();
  const agrupado = agruparPorMunicipio(estaciones);
  const salida = [];

  for (const prov of PROVINCIAS) {
    const munis = agrupado.get(prov.id);
    if (!munis) continue;
    const provSlug = slugProvincia(prov);

    // Media provincial de gasolina 95, para comparar cada pueblo con su provincia.
    const g95Prov = [];
    for (const m of munis.values()) for (const e of m.lista) if (e.p.g95 != null) g95Prov.push(e.p.g95);
    const mediaProvinciaG95 = g95Prov.length ? media(g95Prov) : null;

    const conPagina = [...munis.values()]
      .filter((m) => m.lista.length >= MIN_ESTACIONES_MUNICIPIO && m.nombre)
      .sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'));

    for (const m of conPagina) {
      const combustibles = {};
      for (const c of COMBUSTIBLES) {
        // Pueblos pequeños: caben todas las estaciones, se limita solo por prudencia.
        combustibles[c.id] = resumirCombustible(m.lista, c.id, 30);
      }
      // Hasta 12 pueblos cercanos alfabéticamente para navegar, sin volcar toda la provincia.
      const hermanos = conPagina
        .filter((x) => x.slug !== m.slug)
        .slice(0, 12)
        .map((x) => ({ nombre: x.nombre, slug: x.slug }));

      salida.push({
        prov: { id: prov.id, nombre: prov.nombre },
        provSlug,
        muniNombre: m.nombre,
        muniSlug: m.slug,
        fecha,
        total: m.lista.length,
        combustibles,
        mediaProvinciaG95,
        hermanos,
      });
    }
  }
  return salida;
}
