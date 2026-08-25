# Gasolineras Baratas (Web 5)

Buscador de la gasolinera más barata cerca de ti: precios de hoy de gasolina 95, 98, diésel,
diésel premium y GLP, con **datos oficiales del Ministerio** (Geoportal Gasolineras),
actualizados cada 30 minutos. 100% cliente, sin backend.

Stack: **Astro 7 + JavaScript vanilla**, **Tailwind CSS v4**. Tema oscuro con acento ámbar
(patrón visual de Vatio).

## Datos

- API: `https://sedeaplicaciones.minetur.gob.es/ServiciosRESTCarburantes/PreciosCarburantes/`
  (pública, sin token, **CORS abierto** — verificado 16-07-2026).
- Se consulta **por provincia** (`FiltroProvincia/{id}`, ~0,3-1 MB) y se reduce el payload a los
  campos útiles antes de cachearlo en localStorage (TTL 30 min, solo la última provincia).
- Los precios llegan con coma decimal y coordenadas WGS84; se parsean en `src/lib/gasolineras.js`.

## Funcionalidades

- Combustible: G95, G98, Gasóleo A, Gasóleo Premium, GLP.
- **"Cerca de mí"**: geolocalización del navegador (solo se usa en cliente); se elige la
  provincia más cercana por coordenadas de capital (incrustadas) y se ordena por distancia
  (haversine). Requiere HTTPS o localhost (contexto seguro); con permiso denegado se avisa
  y queda la selección manual.
- Orden por precio o cercanía, filtro por municipio/rótulo, "mostrar más" (paginado de 25),
  color del precio (verde barata → rojo cara, relativo a la zona), enlace "Cómo llegar"
  (Google Maps) y botón de actualizar.

## Mapa

Vista alternativa a la lista dentro del buscador, sobre los mismos datos ya filtrados.
Marcadores coloreados por precio con la escala de la lista y el precio escrito dentro del
propio marcador: en un mapa de gasolineras el precio es el dato, y obligar a pinchar cada
chincheta lo haria inutil. **Sin logos de marca a proposito**: son marcas registradas y
alojar decenas de logotipos de petroleras en una web con publicidad es un riesgo evitable.

- **Leaflet 1.9.4** por npm, detras de un `import()` dinamico en `src/lib/mapa.js`: no se
  descarga mientras se use la lista. La hoja de estilos se pide con `?url` y se engancha a
  mano al abrir el mapa; con un import de CSS normal, Vite la mete en el `<link>` de la
  pagina y esos 16 KB bloquearian el render en todas las visitas.
- **Teselas de CARTO** (`dark_all` / `light_all`, segun el tema de la web) sobre cartografia
  de OpenStreetMap, con la atribucion visible que exigen sus terminos. Hoy responden sin
  clave; la clave gratuita de carto.com/basemaps/apikey da cobertura de uso razonable si el
  trafico crece.
- **El servidor de teselas de la OSMF queda descartado a proposito**: su politica dice que no
  hay SLA y que pueden cortar el acceso sin aviso. No es una base para una funcion de
  producto. Stadia Maps tampoco sirve: su plan gratuito es solo para uso no comercial.
- Tope de `MAX_MARCADORES` (120) por rendimiento en movil; se avisa debajo del mapa.
## SEO / Monetización

- H1 + intro + FAQ (actualización cada 30 min, low cost vs marca, cuándo repostar...) +
  JSON-LD (`WebApplication` + `FAQPage`) + sitemap.
- Lateral fijo 300x600 (sticky, escritorio) + banner inferior (placeholders AdSense).
- CTA afiliado: comparador de **seguros de coche** (sustituir `href="#"`).

## Contenido y umbral de páginas (agosto 2026)

AdSense rechazó a esta web y a mivatio.es por "contenido de poco valor". El primer intento
(12-08-2026) fue añadir ocho guías y poner `noindex` a los municipios pequeños. **No funcionó, y
se volvió a rechazar el 24-08-2026.** El motivo del fallo es importante para no repetirlo:

> `noindex` es una instrucción para el índice de Google Search. **AdSense no consulta ese
> índice**: su revisión entra por la portada y sigue enlaces internos. Las 504 páginas con
> `noindex` se seguían generando, se seguían enlazando desde su provincia y seguían llevando el
> script de anuncios. El revisor veía 1.189 páginas con 11 de contenido escrito, no 683.

Segunda pasada (24-08-2026), con la web reducida de 1.189 a 345 páginas:

1. **`MIN_ESTACIONES_MUNICIPIO = 10`** en `src/lib/datos-build.js`. Ya no existe
   `MIN_ESTACIONES_INDEXABLE`: los municipios por debajo del umbral **no se generan**, en vez de
   generarse ocultos. El umbral no es un truco para pasar la revisión, es la línea por debajo de
   la cual la página no puede aportar nada: con tres estaciones el ranking son tres filas y la
   media local es ruido.
2. **Los municipios pequeños no pierden su dato.** `todosLosMunicipios` alimenta una tabla en la
   página de provincia con las 100+ localidades y su precio más bajo de 95 y de diésel. La
   información sigue publicada y la página de provincia gana contenido propio.
3. **Valor añadido real en los municipios que quedan**: la horquilla de precio dentro del
   municipio traducida a euros por depósito, y los municipios cercanos de verdad (haversine sobre
   el centroide de cada uno, radio de 35 km) con su precio más bajo. Las dos cosas son distintas
   en cada página porque dependen de los datos de ese municipio, no de la plantilla.
4. **Treinta guías** en `/guias/` (eran ocho), en seis temas. Además de las de combustible se
   añadieron dos pilares que caben en la marca (es "Ahorro al Volante", no "ahorro en gasolina"):
   **Lo que cuesta el coche** (seguro, valor venal, reparar o vender, cambiar de coche, ITV) y
   **Neumáticos y mantenimiento** (flanco, desgaste, presión, aceite, batería). Son los dos
   pilares evergreen: se escriben una vez y no caducan. Quedan pendientes, para después de la
   aprobación, normas y multas (V16, ZBE, radares), que exigen contrastar normativa y hay que
   mantener al día, y la comparativa eléctrico frente a gasolina, que es la única de eléctricos
   que se apoya en datos propios (precios de carburante de aquí y de la luz en mivatio.es).
   Índice en `src/lib/guias.js`,
   layout en `src/layouts/GuiaLayout.astro`. La portada enlaza una guía de cada tema, para que
   se vea de un vistazo que la web cubre todo el coste del coche y no solo el litro: antes no
   enlazaba ni una sola guía individual y el revisor aterrizaba en un buscador.

Las dos páginas de contenido antiguas (`/diesel-o-gasolina/` y `/calcular-gasto-gasolina/`) se
listan en el índice de guías pero NO cambian de ruta.

**Aviso para el futuro**: la cola larga por municipio y la política de contenido de AdSense están
en tensión permanente. Volver a bajar el umbral a 3 después de la aprobación expone la cuenta a
una acción manual más adelante, con más que perder. Si el sitio crece, que crezca por guías.

## Comandos

```bash
npm install
npm run dev      # http://localhost:4321
npm run build
```

## Antes de publicar

1. `site` en `astro.config.mjs` + sitemap en `public/robots.txt`.
2. IDs de AdSense y GA4 en `src/layouts/Layout.astro`.
3. Enlace de afiliado real (seguros de coche / tarjetas descuento carburante).
4. `public/og-image.png` (1200x630).
