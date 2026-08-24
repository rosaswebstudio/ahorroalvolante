// Índice de las guías. Vive aquí y no en cada página para que el listado, los enlaces
// entre guías y el sitemap salgan todos de la misma fuente y no se desincronicen.
//
// `actualizada` es la fecha real de la última revisión del texto. Si se retoca una guía,
// se cambia aquí: es lo que se enseña al lector y lo que va en el JSON-LD.

export const GUIAS = [
  {
    slug: 'precio-de-la-gasolina',
    tema: 'El precio',
    titulo: 'Por qué la gasolina cuesta lo que cuesta',
    description:
      'Las cuatro partes del precio de un litro: producto, impuesto de hidrocarburos, margen de la estación e IVA, y por qué el IVA se cobra también sobre el impuesto.',
    resumen:
      'Cerca de la mitad de lo que pagas no es combustible. Y una parte se calcula encima de la otra.',
    minutos: 9,
    actualizada: '2026-08-12',
  },
  {
    slug: 'de-donde-salen-los-precios',
    tema: 'El precio',
    titulo: 'De dónde salen estos precios y por qué a veces no coinciden',
    description:
      'Cómo funciona el listado oficial del Ministerio, cada cuánto está obligada una gasolinera a comunicar sus precios y qué hacer si el surtidor marca otra cosa.',
    resumen:
      'La gasolinera tiene obligación legal de comunicar el precio, pero no en tiempo real. Ahí está el desfase.',
    minutos: 7,
    actualizada: '2026-08-12',
  },
  {
    slug: 'low-cost-o-marca',
    tema: 'Dónde repostar',
    titulo: 'Low cost o marca: ¿es la misma gasolina?',
    description:
      'Qué comparten realmente una estación desatendida y una de marca, qué exige la norma europea a todo el combustible que se vende en España y en qué se diferencian de verdad.',
    resumen:
      'Salen de las mismas refinerías y viajan por los mismos tubos. Lo que cambia viene después.',
    minutos: 8,
    actualizada: '2026-08-12',
  },
  {
    slug: 'cuando-repostar',
    tema: 'Dónde repostar',
    titulo: 'Cuándo y dónde repostar más barato',
    description:
      'Qué diferencias de precio son reales, cuáles son mitos repetidos y cuánto se ahorra de verdad eligiendo bien la estación en lugar del momento del día.',
    resumen:
      'El sitio importa mucho más que la hora. Y lo de repostar de madrugada no ahorra nada.',
    minutos: 8,
    actualizada: '2026-08-12',
  },
  {
    slug: 'descuentos-de-carburante',
    tema: 'Dónde repostar',
    titulo: 'Descuentos de carburante: cuáles compensan y cuáles no',
    description:
      'Tarjetas de fidelización, promociones de supermercado, cooperativas y tarjetas de crédito con devolución: cómo comparar un descuento con un precio más bajo de partida.',
    resumen:
      'Un descuento de 10 céntimos en una estación cara puede salir peor que el precio normal de la barata de al lado.',
    minutos: 8,
    actualizada: '2026-08-12',
  },
  {
    slug: 'conduccion-eficiente',
    tema: 'Gastar menos',
    titulo: 'Cuánto baja el consumo cada cosa que puedes cambiar',
    description:
      'Velocidad, presión de neumáticos, aire acondicionado, baca, peso y forma de conducir, ordenados por lo que reducen de verdad el consumo.',
    resumen:
      'Ordenado por impacto real, no por lo fácil que es escribir el consejo.',
    minutos: 10,
    actualizada: '2026-08-12',
  },
  {
    slug: 'consumo-real-vs-homologado',
    tema: 'Gastar menos',
    titulo: 'Por qué tu coche gasta más que lo que dice la ficha',
    description:
      'Qué mide el ciclo de homologación WLTP, por qué el consumo real casi siempre es mayor y cómo medir el tuyo de verdad con dos repostajes.',
    resumen:
      'El dato del catálogo no es mentira, es otra pregunta. Cómo calcular la respuesta a la tuya.',
    minutos: 8,
    actualizada: '2026-08-12',
  },
  {
    slug: 'gasoleo-a-o-premium',
    tema: 'Gastar menos',
    titulo: 'Gasóleo normal o premium: si los aditivos compensan',
    description:
      'Qué llevan de más los combustibles premium, qué dice la norma que deben cumplir todos, y en qué casos concretos ese sobreprecio tiene sentido.',
    resumen:
      'La diferencia existe, pero no está donde la pone la publicidad ni compensa a todo el mundo.',
    minutos: 7,
    actualizada: '2026-08-12',
  },
  {
    slug: 'por-que-sube-la-gasolina',
    tema: 'El precio',
    titulo: 'Por qué sube la gasolina de un mes para otro',
    description:
      'Qué mueve de verdad el precio del litro: el crudo, el cambio euro-dólar, el margen de refino y la estacionalidad, y por qué el surtidor tarda en reflejarlo.',
    resumen:
      'El barril no es lo único, y casi nunca es lo que más manda en la subida de esta semana.',
    minutos: 9,
    actualizada: '2026-08-24',
  },
  {
    slug: 'precios-por-provincia',
    tema: 'El precio',
    titulo: 'Por qué la gasolina no cuesta lo mismo en cada provincia',
    description:
      'De dónde salen las diferencias de precio entre provincias españolas: competencia local, distancia a las refinerías, régimen fiscal de Canarias, Ceuta y Melilla, y densidad de estaciones.',
    resumen:
      'Entre la provincia más barata y la más cara hay más de diez céntimos, y no es casualidad.',
    minutos: 8,
    actualizada: '2026-08-24',
  },
  {
    slug: 'gasolineras-de-autopista',
    tema: 'Dónde repostar',
    titulo: 'Gasolineras de autopista: cuánto cuestan de más y cuándo salir',
    description:
      'Por qué el área de servicio cobra más caro, cuánto suele ser la diferencia y en qué casos compensa salir de la autovía a repostar.',
    resumen:
      'Salir a repostar cuesta unos minutos. La cuenta de si merece la pena es sencilla.',
    minutos: 7,
    actualizada: '2026-08-24',
  },
  {
    slug: 'gasolineras-desatendidas',
    tema: 'Dónde repostar',
    titulo: 'Gasolineras desatendidas: cómo funcionan y por qué son más baratas',
    description:
      'Qué es una estación automática, qué necesitas para repostar en una, de dónde sale su ahorro y qué limitaciones tienen frente a una atendida.',
    resumen:
      'El combustible es el mismo. Lo que quitan es todo lo que hay alrededor del surtidor.',
    minutos: 8,
    actualizada: '2026-08-24',
  },
  {
    slug: 'repostar-en-un-viaje-largo',
    tema: 'Dónde repostar',
    titulo: 'Cómo planificar el repostaje en un viaje largo',
    description:
      'Dónde conviene llenar en una ruta de varios cientos de kilómetros, cuántas paradas hacen falta y por qué salir de casa con el depósito lleno casi siempre sale mejor.',
    resumen:
      'En un viaje de 700 km, elegir bien dos paradas vale más que cualquier truco de conducción.',
    minutos: 8,
    actualizada: '2026-08-24',
  },
  {
    slug: 'aire-acondicionado-o-ventanillas',
    tema: 'Gastar menos',
    titulo: 'Aire acondicionado o ventanillas bajadas: qué gasta más',
    description:
      'Cuánto consume de más el aire acondicionado, cuánto la resistencia aerodinámica de llevar las ventanillas abiertas y a partir de qué velocidad se cruzan las dos curvas.',
    resumen:
      'La respuesta cambia con la velocidad, y por eso las dos posturas de la discusión tienen su parte de razón.',
    minutos: 7,
    actualizada: '2026-08-24',
  },
  {
    slug: 'consumo-en-ciudad',
    tema: 'Gastar menos',
    titulo: 'Por qué en ciudad se dispara el consumo',
    description:
      'Qué pasa físicamente en un trayecto urbano corto: arranques en frío, aceleraciones continuas y motor sin temperatura, y qué se puede hacer al respecto.',
    resumen:
      'No es que la ciudad gaste más: es que los tres primeros kilómetros gastan muchísimo más.',
    minutos: 8,
    actualizada: '2026-08-24',
  },
  {
    slug: 'coste-real-de-un-coche',
    tema: 'Gastar menos',
    titulo: 'Cuánto cuesta de verdad tu coche al año',
    description:
      'Las seis partidas del coste anual de un coche particular: depreciación, seguro, combustible, mantenimiento, impuesto de circulación e ITV, y cuál pesa más de lo que parece.',
    resumen:
      'El combustible es la partida en la que más piensas y casi nunca la más cara.',
    minutos: 9,
    actualizada: '2026-08-24',
  },
  {
    slug: 'gasolina-e10',
    tema: 'Combustibles',
    titulo: 'Gasolina E10: qué es y si tu coche la admite',
    description:
      'Qué significa la etiqueta E10 del surtidor, cuánto etanol lleva la gasolina que se vende en España y qué vehículos pueden tener problemas con ella.',
    resumen:
      'La etiqueta del surtidor lleva años ahí y casi nadie sabe qué significa la E.',
    minutos: 7,
    actualizada: '2026-08-24',
  },
  {
    slug: 'glp-compensa',
    tema: 'Combustibles',
    titulo: 'GLP: cuántos kilómetros hacen falta para amortizarlo',
    description:
      'Qué cuesta convertir un coche de gasolina a autogás, cuánto se ahorra por kilómetro contando el mayor consumo, y a partir de cuántos kilómetros al año sale a cuenta.',
    resumen:
      'El litro cuesta la mitad, pero gastas más litros. La cuenta buena es por kilómetro.',
    minutos: 9,
    actualizada: '2026-08-24',
  },
  {
    slug: 'adblue',
    tema: 'Combustibles',
    titulo: 'AdBlue: qué es, cuánto gasta y dónde conviene comprarlo',
    description:
      'Para qué sirve el AdBlue en un diésel moderno, cada cuántos kilómetros hay que rellenarlo, cuánto cuesta según dónde lo compres y qué pasa si se agota.',
    resumen:
      'No es un aditivo ni un capricho: sin él, el coche acaba por no arrancar.',
    minutos: 7,
    actualizada: '2026-08-24',
  },
  {
    slug: 'equivocarse-de-combustible',
    tema: 'Combustibles',
    titulo: 'Me he equivocado de combustible: qué hacer',
    description:
      'Qué hacer si echas gasolina en un diésel o diésel en un gasolina, por qué no hay que arrancar el motor, y qué diferencia hay entre los dos errores.',
    resumen:
      'Lo que decidas en el minuto siguiente marca la diferencia entre un vaciado y una avería cara.',
    minutos: 7,
    actualizada: '2026-08-24',
  },
];

/**
 * Páginas de contenido que ya existían antes de la sección y que se siguen sirviendo en su
 * ruta original. Se listan en el índice de guías porque son parte de lo mismo, pero no se
 * mueven: cambiar una URL publicada solo sirve para perder lo que ya tenga posicionado.
 */
export const GUIAS_EXTERNAS = [
  {
    ruta: '/diesel-o-gasolina/',
    tema: 'Antes de comprar',
    titulo: 'Diésel o gasolina: cuál te sale a cuenta',
    resumen: 'Los kilómetros a partir de los cuales el diésel compensa, con la cuenta hecha.',
  },
  {
    ruta: '/calcular-gasto-gasolina/',
    tema: 'Antes de comprar',
    titulo: 'Calcular lo que cuesta un viaje',
    resumen: 'Cuánto combustible se va en un trayecto concreto, con los precios de hoy.',
  },
];

export const guia = (slug) => {
  const g = GUIAS.find((x) => x.slug === slug);
  if (!g) throw new Error(`No existe la guía "${slug}" en src/lib/guias.js`);
  return g;
};

export const rutaGuia = (slug) => `/guias/${slug}/`;

/**
 * Las guías que siguen a esta, en círculo. Así cada una recomienda vecinas distintas y no
 * acaban las ocho apuntando a las tres primeras.
 */
export const otrasGuias = (slug, n = 3) => {
  const i = GUIAS.findIndex((g) => g.slug === slug);
  const desde = i === -1 ? 0 : i + 1;
  return Array.from({ length: Math.min(n, GUIAS.length - 1) }, (_, k) => GUIAS[(desde + k) % GUIAS.length]);
};

/** "12 de agosto de 2026" a partir del ISO corto. */
export const fechaLarga = (iso) =>
  new Date(`${iso}T00:00:00Z`).toLocaleDateString('es-ES', {
    day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC',
  });
