// Carga y agregación de precios para generar las páginas de provincia EN EL BUILD.
// No importar desde el navegador: descarga el listado nacional entero (~12 MB).
// Fuente: misma API oficial del Ministerio que usa el buscador (ver gasolineras.js).
import { API_BASE, COMBUSTIBLES, PROVINCIAS, slugProvincia } from './gasolineras.js';

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
    rotulo: rotulo(e['Rótulo']),
    dir: (e['Dirección'] || '').trim(),
    muni: (e['Municipio'] || '').trim(),
    horario: (e['Horario'] || '').trim(),
    lat: coord(e['Latitud']),
    lng: coord(e['Longitud (WGS84)']),
    p: Object.fromEntries(COMBUSTIBLES.map((c) => [c.id, precio(e, c.campo)])),
  };
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
    return {
      prov,
      slug: slugProvincia(prov),
      fecha,
      total: lista.length,
      combustibles,
      municipiosBaratos: municipios.slice(0, 5),
      municipiosCaros: hayParaDosListas ? municipios.slice(-5).reverse() : [],
    };
  });
}
