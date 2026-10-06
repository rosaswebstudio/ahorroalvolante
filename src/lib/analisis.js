// Lectura escrita de los datos de un municipio o de una marca.
//
// Por qué existe este fichero:
// una página que dice "en X la gasolina está a Y €/L, la más barata es Z" es la misma
// página mil veces con el nombre cambiado. Da igual lo larga que sea: si al sustituir el
// nombre del pueblo el texto sigue valiendo, no aporta nada que no aporte la tabla.
// Eso es lo que Google llama contenido replicado a escala y es el motivo del rechazo de
// AdSense por "contenido de poco valor".
//
// Lo que hace este módulo es lo contrario: mira la ESTRUCTURA del mercado local (cuántas
// cadenas compiten, si hay redes baratas, si los precios están clavados, cuánto se separa
// el diésel de la gasolina, cómo ha ido el precio en la provincia estos meses) y escribe
// conclusiones distintas según lo que encuentra. Dos pueblos con la misma media de precio
// pero distinta estructura de competencia reciben textos distintos, porque el consejo útil
// también es distinto: donde todas las estaciones cobran lo mismo no sirve de nada
// comparar, y donde hay 15 céntimos de diferencia es lo único que importa.
//
// Regla de la casa: aquí no se escribe ninguna frase que no se pueda comprobar con el
// listado del Ministerio. Nada de adjetivos sin número detrás.

const media = (xs) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null);
const mediana = (xs) => {
  if (!xs.length) return null;
  const s = [...xs].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
};

// Depósito de turismo medio: la unidad en la que la gente decide de verdad.
export const DEPOSITO = 55;
// 12.000 km al año a 6,5 L/100 km. Es el kilometraje medio declarado de un turismo en
// España; sirve para traducir céntimos por litro a euros al año, que es lo que se nota.
export const LITROS_ANIO = 780;

const eur = (n, d = 2) =>
  n.toLocaleString('es-ES', { minimumFractionDigits: d, maximumFractionDigits: d });
const p3 = (n) => eur(n, 3);
const cts = (n) => eur(Math.abs(n) * 100, 1);

const MESES = [
  'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
  'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre',
];
const fechaCorta = (iso) => {
  const [a, m, d] = String(iso).split('-');
  if (!a || !m || !d) return iso;
  return `${Number(d)} de ${MESES[Number(m) - 1]}`;
};

/* ------------------------------------------------------------------ *
 * Clasificación de redes a partir del dato, no de una lista a mano     *
 * ------------------------------------------------------------------ */

// Una cadena es "barata" o "cara" por lo que cobra de media en toda España frente a la
// media del país, no porque alguien la haya etiquetado. El umbral son 3 céntimos: por
// debajo de eso la diferencia entra dentro de lo que varía una misma cadena de una
// provincia a otra, así que llamarla barata sería forzar el dato.
const UMBRAL_RED = 0.03;
// Por debajo de estas estaciones una cadena no tiene "una media nacional": es un puñado
// de estaciones independientes que comparten rótulo.
const MIN_RED = 20;

/**
 * Índice de redes: clave de marca -> { n, media, clase }.
 * clase: 'barata' | 'cara' | 'media' | 'independiente'
 */
export function clasificarRedes(estaciones, mediaNacionalG95) {
  const g = new Map();
  for (const e of estaciones) {
    const clave = String(e.rotulo ?? '').trim().toUpperCase().replace(/\s+/g, ' ');
    if (!clave || clave === 'SIN RÓTULO') continue;
    if (!g.has(clave)) g.set(clave, []);
    if (e.p?.g95 != null) g.get(clave).push(e.p.g95);
  }
  const redes = new Map();
  for (const [clave, precios] of g) {
    if (precios.length < MIN_RED) {
      redes.set(clave, { n: precios.length, media: media(precios), clase: 'independiente' });
      continue;
    }
    const m = media(precios);
    const dif = m - mediaNacionalG95;
    redes.set(clave, {
      n: precios.length,
      media: m,
      clase: dif <= -UMBRAL_RED ? 'barata' : dif >= UMBRAL_RED ? 'cara' : 'media',
    });
  }
  return redes;
}

/* ------------------------------------------------------------------ *
 * Análisis de un municipio                                            *
 * ------------------------------------------------------------------ */

/** De "REPSOL" a "Repsol", respetando siglas cortas (BP, Q8, GALP). */
const bonito = (nombre) =>
  String(nombre)
    .split(' ')
    .map((p) => (p.length <= 2 || /\d/.test(p) ? p : p[0] + p.slice(1).toLowerCase()))
    .join(' ');

const esVeinticuatroHoras = (h) => /24\s*H/i.test(String(h ?? ''));

const lista2 = (xs) =>
  xs.length <= 1 ? xs.join('') : `${xs.slice(0, -1).join(', ')} y ${xs[xs.length - 1]}`;

/**
 * Devuelve bloques de texto propios del municipio.
 *
 * @param {object} arg
 * @param {string} arg.muni        nombre del municipio
 * @param {string} arg.provincia   nombre de la provincia
 * @param {object[]} arg.lista     estaciones del municipio (rotulo, horario, p)
 * @param {object} arg.ctx         contexto nacional y provincial precalculado
 * @returns {{bloques: {id:string,h:string,p:string[]}[], resumen: string|null}}
 */
export function analisisMunicipio({ muni, provincia, lista, ctx }) {
  const bloques = [];
  const g95 = lista.map((e) => e.p?.g95).filter((v) => v != null);
  const ga = lista.map((e) => e.p?.ga).filter((v) => v != null);
  if (g95.length < 3) return { bloques, resumen: null };

  const min = Math.min(...g95);
  const max = Math.max(...g95);
  const med = media(g95);
  const horquilla = max - min;
  const ahorroAnio = (med - min) * LITROS_ANIO;

  // Rotulo de la estacion mas barata y de la mas cara del municipio. Decir quien esta en
  // cada extremo es un dato que no se repite de un pueblo a otro ni aunque los numeros se
  // parezcan, y ademas es lo primero que quiere saber quien entra.
  const conG95 = lista.filter((e) => e.p?.g95 != null);
  const extremos = conG95.length
    ? {
        barata: bonito(conG95.reduce((a, b) => (b.p.g95 < a.p.g95 ? b : a)).rotulo),
        cara: bonito(conG95.reduce((a, b) => (b.p.g95 > a.p.g95 ? b : a)).rotulo),
      }
    : null;

  /* --- 1. Qué se juega el conductor aquí ------------------------------ */
  {
    const p = [];
    const porDeposito = horquilla * DEPOSITO;
    if (horquilla < 0.02) {
      p.push(
        `En ${muni} el precio está muy igualado: entre la gasolinera más barata (${p3(min)} €/L) y la más cara (${p3(max)} €/L) hay ${cts(horquilla)} céntimos, que en un depósito de ${DEPOSITO} litros son ${eur(porDeposito)} €. Con esa diferencia, dar una vuelta para cambiar de surtidor no compensa: el consumo del rodeo se come lo que ahorras.`
      );
      p.push(
        `Puesto en euros al año: un conductor de 12.000 km que repostara siempre en la más barata de ${muni} se ahorraría unos ${eur(ahorroAnio, 0)} € frente a hacerlo en una estación cualquiera del municipio. Cuando los precios están tan juntos, lo que de verdad mueve la factura no es elegir surtidor, sino el momento de repostar y mirar lo que cuesta en los municipios de al lado antes de llenar aquí.`
      );
    } else if (horquilla < 0.06) {
      p.push(
        `Entre la gasolinera más barata de ${muni} (${p3(min)} €/L) y la más cara (${p3(max)} €/L) hay ${cts(horquilla)} céntimos por litro: ${eur(porDeposito)} € por depósito de ${DEPOSITO} litros. Es una diferencia normal para un municipio de este tamaño, suficiente para que merezca la pena mirar antes de entrar, pero no para cruzar la ciudad.`
      );
      p.push(
        `Repostando siempre en la más barata en lugar de en una cualquiera, un conductor que haga 12.000 km al año se deja unos ${eur(ahorroAnio, 0)} € menos. No es un cambio de vida, pero es dinero que no cuesta nada ahorrar.`
      );
    } else if (horquilla < 0.12) {
      p.push(
        `La horquilla en ${muni} es amplia: ${cts(horquilla)} céntimos entre la más barata (${p3(min)} €/L) y la más cara (${p3(max)} €/L), o sea ${eur(porDeposito)} € de diferencia en el mismo depósito de ${DEPOSITO} litros con el mismo combustible.`
      );
      p.push(
        `Repostando siempre en la más barata en lugar de en una estación cualquiera del municipio, un conductor de 12.000 km al año se ahorra unos ${eur(ahorroAnio, 0)} €. Diferencias de este tamaño suelen significar que en el municipio conviven estaciones de perfiles distintos: alguna desatendida o de supermercado tirando el precio hacia abajo y alguna en vía rápida o de servicio completo tirando hacia arriba.`
      );
    } else {
      p.push(
        `${muni} tiene una de las horquillas grandes: ${cts(horquilla)} céntimos entre la gasolinera más barata (${p3(min)} €/L) y la más cara (${p3(max)} €/L). Son ${eur(porDeposito)} € de diferencia en un solo depósito de ${DEPOSITO} litros. Quien repose siempre en la más barata, en vez de en una estación cualquiera del municipio, se deja unos ${eur(ahorroAnio, 0)} € menos al año a 12.000 km.`
      );
      p.push(
        `${extremos ? `Hoy esa diferencia está entre ${extremos.barata} (${p3(min)} €/L) y ${extremos.cara} (${p3(max)} €/L). ` : ''}Una diferencia de este tamaño dentro de un mismo municipio casi nunca es casualidad: suele haber estaciones en un entorno cautivo (una autopista, un aeropuerto, un polígono sin alternativa cerca) conviviendo con otras que compiten de verdad. Aquí mirar el precio antes de entrar es, con diferencia, lo que más ahorra de todo lo que puedes hacer con el coche.`
      );
    }
    bloques.push({ id: 'horquilla', h: `Cuánto se juega aquí entre una gasolinera y otra`, p });
  }

  /* --- 2. Quién compite en este municipio ----------------------------- */
  {
    const porMarca = new Map();
    for (const e of lista) {
      const clave = String(e.rotulo ?? '').trim().toUpperCase().replace(/\s+/g, ' ');
      if (!clave) continue;
      if (!porMarca.has(clave)) porMarca.set(clave, []);
      porMarca.get(clave).push(e);
    }
    const marcas = [...porMarca.entries()]
      .map(([clave, xs]) => ({ clave, nombre: bonito(clave), n: xs.length }))
      .sort((a, b) => b.n - a.n);
    const total = lista.length;
    const dominante = marcas[0] && marcas[0].n / total >= 0.35 && marcas[0].n >= 3 ? marcas[0] : null;

    const p = [];
    if (dominante) {
      p.push(
        `De las ${total} gasolineras de ${muni}, ${dominante.n} son ${dominante.nombre}: ${Math.round((dominante.n / total) * 100)}% del municipio en manos de un solo rótulo. Las otras ${total - dominante.n} se reparten entre ${marcas.length - 1} ${marcas.length - 1 === 1 ? 'marca' : 'marcas'}.`
      );
      p.push(
        `Cuando una cadena concentra tantas estaciones, el precio que pone marca el de referencia de la zona y las demás suelen moverse detrás. Aquí se nota en la horquilla: ${cts(horquilla)} céntimos entre la más barata y la más cara de ${muni}, con ${marcas.length} ${marcas.length === 1 ? 'rótulo' : 'rótulos'} en juego. Comparar dentro del municipio da menos recorrido del que parece, y conviene mirar también el pueblo de al lado.`
      );
    } else if (marcas.length >= Math.max(5, total * 0.6)) {
      p.push(
        `${muni} tiene ${total} gasolineras repartidas entre ${marcas.length} rótulos distintos, casi una marca por estación. Es el reparto más competido que se puede dar: ninguna cadena manda y los precios los acaba fijando la estación de al lado.`
      );
    } else {
      p.push(
        `Las ${total} gasolineras de ${muni} se reparten entre ${marcas.length} ${marcas.length === 1 ? 'rótulo' : 'rótulos'}. ${marcas.length >= 2 ? `Las que más estaciones tienen aquí son ${lista2(marcas.slice(0, 3).map((m) => `${m.nombre} (${m.n})`))}.` : ''}`
      );
    }

    // Redes baratas y caras según su media nacional, aplicadas a este municipio.
    const redes = ctx.redes;
    const clasif = { barata: [], cara: [], media: [], independiente: [] };
    for (const e of lista) {
      if (e.p?.g95 == null) continue;
      const clave = String(e.rotulo ?? '').trim().toUpperCase().replace(/\s+/g, ' ');
      const r = redes.get(clave);
      clasif[r?.clase ?? 'independiente'].push(e);
    }
    const mBaratas = clasif.barata.length ? media(clasif.barata.map((e) => e.p.g95)) : null;
    const restoLista = [...clasif.cara, ...clasif.media];
    const mResto = restoLista.length ? media(restoLista.map((e) => e.p.g95)) : null;

    if (clasif.barata.length === 0 && total >= 5) {
      const nombresCaras = [...new Set(clasif.cara.map((e) => bonito(e.rotulo)))].slice(0, 3);
      p.push(
        `Un detalle que no se ve en la tabla: en ${muni} no opera ninguna de las cadenas que en el conjunto de España están al menos 3 céntimos por debajo de la media (las de bajo coste y desatendidas). ${nombresCaras.length ? `Lo que hay son redes de servicio completo como ${lista2(nombresCaras)}, que a nivel nacional cobran por encima de la media.` : ''} Por eso el suelo de precio del municipio está donde está: no es que las estaciones de aquí sean caras, es que falta el tipo de competidor que tira los precios hacia abajo.`
      );
    } else if (clasif.barata.length && mBaratas != null && mResto != null && restoLista.length >= 2) {
      const dif = mResto - mBaratas;
      if (dif >= 0.02) {
        p.push(
          `Las ${clasif.barata.length} ${clasif.barata.length === 1 ? 'estación' : 'estaciones'} de cadenas de bajo coste que hay en ${muni} están a ${p3(mBaratas)} €/L de media, frente a ${p3(mResto)} €/L de las demás: ${cts(dif)} céntimos de diferencia, ${eur(dif * DEPOSITO)} € por depósito. Es la vía más directa de ahorrar aquí.`
        );
      } else if (dif <= -0.005) {
        p.push(
          `Aquí pasa algo que no es lo habitual: las cadenas de bajo coste del municipio (${p3(mBaratas)} €/L de media) NO son las más baratas. Las demás estaciones de ${muni} están a ${p3(mResto)} €/L, por debajo. La etiqueta "low cost" vale para la media nacional de la cadena, no garantiza nada en un municipio concreto, y este es el ejemplo.`
        );
      } else {
        p.push(
          `En ${muni} las cadenas de bajo coste (${p3(mBaratas)} €/L de media) y el resto (${p3(mResto)} €/L) están prácticamente igualadas, con ${cts(dif)} céntimos entre unas y otras. Cuando pasa esto suele ser porque la competencia local ya ha apretado los márgenes de todos, así que el rótulo importa menos que la estación concreta.`
        );
      }
    }
    bloques.push({ id: 'competencia', h: `Quién pone los precios en ${muni}`, p });
  }

  /* --- 3. Precios clavados (solo si ocurre) ---------------------------- */
  {
    const cuenta = new Map();
    for (const v of g95) {
      const k = v.toFixed(3);
      cuenta.set(k, (cuenta.get(k) ?? 0) + 1);
    }
    const [valor, veces] = [...cuenta.entries()].sort((a, b) => b[1] - a[1])[0];
    if (veces >= 4 && veces / g95.length >= 0.35) {
      bloques.push({
        id: 'clavados',
        h: 'Precios calcados entre estaciones',
        p: [
          `${veces} de las ${g95.length} gasolineras de ${muni} que comunican gasolina 95 anuncian exactamente el mismo precio: ${p3(Number(valor))} €/L, hasta la milésima. No es un error del listado, es un patrón que aparece en muchos municipios españoles.`,
          `La explicación habitual es doble: varias de esas estaciones pertenecen a la misma red y aplican precio central, y las independientes se alinean mirando el cartel del vecino, que es público y visible desde la carretera. Para ti la consecuencia es práctica: en ${muni} no hay que comparar las ${g95.length}, sino localizar las ${g95.length - veces} que se salen del grupo, porque ahí está toda la diferencia. Hoy la más barata de ${muni} está ${cts(Number(valor) - min)} céntimos por debajo de ese precio común.`,
        ],
      });
    }
  }

  /* --- 4. Diésel frente a gasolina, aquí ------------------------------- */
  if (ga.length >= 3 && ctx.brechaNacional != null) {
    const brechaLocal = media(ga) - med;
    const dif = brechaLocal - ctx.brechaNacional;
    const p = [];
    const signo = brechaLocal >= 0 ? 'por encima de' : 'por debajo de';
    p.push(
      `En ${muni} el diésel está a ${p3(media(ga))} €/L de media, ${cts(brechaLocal)} céntimos ${signo} la gasolina 95. En el conjunto de España esa distancia es de ${cts(ctx.brechaNacional)} céntimos.`
    );
    if (dif >= 0.02) {
      p.push(
        `Es decir, aquí el diésel sale comparativamente peor que en la media del país: ${cts(dif)} céntimos más de separación. Si conduces un diésel y pasas por varias zonas, este es un municipio para no llenar si puedes evitarlo; si estás eligiendo coche, es un punto menos para el gasóleo en esta zona.`
      );
    } else if (dif <= -0.02) {
      p.push(
        `Aquí el diésel está comparativamente mejor de precio que en la media nacional: ${cts(Math.abs(dif))} céntimos menos de separación respecto a la gasolina. Para un diésel, ${muni} es buen sitio para llenar el depósito.`
      );
    } else {
      p.push(
        `La separación entre los dos combustibles en ${muni} es la normal del país, así que la elección entre diésel y gasolina aquí no depende del municipio sino del coche y de los kilómetros que hagas al año.`
      );
    }
    bloques.push({ id: 'brecha', h: 'Diésel y gasolina: la distancia entre los dos', p });
  }

  /* --- 5. Horarios ------------------------------------------------------ */
  {
    const conHorario = lista.filter((e) => e.horario);
    const n24 = conHorario.filter((e) => esVeinticuatroHoras(e.horario)).length;
    if (conHorario.length >= 4) {
      const p = [];
      if (n24 === 0) {
        p.push(
          `Ninguna de las ${conHorario.length} gasolineras de ${muni} que declaran horario abre las 24 horas. Si sales de madrugada o vuelves tarde, cuenta con llegar con depósito o con desviarte: conviene mirar el horario concreto en la ficha de cada estación antes de fiarse.`
        );
      } else if (n24 === conHorario.length) {
        p.push(
          `Las ${conHorario.length} gasolineras de ${muni} que declaran horario abren 24 horas. Es una ventaja menos obvia de lo que parece: a cualquier hora puedes elegir la más barata en lugar de la única abierta, que es cuando se pagan los precios malos.`
        );
      } else {
        p.push(
          `${n24} de las ${conHorario.length} gasolineras de ${muni} abren 24 horas. El resto cierra, así que de noche el abanico de precios se reduce y lo que de día es la estación más cara puede ser de madrugada la única opción.`
        );
      }
      bloques.push({ id: 'horarios', h: 'A qué hora puedes repostar', p });
    }
  }

  /* --- 6. Posición dentro de la provincia ------------------------------ */
  if (ctx.ranking && ctx.ranking.total >= 6) {
    const { pos, total: tot } = ctx.ranking;
    const cuartil = pos / tot;
    const p = [];
    // Hay capitales que se llaman igual que su provincia (Leon, Murcia, Valladolid...).
    // Sin esto el titular sale "Leon dentro de Leon", que parece un error de plantilla.
    const mismoNombre = muni === provincia;
    const laProv = mismoNombre ? `la provincia de ${provincia}` : provincia;
    if (cuartil <= 0.25) {
      p.push(
        `Comparado con el resto de la provincia, ${muni} sale bien parado: es el número ${pos} más barato de los ${tot} municipios de ${laProv} con precios publicados. Si vives aquí, repostar en casa suele ser la opción correcta.`
      );
    } else if (cuartil >= 0.75) {
      p.push(
        `${muni} está en la parte cara de ${laProv}: ocupa el puesto ${pos} de ${tot} municipios ordenados de más barato a más caro. Antes de llenar, merece la pena mirar los municipios cercanos de la lista de abajo, sobre todo si vas a hacer ese trayecto de todas formas.`
      );
    } else {
      p.push(
        `En el conjunto de ${laProv}, ${muni} está en la zona media: puesto ${pos} de ${tot} municipios con precios publicados. Ni es de los sitios donde conviene llenar siempre, ni de los que conviene evitar.`
      );
    }
    bloques.push({ id: 'ranking', h: mismoNombre ? `${muni} dentro de su provincia` : `${muni} dentro de ${provincia}`, p });
  }

  /* --- 7. Cómo va el precio en la provincia (serie propia) -------------- */
  const serie = analisisSerieProvincia(ctx.serie, provincia);
  if (serie) bloques.push(serie);

  const resumen =
    horquilla >= 0.06
      ? `En ${muni} hay ${cts(horquilla)} céntimos entre la gasolinera más barata y la más cara: elegir bien vale unos ${eur(ahorroAnio, 0)} € al año.`
      : `En ${muni} los precios están juntos (${cts(horquilla)} céntimos entre la más barata y la más cara), así que el ahorro está más en cuándo y dónde que en qué surtidor.`;

  return { bloques, resumen };
}

/* ------------------------------------------------------------------ *
 * Análisis de una provincia                                           *
 * ------------------------------------------------------------------ */

/**
 * Lectura escrita de una provincia. La pregunta que responde no es la misma que la de un
 * municipio ("¿en qué surtidor echo?") sino "¿cómo está el mercado aquí?": cuánto separa
 * al pueblo más barato del más caro, cuántos municipios se quedan con una sola gasolinera
 * y sin competencia, qué redes mandan y cómo ha ido el precio estos meses.
 */
export function analisisProvincia({ provincia, lista, municipios, ctx }) {
  const bloques = [];
  const g95 = lista.map((e) => e.p?.g95).filter((v) => v != null);
  if (g95.length < 10) return { bloques };
  const med = media(g95);

  /* --- 1. La provincia dentro de España -------------------------------- */
  if (ctx.mediaNacionalG95 != null && ctx.rankingProv) {
    const dif = med - ctx.mediaNacionalG95;
    const { pos, total: tot } = ctx.rankingProv;
    const p = [];
    if (dif <= -0.015) {
      p.push(
        `${provincia} es de las provincias baratas: su gasolina 95 está a ${p3(med)} €/L de media, ${cts(dif)} céntimos por debajo de la media de España (${p3(ctx.mediaNacionalG95)} €/L). Ocupa el puesto ${pos} de ${tot} provincias, ordenadas de más barata a más cara.`
      );
      p.push(
        `En euros, un conductor de 12.000 km al año paga aquí unos ${eur(Math.abs(dif) * LITROS_ANIO, 0)} € menos al año que la media del país solo por repostar en esta provincia.`
      );
    } else if (dif >= 0.015) {
      p.push(
        `${provincia} está en la parte cara del mapa: ${p3(med)} €/L de media en gasolina 95, ${cts(dif)} céntimos por encima de la media nacional (${p3(ctx.mediaNacionalG95)} €/L). Es el puesto ${pos} de ${tot} provincias de más barata a más cara.`
      );
      p.push(
        `Para quien hace 12.000 km al año son unos ${eur(dif * LITROS_ANIO, 0)} € más al año que la media de España. Buena parte de esa diferencia no depende de ti, pero la que hay entre municipios de la propia provincia sí.`
      );
    } else {
      p.push(
        `${provincia} está en la media del país: ${p3(med)} €/L de gasolina 95 frente a ${p3(ctx.mediaNacionalG95)} €/L de media nacional, puesto ${pos} de ${tot}. Lo que decide aquí el precio que pagas no es la provincia, es el municipio y la estación.`
      );
    }
    bloques.push({ id: 'vs-pais', h: `${provincia} frente al resto de España`, p });
  }

  /* --- 2. Distancia entre municipios ------------------------------------ */
  if (municipios?.length >= 6) {
    const orden = [...municipios].sort((a, b) => a.media - b.media);
    const barato = orden[0];
    const caro = orden[orden.length - 1];
    const brecha = caro.media - barato.media;
    const p = [
      `Dentro de ${provincia} la diferencia entre municipios es de ${cts(brecha)} céntimos por litro: ${barato.nombre} tiene la media más baja (${p3(barato.media)} €/L) y ${caro.nombre} la más alta (${p3(caro.media)} €/L). Son ${eur(brecha * DEPOSITO)} € por depósito de ${DEPOSITO} litros entre llenar en uno u otro.`,
    ];
    if (brecha >= 0.08) {
      p.push(
        `Una brecha así dentro de una misma provincia significa que merece la pena planificar dónde se llena, sobre todo si pasas por varios municipios a diario. Repostar siempre en la zona barata, para quien haga 12.000 km al año, vale unos ${eur(brecha * LITROS_ANIO, 0)} €.`
      );
    } else {
      p.push(
        `Es una diferencia contenida: en ${provincia} cambiar de municipio para repostar no suele compensar el desvío. El ahorro está en elegir bien la estación dentro de tu propio pueblo o ciudad.`
      );
    }
    bloques.push({ id: 'entre-municipios', h: 'Cuánto cambia el precio de un municipio a otro', p });
  }

  /* --- 3. Municipios sin competencia ------------------------------------ */
  if (ctx.reparto) {
    const { conUna, conDos, totalMunis } = ctx.reparto;
    const sinCompetencia = conUna + conDos;
    if (totalMunis >= 10) {
      const pct = Math.round((sinCompetencia / totalMunis) * 100);
      const p = [];
      if (pct >= 50) {
        p.push(
          `${sinCompetencia} de los ${totalMunis} municipios de ${provincia} con gasolinera tienen una o dos como mucho: ${pct}% de la provincia vive sin competencia real a la que comparar. ${conUna} de ellos tienen una sola estación.`
        );
        p.push(
          `Donde no hay con quién comparar, el precio se parece más al de la carretera que al de la ciudad. En esa parte de la provincia la decisión útil no es qué surtidor elegir, sino llegar con depósito desde el municipio grande más cercano.`
        );
      } else {
        p.push(
          `De los ${totalMunis} municipios de ${provincia} con gasolinera, ${conUna} tienen una sola y ${conDos} tienen dos. En el resto hay al menos tres estaciones compitiendo, que es a partir de donde las diferencias de precio empiezan a notarse de verdad.`
        );
      }
      bloques.push({ id: 'competencia-prov', h: 'Dónde hay competencia y dónde no', p });
    }
  }

  /* --- 4. Serie provincial ----------------------------------------------- */
  const serie = analisisSerieProvincia(ctx.serie, provincia);
  if (serie) bloques.push(serie);

  return { bloques };
}

/* ------------------------------------------------------------------ *
 * Serie histórica de la provincia                                     *
 * ------------------------------------------------------------------ */

/**
 * Lectura de los últimos meses de precio medio de la provincia. Es dato propio: se
 * construye guardando cada día la foto del listado oficial, que el Ministerio no
 * conserva. Cada provincia cuenta una historia distinta, y eso es justo lo que hace
 * que esta sección no sea la misma en 52 páginas.
 */
export function analisisSerieProvincia(serie, provincia) {
  if (!serie || !Array.isArray(serie.valores)) return null;
  const pares = serie.valores
    .map((v, i) => [serie.fechas[i], v])
    .filter(([, v]) => typeof v === 'number' && Number.isFinite(v));
  if (pares.length < 30) return null;

  const primero = pares[0];
  const ultimo = pares[pares.length - 1];
  const cambio = ultimo[1] - primero[1];
  const maxPar = pares.reduce((a, b) => (b[1] > a[1] ? b : a));
  const minPar = pares.reduce((a, b) => (b[1] < a[1] ? b : a));
  const amplitud = maxPar[1] - minPar[1];

  const ult7 = pares.slice(-7).map(([, v]) => v);
  const prev7 = pares.slice(-14, -7).map(([, v]) => v);
  const semanal = prev7.length >= 3 ? media(ult7) - media(prev7) : 0;

  const p = [];
  const meses = Math.round(pares.length / 30);
  const periodo = meses >= 2 ? `${meses} meses` : `${pares.length} días`;

  if (Math.abs(cambio) < 0.01) {
    p.push(
      `El precio medio de la gasolina 95 en ${provincia} está hoy en ${p3(ultimo[1])} €/L, prácticamente donde estaba hace ${periodo} (${p3(primero[1])} €/L). Esa estabilidad de fondo esconde movimiento: en el camino llegó a ${p3(maxPar[1])} €/L el ${fechaCorta(maxPar[0])} y bajó a ${p3(minPar[1])} €/L el ${fechaCorta(minPar[0])}, ${cts(amplitud)} céntimos de recorrido.`
    );
  } else if (cambio > 0) {
    p.push(
      `En ${provincia} la gasolina 95 ha subido ${cts(cambio)} céntimos en ${periodo}: de ${p3(primero[1])} €/L a ${p3(ultimo[1])} €/L de media provincial. Para un conductor de 12.000 km al año eso son ${eur(cambio * LITROS_ANIO, 0)} € más al año sin haber cambiado nada en su forma de conducir.`
    );
    p.push(
      `El máximo del periodo fue ${p3(maxPar[1])} €/L el ${fechaCorta(maxPar[0])} y el mínimo ${p3(minPar[1])} €/L el ${fechaCorta(minPar[0])}.`
    );
  } else {
    p.push(
      `En ${provincia} la gasolina 95 ha bajado ${cts(cambio)} céntimos en ${periodo}: de ${p3(primero[1])} €/L a ${p3(ultimo[1])} €/L de media provincial, unos ${eur(Math.abs(cambio) * LITROS_ANIO, 0)} € al año menos para quien haga 12.000 km.`
    );
    p.push(
      `El máximo del periodo fue ${p3(maxPar[1])} €/L el ${fechaCorta(maxPar[0])} y el mínimo ${p3(minPar[1])} €/L el ${fechaCorta(minPar[0])}.`
    );
  }

  if (semanal > 0.004) {
    p.push(
      `La última semana la media provincial ha subido ${cts(semanal)} céntimos respecto a la anterior. Con el precio de subida, esperar a que baje suele salir mal: si el depósito está por la mitad, mejor llenar.`
    );
  } else if (semanal < -0.004) {
    p.push(
      `La última semana la media provincial ha bajado ${cts(semanal)} céntimos respecto a la anterior. Si te aguanta el depósito unos días y la tendencia sigue, esperar puede ahorrarte unos euros.`
    );
  } else {
    p.push(
      `En las dos últimas semanas la media provincial apenas se ha movido${Math.abs(semanal) >= 0.0005 ? ` (${cts(semanal)} céntimos de diferencia)` : ''}, así que el momento de repostar importa poco ahora mismo; lo que importa es la estación.`
    );
  }

  return { id: 'serie', h: `Cómo ha ido el precio en la provincia de ${provincia} estos meses`, p };
}

/* ------------------------------------------------------------------ *
 * Análisis de una marca                                               *
 * ------------------------------------------------------------------ */

/**
 * Lectura escrita de una cadena. Igual que con los municipios, el objetivo es que la
 * página de Ballenoil y la de Repsol no sean la misma con otro nombre: una es una red
 * desatendida con precio casi único y la otra una red de servicio con 40 céntimos de
 * diferencia entre sus propias estaciones, y el texto tiene que decirlo.
 */
export function analisisMarca({ nombre, lista, provincias, nacional }) {
  const bloques = [];
  // Combustible de referencia. Lo normal es la gasolina 95, pero hay redes orientadas al
  // gasoleo (IDS y similares) que apenas la despachan: sin esto su pagina se quedaba sin
  // analisis y era la mas pobre del sitio. Se analiza lo que la marca vende de verdad.
  const porFuel = (f) => lista.map((e) => e.p?.[f]).filter((v) => v != null);
  const usaDiesel = porFuel('g95').length < 5 && porFuel('ga').length >= 5;
  const g95 = usaDiesel ? porFuel('ga') : porFuel('g95');
  const ga = usaDiesel ? porFuel('g95') : porFuel('ga');
  const etqRef = usaDiesel ? 'gasóleo A' : 'gasolina 95';
  if (g95.length < 5) return { bloques };

  const med = media(g95);
  const min = Math.min(...g95);
  const max = Math.max(...g95);
  const total = lista.length;

  /* --- 1. ¿Precio de cadena o cada estación a su aire? ----------------- */
  {
    const dentro = g95.filter((v) => Math.abs(v - med) <= 0.02).length;
    const pctDentro = Math.round((dentro / g95.length) * 100);
    const p = [];
    if (pctDentro >= 80) {
      p.push(
        `${nombre} aplica precio de cadena: ${pctDentro}% de sus estaciones están dentro de ±2 céntimos de su media de ${etqRef} (${p3(med)} €/L). Las redes que funcionan así fijan el precio desde central y lo mueven a la vez en toda España, con pocos ajustes por zona.`
      );
      p.push(
        `Para ti significa que ver el precio de una ${nombre} te dice bastante bien lo que vas a pagar en otra: la sorpresa, si la hay, será pequeña. El margen de maniobra está en elegir cadena, no en elegir cuál de sus estaciones.`
      );
    } else if (pctDentro >= 55) {
      p.push(
        `En ${nombre} conviven precio central y ajuste local: ${pctDentro}% de sus estaciones están dentro de ±2 céntimos de la media de la cadena en ${etqRef} (${p3(med)} €/L), y el resto se separa bastante, entre ${p3(min)} y ${p3(max)} €/L.`
      );
      p.push(
        `Eso suele pasar en redes mixtas, con estaciones propias y otras en régimen de abanderamiento donde el precio final lo pone el titular. La media de la marca te orienta, pero no te sirve para dar por hecho lo que cuesta la de tu barrio.`
      );
    } else {
      p.push(
        `En ${nombre} el precio lo pone cada estación: solo ${pctDentro}% están dentro de ±2 céntimos de la media de la cadena en ${etqRef}, y entre la más barata (${p3(min)} €/L) y la más cara (${p3(max)} €/L) hay ${cts(max - min)} céntimos, ${eur((max - min) * DEPOSITO)} € por depósito.`
      );
      p.push(
        `Con esta dispersión, la media de ${nombre} sirve para comparar cadenas entre sí, pero no para decidir dónde repostas: el rótulo no te dice el precio. Hay que mirar la estación concreta.`
      );
    }
    bloques.push({ id: 'dispersion', h: `¿El precio lo pone la central o la estación?`, p });
  }

  /* --- 2. Geografía: red nacional o regional --------------------------- */
  if (provincias?.length) {
    const nProv = provincias.length;
    const top = provincias[0];
    const pctTop = Math.round((top.n / total) * 100);
    const top3 = provincias.slice(0, 3).reduce((s, x) => s + x.n, 0);
    const pctTop3 = Math.round((top3 / total) * 100);
    const p = [];
    if (nProv >= 35) {
      p.push(
        `${nombre} es una red nacional de verdad: ${total} estaciones repartidas por ${nProv} de las 52 provincias. Donde más tiene es en ${top.nombre} (${top.n}), pero sin concentrarse: las tres primeras provincias solo suman ${pctTop3}% de la red.`
      );
      p.push(
        `Una cobertura así importa si haces viajes largos: puedes planificar las paradas con la misma cadena y un precio parecido de punta a punta del país.`
      );
    } else if (pctTop >= 40 || nProv <= 6) {
      p.push(
        `${nombre} es una red concentrada, no nacional: ${pctTop}% de sus ${total} estaciones están en ${top.nombre} y en total solo aparece en ${nProv} ${nProv === 1 ? 'provincia' : 'provincias'}. Fuera de su zona es muy difícil encontrarla.`
      );
      p.push(
        `Para un residente de esa zona es una opción real del día a día; para alguien de paso, conviene no contar con ella como plan de repostaje en ruta.`
      );
    } else {
      p.push(
        `${nombre} está en ${nProv} provincias con ${total} estaciones, con más peso en ${lista2(provincias.slice(0, 3).map((x) => `${x.nombre} (${x.n})`))}: entre esas tres reúnen ${pctTop3}% de la red. Es una cadena de implantación amplia pero desigual, fuerte en unas comunidades y testimonial en otras.`
      );
    }
    bloques.push({ id: 'geografia', h: `Dónde encuentras ${nombre}`, p });
  }

  /* --- 3. Qué combustibles vende de verdad ------------------------------ */
  {
    const cobertura = (campo) => lista.filter((e) => e.p?.[campo] != null).length / total;
    const g98 = cobertura('g98');
    const glp = cobertura('glp');
    const gap = cobertura('gap');
    const cobG95 = cobertura('g95');
    const cobGa = cobertura('ga');
    const p = [];
    const vende = [];
    if (g98 >= 0.5) vende.push('gasolina 98');
    if (gap >= 0.5) vende.push('diésel premium');
    if (glp >= 0.3) vende.push('GLP');
    // Caso aparte: redes de gasoleo (IDS y similares). Decir que "venden gasolina 95 y
    // gasoleo" seria falso cuando apenas una de cada diez despacha gasolina.
    if (cobG95 < 0.4 && cobGa >= 0.7) {
      p.push(
        `${nombre} no es una red de uso general: solo ${Math.round(cobG95 * 100)}% de sus estaciones comunican gasolina 95, frente a ${Math.round(cobGa * 100)}% que comunican gasóleo A. Es una red orientada al gasóleo, el perfil de las cooperativas, los suministros a flotas y las estaciones de transporte profesional.`
      );
      p.push(
        `Para un turismo de gasolina, esta cadena no es una alternativa real por mucho que su precio de gasóleo salga bien en el ranking. Para un diésel, y sobre todo para quien recorre muchos kilómetros, sí lo es.`
      );
    } else if (!vende.length) {
      p.push(
        `${nombre} vende esencialmente dos productos: gasolina 95 y gasóleo A. La gasolina 98 la comunica ${Math.round(g98 * 100)}% de sus estaciones y el diésel premium ${Math.round(gap * 100)}%. Es el perfil típico de las redes que compiten por precio: menos referencias, menos inmovilizado en depósito y surtidores más simples.`
      );
      p.push(
        `Si tu coche pide 98 o usas GLP, esta cadena no te sirve como opción habitual por mucho que su media salga bien en el ranking.`
      );
    } else {
      p.push(
        `Además de gasolina 95 y gasóleo A, ${nombre} ofrece ${lista2(vende)} en buena parte de su red: ${g98 >= 0.5 ? `${Math.round(g98 * 100)}% de sus estaciones comunican gasolina 98` : ''}${g98 >= 0.5 && (gap >= 0.5 || glp >= 0.3) ? ' y ' : ''}${gap >= 0.5 ? `${Math.round(gap * 100)}% diésel premium` : ''}${glp >= 0.3 ? `${gap >= 0.5 ? ', ' : ''}${Math.round(glp * 100)}% GLP` : ''}.`
      );
      p.push(
        `La gama completa es lo que diferencia a una red de servicio de una de bajo coste, y es parte de lo que se paga en el precio por litro: más productos significa más depósitos, más surtidores y más rotación que cubrir.`
      );
    }
    bloques.push({ id: 'gama', h: `Qué se puede repostar en una ${nombre}`, p });
  }

  /* --- 4. Diésel frente a gasolina dentro de la cadena ------------------ */
  if (ga.length >= 5 && nacional?.brecha != null) {
    // La brecha nacional se mide siempre como diesel menos gasolina. Si en esta cadena el
    // combustible de referencia es el gasoleo, la resta sale al reves y hay que girarla
    // antes de comparar; si no, el veredicto diria justo lo contrario de lo que pasa.
    const brecha = usaDiesel ? med - media(ga) : media(ga) - med;
    const dif = brecha - nacional.brecha;
    const p = [
      `En ${nombre} el gasóleo A está ${cts(brecha)} céntimos ${brecha >= 0 ? 'por encima de' : 'por debajo de'} su gasolina 95 (${p3(usaDiesel ? med : media(ga))} frente a ${p3(usaDiesel ? media(ga) : med)} €/L). La distancia media del país entre los dos combustibles es de ${cts(nacional.brecha)} céntimos.`,
    ];
    if (Math.abs(dif) >= 0.015) {
      p.push(
        dif > 0
          ? `Es decir, esta cadena es comparativamente mejor para gasolina que para diésel: su ventaja de precio se nota menos si llenas de gasóleo.`
          : `Es decir, esta cadena aprieta más el gasóleo que la gasolina: si tu coche es diésel, su posición en el ranking te favorece todavía más de lo que indica la media de la 95.`
      );
    } else {
      p.push(
        `La separación entre ambos es la normal del mercado, así que el ahorro de esta cadena es parecido conduzcas lo que conduzcas.`
      );
    }
    bloques.push({ id: 'brecha-marca', h: 'Diésel o gasolina en esta cadena', p });
  }

  /* --- 5. 24 horas ------------------------------------------------------ */
  {
    const conHorario = lista.filter((e) => e.horario);
    if (conHorario.length >= 10) {
      const n24 = conHorario.filter((e) => esVeinticuatroHoras(e.horario)).length;
      const pct24 = Math.round((n24 / conHorario.length) * 100);
      const p = [];
      if (pct24 >= 70) {
        p.push(
          `${pct24}% de las estaciones de ${nombre} que declaran horario abren 24 horas. Es coherente con una red automatizada: sin personal en turno de noche, mantener la estación abierta no cuesta apenas más.`
        );
      } else if (pct24 <= 25) {
        p.push(
          `Solo ${pct24}% de las ${nombre} que declaran horario abren 24 horas: la mayoría cierra. Si repostas de noche con frecuencia, cuenta con que esta cadena no va a ser tu opción aunque su precio medio sea bueno.`
        );
      } else {
        p.push(
          `${pct24}% de las estaciones de ${nombre} con horario declarado abren 24 horas: depende mucho de si está en vía rápida o en casco urbano. Conviene comprobarlo en la ficha de la estación concreta.`
        );
      }
      bloques.push({ id: 'horario-marca', h: 'Horarios de la red', p });
    }
  }

  return { bloques };
}
