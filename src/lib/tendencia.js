// Analiza una serie de precios medios diarios para responder "¿lleno hoy o espero?".
// Describe lo que ha pasado; no predice el futuro (ver el aviso que muestra la web).

const media = (xs) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null);

// Por debajo de este cambio semanal el movimiento es ruido, no tendencia.
const UMBRAL = 0.005; // 0,5%

/**
 * @param {(number|null)[]} valores serie diaria, del día más antiguo al más reciente
 * @returns {null|{actual:number,media:number,minimo:number,maximo:number,
 *   cambio:number,cambioPct:number,estado:'subiendo'|'bajando'|'estable',
 *   variacionSemanal:number,vsMediaPct:number,dias:number}}
 */
export function analizar(valores) {
  const serie = (valores || []).filter((v) => typeof v === 'number' && Number.isFinite(v));
  if (serie.length < 8) return null; // sin dos semanas no hay tendencia que valga

  const actual = serie[serie.length - 1];
  const primero = serie[0];
  const m = media(serie);

  const ultimos7 = serie.slice(-7);
  const previos7 = serie.slice(-14, -7);
  const m7 = media(ultimos7);
  const mPrev = previos7.length >= 3 ? media(previos7) : m7;
  const variacionSemanal = mPrev ? (m7 - mPrev) / mPrev : 0;

  let estado = 'estable';
  if (variacionSemanal > UMBRAL) estado = 'subiendo';
  else if (variacionSemanal < -UMBRAL) estado = 'bajando';

  return {
    actual,
    media: m,
    minimo: Math.min(...serie),
    maximo: Math.max(...serie),
    cambio: actual - primero,
    cambioPct: primero ? (actual - primero) / primero : 0,
    estado,
    variacionSemanal,
    vsMediaPct: m ? (actual - m) / m : 0,
    dias: serie.length,
  };
}

/** Frase de recomendación, en función de la tendencia y de lo caro que esté ahora. */
export function veredicto(a) {
  if (!a) return null;
  const caro = a.vsMediaPct > 0.01;
  const barato = a.vsMediaPct < -0.01;

  if (a.estado === 'subiendo') {
    return {
      titulo: 'Mejor llena hoy',
      texto: caro
        ? 'El precio lleva una semana subiendo y ahora está por encima de su media reciente. Si puedes repostar hoy, hazlo: la tendencia no acompaña a esperar.'
        : 'El precio lleva una semana subiendo. Todavía no está caro respecto a su media, pero esperar juega en tu contra.',
      color: 'rojo',
    };
  }
  if (a.estado === 'bajando') {
    return {
      titulo: 'Puedes esperar',
      texto: barato
        ? 'El precio lleva una semana bajando y ya está por debajo de su media reciente. Si el depósito te aguanta unos días, es probable que ahorres.'
        : 'El precio lleva una semana bajando. Si no tienes prisa, esperar un par de días puede salirte a cuenta.',
      color: 'verde',
    };
  }
  return {
    titulo: 'Da un poco igual',
    texto: barato
      ? 'El precio está estable y por debajo de su media reciente: es un buen momento para repostar, pero sin urgencia.'
      : 'El precio lleva una semana estable, así que esperar o repostar hoy no cambia mucho. Lo que sí cambia, y bastante, es en qué gasolinera lo hagas.',
    color: 'neutro',
  };
}

/**
 * Puntos de una línea para un SVG, normalizados al ancho y alto indicados.
 * Los huecos (null) se ignoran, manteniendo la posición temporal en el eje X.
 */
export function puntosSparkline(valores, ancho, alto) {
  const idx = [];
  (valores || []).forEach((v, i) => {
    if (typeof v === 'number' && Number.isFinite(v)) idx.push([i, v]);
  });
  if (idx.length < 2) return '';
  const vs = idx.map(([, v]) => v);
  const min = Math.min(...vs);
  const max = Math.max(...vs);
  const rango = max - min || 1;
  const n = valores.length - 1 || 1;
  return idx
    .map(([i, v]) => {
      const x = (i / n) * ancho;
      const y = alto - ((v - min) / rango) * alto;
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(' ');
}
