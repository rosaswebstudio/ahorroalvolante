// Mapa de gasolineras. Vive aparte del buscador por dos razones: el componente ya era
// largo, y sobre todo porque asi Leaflet queda detras de un import() dinamico y no se
// descarga mientras se use la lista, que es lo que hace casi todo el mundo y lo que ve el
// primer visitante que aterriza en la portada.
//
// No se pintan logos de marca a proposito. Son marcas registradas, y alojar decenas de
// logotipos de petroleras en una web con publicidad es un riesgo evitable: en un mapa se
// busca el precio, no el logotipo. Los marcadores van coloreados por precio con la misma
// escala que la lista, que ademas se lee de un vistazo y no hay que aprender.

import hojaUrl from 'leaflet/dist/leaflet.css?url';

// Teselas de CARTO sobre cartografia de OpenStreetMap. Elegidas por dos motivos: tienen
// estilo oscuro y claro, que es justo lo que necesita el tema de la web, y su politica
// permite este uso siempre que la atribucion quede visible.
//
// El servidor de teselas de la propia OSMF queda descartado a proposito: su politica dice
// explicitamente que no hay SLA y que pueden cortar el acceso sin aviso si el uso les
// molesta. Eso no es una base sobre la que montar una funcion de un producto.
const TILES = {
  oscuro: 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png',
  claro: 'https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png',
};

const ATRIBUCION =
  '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap</a> ' +
  '&copy; <a href="https://carto.com/attributions" target="_blank" rel="noopener">CARTO</a>';

// Tope de marcadores. Una provincia grande pasa de las 300 estaciones y cada etiqueta de
// precio es un nodo del DOM: en un movil modesto eso se nota al mover el mapa. Se pintan
// las primeras del orden activo, que son las que interesan (las mas baratas o las mas
// rentables), y se avisa debajo de cuantas se estan viendo.
export const MAX_MARCADORES = 120;

const tema = () =>
  document.documentElement.dataset.tema === 'claro' ? 'claro' : 'oscuro';

// La hoja de Leaflet se pide como URL, no como import de CSS. Con un import normal, Vite la
// mete en el <link> de la pagina y esos 16 KB se descargan en TODAS las visitas, bloqueando
// el render, para una funcion que casi nadie abre. Pidiendo la URL solo se emite el fichero y
// aqui se engancha a mano la primera vez que se abre el mapa.
function engancharHoja() {
  if (document.querySelector('link[data-leaflet]')) return;
  const link = document.createElement('link');
  link.rel = 'stylesheet';
  link.href = hojaUrl;
  link.dataset.leaflet = '1';
  document.head.appendChild(link);
}

let L = null;

/** Carga Leaflet y su CSS bajo demanda. Idempotente. */
export async function cargarLeaflet() {
  if (L) return L;
  engancharHoja();
  const mod = await import('leaflet');
  L = mod.default ?? mod;
  return L;
}

/** Crea el mapa dentro de `nodo`. Devuelve el manejador que usa el buscador. */
export async function crearMapa(nodo) {
  const Lf = await cargarLeaflet();

  const mapa = Lf.map(nodo, {
    // El zoom con rueda secuestra el scroll de la pagina cuando el puntero pasa por
    // encima del mapa. Con ctrl+rueda o con los botones se hace zoom igual.
    scrollWheelZoom: false,
    attributionControl: true,
  });

  let capaTiles = Lf.tileLayer(TILES[tema()], { attribution: ATRIBUCION, maxZoom: 19 }).addTo(mapa);
  const capaMarcas = Lf.layerGroup().addTo(mapa);
  let temaPintado = tema();

  // Vista por defecto hasta que haya estaciones que encuadrar (peninsula).
  mapa.setView([40.2, -3.7], 5);

  /** Si el usuario cambia el tema con el mapa abierto, se cambia el estilo de las teselas. */
  function sincronizarTema() {
    if (tema() === temaPintado) return;
    temaPintado = tema();
    mapa.removeLayer(capaTiles);
    capaTiles = Lf.tileLayer(TILES[temaPintado], { attribution: ATRIBUCION, maxZoom: 19 }).addTo(mapa);
  }

  return { Lf, mapa, capaMarcas, sincronizarTema };
}

/**
 * Vuelca las estaciones en el mapa.
 *
 * `estaciones` llega ya filtrada y ordenada por el buscador, asi que el mapa siempre
 * enseña lo mismo que la lista. `ayuda` trae las funciones del componente (color, formato,
 * escape y la linea de si compensa el desvio) para no duplicarlas aqui y que las dos
 * vistas no puedan discrepar.
 */
export function pintarMapa(ctx, estaciones, fuel, min, max, ayuda, userPos) {
  const { Lf, mapa, capaMarcas, sincronizarTema } = ctx;
  sincronizarTema();
  capaMarcas.clearLayers();

  const conCoords = estaciones.filter(
    (e) => Number.isFinite(e.lat) && Number.isFinite(e.lng) && e.p[fuel] != null
  );
  const visibles = conCoords.slice(0, MAX_MARCADORES);
  const puntos = [];

  for (const e of visibles) {
    const precio = e.p[fuel];
    const t = max > min ? (precio - min) / (max - min) : 0.5;
    const color = ayuda.colorFor(t);

    // Etiqueta con el precio dentro del propio marcador: en un mapa de gasolineras el
    // precio ES el dato, y obligar a pinchar cada chincheta para verlo lo haria inutil.
    const icono = Lf.divIcon({
      className: '',
      html:
        '<span style="display:inline-block;padding:2px 5px;border-radius:6px;' +
        'font:600 11px/1.1 ui-monospace,SFMono-Regular,Menlo,monospace;' +
        'color:#0B0D12;background:' + color + ';box-shadow:0 1px 3px rgba(0,0,0,.5);' +
        'white-space:nowrap">' + ayuda.fmt(precio) + '</span>',
      iconSize: [46, 18],
      iconAnchor: [23, 9],
    });

    const marcador = Lf.marker([e.lat, e.lng], { icon: icono, title: e.rotulo });
    const comoLlegar =
      'https://www.google.com/maps/dir/?api=1&destination=' + e.lat + ',' + e.lng;

    marcador.bindPopup(
      '<div style="min-width:180px">' +
        '<strong>' + ayuda.esc(e.rotulo) + '</strong><br>' +
        '<span style="opacity:.75">' + ayuda.esc(e.dir) + '</span><br>' +
        '<span style="font-weight:700">' + ayuda.fmt(precio) + ' €/L</span>' +
        (ayuda.textoDesvio(e) ? '<br>' + ayuda.esc(ayuda.textoDesvio(e)) : '') +
        '<br><a href="' + comoLlegar + '" target="_blank" rel="noopener nofollow">Cómo llegar</a>' +
      '</div>'
    );

    capaMarcas.addLayer(marcador);
    puntos.push([e.lat, e.lng]);
  }

  // Donde esta el usuario, para que el mapa responda a "cual me pilla de camino". Es un
  // circulo y no una chincheta para que no compita visualmente con los precios.
  if (userPos) {
    capaMarcas.addLayer(
      Lf.circleMarker([userPos.lat, userPos.lng], {
        radius: 7,
        weight: 3,
        color: '#38BDF8',
        fillColor: '#38BDF8',
        fillOpacity: 0.35,
      }).bindPopup('Estás aquí, según tu navegador')
    );
    puntos.push([userPos.lat, userPos.lng]);
  }

  if (puntos.length) {
    mapa.fitBounds(puntos, { padding: [30, 30], maxZoom: 14 });
  }

  return { pintados: visibles.length, total: conCoords.length };
}
