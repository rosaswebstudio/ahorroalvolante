// Mantiene el histórico de precios medios en src/data/historico.json.
//
//   node scripts/historico.mjs            -> añade el día de hoy
//   node scripts/historico.mjs --dias 90  -> rellena hacia atrás los últimos 90 días
//
// Cada snapshot del Ministerio pesa ~12 MB, así que aquí solo se guardan las medias
// (por provincia y nacional) de gasolina 95 y diésel: el archivo resultante es pequeño.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DESTINO = path.join(RAIZ, 'src', 'data', 'historico.json');
const BASE =
  'https://sedeaplicaciones.minetur.gob.es/ServiciosRESTCarburantes/PreciosCarburantes';

// Solo los dos combustibles mayoritarios: son los que mueven la decisión de repostar.
const COMBUSTIBLES = { g95: 'Precio Gasolina 95 E5', ga: 'Precio Gasoleo A' };
const DIAS_MAX = 400; // se recorta para que el archivo no crezca sin límite
const PRECIO_MIN = 0.4;
const PRECIO_MAX = 4;

const arg = (nombre, fb) => {
  const i = process.argv.indexOf(nombre);
  return i >= 0 && process.argv[i + 1] ? process.argv[i + 1] : fb;
};

const iso = (d) => d.toISOString().slice(0, 10);
const ddmmyyyy = (d) =>
  `${String(d.getDate()).padStart(2, '0')}-${String(d.getMonth() + 1).padStart(2, '0')}-${d.getFullYear()}`;

const media = (xs) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null);
const redondear = (n) => (n == null ? null : Math.round(n * 1000) / 1000);

const precio = (e, campo) => {
  const n = parseFloat(String(e[campo] ?? '').replace(',', '.'));
  return Number.isFinite(n) && n >= PRECIO_MIN && n <= PRECIO_MAX ? n : null;
};

async function descargarDia(fecha, esHoy) {
  const url = esHoy
    ? `${BASE}/EstacionesTerrestres/`
    : `${BASE}/EstacionesTerrestresHist/${ddmmyyyy(fecha)}`;
  for (let intento = 1; intento <= 3; intento++) {
    try {
      const res = await fetch(url, { headers: { Accept: 'application/json' } });
      if (!res.ok) throw new Error('HTTP ' + res.status);
      const json = await res.json();
      const lista = json.ListaEESSPrecio || [];
      if (lista.length < 5000) throw new Error('respuesta incompleta (' + lista.length + ')');
      return lista;
    } catch (err) {
      if (intento === 3) throw err;
      await new Promise((r) => setTimeout(r, 1500 * intento));
    }
  }
}

/** Medias nacionales y por provincia de un día. */
function resumirDia(lista) {
  const nacional = {};
  const provincias = {};
  for (const [id, campo] of Object.entries(COMBUSTIBLES)) {
    const todos = [];
    const porProv = new Map();
    for (const e of lista) {
      const p = precio(e, campo);
      if (p == null) continue;
      todos.push(p);
      const prov = String(e['IDProvincia'] ?? '').padStart(2, '0');
      if (!porProv.has(prov)) porProv.set(prov, []);
      porProv.get(prov).push(p);
    }
    nacional[id] = redondear(media(todos));
    for (const [prov, xs] of porProv) {
      provincias[prov] ??= {};
      provincias[prov][id] = redondear(media(xs));
    }
  }
  return { nacional, provincias };
}

function leerExistente() {
  try {
    return JSON.parse(fs.readFileSync(DESTINO, 'utf8'));
  } catch {
    return { fechas: [], nacional: {}, provincias: {} };
  }
}

async function main() {
  const dias = Number(arg('--dias', '1'));
  const datos = leerExistente();
  const porFecha = new Map(datos.fechas.map((f, i) => [f, i]));

  const hoy = new Date();
  const pendientes = [];
  for (let i = 0; i < dias; i++) {
    const d = new Date(hoy);
    d.setDate(hoy.getDate() - i);
    const f = iso(d);
    // El día de hoy siempre se recalcula; los pasados solo si faltan.
    if (i === 0 || !porFecha.has(f)) pendientes.push({ fecha: d, iso: f, esHoy: i === 0 });
  }

  if (!pendientes.length) {
    console.log('Histórico ya al día, nada que descargar.');
    return;
  }
  console.log(`Descargando ${pendientes.length} día(s)...`);

  const nuevos = new Map();
  for (const p of pendientes) {
    try {
      const lista = await descargarDia(p.fecha, p.esHoy);
      nuevos.set(p.iso, resumirDia(lista));
      console.log(`  ${p.iso} ok (${lista.length} estaciones)`);
    } catch (err) {
      console.warn(`  ${p.iso} FALLO: ${err.message}`);
    }
    await new Promise((r) => setTimeout(r, 300)); // no martillear la API
  }

  if (!nuevos.size) {
    console.log('No se pudo descargar ningún día.');
    process.exitCode = 1;
    return;
  }

  // Reconstruye las series completas alineadas con el array de fechas.
  const fechas = [...new Set([...datos.fechas, ...nuevos.keys()])].sort().slice(-DIAS_MAX);
  const valor = (bloque, prov, fuel, f) => {
    const n = nuevos.get(f);
    if (n) return prov ? (n.provincias[prov]?.[fuel] ?? null) : n.nacional[fuel];
    const i = porFecha.get(f);
    if (i == null) return null;
    return bloque?.[fuel]?.[i] ?? null;
  };

  const salida = { actualizado: iso(hoy), fechas, nacional: {}, provincias: {} };
  const provs = new Set([
    ...Object.keys(datos.provincias || {}),
    ...[...nuevos.values()].flatMap((n) => Object.keys(n.provincias)),
  ]);
  for (const fuel of Object.keys(COMBUSTIBLES)) {
    salida.nacional[fuel] = fechas.map((f) => valor(datos.nacional, null, fuel, f));
    for (const prov of provs) {
      salida.provincias[prov] ??= {};
      salida.provincias[prov][fuel] = fechas.map((f) => valor(datos.provincias[prov], prov, fuel, f));
    }
  }

  fs.mkdirSync(path.dirname(DESTINO), { recursive: true });
  fs.writeFileSync(DESTINO, JSON.stringify(salida));
  const kb = Math.round(fs.statSync(DESTINO).size / 1024);
  console.log(`Guardado ${path.relative(RAIZ, DESTINO)}: ${fechas.length} días, ${provs.size} provincias, ${kb} KB.`);
}

main();
