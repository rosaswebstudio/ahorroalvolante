// Carga y agregación de precios para generar las páginas de provincia EN EL BUILD.
// No importar desde el navegador: descarga el listado nacional entero (~12 MB).
// Fuente: misma API oficial del Ministerio que usa el buscador (ver gasolineras.js).
import { API_BASE, COMBUSTIBLES, PROVINCIAS, slugProvincia, slugify } from './gasolineras.js';

// A partir de cuántas gasolineras un pueblo tiene página propia.
//
// El número no es una preferencia estética: es la línea por debajo de la cual la página
// no puede aportar nada. Con tres o cuatro estaciones el "ranking" son tres filas, la
// media local es ruido estadístico y la horquilla entre la más barata y la más cara no
// da para una recomendación. Todo lo que se le añadiera sería relleno idéntico al de los
// otros mil pueblos, que es exactamente lo que Google llama contenido replicado a escala
// y el motivo del rechazo de AdSense por "contenido de poco valor".
//
// Los municipios por debajo del umbral NO desaparecen: se listan con sus precios dentro
// de la página de su provincia (ver todosLosMunicipios), que así gana contenido propio
// en lugar de perderlo. Simplemente no tienen URL propia.
export const MIN_ESTACIONES_MUNICIPIO = 10;

// A partir de cuántas estaciones una marca tiene página propia. En el listado del
// Ministerio hay más de 3.000 "rótulos" distintos, pero la inmensa mayoría son
// estaciones independientes que aparecen con su nombre propio una sola vez: promediar
// dos gasolineras y llamarlo "el precio de la marca X" no informa de nada.
export const MIN_ESTACIONES_MARCA = 20;

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

// Distancia en km entre dos puntos (haversine). Se usa en el build para saber que
// municipios de la provincia estan de verdad al lado, y no solo alfabeticamente cerca.
const distanciaKm = (aLat, aLng, bLat, bLng) => {
  const R = 6371;
  const rad = (d) => (d * Math.PI) / 180;
  const dLat = rad(bLat - aLat);
  const dLng = rad(bLng - aLng);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(rad(aLat)) * Math.cos(rad(bLat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
};

// Centro aproximado de un municipio: media de las coordenadas de sus estaciones.
// Suficiente para ordenar vecinos por cercania; no pretende ser el centro geografico.
const centroide = (lista) => {
  const lats = lista.map((e) => e.lat).filter((v) => v != null);
  const lngs = lista.map((e) => e.lng).filter((v) => v != null);
  if (!lats.length || !lngs.length) return null;
  return { lat: media(lats), lng: media(lngs) };
};

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

    // TODOS los municipios de la provincia con sus precios, tengan pagina propia o no.
    // Los que no llegan al umbral viven aqui: el dato sigue publicado y enlazado, pero sin
    // gastar una URL en una pagina que solo tendria tres filas. Ver MIN_ESTACIONES_MUNICIPIO.
    const todosLosMunicipios = munis
      ? [...munis.values()]
          .filter((m) => m.nombre)
          .map((m) => {
            const g95 = m.lista.map((e) => e.p.g95).filter((v) => v != null);
            const ga = m.lista.map((e) => e.p.ga).filter((v) => v != null);
            return {
              nombre: m.nombre,
              slug: m.lista.length >= MIN_ESTACIONES_MUNICIPIO ? m.slug : null,
              total: m.lista.length,
              minG95: g95.length ? Math.min(...g95) : null,
              mediaG95: g95.length ? media(g95) : null,
              minGa: ga.length ? Math.min(...ga) : null,
            };
          })
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
      todosLosMunicipios,
    };
  });
}

/* ------------------------------------------------------------------ *
 * Combustibles                                                        *
 * ------------------------------------------------------------------ */

/**
 * Todo lo que hace falta para las páginas "precio del diésel", "precio de la gasolina 95"...
 *
 * La intención de búsqueda aquí es NACIONAL ("¿dónde está más barato el diésel?", "¿cuánto
 * cuesta el GLP?"), distinta de la de las páginas de provincia, que son locales ("dónde
 * reposto hoy"). Por eso lo que se calcula es el ranking de las 52 provincias y el de las
 * marcas para ESE combustible, no otra lista de estaciones cercanas.
 */
export async function resumenPorCombustible() {
  const { fecha, estaciones } = await cargarNacional();

  // Índice provincia -> estaciones, una sola pasada para los cinco combustibles.
  const porProv = new Map();
  for (const raw of estaciones) {
    const id = String(raw['IDProvincia'] ?? '').padStart(2, '0');
    if (!porProv.has(id)) porProv.set(id, []);
    porProv.get(id).push(reducir(raw));
  }

  // Índice marca -> estaciones, con el mismo umbral que las páginas de marca.
  const porMarca = new Map();
  for (const raw of estaciones) {
    const clave = String(raw['Rótulo'] ?? '').trim().toUpperCase().replace(/\s+/g, ' ');
    if (!clave || !/[\p{L}\p{N}]/u.test(clave)) continue;
    if (!porMarca.has(clave)) porMarca.set(clave, []);
    porMarca.get(clave).push(reducir(raw));
  }

  const todas = [...porProv.values()].flat();

  const salida = COMBUSTIBLES.map((c) => {
    const precios = todas.map((e) => e.p[c.id]).filter((v) => v != null);
    if (!precios.length) return null;

    const provincias = PROVINCIAS.map((prov) => {
      const lista = porProv.get(prov.id) ?? [];
      const ps = lista.map((e) => e.p[c.id]).filter((v) => v != null);
      if (!ps.length) return null;
      return {
        nombre: prov.nombre,
        slug: slugProvincia(prov),
        n: ps.length,
        media: media(ps),
        min: Math.min(...ps),
      };
    })
      .filter(Boolean)
      .sort((a, b) => a.media - b.media);

    const marcas = [...porMarca.entries()]
      .map(([clave, lista]) => {
        const ps = lista.map((e) => e.p[c.id]).filter((v) => v != null);
        // Para el ranking por combustible hace falta que la marca lo venda de verdad en
        // una parte apreciable de su red, no en dos estaciones sueltas.
        if (ps.length < MIN_ESTACIONES_MARCA) return null;
        return {
          nombre: clave
            .split(' ')
            .map((p) => (p.length <= 2 || /\d/.test(p) ? p : p[0] + p.slice(1).toLowerCase()))
            .join(' '),
          slug: slugify(clave),
          n: ps.length,
          media: media(ps),
        };
      })
      .filter(Boolean)
      .sort((a, b) => a.media - b.media);

    return {
      id: c.id,
      label: c.label,
      slug: c.slug,
      titulo: c.titulo,
      de: c.de,
      barato: c.barato,
      nacional: { n: precios.length, media: media(precios), min: Math.min(...precios), max: Math.max(...precios) },
      provincias,
      marcas,
      // Las 15 estaciones más baratas de toda España para este combustible.
      baratas: todas
        .filter((e) => e.p[c.id] != null)
        .sort((a, b) => a.p[c.id] - b.p[c.id])
        .slice(0, 15),
    };
  }).filter(Boolean);

  return { fecha, combustibles: salida, totalEstaciones: estaciones.length };
}

/* ------------------------------------------------------------------ *
 * Marcas                                                              *
 * ------------------------------------------------------------------ */

// El rótulo llega escrito de cualquier manera ("REPSOL", "Repsol", "repsol  ").
// Se agrupa por la forma normalizada y se muestra la más legible de las que llegan.
const claveMarca = (s) => String(s ?? '').trim().toUpperCase().replace(/\s+/g, ' ');

/** De "REPSOL" a "Repsol", pero respetando las siglas cortas (BP, Q8, GALP, HAM). */
function bonito(nombre) {
  return nombre
    .split(' ')
    .map((p) => (p.length <= 2 || /\d/.test(p) ? p : p[0] + p.slice(1).toLowerCase()))
    .join(' ');
}

/**
 * Precio medio de cada marca a nivel nacional, comparado con la media del país.
 *
 * Es la comparativa que de verdad busca la gente ("gasolineras low cost", "¿es más cara
 * Repsol?") y que ningún competidor publica con el dato oficial en vivo: entre la marca
 * más barata y la más cara hay más de 30 céntimos por litro.
 *
 * No hay una lista escrita a mano de "cuáles son low cost": la clasificación sale del
 * propio dato, comparando la media de cada marca con la media nacional del día.
 */
export async function resumenPorMarca() {
  const { fecha, estaciones } = await cargarNacional();

  // Media nacional por combustible: el punto de referencia de toda la página.
  const todas = estaciones.map(reducir);
  const nacional = {};
  for (const c of COMBUSTIBLES) {
    const precios = todas.map((e) => e.p[c.id]).filter((v) => v != null);
    nacional[c.id] = precios.length ? { n: precios.length, media: media(precios) } : null;
  }

  const grupos = new Map(); // clave -> { nombre, lista }
  for (const raw of estaciones) {
    const bruto = String(raw['Rótulo'] ?? '').trim();
    const clave = claveMarca(bruto);
    // "Sin rótulo" no es una marca: son estaciones que no comunican el nombre.
    if (!clave || !/[\p{L}\p{N}]/u.test(clave)) continue;
    if (!grupos.has(clave)) grupos.set(clave, { nombre: bonito(clave), lista: [], provincias: new Map() });
    const g = grupos.get(clave);
    const est = reducir(raw);
    g.lista.push(est);
    const idProv = String(raw['IDProvincia'] ?? '').padStart(2, '0');
    g.provincias.set(idProv, (g.provincias.get(idProv) ?? 0) + 1);
  }

  const usados = new Set();
  const marcas = [...grupos.entries()]
    .filter(([, g]) => g.lista.length >= MIN_ESTACIONES_MARCA)
    .map(([clave, g]) => {
      const combustibles = {};
      for (const c of COMBUSTIBLES) {
        const precios = g.lista.map((e) => e.p[c.id]).filter((v) => v != null);
        combustibles[c.id] = precios.length
          ? {
              n: precios.length,
              media: media(precios),
              min: Math.min(...precios),
              max: Math.max(...precios),
              // Diferencia con la media nacional del mismo combustible, en euros/litro.
              vsNacional: nacional[c.id] ? media(precios) - nacional[c.id].media : null,
            }
          : null;
      }

      let slug = slugify(g.nombre) || 'marca';
      let i = 2;
      while (usados.has(slug)) slug = `${slugify(g.nombre)}-${i++}`;
      usados.add(slug);

      // Provincias donde más presencia tiene, con su nombre para poder enlazarlas.
      const provs = [...g.provincias.entries()]
        .map(([id, n]) => {
          const p = PROVINCIAS.find((x) => x.id === id);
          return p ? { nombre: p.nombre, slug: slugProvincia(p), n } : null;
        })
        .filter(Boolean)
        .sort((a, b) => b.n - a.n);

      return {
        clave,
        nombre: g.nombre,
        slug,
        total: g.lista.length,
        combustibles,
        provincias: provs,
        // Las más baratas de esa marca en toda España: sirven de prueba del dato.
        baratas: [...g.lista]
          .filter((e) => e.p.g95 != null)
          .sort((a, b) => a.p.g95 - b.p.g95)
          .slice(0, 10),
      };
    })
    // Orden por defecto: de la marca más barata a la más cara en gasolina 95, que es
    // la pregunta real ("¿cuál es la más barata?"), no el tamaño de la red.
    .sort((a, b) => (a.combustibles.g95?.media ?? Infinity) - (b.combustibles.g95?.media ?? Infinity));

  return { fecha, nacional, marcas, totalEstaciones: estaciones.length };
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

    // Indice de vecinos: centro aproximado y precio minimo de cada municipio de la
    // provincia, incluidos los que no tienen pagina propia. Es lo que permite decirle al
    // lector si le compensa cruzar al pueblo de al lado, que es la pregunta real detras
    // de "gasolineras baratas en X" y lo unico que esta pagina puede responder y la de
    // la provincia no.
    const vecinos = [...munis.values()]
      .filter((m) => m.nombre && m.lista.length >= 3)
      .map((m) => {
        const g95 = m.lista.map((e) => e.p.g95).filter((v) => v != null);
        return {
          nombre: m.nombre,
          slug: m.lista.length >= MIN_ESTACIONES_MUNICIPIO ? m.slug : null,
          idMuni: m.idMuni,
          centro: centroide(m.lista),
          minG95: g95.length ? Math.min(...g95) : null,
        };
      })
      .filter((v) => v.centro && v.minG95 != null);

    const conPagina = [...munis.values()]
      .filter((m) => m.lista.length >= MIN_ESTACIONES_MUNICIPIO && m.nombre)
      .sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'));

    for (const m of conPagina) {
      const combustibles = {};
      for (const c of COMBUSTIBLES) {
        // Pueblos pequeños: caben todas las estaciones, se limita solo por prudencia.
        combustibles[c.id] = resumirCombustible(m.lista, c.id, 30);
      }
      // Municipios cercanos de verdad (haversine sobre el centro de cada uno), ordenados
      // por precio: primero los que estan mas baratos que este. Cada pagina saca una lista
      // distinta porque depende de donde esta el pueblo y de lo que cuesta el litro aqui.
      const centro = centroide(m.lista);
      const minAqui = combustibles.g95 ? combustibles.g95.min : null;
      const cercanos = centro
        ? vecinos
            .filter((v) => v.idMuni !== m.idMuni)
            .map((v) => ({
              nombre: v.nombre,
              slug: v.slug,
              minG95: v.minG95,
              km: distanciaKm(centro.lat, centro.lng, v.centro.lat, v.centro.lng),
            }))
            .filter((v) => v.km <= 35)
            .sort((a, b) => a.minG95 - b.minG95 || a.km - b.km)
            .slice(0, 6)
        : [];

      // Navegacion: el resto de municipios con pagina, alfabeticamente.
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
        cercanos,
        minAqui,
        hermanos,
      });
    }
  }
  return salida;
}
