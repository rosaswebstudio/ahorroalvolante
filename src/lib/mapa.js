// Mapa de gasolineras. Vive aparte del buscador por dos razones: el componente ya era
// largo, y sobre todo porque asi Leaflet queda detras de un import() dinamico y no se
// descarga mientras se use la lista, que es lo que hace casi todo el mundo y lo que ve el
// primer visitante que aterriza en la portada.
//
// No se pintan logos de marca a proposito. Son marcas registradas, y alojar decenas de
// logotipos de petroleras en una web con publicidad es un riesgo evitable: en un mapa se
// busca el precio, no el logotipo. Los marcadores van coloreados por precio con la misma
// escala que la lista, que ademas se lee de un vistazo y no hay que aprender.

// La hoja de Leaflet se pide como URL, no como import de CSS. Con un import normal, Vite la
// mete en el <link> de la pagina y esos 16 KB se descargan en TODAS las visitas, bloqueando
// el render, para una funcion que casi nadie abre. Pidiendo la URL solo se emite el fichero
// y aqui se engancha a mano la primera vez que se abre el mapa.
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

// Tope por PANTALLA, no sobre el total. Ya no se recorta la lista: se pinta lo que cabe en
// lo que estas mirando y el resto va apareciendo al moverte. Este numero solo existe para
// que un zoom muy alejado sobre una provincia entera no meta mil nodos en el DOM de golpe
// en un movil modesto; en la practica casi nunca se alcanza.
const MAX_EN_PANTALLA = 300;

// Cuantas estaciones del orden activo se usan para encuadrar la vista inicial. Encuadrar
// las 300 de una provincia dejaria el mapa tan alejado que no se leeria ningun precio; con
// las primeras del orden (las mas baratas, o las mas rentables) abre donde importa.
const PARA_ENCUADRAR = 20;

const tema = () =>
  document.documentElement.dataset.tema === 'claro' ? 'claro' : 'oscuro';

let L = null;

function engancharHoja() {
  if (document.querySelector('link[data-leaflet]')) return;
  const link = document.createElement('link');
  link.rel = 'stylesheet';
  link.href = hojaUrl;
  link.dataset.leaflet = '1';
  document.head.appendChild(link);
}

/** Carga Leaflet y su CSS bajo demanda. Idempotente. */
export async function cargarLeaflet() {
  if (L) return L;
  engancharHoja();
  const mod = await import('leaflet');
  L = mod.default ?? mod;
  return L;
}

/**
 * Crea el mapa dentro de `nodo`. `onCambio` recibe el recuento de lo que se esta viendo
 * cada vez que cambia, para que el buscador lo pueda contar debajo del mapa.
 */
export async function crearMapa(nodo, onCambio) {
  const Lf = await cargarLeaflet();

  const mapa = Lf.map(nodo, {
    // Arranca desactivado y se enciende al tocar el mapa. Ver el bloque de la rueda.
    scrollWheelZoom: false,
    attributionControl: true,
  });

  let capaTiles = Lf.tileLayer(TILES[tema()], { attribution: ATRIBUCION, maxZoom: 19 }).addTo(mapa);
  const capaMarcas = Lf.layerGroup().addTo(mapa);
  const capaUsuario = Lf.layerGroup().addTo(mapa);
  let temaPintado = tema();

  mapa.setView([40.2, -3.7], 5);

  // Datos vigentes: los pone el buscador en cada render y los lee el repintado por
  // movimiento, que ocurre cuando el buscador no esta mirando.
  const estado = { estaciones: [], fuel: null, min: 0, max: 0, ayuda: null, firma: '' };

  // --- Zoom con rueda sin secuestrar la pagina --------------------------------------
  //
  // Con la rueda siempre activa, quien baja por la portada y pasa el puntero por encima del
  // mapa se queda atrapado haciendo zoom en vez de seguir bajando: es de las cosas que mas
  // molestan de un mapa incrustado. Con la rueda siempre apagada hay que usar los botones,
  // que es lo que habia y era incomodo.
  //
  // El punto medio: en cuanto tocas el mapa (clic, arrastre o dedo) la rueda queda activa
  // mientras el puntero este encima. Si solo pasabas por encima bajando por la pagina, la
  // pagina sigue bajando. En movil no aplica: el pellizco ya hacia zoom desde el principio.
  const encender = () => mapa.scrollWheelZoom.enable();
  const apagar = () => mapa.scrollWheelZoom.disable();
  const activar = () => { nodo.dataset.activo = '1'; encender(); };

  nodo.addEventListener('mousedown', activar);
  nodo.addEventListener('touchstart', activar, { passive: true });
  nodo.addEventListener('mouseenter', () => { if (nodo.dataset.activo === '1') encender(); });
  nodo.addEventListener('mouseleave', apagar);
  // Un clic fuera del mapa significa que has vuelto a la pagina.
  document.addEventListener('mousedown', (ev) => {
    if (!nodo.contains(ev.target)) { nodo.dataset.activo = '0'; apagar(); }
  });

  function sincronizarTema() {
    if (tema() === temaPintado) return;
    temaPintado = tema();
    mapa.removeLayer(capaTiles);
    capaTiles = Lf.tileLayer(TILES[temaPintado], { attribution: ATRIBUCION, maxZoom: 19 }).addTo(mapa);
  }

  /** Marcador de una estacion, con el precio escrito dentro. */
  function marcadorDe(e) {
    const { fuel, min, max, ayuda } = estado;
    const precio = e.p[fuel];
    const t = max > min ? (precio - min) / (max - min) : 0.5;
    const color = ayuda.colorFor(t);

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

    const comoLlegar = 'https://www.google.com/maps/dir/?api=1&destination=' + e.lat + ',' + e.lng;
    const veredicto = ayuda.textoDesvio(e);

    return Lf.marker([e.lat, e.lng], { icon: icono, title: e.rotulo }).bindPopup(
      '<div style="min-width:180px">' +
        '<strong>' + ayuda.esc(e.rotulo) + '</strong><br>' +
        '<span style="opacity:.75">' + ayuda.esc(e.dir) + '</span><br>' +
        '<span style="font-weight:700">' + ayuda.fmt(precio) + ' €/L</span>' +
        (veredicto ? '<br>' + ayuda.esc(veredicto) : '') +
        '<br><a href="' + comoLlegar + '" target="_blank" rel="noopener nofollow">Cómo llegar</a>' +
      '</div>'
    );
  }

  /**
   * Pinta las estaciones que caen dentro de lo que se esta viendo. Se llama al terminar
   * cada movimiento, asi que al desplazarte o alejarte van apareciendo las demas sin que
   * haya que recortar la lista a un numero fijo.
   */
  function pintarVisibles() {
    if (!estado.ayuda || !estado.estaciones.length) return;
    const limites = mapa.getBounds();
    const dentro = estado.estaciones.filter((e) => limites.contains([e.lat, e.lng]));

    capaMarcas.clearLayers();
    for (const e of dentro.slice(0, MAX_EN_PANTALLA)) capaMarcas.addLayer(marcadorDe(e));

    if (onCambio) {
      onCambio({
        enPantalla: Math.min(dentro.length, MAX_EN_PANTALLA),
        recortadas: Math.max(0, dentro.length - MAX_EN_PANTALLA),
        total: estado.estaciones.length,
      });
    }
  }

  // moveend cubre arrastre y zoom, y salta una sola vez al terminar, no en cada fotograma.
  mapa.on('moveend', pintarVisibles);

  return { Lf, mapa, capaMarcas, capaUsuario, estado, sincronizarTema, pintarVisibles };
}

/**
 * Vuelca en el mapa las estaciones que el buscador ya ha filtrado y ordenado, de modo que
 * mapa y lista siempre enseñan lo mismo. `ayuda` trae las funciones del componente (color,
 * formato, escape y el veredicto del desvio) para no duplicarlas y que no puedan discrepar.
 */
export function pintarMapa(ctx, estaciones, fuel, min, max, ayuda, userPos) {
  const { Lf, mapa, capaUsuario, estado, sincronizarTema, pintarVisibles } = ctx;
  sincronizarTema();

  const conCoords = estaciones.filter(
    (e) => Number.isFinite(e.lat) && Number.isFinite(e.lng) && e.p[fuel] != null
  );

  // ¿Han cambiado los datos o solo estamos repintando lo mismo? Si han cambiado hay que
  // reencuadrar; si no, se respeta donde haya dejado el usuario el mapa, porque mover el
  // mapa por su cuenta mientras alguien lo esta usando es de las cosas que mas irritan.
  const firma = fuel + ':' + conCoords.length + ':' + (conCoords[0] ? conCoords[0].id : '');
  const nuevos = firma !== estado.firma;

  estado.estaciones = conCoords;
  estado.fuel = fuel;
  estado.min = min;
  estado.max = max;
  estado.ayuda = ayuda;
  estado.firma = firma;

  // Donde esta el usuario, para que el mapa responda a "cual me pilla de camino". Circulo y
  // no chincheta para que no compita visualmente con los precios.
  capaUsuario.clearLayers();
  if (userPos) {
    capaUsuario.addLayer(
      Lf.circleMarker([userPos.lat, userPos.lng], {
        radius: 7,
        weight: 3,
        color: '#38BDF8',
        fillColor: '#38BDF8',
        fillOpacity: 0.35,
      }).bindPopup('Estás aquí, según tu navegador')
    );
  }

  if (nuevos) {
    const puntos = conCoords.slice(0, PARA_ENCUADRAR).map((e) => [e.lat, e.lng]);
    if (userPos) puntos.push([userPos.lat, userPos.lng]);
    if (puntos.length) mapa.fitBounds(puntos, { padding: [30, 30], maxZoom: 14 });
  }

  // fitBounds dispara moveend y con el el repintado, pero si el encuadre no cambia nada no
  // salta, asi que se llama tambien aqui. Pintar dos veces seguidas es inocuo.
  pintarVisibles();
}
