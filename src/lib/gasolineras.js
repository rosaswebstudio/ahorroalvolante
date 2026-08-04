// Datos y lógica del buscador de gasolineras.
// Fuente: API oficial de precios de carburantes del Ministerio (Geoportal Gasolineras),
// https://sedeaplicaciones.minetur.gob.es/ServiciosRESTCarburantes/PreciosCarburantes/
// Pública, sin token y con CORS abierto (verificado 16-07-2026). Las estaciones están
// obligadas a comunicar sus precios; el listado se actualiza cada 30 minutos.

export const API_BASE =
  'https://sedeaplicaciones.minetur.gob.es/ServiciosRESTCarburantes/PreciosCarburantes';

// Provincias (IDs de la propia API) con coordenadas aproximadas de su capital,
// usadas solo para elegir la provincia más cercana al geolocalizar.
export const PROVINCIAS = [
  { id: '01', nombre: 'Araba/Álava', lat: 42.85, lng: -2.67 },
  { id: '02', nombre: 'Albacete', lat: 38.99, lng: -1.86 },
  { id: '03', nombre: 'Alicante', lat: 38.35, lng: -0.48 },
  { id: '04', nombre: 'Almería', lat: 36.84, lng: -2.46 },
  { id: '33', nombre: 'Asturias', lat: 43.36, lng: -5.85 },
  { id: '05', nombre: 'Ávila', lat: 40.66, lng: -4.7 },
  { id: '06', nombre: 'Badajoz', lat: 38.88, lng: -6.97 },
  { id: '07', nombre: 'Illes Balears', lat: 39.57, lng: 2.65 },
  { id: '08', nombre: 'Barcelona', lat: 41.39, lng: 2.17 },
  { id: '48', nombre: 'Bizkaia', lat: 43.26, lng: -2.93 },
  { id: '09', nombre: 'Burgos', lat: 42.34, lng: -3.7 },
  { id: '10', nombre: 'Cáceres', lat: 39.48, lng: -6.37 },
  { id: '11', nombre: 'Cádiz', lat: 36.53, lng: -6.29 },
  { id: '39', nombre: 'Cantabria', lat: 43.46, lng: -3.8 },
  { id: '12', nombre: 'Castellón', lat: 39.99, lng: -0.04 },
  { id: '51', nombre: 'Ceuta', lat: 35.89, lng: -5.32 },
  { id: '13', nombre: 'Ciudad Real', lat: 38.99, lng: -3.93 },
  { id: '14', nombre: 'Córdoba', lat: 37.89, lng: -4.78 },
  { id: '15', nombre: 'A Coruña', lat: 43.37, lng: -8.4 },
  { id: '16', nombre: 'Cuenca', lat: 40.07, lng: -2.13 },
  { id: '20', nombre: 'Gipuzkoa', lat: 43.32, lng: -1.98 },
  { id: '17', nombre: 'Girona', lat: 41.98, lng: 2.82 },
  { id: '18', nombre: 'Granada', lat: 37.18, lng: -3.6 },
  { id: '19', nombre: 'Guadalajara', lat: 40.63, lng: -3.17 },
  { id: '21', nombre: 'Huelva', lat: 37.26, lng: -6.94 },
  { id: '22', nombre: 'Huesca', lat: 42.14, lng: -0.41 },
  { id: '23', nombre: 'Jaén', lat: 37.77, lng: -3.79 },
  { id: '24', nombre: 'León', lat: 42.6, lng: -5.57 },
  { id: '25', nombre: 'Lleida', lat: 41.62, lng: 0.62 },
  { id: '27', nombre: 'Lugo', lat: 43.01, lng: -7.56 },
  { id: '28', nombre: 'Madrid', lat: 40.42, lng: -3.7 },
  { id: '29', nombre: 'Málaga', lat: 36.72, lng: -4.42 },
  { id: '52', nombre: 'Melilla', lat: 35.29, lng: -2.94 },
  { id: '30', nombre: 'Murcia', lat: 37.98, lng: -1.13 },
  { id: '31', nombre: 'Navarra', lat: 42.82, lng: -1.64 },
  { id: '32', nombre: 'Ourense', lat: 42.34, lng: -7.86 },
  { id: '34', nombre: 'Palencia', lat: 42.01, lng: -4.53 },
  { id: '35', nombre: 'Las Palmas', lat: 28.12, lng: -15.43 },
  { id: '36', nombre: 'Pontevedra', lat: 42.43, lng: -8.64 },
  { id: '26', nombre: 'La Rioja', lat: 42.47, lng: -2.45 },
  { id: '37', nombre: 'Salamanca', lat: 40.97, lng: -5.66 },
  { id: '38', nombre: 'S.C. de Tenerife', lat: 28.47, lng: -16.25 },
  { id: '40', nombre: 'Segovia', lat: 40.95, lng: -4.12 },
  { id: '41', nombre: 'Sevilla', lat: 37.39, lng: -5.99 },
  { id: '42', nombre: 'Soria', lat: 41.76, lng: -2.47 },
  { id: '43', nombre: 'Tarragona', lat: 41.12, lng: 1.25 },
  { id: '44', nombre: 'Teruel', lat: 40.34, lng: -1.11 },
  { id: '45', nombre: 'Toledo', lat: 39.86, lng: -4.03 },
  { id: '46', nombre: 'Valencia', lat: 39.47, lng: -0.38 },
  { id: '47', nombre: 'Valladolid', lat: 41.65, lng: -4.72 },
  { id: '49', nombre: 'Zamora', lat: 41.5, lng: -5.75 },
  { id: '50', nombre: 'Zaragoza', lat: 41.65, lng: -0.88 },
];

// Combustibles soportados: clave interna -> campo de la API y etiqueta.
// Campos para las páginas /precios/[combustible]/. Hacen falta las tres formas porque en
// castellano no valen con una: `titulo` para "¿a cuánto está el diésel?", `de` para
// "precio del diésel" (no "de el"), y `barato` para concordar el género con el nombre.
// `label` es el nombre corto de tablas y selectores; `corto` solo existe donde el nombre
// completo no cabe en el selector del buscador a media anchura en un móvil.
export const COMBUSTIBLES = [
  { id: 'g95', campo: 'Precio Gasolina 95 E5', label: 'Gasolina 95', slug: 'gasolina-95', titulo: 'la gasolina 95', de: 'de la gasolina 95', barato: 'barata' },
  { id: 'ga', campo: 'Precio Gasoleo A', label: 'Diésel (Gasóleo A)', corto: 'Diésel', slug: 'diesel', titulo: 'el diésel', de: 'del diésel', barato: 'barato' },
  { id: 'g98', campo: 'Precio Gasolina 98 E5', label: 'Gasolina 98', slug: 'gasolina-98', titulo: 'la gasolina 98', de: 'de la gasolina 98', barato: 'barata' },
  { id: 'gap', campo: 'Precio Gasoleo Premium', label: 'Diésel Premium', slug: 'diesel-premium', titulo: 'el diésel premium', de: 'del diésel premium', barato: 'barato' },
  { id: 'glp', campo: 'Precio Gases licuados del petróleo', label: 'GLP (Autogas)', corto: 'GLP', slug: 'glp-autogas', titulo: 'el GLP (autogas)', de: 'del GLP (autogas)', barato: 'barato' },
];

const num = (s) => {
  if (!s) return null;
  const n = parseFloat(String(s).replace(',', '.'));
  return Number.isFinite(n) ? n : null;
};

/** Reduce un registro de la API a lo imprescindible. */
function reducir(e) {
  return {
    // Identificador oficial de la estación: es lo que permite guardar favoritos.
    id: String(e['IDEESS'] ?? ''),
    rotulo: e['Rótulo'] || 'Sin rótulo',
    dir: e['Dirección'] || '',
    loc: e['Localidad'] || '',
    muni: e['Municipio'] || '',
    horario: e['Horario'] || '',
    lat: num(e['Latitud']),
    lng: num(e['Longitud (WGS84)']),
    p: {
      g95: num(e['Precio Gasolina 95 E5']),
      ga: num(e['Precio Gasoleo A']),
      g98: num(e['Precio Gasolina 98 E5']),
      gap: num(e['Precio Gasoleo Premium']),
      glp: num(e['Precio Gases licuados del petróleo']),
    },
  };
}

// El sufijo 2 invalida las cachés guardadas antes de que los registros llevaran `id`,
// que es lo que necesitan los favoritos para reconocer una gasolinera.
const CACHE_PREFIX = 'gs_prov2_';
const CACHE_TTL = 30 * 60 * 1000; // la API se actualiza cada 30 min

// Caché en memoria de la sesión: localStorage solo guarda la última provincia, y al
// pintar los favoritos puede hacer falta más de una a la vez.
const memoria = new Map();

// Peticiones en curso: el buscador y el bloque de favoritos pueden pedir la misma
// provincia a la vez al arrancar, y sin esto se descargaría dos veces.
const enVuelo = new Map();

/** Descarga (o recupera de caché) las estaciones de una provincia. */
export async function cargarProvincia(idProvincia, force = false) {
  if (!force && enVuelo.has(idProvincia)) return enVuelo.get(idProvincia);
  const promesa = descargarProvincia(idProvincia, force);
  enVuelo.set(idProvincia, promesa);
  try {
    return await promesa;
  } finally {
    enVuelo.delete(idProvincia);
  }
}

async function descargarProvincia(idProvincia, force) {
  const key = CACHE_PREFIX + idProvincia;
  if (!force) {
    const enMemoria = memoria.get(idProvincia);
    if (enMemoria && Date.now() - enMemoria.t < CACHE_TTL) return enMemoria;
    try {
      const raw = localStorage.getItem(key);
      if (raw) {
        const c = JSON.parse(raw);
        if (Date.now() - c.t < CACHE_TTL && Array.isArray(c.e)) {
          memoria.set(idProvincia, c);
          return c;
        }
      }
    } catch { /* caché corrupta: se ignora */ }
  }
  const res = await fetch(`${API_BASE}/EstacionesTerrestres/FiltroProvincia/${idProvincia}`, {
    headers: { Accept: 'application/json' },
  });
  if (!res.ok) throw new Error('http_' + res.status);
  const json = await res.json();
  const lista = (json.ListaEESSPrecio || []).map(reducir).filter((e) => e.lat && e.lng);
  const data = { t: Date.now(), fecha: json.Fecha || '', e: lista };
  try {
    // Solo guardamos la última provincia para no llenar localStorage.
    Object.keys(localStorage)
      .filter((k) => k.startsWith(CACHE_PREFIX) && k !== key)
      .forEach((k) => localStorage.removeItem(k));
    localStorage.setItem(key, JSON.stringify(data));
  } catch { /* sin espacio: no pasa nada */ }
  memoria.set(idProvincia, data);
  return data;
}

// Preferencias del visitante (combustible, provincia y datos de su coche). Viven solo
// en su navegador: sin cuenta, sin servidor y sin salir del dispositivo.
const PREF_KEY = 'gs_pref';

/** Lee las preferencias guardadas. Devuelve {} si no hay o están corruptas. */
export const leerPref = () => {
  try { return JSON.parse(localStorage.getItem(PREF_KEY) || '{}') || {}; } catch { return {}; }
};

/** Guarda (fusionando) las preferencias indicadas. */
export const guardarPref = (p) => {
  try { localStorage.setItem(PREF_KEY, JSON.stringify({ ...leerPref(), ...p })); } catch { /* sin espacio */ }
};

/** Distancia haversine en km. */
export function distanciaKm(lat1, lng1, lat2, lng2) {
  const R = 6371;
  const rad = Math.PI / 180;
  const dLat = (lat2 - lat1) * rad;
  const dLng = (lng2 - lng1) * rad;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * rad) * Math.cos(lat2 * rad) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

/** Convierte un nombre en slug de URL (sin acentos ni signos). */
export const slugify = (s) =>
  String(s)
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

// El nombre corto de la API no da un slug decente, se fija a mano.
const SLUG_PROVINCIA = { 38: 'santa-cruz-de-tenerife' };

/** Slug de URL de una provincia (p. ej. "A Coruña" -> "a-coruna"). */
export const slugProvincia = (p) => SLUG_PROVINCIA[Number(p.id)] || slugify(p.nombre);

/** Busca una provincia por su slug. */
export const provinciaPorSlug = (slug) =>
  PROVINCIAS.find((p) => slugProvincia(p) === slug) || null;

/** Provincia más cercana a unas coordenadas (por capital). */
export function provinciaMasCercana(lat, lng) {
  let mejor = PROVINCIAS[0];
  let mejorD = Infinity;
  for (const p of PROVINCIAS) {
    const d = distanciaKm(lat, lng, p.lat, p.lng);
    if (d < mejorD) { mejorD = d; mejor = p; }
  }
  return mejor;
}
