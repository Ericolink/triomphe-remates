# Auditoría SEO técnica y de contenido — rematesbancarios.net

Fecha: 2026-09-10
Alcance: Fase 1 (auditoría) + Fase 2 (priorización). La Fase 3 (implementación) se documentará en un anexo a este mismo archivo una vez acordado el alcance con el equipo.

Metodología: lectura del código fuente (client/server), pruebas en vivo contra `https://rematesbancarios.net` (curl con distintos User-Agent, revisión de `robots.txt`/`sitemap.xml` en producción, códigos de estado HTTP reales), y búsquedas en Google para las queries objetivo (sin scraping de SERPs de terceros, solo lectura de resultados públicos). No se tuvo acceso a Google Search Console — todo lo referente a GSC son instrucciones de qué revisar manualmente, no datos inventados.

---

## 1. Indexabilidad

**robots.txt** (`client/public/robots.txt`, servido tal cual en prod):
```
User-agent: *
Disallow: /admin/
Disallow: /api/

Sitemap: https://rematesbancarios.net/sitemap.xml
```
Correcto y mínimo. No bloquea nada público. `/admin/` y `/api/` son los únicos disallow y tiene sentido (panel privado y API no son contenido).

**sitemap.xml** — generado dinámicamente en `server/src/routes/sitemap.js` (no es un archivo estático), consulta la tabla `Property` en vivo. Verificado en producción: responde 200, XML válido, incluye `/`, `/propiedades`, `/contacto` y una URL por cada propiedad `status: 'disponible'`. Correcto: respeta el flag `publicPropertiesEnabled` (si el listado público está apagado, no lista propiedades individuales — evita indexar URLs que hoy devolverían contenido oculto).

**Gap encontrado:** el sitemap NO incluye `/nosotros`, `/proceso-adquisicion`, `/preguntas-frecuentes`, `/trabaja-con-nosotros`, `/aviso-de-privacidad`. Son páginas públicas, indexables, con contenido real (ver punto 5) que hoy dependen solo de enlaces internos para ser descubiertas. Para un sitio de autoridad/antigüedad baja, no estar en el sitemap es una señal de descubrimiento más débil.

**Meta robots / noindex / nofollow:** no se encontró ningún `noindex` ni `nofollow` en el código de páginas públicas. Correcto.

**Códigos HTTP — hallazgo crítico (soft 404s):** se probó en producción:
- `GET /pagina-inexistente-test-123` → **200** (debería ser 404)
- `GET /propiedades/no-existe-slug-xyz` → **200** (debería ser 404)
- `GET /og-image.jpg` (archivo que no existe, ver punto 11) → **200**, `Content-Type: text/html`, cuerpo = el shell de la SPA

Causa: `server/app.js` sirve `express.static(clientBuildPath)` y luego un catch-all `app.get('*path', (req,res)=>res.sendFile(index.html))` sin verificar si la ruta corresponde a algo real. **Toda URL inexistente, todo slug de propiedad borrado/typo, y todo asset faltante responde 200.** Esto es exactamente lo que Google Search Console clasifica como "Soft 404" bajo Cobertura/Indexación, y es una señal negativa de calidad técnica del sitio — no es solo un detalle cosmético.

**URLs duplicadas / parámetros:** `/propiedades?city=juarez&type=casa...` existen como estado de la UI, pero (ver punto 6/8) hoy no son generadas como enlaces `<a href>` reales en ningún lugar del sitio ni están en el sitemap, y su `<canonical>` siempre apunta a `/propiedades` sin parámetros (correcto, evita duplicados). No hay riesgo de contenido duplicado indexado, pero tampoco hay ganancia: esas combinaciones no son rankeables hoy.

**Conclusión de indexabilidad:** Google puede descubrir y rastrear el dominio (ya lo tiene indexado, como confirma la búsqueda por "Triomphe"). El problema no es que esté bloqueado — es que (a) las páginas más importantes no entregan señal en el HTML crudo (ver punto 2) y (b) hay soft-404s reales que Search Console probablemente ya está reportando.

---

## 2. Arquitectura actual — ¿HTML real o depende de JavaScript?

Confirmado con pruebas directas (`curl` con distintos User-Agent contra producción, sin ejecutar JS):

```
GET / (Chrome UA)          → <title>Triomphe Remates Bancarios</title>, <body><div id="root"></div></body>
GET / (Googlebot UA)       → idéntico, sin meta description, sin H1, sin contenido
GET /propiedades           → idéntico
GET /propiedades/<slug>    → idéntico, incluso con UA de Googlebot
```

Es una SPA 100% client-side rendered (Vite + React + react-router). Los `<title>`, `<meta description>`, `<link canonical>` y JSON-LD se inyectan con `react-helmet-async` (`client/src/components/ui/SEO.jsx`) **después** de que React ejecuta en el navegador. No hay SSR ni SSG.

**Esto no significa que Google no pueda indexar el sitio.** Googlebot ejecuta JavaScript en una segunda pasada (Web Rendering Service), y de hecho ya tiene el dominio indexado. Pero renderizar JS es más lento, consume más presupuesto de rastreo, y para un sitio nuevo/de baja autoridad compitiendo por una keyword muy disputada ("remates bancarios"), depender 100% de la segunda pasada para las dos páginas más importantes (home y listado) es un riesgo real y evitable.

**Ya existe una solución parcial en el repo, pero no está desplegada en producción.** El commit `f7f5585` (8 sept 2026, "se modifico la metadata de facebook") añadió `server/src/utils/propertyOgMeta.js` + un middleware en `app.js`: cuando detecta un User-Agent de bot conocido (`server/src/utils/botDetection.js`, incluye `googlebot`, `bingbot`, `facebookexternalhit`, etc.) pidiendo `/propiedades/:slug`, el servidor lee el `index.html` compilado, le inyecta `<title>`, `<meta description>`, Open Graph y Twitter Card específicos de esa propiedad, y lo devuelve — sin tocar el `<body>` (sigue siendo el shell vacío; solo se resuelve `<head>`).

**Verificado que NO está en producción:** pedir una propiedad real con User-Agent de Googlebot devuelve el HTML genérico sin metadata inyectada. El `Last-Modified` del `index.html` en el servidor (4 sept) es anterior al commit que agrega esta función (8 sept) — es decir, el build actual en SmarterASP.NET es de antes de este cambio. **No es un bug de código: es un despliegue pendiente.** Los deploys son manuales por FTP (ver CLAUDE.md), así que el commit existe pero nadie lo ha subido todavía.

Aun una vez desplegada, esta técnica (a veces llamada "dynamic rendering", que Google documentó como aceptable — no es cloaking porque el contenido mostrado a bots es el mismo que un usuario real termina viendo tras ejecutar JS) **solo cubre `/propiedades/:slug`**. La home y `/propiedades` (listado) — las dos páginas que deben competir por "remates bancarios" a secas — no tienen ningún tratamiento equivalente y siguen dependiendo 100% del renderizado diferido de Googlebot.

**Arquitectura de hosting:** SmarterASP.NET vía IIS + httpPlatformHandler ejecutando Node/Express (`web.config` en la raíz). No hay reverse proxy/CDN propio detectado (headers de respuesta no muestran Cloudflare ni similar) — las cabeceras `x-powered-by: ASP.NET` vienen de IIS, no de una capa de caché intermedia. Esto es relevante porque significa que cualquier solución de pre-renderizado tendría que vivir en el propio Express, no se puede resolver con una regla de CDN.

---

## 3. Páginas públicas — clasificación

| Ruta | Prioridad | Motivo |
|---|---|---|
| `/` (Home) | **Alta** | Debe competir por "remates bancarios" a secas |
| `/propiedades` | **Alta** | Debe competir por "casas en remate bancario", "propiedades en remate bancario", "remates bancarios en venta" |
| `/propiedades/:slug` | **Alta** | Long-tail por dirección/colonia/tipo+ciudad; volumen agregado relevante |
| `/preguntas-frecuentes` | Media-Alta | Contenido genuinamente útil para intención informacional ("¿qué es un remate bancario?", "¿cómo comprar?") — hoy infrautilizada |
| `/proceso-adquisicion` | Media | Refuerza intención informacional/confianza |
| `/nosotros` | Media | Señal de autoridad/experiencia (E-E-A-T) |
| `/contacto` | Media | Conversión, no ranking |
| `/trabaja-con-nosotros` | Baja | Sin relación con las keywords objetivo |
| `/aviso-de-privacidad` | Baja | Requerido legalmente, sin valor SEO |
| `/favoritos`, `/comparar`, `/buzon`, `/mi-alerta`, `/cancelar-alerta` | Ninguna (funcional) | Estado de usuario / utilidades, no deberían competir por keywords ni consumir presupuesto de rastreo relevante |
| **No existe hoy:** landing por ciudad (Cd. Juárez / Chihuahua) | — | Ver punto 6 |

---

## 4. Title y meta description — estado real

Todas las páginas públicas usan el componente `<SEO>` (`client/src/components/ui/SEO.jsx`), que sí genera `<title>`, `<meta description>` y `<link canonical>` **dinámicos y distintos por página** — no hay el problema de "todas las páginas dicen lo mismo" que se temía. Ejemplos reales encontrados en el código (no inventados):

- Home: `seoTitle: "Comprar Casas en Remate Bancario en México"`
- Listado: `listingTitle: "Propiedades en Remate"` (cambia según la línea de negocio activa en el TabBar)
- Ficha de propiedad: se construye dinámicamente, ej. `"{título} - Casa en remate bancario en Cd. Juárez"`
- FAQ: `"Preguntas Frecuentes"` con descripción específica
- Nosotros / Proceso: títulos y descripciones propios, no genéricos

**El problema no es la ausencia de títulos dinámicos — es que ese mecanismo (`react-helmet-async`) corre 100% en el cliente** (ver punto 2), así que en el HTML que Googlebot obtiene en su primera pasada, **todas las páginas devuelven el mismo `<title>Triomphe Remates Bancarios</title>` estático de `client/index.html` y ningún `<meta description>`.** El title/description "bien hechos" existen, pero no llegan de forma inmediata/confiable al índice.

**Meta description del `index.html` estático:** no existe ninguna. El `<head>` estático solo tiene `charset`, `viewport` y `<title>` genérico — ni una meta description de respaldo.

---

## 5. Contenido visible — ¿hay sustancia real?

Este es el hallazgo más alentador de la auditoría: **el contenido de calidad ya existe**, contrario a lo que sugeriría el posicionamiento actual.

- **`/preguntas-frecuentes`**: 13 preguntas reales agrupadas en 4 categorías (Sobre los remates bancarios, Proceso de compra, Pagos y costos, Riesgos y garantías). Respuestas específicas del negocio (ej. explica qué es "cesión de derechos", qué pasa si una propiedad está invadida, por qué un precio aparece "PENDIENTE"). No es contenido genérico de relleno.
- **`/proceso-adquisicion`**: describe el proceso paso a paso (9 pasos, desde primer contacto hasta escrituración).
- **`/nosotros`**: menciona 28 años de experiencia, oficinas reales en Cd. Juárez y Chihuahua con dirección/teléfono verificables (`utils/constants.js` → `OFFICES`).
- **Ficha de propiedad**: descripción, ubicación (colonia/ciudad/estado), características (m² construcción/terreno, recámaras, baños), estatus del proceso legal, countdown de fecha de remate cuando aplica.

**El problema no es "no hay contenido" — es que ese contenido no está en la página que más lo necesita.** La Home tiene: hero, banda de stats, propiedad destacada, 6 propiedades destacadas, 3 tarjetas "por qué elegirnos" (genéricas: "Precios de Remate", "Proceso Seguro", "Amplio Inventario"), testimonios, CTA. **No hay ni un párrafo que explique qué es un remate bancario, cómo funciona, o enlace a las respuestas que sí existen en FAQ/Proceso.** Para la keyword "remates bancarios" (intención mixta informacional+transaccional), la página que debe ganar esa búsqueda hoy no demuestra profundidad temática por sí misma — depende de que el usuario navegue a otra página para encontrarla.

No se encontró keyword stuffing en ningún lado revisado — el copy existente es natural.

---

## 6. Arquitectura temática

**Hallazgo estructural (el más importante para las keywords de ciudad):**

`/propiedades` maneja el filtro de ciudad/tipo/categoría como **estado de React, no como rutas**. Revisando `PropertiesPage.jsx`:

- Los filtros solo se inicializan desde `searchParams` si la URL ya trae `?city=...` al cargar.
- Al cambiar un filtro desde la propia UI (`setFilter`), el código **remueve** ese parámetro de la URL en vez de añadirlo (`next.delete(key)`) — es decir, la página nunca genera por sí misma una URL del tipo `/propiedades?city=juarez` que se pueda compartir, enlazar o indexar.
- El único lugar que sí construye esa URL es el buscador de la Home (`HomePage.jsx`), pero lo hace con `navigate()` de react-router dentro de un `onSubmit` — **no es un `<a href>` real**, es una navegación de JS disparada por interacción de formulario. Googlebot no rellena formularios, así que nunca la descubre por rastreo.
- El `<title>`/`<meta description>` del listado tampoco varía según el filtro activo (siempre usa `content.listingTitle` de la línea de negocio, ignorando ciudad/tipo).

**Conclusión: hoy no existe, ni de forma oculta, ninguna URL real, enlazada y optimizada para "remates bancarios en Ciudad Juárez" o "remates bancarios en Chihuahua".** No es que la página exista y esté mal optimizada — estructuralmente no puede rankear para esas búsquedas porque no hay una URL canónica, descubrible y con metadata propia que las represente.

Esto se confirma comparando con la competencia real (ver punto 18): Lamudi indexa `https://www.lamudi.com.mx/chihuahua/ciudad-juarez-2/foreclosures/casa/for-sale/` — una URL de categoría por ciudad, real y rankeable. Triomphe no tiene el equivalente.

El negocio sí tiene la base real para justificar esto sin caer en páginas artificiales: dos oficinas físicas reales y verificables (Cd. Juárez y Chihuahua, con dirección/teléfono propios en `OFFICES`), inventario real filtrable por ciudad vía la API existente (`GET /api/properties?city=juarez` ya funciona), y — según el contexto del negocio — presencia comercial fuerte específicamente en Cd. Juárez.

---

## 7. Internal linking

- **Navbar** (`Navbar.jsx`): Inicio, Propiedades, Sobre Nosotros, Proceso de Adquisición, Contacto, Trabaja con nosotros. Todos son `<Link>` de react-router (se renderizan como `<a href>` real en el DOM — si Google llega a ejecutar el JS, son rastreables).
- **Footer** (`Footer.jsx`): Inicio, Propiedades, Sobre Nosotros, Contacto, Preguntas Frecuentes, Buzón de opiniones + Aviso de Privacidad. Incluye NAP (nombre/dirección/teléfono) real por oficina, pero como texto plano — no enlaza a ninguna página de ciudad (porque no existe).
- **Páginas huérfanas:** ninguna página pública importante es huérfana — todo cuelga de Navbar o Footer.
- **Gap:** `/preguntas-frecuentes` no está en el Navbar (solo en Footer) pese a ser contenido de alto valor para la intención de búsqueda objetivo — queda un clic más lejos de lo ideal para una página con ese peso temático.
- **Anchor texts:** en general descriptivos (`Preguntas Frecuentes`, `Sobre Nosotros`), no genéricos tipo "Ver más" en la navegación principal. Dentro de tarjetas de propiedad sí se usa `Ver todas las propiedades` en botones — aceptable en contexto porque no es el enlace principal de la página.
- **Home → Propiedades:** el enlace principal ("Ver todas las propiedades") es un botón `onClick` con `navigate()`, no un `<Link>`. Funciona para usuarios pero es una oportunidad perdida de anchor text más descriptivo si se resolviera desde el listado real de propiedades destacadas (que sí usan `<Link>` via `PropertyCard`).

---

## 8. URLs

Estructura actual: `/`, `/propiedades`, `/propiedades/:slug` (slug real, legible, ej. `remate-bancario-en-los-arcos-jrch-0288`), `/contacto`, `/nosotros`, `/proceso-adquisicion`, `/trabaja-con-nosotros`, `/preguntas-frecuentes`, `/aviso-de-privacidad`. Son estables, descriptivas y sin parámetros innecesarios. No se recomienda cambiar ninguna URL existente — no hay justificación SEO para hacerlo, y el costo (redirects, quiebre de sitemap/enlaces ya indexados) no se justifica.

---

## 9. Sitemap — detalle

Ver punto 1. Resumen: existe, es válido, se genera dinámicamente desde la base de datos (no se desactualiza manualmente), respeta el estado `publicPropertiesEnabled`. Falta incluir las páginas estáticas de contenido (`/nosotros`, `/proceso-adquisicion`, `/preguntas-frecuentes`, `/trabaja-con-nosotros`).

---

## 10. Structured Data / Schema.org

Implementado en `SEO.jsx`:
- **Organization** (`@type: RealEstateAgent`) — presente en **todas** las páginas vía `<Helmet>`. Datos reales: nombre, teléfono, redes sociales, ciudades de cobertura.
- **RealEstateListing** + **BreadcrumbList** — solo en ficha de propiedad (`property` prop presente). Datos tomados directamente de la propiedad real (precio, ubicación, m², recámaras/baños) — no hay datos inventados.

**No implementado, con justificación real para hacerlo (datos ya existen, no habría que fabricar nada):**
- **WebSite** con `SearchAction` — el sitio ya tiene una barra de búsqueda funcional (`/propiedades?search=`), calificaría legítimamente.
- **FAQPage** — la página `/preguntas-frecuentes` ya tiene 13 preguntas/respuestas reales; hoy no llevan marcado, es la oportunidad más clara de esta sección porque no requiere inventar nada.
- **LocalBusiness** por oficina — hay datos reales (`OFFICES`: dirección, teléfono, ciudad) que hoy solo se muestran en el Footer sin marcado estructurado.

Nota importante: como recuerda el propio esquema de `SEO.jsx` (comentarios en el código), todo el JSON-LD se inyecta vía `react-helmet-async`, es decir **sufre el mismo problema del punto 2**: no llega en el HTML crudo salvo que Googlebot ejecute el JS.

---

## 11. Open Graph y redes sociales

Bien implementado en `SEO.jsx` (cliente) y `propertyOgMeta.js` (servidor, para bots, solo fichas de propiedad, no desplegado — ver punto 2): `og:title`, `og:description`, `og:image`, `og:url`, `og:type`, `og:locale`, Twitter Card `summary_large_image`.

**Bug real encontrado y verificado en producción:** `DEFAULT_IMAGE` en `SEO.jsx` apunta a `${SITE_URL}/og-image.jpg`, un archivo que **no existe** en `client/public/`. Se comprobó en vivo: `GET /og-image.jpg` responde `200` con `Content-Type: text/html` (el catch-all de la SPA lo intercepta — mismo mecanismo del soft-404 del punto 1). Esto afecta a **toda página pública que no sea una ficha de propiedad** (Home, Propiedades, FAQ, Nosotros, Proceso, Contacto, Trabaja con nosotros): cuando alguien comparte esas páginas en WhatsApp/Facebook/LinkedIn, la tarjeta de previsualización no tiene imagen (o Facebook cachea un error).

---

## 12. Imágenes

- `loading="lazy"` aplicado consistentemente en imágenes secundarias (miniaturas, testimonios). La imagen principal de la galería de propiedad usa `fetchPriority="high"` (correcto para LCP).
- `alt` presente en todas las imágenes revisadas: `PropertyCard` usa `alt={property.title}` (real, no genérico, aunque podría ser marginalmente más descriptivo — ver Fase 2). Imágenes de testimonios usan `alt="Antes - {nombre}"` / `"Después - {nombre}"`. Logo usa `alt="Triomphe Bienes Raíces"`. No se encontró keyword stuffing en ningún `alt`.
- Todas las imágenes de propiedades pasan por Cloudinary con transformaciones `f_auto,q_auto` (formato/calidad automáticos) vía `buildImageUrl()` — ya optimizado, no requiere cambios.

---

## 13. Performance / Core Web Vitals

No se ejecutó Lighthouse/PageSpeed Insights contra el sitio en vivo en esta auditoría (fuera del alcance de las herramientas disponibles en esta sesión) — cualquier cifra de LCP/INP/CLS debe confirmarse con PageSpeed Insights real antes de actuar sobre ella. Lo que sí se verificó en el código:

- Code splitting por ruta con `React.lazy()` (`App.jsx`) — reduce el bundle inicial.
- Vite separa vendor chunks (`react-vendor`, `animations`, `icons`, `data` — visibles en los `modulepreload` del HTML real).
- Framer Motion se usa en casi todas las secciones de Home con animaciones `whileInView`/`viewport once` — es JS adicional pero está usado con moderación (no re-anima en cada scroll).
- Imágenes servidas vía Cloudinary con transformación automática de formato/calidad — correcto.

**Riesgo real identificable sin herramienta externa:** al ser CSR puro, el LCP de Home/Propiedades depende de: descargar el bundle JS → ejecutar React → hacer fetch a la API → renderizar. Esa cadena es inherentemente más lenta que HTML servido directo, y es la misma raíz del problema del punto 2 (no es solo un tema de indexación, también de experiencia real para el usuario que llega desde Google).

---

## 14. Mobile

Uso consistente de clases responsive de Tailwind (`sm:`, `md:`, `lg:`, `xl:`) en todas las páginas revisadas. Menú mobile propio en `Navbar.jsx` con hamburguesa accesible (`aria-label`, `aria-expanded`). No se encontró contenido oculto exclusivamente en desktop que sea relevante para SEO (ningún bloque de texto con `hidden md:block` que contuviera contenido único). Viewport meta correcto en `index.html`.

---

## 15. Contenido duplicado

No se encontró contenido duplicado indexado: el canonical de `/propiedades` es fijo y no varía con filtros (correcto, evita que Google indexe N combinaciones de `?city=&type=&category=` como páginas separadas con el mismo contenido). Como se explicó en el punto 6, el efecto colateral es que esas combinaciones tampoco pueden rankear — pero eso es preferible a duplicado real. No se recomienda cambiar este comportamiento salvo para las páginas de ciudad reales que se decidan crear (punto 6), que deben ser rutas propias con contenido propio, no versiones parametrizadas de `/propiedades`.

---

## 16. Canonical

Correcto en todas las páginas revisadas vía `SEO.jsx`: cada página se autocanonicaliza (`url` prop → `${SITE_URL}${url}`). No se encontró ningún caso de canonicalización accidental hacia `/` u otra página genérica. (Recordatorio: esto solo llega al HTML si Googlebot ejecuta JS — ver punto 2).

---

## 17. Google Search Console

No se tuvo acceso a Search Console en esta sesión — no se inventó ningún dato de impresiones/clics/posición. Lo que el administrador de Search Console debería revisar manualmente, en este orden:

1. **Cobertura/Indexación** → sección "No indexadas": buscar específicamente cuántas URLs aparecen como **"Soft 404"** (dado el hallazgo del punto 1, es probable que haya varias) y cuántas como "Rastreada, actualmente no indexada" (URLs que Google visitó pero decidió no indexar — típico de sitios CSR sin prerender).
2. **Inspección de URLs** → probar `/` y `/propiedades` con "Ver página rastreada" y comparar el HTML mostrado ahí contra el HTML real: si coincide con el shell vacío, confirma que Google no está esperando a que termine de cargar el contenido dinámico.
3. **Sitemaps** → confirmar que `sitemap.xml` está enviado y ver cuántas URLs están "Descubiertas" vs "Indexadas".
4. **Rendimiento** → filtrar por las queries objetivo del brief (remates bancarios, remates bancarios Ciudad Juárez, etc.) para ver impresiones/CTR/posición actuales — esto da la línea base contra la que medir el impacto de los cambios.
5. **Enlaces** → sección "Páginas con más enlaces externos" para entender si ya existen backlinks aprovechables.

---

## 18. Competencia (basado en resultados reales de búsqueda, sin scraping)

Para "remates bancarios" aparecen: Inmuebles24 (blog educativo), BBVA México (contenido institucional/educativo sobre remates hipotecarios), propiedades.com, un despacho de abogados, un portal especializado (remateshipotecarios.mx), rematadas.com, y contenido educativo del Colegio de Valuadores de Chihuahua.

Para "remates bancarios Ciudad Juárez" aparecen específicamente: **Lamudi** con una URL de categoría dedicada por ciudad (`/chihuahua/ciudad-juarez-2/foreclosures/casa/for-sale/`), **iCasas** con una URL igualmente estructurada por ciudad+colonia+filtro, **Trovit/Mitula/Nuroa** (agregadores que también indexan por ciudad+categoría), y un competidor local pequeño (sitio hecho en Uenity, plantilla genérica) — es decir, **el nivel de autoridad para ganar específicamente la variante "Ciudad Juárez" es mucho más bajo que para el término genérico**: no son solo los grandes portales, hay negocios locales pequeños compitiendo ahí.

**Diferenciación por tipo de factor:**
- **Técnico:** los grandes agregadores (Lamudi, iCasas, Inmuebles24) usan arquitecturas con URLs de categoría reales por ciudad/tipo, indexables desde el primer HTML (no dependen de un SPA client-side). Esto es exactamente la brecha del punto 6.
- **Contenido:** BBVA e Inmuebles24 rankean con contenido puramente educativo (qué es, cómo funciona, riesgos) — good news: Triomphe ya tiene ese contenido (FAQ/Proceso), solo falta que sea descubrible (puntos 1-2) y esté enlazado desde donde más pesa (Home).
- **Autoridad/antigüedad:** BBVA, Inmuebles24, CONDUSEF y Gobierno de México tienen décadas de dominio, millones de backlinks y autoridad de marca — eso no se resuelve con código ni en semanas. Realistamente, competir de tú a tú por "remates bancarios" a secas contra BBVA/CONDUSEF/Inmuebles24 en el corto plazo no es razonable; la oportunidad real y alcanzable es la cola larga geográfica ("remates bancarios Ciudad Juárez", "remates bancarios Chihuahua", "casas en remate bancario Ciudad Juárez"), donde la competencia es de autoridad comparable o menor.
- **Enlaces:** no se auditaron backlinks reales de Triomphe (no hay acceso a Ahrefs/Search Console Enlaces en esta sesión) — recomendado revisar en Search Console (punto 17).

---

# Fase 2 — Priorización

| # | Problema | Impacto SEO | Esfuerzo | Prioridad |
|---|---|---|---|---|
| 1 | Soft 404s: cualquier URL/asset inexistente responde 200 con el shell de la SPA | Alto — Google lo marca como señal de calidad negativa, ya probablemente reportado en GSC | Bajo | **P0** |
| 2 | `og-image.jpg` no existe → fallback OG roto en toda página no-propiedad | Medio (compartir en redes, no ranking directo) | Bajo | **P0** |
| 3 | Sitemap no incluye páginas de contenido (`/nosotros`, `/proceso-adquisicion`, `/preguntas-frecuentes`, `/trabaja-con-nosotros`) | Medio — descubrimiento más lento de contenido de valor | Bajo | **P0** |
| 4 | Feature de metadata dinámica para bots en fichas de propiedad (`propertyOgMeta.js`) existe en el repo pero no está desplegada en producción | Alto (una vez desplegada) | Bajo — es un deploy FTP, no código nuevo | **P0 operativo** |
| 5 | Home y `/propiedades` no entregan `<title>`/`<meta description>`/contenido en el HTML crudo (dependen 100% de ejecución JS de Google) | Alto — son las páginas que deben ganar la keyword principal | Medio-Alto (requiere una solución de pre-renderizado en servidor, no solo meta tags) | **P1** |
| 6 | No existe URL real, enlazada e indexable para "remates bancarios en Ciudad Juárez" / "Chihuahua" (filtros son solo estado de cliente) | Alto — es la brecha estructural #1 frente a la competencia directa (Lamudi/iCasas ya la tienen) | Medio (nueva página con contenido real + ruta + enlaces internos) | **P1** |
| 7 | FAQ con contenido real pero sin marcado `FAQPage` (JSON-LD) | Medio (rich snippets, no ranking directo) | Bajo | **P1** |
| 8 | Home no enlaza ni resume el contenido educativo que ya existe (FAQ/Proceso) | Medio-Alto — debilita la profundidad temática de la página más importante | Bajo-Medio | **P1** |
| 9 | Falta `WebSite` + `SearchAction` y `LocalBusiness` por oficina en structured data | Bajo-Medio | Bajo | **P2** |
| 10 | `/preguntas-frecuentes` no está en el Navbar (solo Footer) | Bajo-Medio | Bajo | **P2** |
| 11 | Enlace "Ver todas las propiedades" en Home es `onClick`/`navigate()` en vez de `<Link>` | Bajo | Bajo | **P2** |
| 12 | `alt` de imágenes de propiedad podría ser marginalmente más descriptivo (`property.title` solo, sin tipo/ciudad) | Bajo | Bajo | **P2** |
| 13 | Validar Core Web Vitals reales con PageSpeed Insights (no medido en esta sesión) | Desconocido hasta medir | Bajo (medir) | **P2 (medición, no cambio)** |

**No se propone tocar:** URLs existentes, modelos de datos, rutas del backend, ni el mecanismo de canonicalización de `/propiedades` (evita duplicados correctamente). Ningún cambio de esta lista requiere romper la arquitectura actual.

**Decisiones de alcance confirmadas con el equipo antes de implementar:**
1. Extender el patrón de renderizado dinámico ya existente (detección de bots por User-Agent) a Home y `/propiedades`, en vez de posponerlo o migrar a SSR completo — **aprobado**.
2. Crear landing pages reales por ciudad (Cd. Juárez / Chihuahua) — **pospuesto**. Queda documentado como recomendación P1 (#6 en la tabla) para una sesión futura con más contexto/copy de negocio.

---

# Fase 3 — Implementación

Todo lo implementado corresponde a los ítems marcados **P0** más el **P1 #5** (única decisión de alcance aprobada arriba) y dos limpiezas P1/P2 de bajo riesgo y sin ambigüedad (schema FAQ, anchor de Home). No se tocó ninguna URL, modelo de datos, ni el mecanismo de canonicalización de `/propiedades`.

## Cambios implementados

### `server/app.js`
- **Cambio:** el catch-all final (`app.get('*path', ...)`) ya no responde 200 para cualquier URL. Ahora: una ruta con extensión de archivo que `express.static` no encontró responde 404 real; una ruta pública conocida (lista `KNOWN_PUBLIC_PATHS`, tomada de las rutas reales de `App.jsx`) o cualquier `/admin/*` sigue respondiendo 200 con el shell de la SPA; cualquier otra URL responde 404 (sirviendo igual el shell, para que el router de React pueda mostrar una página "no encontrada" en vez de dejar la pantalla en blanco).
- **Motivo:** hallazgo verificado en producción (Fase 1, punto 1): `/pagina-inexistente-test-123`, `/propiedades/slug-que-no-existe` y `/og-image.jpg` respondían **200** — un "soft 404" textbook que Search Console reporta como error de indexación.
- **Impacto esperado:** Search Console debería dejar de acumular URLs nuevas en "Soft 404"; mejora la señal de calidad técnica general del sitio ante Google.

- **Cambio:** `/propiedades/:slug` ahora responde 404 real (no solo para bots) cuando el slug no existe o la propiedad no es pública (no disponible, o con `publicPropertiesEnabled` desactivado) — antes solo bots recibían metadata distinta, pero el código de estado siempre era 200 para todos.
- **Motivo:** mismo hallazgo del punto 1 — fichas de propiedad borradas/vendidas/typo'd son el caso de soft-404 más frecuente en un catálogo que cambia constantemente.
- **Impacto esperado:** enlaces viejos a propiedades que ya no existen (compartidos, indexados, en redes) dejan de reportarse como contenido válido.

- **Cambio:** Home (`/`) y `/propiedades` ahora reciben, cuando la visita es de un bot conocido (Googlebot incluido — ver `botDetection.js`), el mismo tratamiento que ya existía solo para fichas de propiedad: `<title>`, `<meta description>`, `<link canonical>`, Open Graph/Twitter Card y JSON-LD `RealEstateAgent` inyectados directamente en el HTML servido, sin esperar a que se ejecute React. Usuarios reales (User-Agent normal) siguen recibiendo exactamente el mismo `index.html` genérico de siempre — la SPA no cambia para nadie que la visite de verdad.
- **Motivo:** hallazgo central de la Fase 1 (punto 2): estas son las dos páginas que deben competir por "remates bancarios" y "casas en remate bancario", y hoy no entregan ninguna señal en el HTML crudo. Decisión de alcance confirmada con el equipo: extender el patrón ya construido, no una migración a SSR.
- **Impacto esperado:** cualquier crawler o herramienta que no ejecute JavaScript (y la primera pasada de Googlebot) ve de inmediato el title/description reales de estas dos páginas, en vez de "Triomphe Remates Bancarios" sin descripción.

### `server/src/utils/propertyOgMeta.js`
- **Cambio:** se generalizó `injectMeta` para aceptar `type` (antes fijo en `"article"`, ahora `"website"` para Home/listado) y una lista de objetos `jsonLd` a inyectar. Se agregó `renderStaticPageOgHtml(pageKey, clientBuildPath)` con los textos reales de `BUSINESS_LINE_CONTENT.remate` (mismos que ya usa el `<SEO>` del cliente para Home/`/propiedades`, duplicados aquí por ser CommonJS — mismo patrón que `CITY_LABELS`/`TYPE_LABELS` ya existente en este archivo) y `buildOrganizationSchema` (mismos datos que `ORGANIZATION` en `SEO.jsx`). Se agregó `isPublicPropertySlug(slug)` para que `app.js` pueda decidir 404 vs 200 sin duplicar metadata.
- **Motivo:** soporte de los dos cambios de `app.js` de arriba.
- **Impacto esperado:** ninguno adicional al ya descrito arriba — es la implementación, no un cambio de comportamiento por sí solo.

### `server/src/routes/sitemap.js`
- **Cambio:** se agregaron `/preguntas-frecuentes`, `/proceso-adquisicion`, `/nosotros` y `/trabaja-con-nosotros` a las páginas estáticas del sitemap (antes solo incluía `/`, `/propiedades` y `/contacto`).
- **Motivo:** Fase 1, punto 1/9 — son páginas públicas indexables con contenido real que hoy dependían solo de enlaces internos para ser descubiertas.
- **Impacto esperado:** descubrimiento más rápido de contenido de valor ya existente (FAQ, proceso de adquisición, nosotros) — no se agregó `/aviso-de-privacidad` (sin valor SEO) ni páginas funcionales (favoritos, comparar, buzón), consistente con la clasificación de prioridad de la Fase 1.

### `client/src/components/ui/SEO.jsx`
- **Cambio:** `DEFAULT_IMAGE` ya no apunta a `/og-image.jpg` (archivo inexistente) — ahora usa `/logo.png` (el mismo fallback que ya usa `propertyOgMeta.js` del lado servidor).
- **Motivo:** Fase 1, punto 11 — verificado en producción que `/og-image.jpg` devolvía 200 con el shell de la SPA en vez de una imagen, rompiendo la tarjeta de previsualización social de toda página que no fuera una ficha de propiedad.
- **Impacto esperado:** compartir Home, `/propiedades`, FAQ, Nosotros, Proceso o Contacto en WhatsApp/Facebook/LinkedIn ahora muestra el logo en vez de ninguna imagen o un error.

### `client/src/pages/public/NotFoundPage.jsx` (nuevo) y `client/src/App.jsx`
- **Cambio:** se agregó una página "Página no encontrada" mínima y una ruta comodín (`path="*"`) dentro del layout público.
- **Motivo:** consecuencia directa del fix de soft-404 en `app.js` — antes cualquier URL no reconocida caía en un `<Routes>` sin match y quedaba en blanco dentro del layout; ahora, además del código 404 correcto del servidor, quien navegue ahí (con JS ya cargado) ve una página real con un enlace a `/propiedades`.
- **Impacto esperado:** mejora de experiencia de usuario ante un enlace roto/typo; no afecta indexación (esa señal ya la da el 404 real del servidor).

### `client/src/pages/public/FAQPage.jsx`
- **Cambio:** se agregó JSON-LD `FAQPage`, generado a partir de las mismas 13 preguntas/respuestas de `faqGroups` que ya se muestran en pantalla (no se redactó ni inventó ningún contenido nuevo).
- **Motivo:** Fase 1, punto 10 — la página ya tenía contenido real de FAQ sin ningún marcado estructurado; era la oportunidad de structured data con menor riesgo de toda la auditoría (cero datos nuevos, solo describir lo que ya existe).
- **Impacto esperado:** posibilidad de que Google muestre un rich snippet de preguntas frecuentes para esta página — no garantizado, decisión exclusiva de Google.

### `client/src/pages/public/HomePage.jsx`
- **Cambio:** el botón "Ver todas las propiedades" (versión de escritorio, bajo "Propiedades Destacadas") pasó de un `<button onClick={() => navigate(...)}>` a un `<Link to="/propiedades">` real, con el anchor text ampliado a "Ver todas las propiedades en remate bancario".
- **Motivo:** Fase 1, punto 7 — es el enlace principal de Home hacia el listado, y antes no era un `<a href>` real en el DOM ni tenía un anchor text descriptivo de la keyword.
- **Impacto esperado:** marginal por sí solo, pero es una señal interna adicional, más limpia, hacia la página de listado. (No se tocó el botón equivalente de la versión móvil ni el buscador del hero — ver "Cambios que NO se implementaron".)

### `server/src/__tests__/propertyOgMeta.integration.test.js`
- **Cambio:** se actualizaron las dos pruebas que esperaban 200 para un slug inexistente/no público (comportamiento anterior, ya identificado como el bug a corregir) para que ahora esperen 404, y se agregó una prueba nueva verificando que un navegador real también recibe 404 para un slug inexistente (antes solo se probaba con User-Agent de bot).
- **Motivo:** las pruebas codificaban el comportamiento anterior (soft-404) como "correcto" — había que actualizarlas para que reflejen el comportamiento deseado, no al revés.
- **Resultado:** 7/7 pruebas de este archivo pasan; suite completa del servidor (65 archivos, 616 pruebas) pasa sin regresiones.

## Cambios que NO se implementaron (y por qué)

- **Landing pages por ciudad (Cd. Juárez / Chihuahua):** pospuesto por decisión explícita del equipo (ver "Decisiones de alcance" arriba). Sigue siendo la recomendación de mayor impacto potencial (P1 #6) para las keywords de ciudad específicas del brief.
- **`/preguntas-frecuentes` en el Navbar principal:** se evaluó agregarlo, pero el código del Navbar tiene el espaciado explícitamente calibrado ("el texto y los gaps van compactos para que los 6 links quepan sin salto de línea", comentario existente en `Navbar.jsx`) para exactamente 6 enlaces entre 1280–1799px de ancho. Agregar un séptimo enlace sin poder verificar visualmente en un navegador real el comportamiento en ese rango es un riesgo de romper una UI ya afinada, por un beneficio SEO menor (la página ya está enlazada desde el Footer). Se revirtió ese cambio.
- **`WebSite` + `SearchAction` y `LocalBusiness` por oficina (JSON-LD):** documentado como P2 en la Fase 2. Son datos reales disponibles (`OFFICES`, el buscador de Home) y de bajo riesgo, pero de impacto menor (afectan apariencia enriquecida, no ranking) — se priorizó terminar los P0 y el P1 aprobado antes de sumar más superficie de cambio en una sola sesión.
- **Sección en Home explicando "qué es un remate bancario" con enlace a FAQ/Proceso:** identificado como el gap de contenido más importante de Home (Fase 1, punto 5/8), pero es una decisión de copy/diseño visible para el usuario final, no solo una corrección técnica — se dejó documentado para decidir con el equipo qué tan extensa debe ser esa sección y qué contenido exacto reutilizar, en vez de redactarla unilateralmente.
- **Medición de Core Web Vitals reales (LCP/INP/CLS) con PageSpeed Insights:** no se realizó en esta sesión (fuera del alcance de las herramientas disponibles) — se documenta como acción de medición pendiente, no como cambio de código.
- **Migración a SSR/SSG:** descartada explícitamente por el equipo como fuera de alcance — es un cambio de arquitectura mayor, no una corrección incremental.
- **Despliegue a producción de estos cambios (incluyendo el commit `f7f5585` ya existente que motivó parte de esta auditoría):** los deploys de este proyecto son manuales por FTP (ver CLAUDE.md) — no es algo que deba ejecutarse sin que el equipo lo revise y suba explícitamente. Ver "Search Console / Próximos pasos" más abajo.

## Resultado de validaciones

- **Lint:** `server` (`npm run lint`) → 0 errores (3 warnings preexistentes, no relacionados). `client` (`npx eslint src/`) → 0 errores, 0 warnings.
- **Tests:** servidor completo (`npm test` en `server/`) → **65 archivos, 616 pruebas, todas pasan**. Cliente (`npx vitest run`) → 148/149 pasan; la única falla (`CatalogDownloadForm.test.jsx`, un timeout esperando un blob de PDF) es preexistente y no relacionada con ningún archivo tocado en esta auditoría (confirmado por `git status` antes de tocar nada).
- **Build:** `npm run build` (raíz) completa correctamente, genera `server/client/`, y el gate `check-deploy-safety.js` pasa sin archivos prohibidos.
- **Smoke test manual contra el build compilado, corriendo localmente (`node server/server.js`, no contra producción):**
  - `GET /pagina-inexistente-test-123` → **404** (antes 200)
  - `GET /og-image.jpg` → **404** (antes 200)
  - `GET /propiedades/slug-que-no-existe` → **404** (antes 200)
  - `GET /admin/algo-random` → **200** (sin cambios — el panel admin sigue funcionando para deep links)
  - `GET /` con User-Agent normal → **200**, HTML sin cambios para el usuario real
  - `GET /` con User-Agent de Googlebot → **200**, con `<title>`, `<meta description>`, `<link canonical>`, Open Graph/Twitter y JSON-LD `RealEstateAgent` inyectados
  - `GET /propiedades` con User-Agent de Googlebot → mismo tratamiento, título/descripción del listado
  - `GET /propiedades/<slug real>` con User-Agent de bot → metadata específica de esa propiedad (título, descripción, imagen de portada, JSON-LD `RealEstateListing`+`BreadcrumbList`)
  - `GET /sitemap.xml` → incluye ahora `/preguntas-frecuentes`, `/proceso-adquisicion`, `/nosotros`, `/trabaja-con-nosotros`
- **Nota sobre el smoke test:** se usó la base de datos de desarrollo local (`triomphe_db`), donde el flag `publicPropertiesEnabled` estaba en `false` desde una sesión anterior — se verificó el comportamiento correcto en ambos estados del flag (propiedad inexistente/no pública → 404 con el flag en cualquier valor; propiedad real con el flag en `true` → 200 y metadata correcta) y se restauró el valor del flag a como estaba antes de la prueba.

---

# Próximos pasos

## Código (ya implementado en esta sesión, pendiente de revisión/merge/deploy)
Todo lo listado en "Cambios implementados" arriba. Queda pendiente el **deploy manual por FTP** — recordar que el build (`npm run build` en la raíz) reinstala `server/node_modules` con `--omit=dev`, así que hay que correr `npm install` en `server/` otra vez si se sigue desarrollando localmente después de buildear (esto ya se hizo en esta sesión).

## Contenido (trabajo editorial, no de código)
- Redactar (con el equipo) una sección breve en Home que explique qué es un remate bancario y enlace a FAQ/Proceso — el contenido real ya existe en `/preguntas-frecuentes` y `/proceso-adquisicion`, solo falta decidir qué extracto usar en Home.
- Decidir si/cuándo construir las landing pages de Cd. Juárez y Chihuahua (P1 #6) — es la pieza de mayor impacto potencial pendiente, y requiere contenido/copy real específico de cada ciudad (no solo una plantilla con el nombre cambiado).
- Producir una imagen social dedicada de 1200×630 px (hoy se usa el logo como fallback, que funciona pero no es una imagen pensada para compartir en redes).

## Autoridad (fuera del alcance de código/contenido de este repositorio)
- Backlinks legítimos: directorios inmobiliarios reales, cámaras de comercio de Cd. Juárez/Chihuahua, prensa local, alianzas con notarías/despachos que ya mencionan remates bancarios.
- Antigüedad y autoridad de dominio: no se puede acelerar con código — es la razón principal por la que competir de tú a tú contra BBVA/CONDUSEF/Inmuebles24 en "remates bancarios" a secas no es realista a corto plazo (ver Fase 1, punto 18). La oportunidad real y alcanzable es la cola larga geográfica.
- Perfil de Google Business Profile por oficina (Cd. Juárez, Chihuahua) — refuerza señales locales que ayudan específicamente a las búsquedas con nombre de ciudad, y es independiente de este código.

## Search Console (después del deploy)
1. Enviar/confirmar `sitemap.xml` en Search Console si no está ya enviado.
2. Revisar la sección "Páginas" → "No indexadas" y contar cuántas URLs bajan de la categoría "Soft 404" en las semanas siguientes al deploy.
3. Usar "Inspección de URLs" sobre `/` y `/propiedades` para confirmar que el HTML que Google dice haber obtenido ya incluye el title/description reales.
4. Establecer la línea base de impresiones/clics/posición para las queries del brief (remates bancarios, remates bancarios Ciudad Juárez, remates bancarios Chihuahua, casas en remate bancario, etc.) — sin esta línea base no se puede medir el impacto real de estos cambios.
5. Repetir la medición del punto 4 a las 4-6 semanas del deploy (Google necesita rastrear de nuevo y reevaluar; no hay manera de acelerar esto desde el código).

**Nota final:** ninguno de los cambios de esta auditoría garantiza una posición específica en Google. Corrigen problemas técnicos verificados (soft 404s, imagen social rota, páginas sin metadata en el HTML crudo, sitemap incompleto) y mejoran la señal de relevancia temática donde había una brecha estructural clara frente a la competencia (Fase 1, punto 18). El impacto real solo se puede confirmar con datos de Search Console después de que Google vuelva a rastrear el sitio.
