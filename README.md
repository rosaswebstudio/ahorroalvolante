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

## SEO / Monetización

- H1 + intro + FAQ (actualización cada 30 min, low cost vs marca, cuándo repostar...) +
  JSON-LD (`WebApplication` + `FAQPage`) + sitemap.
- Lateral fijo 300x600 (sticky, escritorio) + banner inferior (placeholders AdSense).
- CTA afiliado: comparador de **seguros de coche** (sustituir `href="#"`).

## Guías y umbral de indexación (agosto 2026)

AdSense rechazó a mivatio.es (la web hermana) por "contenido de poco valor". Esta web tenía el
mismo perfil y peor: de 1.190 páginas, 1.175 eran plantilla automática. Dos cambios:

1. **Sección `/guias/`**: ocho guías escritas, de 1.000 a 1.400 palabras. Índice en
   `src/lib/guias.js`, layout de artículo en `src/layouts/GuiaLayout.astro`. Las dos páginas de
   contenido que ya existían (`/diesel-o-gasolina/` y `/calcular-gasto-gasolina/`) se listan en el
   índice pero NO se mueven de ruta.
2. **`MIN_ESTACIONES_INDEXABLE`** en `src/lib/datos-build.js`: los municipios con menos de 5
   estaciones llevan `noindex` y salen del sitemap (508 páginas). Se siguen generando y enlazando
   desde su provincia. **Es temporal**: igualarlo a `MIN_ESTACIONES_MUNICIPIO` cuando el sitio
   esté aprobado.

El filtro del sitemap (`src/lib/sitemap.js`) no repite el criterio: lee el `noindex` del HTML ya
generado, así que la regla vive en un único sitio.

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
