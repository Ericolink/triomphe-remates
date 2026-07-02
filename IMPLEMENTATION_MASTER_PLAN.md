# IMPLEMENTATION MASTER PLAN — Triomphe Bienes Raíces

**Fecha de creación:** 2026-06-30
**Autor:** Principal Software Architect review (Claude Code), basado en auditoría de código completa + cruce contra investigación competitiva.
**Fuente competitiva:** `~/Downloads/Triomphe_Auditoria_Competitiva_2026.docx` (documento completo, 25+ competidores: Inmuebles24, Propiedades.com, Maison Maya, Zillow, Redfin, Idealista). El documento `Triomphe_Technical_Product_Audit_Part1.docx` existe pero está incompleto (solo 1 de 25+ competidores desarrollado en detalle) — **no se usó como fuente**, por decisión explícita del usuario.
**Fuentes técnicas internas:** `AUDITORIA_CTO_EXTREMA.md` (2026-06-29) y `REPORTE_REVISION_FINAL.md` (2026-06-18), **re-verificadas línea por línea contra el HEAD actual** (commit `57a07ec`, "se realizo auditoria del proyecto y se trabajo en todos los cambios analizados en la auditoria") — ver sección 2 para qué seguía abierto y qué ya se cerró.
**Este documento es la fuente de verdad del proyecto y debe actualizarse cada vez que se implemente un ítem del backlog** (mover de "Backlog" a "Hecho", con fecha y commit).

---

## 1. Resumen ejecutivo

Triomphe tiene una base técnica sólida y, a diferencia de lo que suele encontrarse al cruzar una auditoría competitiva contra el código real, **el equipo ya cerró la mayoría de la deuda crítica de seguridad/estabilidad** en el commit más reciente (`57a07ec`): transacciones en operaciones multi-tabla, validación de magic bytes en uploads, logging estructurado con Winston, suite de tests real con Jest (antes placeholder), `helmet`+CSP, `trust proxy`, extracción de `labels.js`/`pagination.js`, y el fix de notificación de alertas en `updateProperty`. Esto cambia el punto de partida: **el verdadero gap hoy no es estabilidad backend, es producto** — funcionalidades que la competencia ya tiene y Triomphe no, y una capa de UI con duplicación severa que va a encarecer cada feature nueva si no se ataca primero.

**Veredicto del cruce competitivo:** de 19 funcionalidades evaluadas contra los líderes del mercado, Triomphe tiene **8 implementadas sólidamente**, 3 parciales, 1 con datos falsos (números de "confianza" hardcodeados) y **7 completamente ausentes** — incluyendo las dos que el documento competitivo señala como el diferenciador más fuerte posible (calculadora hipotecaria y calculadora de ROI, que ningún competidor analizado tiene completas).

**Veredicto de infraestructura de frontend:** no existe un solo componente `Card`, `Modal` o `Input` compartido. Hay ~20 definiciones independientes de estilos de input, al menos 6 estilos de botón distintos sin componente común, y un sistema de tokens de color (`tailwind.config.js`) completamente definido pero con **cero adopción real** (todo el dark mode usa hex arbitrarios copiados, no los tokens). Construir features nuevas (calculadoras, certificaciones, blog) sobre esta base multiplicaría la deuda. Por eso el roadmap antepone infraestructura a producto donde se cruzan.

**Lo único que sigue siendo verdaderamente urgente y no es producto:** los secretos de producción (`DB_PASSWORD`, `JWT_SECRET`, `EMAIL_PASS`) fueron **removidos de HEAD** pero **siguen vivos en el historial de git** (commit `289d3c2` confirmado alcanzable). Si no se rotaron ya, esto sigue siendo el hallazgo más grave del proyecto y bloquea todo lo demás.

---

## 2. Estado actual — qué se re-verificó contra HEAD

Antes de construir el backlog, cada hallazgo "abierto" de las auditorías previas se verificó contra el código real (no se asumió vigente). Resultado:

### 2.1 — Cerrado en el commit `57a07ec` (NO entra al backlog nuevo)

| Hallazgo original | Evidencia de cierre |
|---|---|
| `trust proxy` ausente | `server/app.js:14` → `app.set('trust proxy', 1)` |
| Sin `helmet`/CSP | `server/app.js:25,27,47` — helmet + CSP dual (pública vs `/api/docs`) |
| `promoteProperty` sin transacción (doble-promoción) | `propertyController.js:499` — `sequelize.transaction()`, comentado `AUDIT-004` |
| `createProperty` sin transacción (historial huérfano) | `propertyController.js:196` — `sequelize.transaction()`, comentado `AUDIT-018` |
| Pérdida de audit log si falla WhatsApp de seguimiento | `leadController.js:280-322` — `LeadNote` se crea siempre, `logAudit` siempre se llama, comentado `AUDIT-009` |
| `updateProperty` no notifica alertas al reactivar propiedad | `server/src/services/alertService.js` (`notifyMatchingAlerts`) ahora se invoca desde `createProperty` Y `updateProperty` |
| Notificaciones masivas sin control de concurrencia | `alertService.js` → `sendAlertBatch` con límite de concurrencia 5 |
| `cityLabel`/`typeLabel` duplicados en backend (~5 copias) | `server/src/utils/labels.js` centralizado, `exportController.js` ahora importa de ahí |
| Paginación duplicada en 6 controllers | `server/src/utils/pagination.js` extraído y con test propio |
| Upload sin validación de magic bytes | `server/src/utils/fileSignature.js`, comentado `AUDIT-008` |
| Cero tests automatizados (placeholder `echo`) | `server/package.json` → `"test": "jest --runInBand"`; existen `auth.integration.test.js`, `leads.integration.test.js`, `alertService.test.js`, `pagination.test.js`, `validators.test.js`, `fileSignature.test.js` |
| Sin logging estructurado | `server/src/utils/logger.js` — Winston, JSON en producción, comentado `AUDIT-016` |
| `Button.jsx` código muerto | Archivo eliminado (confirmado por `git log` del archivo, borrado en `57a07ec`) |
| `className` duplicado en `AdminPropertiesPage.jsx` | Ya no existe ese patrón en el archivo actual |
| `GET /properties/:id/documents` "expuesto sin auth" | Es un diseño intencional correcto: filtra por `isPublic` (`PropertyDocument.isPublic`), y existe `/documents/all` separado con `authenticate+authorize` para el set completo |

**Esto reduce el Top 25 del CTO audit de 25 a ~10 ítems realmente abiertos** (ver 2.2). Tratar los 15 restantes como pendientes en el nuevo backlog sería trabajo fantasma — no se incluyen.

### 2.2 — Sigue abierto (re-verificado, entra al backlog)

| # | Hallazgo | Evidencia actual | Severidad |
|---|---|---|---|
| 1 | Secretos de producción siguen en el **historial** de git aunque ya no están en HEAD | `git cat-file -e 289d3c2` → existe y es alcanzable; remoto activo en GitHub | **CRÍTICO** |
| 2 | Faltan índices en `Lead`, `Analytics`, `AuditLog` (sí los tienen `Property`, `User`, `PropertyAlert`) | `grep "indexes:"` sobre los 6 modelos — 3 sin bloque | ALTO (preventivo) |
| 3 | `WHATSAPP_NUMBER`/`COMPANY_WHATSAPP` hardcodeado en 2 lugares independientes | `client/src/utils/constants.js:1` y `server/src/services/exportBranding.js:25`, mismo valor literal | BAJO |
| 4 | `client/package.json` con 8+ dependencias de servidor + `react-hook-form` sin uso real | `express`, `sequelize`, `mysql2`, `jsonwebtoken`, `multer`, `nodemailer`, `bcryptjs`, `swagger-ui-express`; `grep -rl react-hook-form client/src` → 0 resultados | BAJO |
| 5 | `PropertyCard` sin `React.memo` | `client/src/components/ui/PropertyCard.jsx:19` — función exportada directo, sin `memo()` | BAJO |
| 6 | `Lightbox.jsx` sin accesibilidad (`role="dialog"`, `aria-modal`, focus trap, `aria-label`) | `grep "role=\|aria-modal\|aria-label\|focus"` → 0 resultados en el archivo | MEDIO |
| 7 | Kanban de leads sin soporte táctil (solo drag&drop de mouse) | No tocado por ningún `AUDIT-0XX` del remediation pass (todos son backend); sin evidencia de cambio | MEDIO |
| 8 | Contraste `text-gray-400` insuficiente en metadatos sobre fondo blanco | No verificado en este pase (no es grep-able de forma confiable); se mantiene como hallazgo heredado de confianza media | BAJO |
| 9 | `analyticsController.getDashboard` con ~15 queries secuenciales sin `Promise.all` | No tocado por el remediation pass backend (que fue de seguridad/estabilidad, no performance) | BAJO-MEDIO |
| 10 | `exportController.js` sigue siendo un archivo grande (720 líneas, antes 841) con 4 responsabilidades mezcladas | `wc -l` → 720; redujo tamaño al extraer labels pero no se dividió en módulos | BAJO (mantenibilidad) |
| 11 | `sync({alter:false})` sin sistema de migraciones formal (Sequelize CLI/Umzug) | Sin cambios — sigue siendo el mecanismo de schema | MEDIO (largo plazo) |
| 12 | SSE con `EventEmitter` en memoria, no escala a multi-instancia | Sin cambios; aceptable mientras Render sea un solo proceso | INFO (documentar, no actuar) |

---

## 3. Mapa del proyecto (Paso 1)

**Rutas públicas (11):** `/`, `/propiedades`, `/propiedades/:slug`, `/contacto`, `/nosotros`, `/trabaja-con-nosotros`, `/buzon`, `/favoritos`, `/comparar`, `/cancelar-alerta`, `/preguntas-frecuentes` — todas en `client/src/App.jsx:50-60`.

**Rutas admin (13):** `dashboard`, `propiedades` (+ `nueva`/`:id/editar`), `leads`, `vacantes`, `postulaciones`, `usuarios`, `buzon`, `alertas`, `auditoria`, `calendario`, `testimonios` — `App.jsx:70-82`, todas protegidas por `ProtectedRoute` + `AdminLayout`.

**Backend:** 12 routers (`alerts, analytics, audit, auth, export, feedback, jobs, leads, properties, sitemap, testimonials, users`), 15 modelos Sequelize, 12 controllers (2.895 líneas totales; `exportController.js` con 720 es el más grande con margen).

**Frontend — inventario completo** (detalle por archivo en el reporte del sub-agente, resumen aquí):
- `pages/public/` (11), `pages/admin/` (13), `components/ui/` (24), `components/layout/` (4), `hooks/` (3: `useFavorites`, `useComparator`, `useNotifications`), `services/` (11, 1:1 con los routers backend — **verificado sin endpoints huérfanos**), `utils/` (5: `animations`, `constants`, `formatters`, `images`, `sanitize`), `store/` (2: `authStore`, `themeStore` — este último confirmado sin usar, `ThemeToggle.jsx` reimplementa la misma lógica con `useState` en vez de consumir el store).

---

## 4. PARTE A — Cruce auditoría competitiva vs. código real (Paso 2)

Para cada uno de los 19 puntos del documento competitivo, estado verificado con archivo:línea (no inferido):

| # | Feature (doc competitivo) | Estado | Evidencia |
|---|---|---|---|
| 1 | Certificaciones legales visibles | **NO EXISTE** | 0 resultados para certificac/licencia/colegiado en todo el código. `AboutPage.jsx:63-65` menciona "Lic. Rubén Ávila" en prosa, sin badge visual |
| 2 | Documentación legal abierta (PDFs) | **EXISTE, bien implementado** | `PropertyDocument.isPublic` (default `true`), endpoint público filtrado (`documentController.js:25-39`) vs. `/all` protegido para admin (líneas 42-56), toggle de visibilidad por doc |
| 3 | CTA sticky en mobile | **NO EXISTE** | 0 clases `fixed`/`sticky` en `PropertyDetailPage.jsx`; el WhatsApp button vive en flujo normal, debajo de galería+descripción+documentos+historial en mobile |
| 4 | Calculadora hipotecaria | **NO EXISTE** | 0 resultados para hipotec/mortgage/amortiz/calculadora en todo `client/src`+`server/src` |
| 5 | Calculadora de rentabilidad/ROI | **NO EXISTE** | Mismo resultado que #4 — el diferenciador que el doc señala como único en el mercado sigue sin construirse |
| 6 | Sección "¿Cómo funciona?" | **PARCIAL** | Existe un timeline de 11 pasos en `AboutPage.jsx:9-21,197-234` y una versión de 9 pasos en una respuesta de `FAQPage.jsx:30-31` — pero **no en HomePage**, donde un visitante nuevo nunca lo ve |
| 7 | Blog (10 artículos base) | **NO EXISTE** | Sin modelo, ruta, controller ni página — confirmado contra el listado completo de `App.jsx` |
| 8 | Tours virtuales 3D (Matterport) | **NO EXISTE** | 0 resultados para matterport/virtual tour/360/panorama; solo galería + `Lightbox.jsx` |
| 9 | WhatsApp directo | **EXISTE, multi-superficie** | Público: `WhatsAppButton.jsx` (`wa.me` con mensaje prellenado) en `PropertyDetailPage.jsx:292`. Servidor: `whatsappService.js` para alertas + seguimiento de leads desde admin |
| 10 | Testimonios con video y números | **PARCIAL** | `Testimonial` model con texto, rating 1-5, foto antes/después (`HomePage.jsx:224-270`). **Falta:** campo de video (no existe `videoUrl`), y ningún testimonio tiene una cifra de resultado concreto (solo estrellas genéricas) |
| 11 | Alertas por email | **EXISTE, completo** | `alertController.js` + `alertService.js`: suscripción, matching por ciudad/tipo/precio, envío batch con concurrencia limitada, dispara desde create Y update |
| 12 | Sistema de favoritos | **EXISTE** | `useFavorites.js` (Zustand + localStorage), `FavoritesPage.jsx`, badge en Navbar |
| 13 | Rastreador de estado | **EXISTE (2 capas)** | Público: `AcquisitionProgress` (5 etapas legales) en `PropertyDetailPage.jsx:30-55`. Admin/CRM: `Lead.status` + Kanban en `LeadsPage.jsx` + `PropertyStatusHistory` como audit trail |
| 14 | Chat/Chatbot | **NO EXISTE** | 0 resultados; el `BuzonPage`/`BuzonAdminPage` es un buzón de mensajes asíncrono, no un widget de chat en vivo |
| 15 | Optimización mobile | **PARCIAL** | Breakpoints Tailwind usados ampliamente en páginas principales, navbar con drawer funcional; pero `BuzonPage`, `ContactPage`, `FavoritesPage`, `UnsubscribeAlertPage` tienen muy baja densidad de clases responsive (1 ocurrencia c/u) — no fueron specíficamente afinadas para mobile |
| 16 | CRM / tracking de leads | **EXISTE, robusto** | `Lead` con `status/source/type/appointmentDate`, `LeadNote` para notas internas, SSE en vivo (`/api/leads/stream`), filtros y batch actions en `LeadsPage.jsx` |
| 17 | Comparador de propiedades | **EXISTE** | `useComparator.js` (máx. 3, Zustand+localStorage), `ComparatorBar` flotante, `ComparatorPage.jsx` |
| 18 | Historial de precios público | **EXISTE, bien diseñado** | `PropertyStatusHistory` transaccional, endpoint público que solo expone campos seguros (`getPublicPriceHistory`), `PriceHistoryTimeline.jsx` se muestra solo si hay >1 cambio |
| 19 | Números de operaciones/confianza | **EXISTE PERO FALSO** | `HomePage.jsx:125-127` y `AboutPage.jsx:82-84`: de 4 cifras mostradas, solo "Propiedades activas" viene de la API real (`getPropertyStats`). **"27+ años", "500+ clientes satisfechos" y "3 ciudades" están hardcodeados como strings literales en el JSX**, no derivados de `Lead`/`Property`. Es prueba social falsa, justo el tipo de cosa que el propio documento competitivo identifica como debilidad de Inmuebles24 |

**Resumen:** 8 implementadas, 3 parciales, 1 falsa, 7 ausentes. Las 7 ausentes incluyen las dos banderas del documento competitivo (#4 calculadora hipotecaria, #5 ROI) como diferenciador de nicho ("especializarse en inversores").

---

## 5. PARTE B — Duplicación de sistema de diseño (Paso 8, infraestructura)

Hallazgo central: **no existe un solo primitivo de Card, Modal, Button o Input compartido**, pese a que `animations.js` (única excepción) sí se respeta al 100% (`grep "variants={{"` fuera de `animations.js` → 0 resultados).

| Sistema | Estado | Evidencia | Prioridad de refactor |
|---|---|---|---|
| **Inputs** (`Input`/`Select`/`Textarea`) | **20+ copias independientes** | 7 constantes `inputClass`/`inputCls` redefinidas (`PropertyFormPage.jsx:58`, `JobsPage.jsx:40`, `TestimonialsAdminPage.jsx:26`, `JobsAdminPage.jsx:26`, `AlertSubscriptionForm.jsx:33`, `ContactForm.jsx:27` con `rounded-lg` distinto al resto, +inline en `UsersPage`, `PropertiesPage` ×7, `LeadsPage`, `BuzonPage`, `ApplicationsPage`, `BuzonAdminPage`) | **#1 — máxima prioridad** |
| **Tokens de color/dark mode** | Sistema definido en `tailwind.config.js` (`primary`, `accent`, `dark.bg/surface/border/muted`) con **0% de adopción** | `bg-primary`/`text-accent`: 0 ocurrencias. En su lugar: `dark:bg-[#242938]` (~60×), `dark:border-[#2e3650]` (~90×) — son los mismos hex que los tokens, copiados a mano en vez de referenciados | **#2 — mecánico, riesgo visual cero** |
| **Cards** | Sin primitivo; ~40+ implementaciones del mismo shell (`bg-white dark:bg-[#242938] rounded-2xl border shadow-*`) | `DashboardPage.jsx` repite el mismo shell **9 veces en un archivo**; `HomePage.jsx:208-218` y `AboutPage.jsx:121-131` son duplicado casi literal del mismo card "icono+título+desc" | **#3** |
| **Botones** | Sin componente (se borró `Button.jsx` por código muerto en el commit anterior); **6 estilos visuales distintos** sin unificar | primario-navy, primario-gold, outline-danger, outline-neutral, icon-round-overlay, icon-row-action (este último repetido 15+ veces en tablas admin) | **#4 — recrear con cuidado de que sí se adopte esta vez** |
| **Modales** | 6 implementaciones independientes del mismo overlay `fixed inset-0 z-50 bg-black/50` | `ConfirmDialog.jsx` (el más reutilizado), `Lightbox.jsx`, `JobsPage.jsx:44`, `UsersPage.jsx:289` (copia el overlay de `ConfirmDialog` sin importarlo), `WelcomeScreen.jsx` | **#5** |
| **Badges** | Parcialmente consolidado | `Badge.jsx` + `STATUS_VARIANTS` se usa bien para status de propiedad, pero coexiste con `SOURCE_COLORS` (otro mapa de colores paralelo) y al menos 3 pills hardcodeados fuera de Badge (`HomePage.jsx:71`, `PropertyCard.jsx:65`, `DashboardPage.jsx` ×3) | **#6** |
| **Empty states** | Sin componente, 10 mensajes "no hay X" repetidos a mano | Varios comparten textualmente `text-center py-16 text-gray-400 dark:text-gray-500` | **#7** |
| **Error states / Error Boundary** | **No existe ningún `ErrorBoundary`** en toda la app | 0 resultados — esto es una ausencia, no una duplicación; un error de render en cualquier componente tira pantalla en blanco sin recuperación | Gap, no refactor — atender en Sprint 4 |
| **Skeletons** | Razonablemente consistente | Solo `PropertyCardSkeleton` existe; el resto del admin usa `Spinner` genérico (aceptable, no bloqueante) | Sin acción prioritaria |

---

## 6. Matriz de backlog completa (Paso 3)

Convención: **Complejidad/Impacto** en escala 1-5. **ROI** = Impacto/Complejidad (orientativo). **Tiempo** estimado en horas-persona.

### 6.1 — Producto (competitivo)

| Feature | Competidor que lo tiene | Estado | Archivos | Complejidad | Impacto | ROI | Prioridad | Dependencias | Riesgo | Tiempo |
|---|---|---|---|---|---|---|---|---|---|---|
| CTA sticky mobile | Todos los líderes (Inmuebles24, Zillow, Idealista) | No existe | `PropertyDetailPage.jsx`, nuevo `StickyContactBar.jsx` (patrón `ComparatorBar.jsx`) | 1 | 4 | 4.0 | **P1** | Ninguna | Bajo | 3h |
| Certificaciones legales visibles | Maison Maya (8.5/10 confianza), Idealista | No existe | Nuevo `TrustBadges.jsx`, usar en `Footer.jsx`+`AboutPage.jsx`+`PropertyDetailPage.jsx` | 1 | 4 | 4.0 | **P1** | Cards (5.2) ideal antes, no bloqueante | Bajo | 4h |
| Fix números de confianza falsos | — (gap propio, no competitivo) | Falso/hardcoded | `HomePage.jsx:125-127`, `AboutPage.jsx:82-84`, nuevo endpoint `getTrustStats` en `analyticsController.js` | 2 | 4 | 2.0 | **P1** | Ninguna | Medio (cambia el mensaje de marketing — validar cifras reales con negocio antes de publicar) | 6h |
| "¿Cómo funciona?" en Home | Todos | Parcial (solo en `/nosotros`) | Extraer `processSteps` a `utils/constants.js`, nueva sección en `HomePage.jsx` | 1 | 3 | 3.0 | **P1** | Ninguna | Bajo | 4h |
| Calculadora hipotecaria | Idealista (robusta), Zillow | No existe | Nuevo `MortgageCalculator.jsx`, lógica pura de amortización, integrar en `PropertyDetailPage.jsx` | 3 | 5 | 1.7 | **P1** | Sistema de Input (6.2 #1) | Bajo (cálculo es lógica pura, fácil de testear) | 12h |
| Calculadora de ROI/rentabilidad | Ninguno (diferenciador único según doc) | No existe | Nuevo `RoiCalculator.jsx`, mismo patrón | 3 | 5 | 1.7 | **P1** | Sistema de Input, idealmente después de la hipotecaria (reutiliza UI) | Bajo | 10h |
| Testimonios: video + cifra numérica | Líderes con redes/reviews | Parcial | `Testimonial` model (+`videoUrl`, +`resultValue`), migración alter, `TestimonialsAdminPage.jsx`, render en `HomePage.jsx` | 2 | 3 | 1.5 | **P2** | Ninguna | Bajo | 8h |
| Optimización mobile (páginas de baja densidad responsive) | Todos | Parcial | `BuzonPage.jsx`, `ContactPage.jsx`, `FavoritesPage.jsx`, `UnsubscribeAlertPage.jsx` | 2 | 3 | 1.5 | **P2** | Ninguna | Bajo | 8h |
| Chat widget (no chatbot custom) | Casi todos (vía Tawk/Intercom) | No existe | Embed de script de terceros (Tawk.to free tier) en `PublicLayout.jsx` | 1 | 3 | 3.0 | **P2 (quick win si se acepta proveedor externo)** | Decisión de negocio: ¿proveedor gratuito aceptable? | Bajo | 2h |
| Blog (10 artículos) | Inmuebles24 (100+), todos los líderes | No existe | Nuevo modelo `BlogPost`, controller, rutas, `BlogPage.jsx`/`BlogPostPage.jsx`, SEO (`SEO.jsx` ya existe, reutilizable) | 4 | 4 | 1.0 | **P3** | Sistema de Cards (5.2), contenido editorial (no es solo código) | Medio (esfuerzo de contenido recurrente, no un sprint) | 24h código + contenido continuo |
| Tours virtuales 3D (Matterport) | Algunos premium, ninguno de los líderes de tráfico | No existe | Integración de embed/iframe + campo `matterportUrl` en `Property` | 2 | 3 | 1.5 | **P3** | Decisión de negocio: costo de licencia Matterport por propiedad | Medio (depende de presupuesto externo) | 6h código (+ costo recurrente externo) |

### 6.2 — Infraestructura / sistema de diseño (Paso 8)

| Sistema | Estado | Archivos afectados (aprox.) | Complejidad | Impacto | ROI | Prioridad | Dependencias | Riesgo | Tiempo |
|---|---|---|---|---|---|---|---|---|---|
| **1. Input/Select/Textarea** | 20+ copias | ~15 archivos | 2 | 5 | 2.5 | **P1 — primero** | Ninguna | Bajo (visualmente ya casi idénticos) | 10h (componente + migrar los 5 formularios más usados) |
| **2. Tokens de color dark mode** | 0% adopción de tokens ya definidos | ~30 archivos (find/replace) | 1 | 4 | 4.0 | **P1 — segundo, mecánico** | Ninguna | Muy bajo (mismo hex, solo cambia la referencia) | 3h |
| **3. Card primitive** | ~40 implementaciones | `DashboardPage.jsx` (9×), `HomePage.jsx`/`AboutPage.jsx` (duplicado), `PropertyCard`/`PromotedPropertyBanner`/`ComparatorPage` (variantes) | 3 | 4 | 1.3 | **P2** | Ninguna técnica; mejor después de Input (mismo "ciclo" de refactor de UI) | Bajo-medio (DashboardPage primero, property cards son más bespoke) | 10h |
| **4. Button primitive (recrear)** | Borrado por código muerto; 6 estilos sin unificar | Todo `client/src` | 3 | 3 | 1.0 | **P2** | Debe nacer ya conectado a ≥3 call sites reales o se vuelve a marcar como código muerto | Medio (riesgo de repetir el ciclo "se crea, no se adopta, se borra") | 8h |
| **5. Modal base wrapper** | 6 implementaciones del mismo overlay | `JobsPage.jsx`, `UsersPage.jsx` a migrar; `ConfirmDialog`/`Lightbox` como base | 2 | 3 | 1.5 | **P2** | Ninguna | Bajo | 6h |
| **6. EmptyState component** | 10 mensajes hardcodeados | 10 páginas admin+público | 1 | 2 | 2.0 | **P2 — quick win** | Ninguna | Muy bajo | 3h |
| **7. ErrorBoundary** | No existe (gap, no duplicación) | `App.jsx` (nivel raíz) + opcional por sección | 1 | 4 | 4.0 | **P2 — quick win de resiliencia** | Ninguna | Muy bajo | 2h |
| **8. Badge: unificar SOURCE_COLORS + pills sueltos** | Parcial | `constants.js`, `Badge.jsx`, `DashboardPage.jsx`, `HomePage.jsx`, `PropertyCard.jsx` | 2 | 2 | 1.0 | **P3** | Badge.jsx ya existe, solo extender variantes | Bajo | 4h |

### 6.3 — Deuda técnica (Paso 5, re-verificada — ver sección 2.2)

| Hallazgo | Archivos | Complejidad | Impacto | ROI | Prioridad | Dependencias | Riesgo | Tiempo |
|---|---|---|---|---|---|---|---|---|---|
| Rotar credenciales + purgar historial de git | `JWT_SECRET`/`DB_PASSWORD`/`EMAIL_PASS` en Render; historial completo del repo | 2 | 5 | 2.5 | **P0** | Ninguna — bloquea todo lo demás en términos de riesgo | Alto si no se hace (compromiso total), medio al ejecutar (force-push coordinado) | 4h + coordinación de equipo |
| Índices en `Lead`/`Analytics`/`AuditLog` | 3 modelos Sequelize + 1 migración/alter | 1 | 3 | 3.0 | **P1** | Ninguna | Bajo | 3h |
| `WHATSAPP_NUMBER` única fuente | `constants.js`, `exportBranding.js` | 1 | 1 | 1.0 | **P3 — quick win trivial** | Ninguna | Muy bajo | 1h |
| Limpiar `client/package.json` | `client/package.json` | 1 | 2 | 2.0 | **P3 — quick win** | Ninguna | Muy bajo | 1h |
| `React.memo` en `PropertyCard` | `PropertyCard.jsx` | 1 | 1 | 1.0 | **P3** | Ninguna | Muy bajo | 0.5h |
| Accesibilidad `Lightbox.jsx` (focus trap, aria) | `Lightbox.jsx` | 2 | 3 | 1.5 | **P2** | Ninguna | Bajo | 4h |
| Kanban: soporte táctil | `LeadsPage.jsx` | 2 | 2 | 1.0 | **P2** | Ninguna | Bajo | 6h |
| Contraste `text-gray-400` | Varias páginas | 1 | 2 | 2.0 | **P2 — quick win** | Ninguna | Muy bajo | 2h |
| `Promise.all` en `analyticsController.getDashboard` | `analyticsController.js` | 2 | 2 | 1.0 | **P3** | Ninguna | Bajo | 3h |
| Dividir `exportController.js` (720 líneas) | `exportController.js` → módulos data/excel/pdf/branding | 3 | 2 | 0.7 | **P3** | Ninguna | Bajo | 8h |
| Migraciones formales (Sequelize CLI/Umzug) | `server.js`, nueva carpeta `migrations/` | 4 | 3 | 0.75 | **P3** | Ninguna | Medio (cambio de proceso de deploy) | 16h |

---

## 7. Clasificación por prioridad (Paso 4)

### P0 — Crítico (antes de tocar cualquier otra cosa)
1. **Confirmar rotación de `JWT_SECRET`/`DB_PASSWORD`/`EMAIL_PASS`** y purgar el historial de git con `git filter-repo` (coordinado con el equipo, force-push). Mientras esto no se confirme, cualquier otro trabajo es secundario en términos de riesgo real.

### P1 — Muy importante (mayor impacto/esfuerzo, hace al resto del roadmap más barato)
- Sistema de Input/Select/Textarea (infraestructura, #1 en apalancamiento)
- Tokens de color dark mode (mecánico, cero riesgo)
- Índices en `Lead`/`Analytics`/`AuditLog`
- CTA sticky mobile
- Certificaciones legales visibles
- Fix de números de confianza falsos
- "¿Cómo funciona?" en Home
- Calculadora hipotecaria
- Calculadora de ROI/rentabilidad

### P2 — Importante
- Card primitive
- Button primitive (recreado con adopción garantizada)
- Modal base wrapper
- EmptyState component
- ErrorBoundary
- Testimonios con video + cifra numérica
- Optimización mobile de páginas de baja densidad
- Chat widget (si se acepta proveedor externo)
- Accesibilidad de `Lightbox.jsx`
- Soporte táctil del Kanban
- Contraste de texto

### P3 — Nice to have
- Blog (10 artículos)
- Tours virtuales 3D (Matterport, sujeto a presupuesto)
- Badge: unificar `SOURCE_COLORS`
- `WHATSAPP_NUMBER` única fuente, limpieza de `package.json`, `React.memo`
- `Promise.all` en dashboard, división de `exportController.js`
- Migraciones formales (Sequelize CLI/Umzug)

---

## 8. Quick Wins (Paso 6 — cruce: la competencia lo tiene, nosotros no, es fácil)

Ordenados por ROI real (impacto alto, esfuerzo bajo, sin dependencias bloqueantes):

1. **CTA sticky mobile** (3h) — los datos (precio, link de WhatsApp) ya existen, solo falta el wrapper `fixed`, mismo patrón que `ComparatorBar.jsx` ya probado en el código.
2. **Tokens de color dark mode** (3h) — find/replace mecánico, cero riesgo visual, hace reales los tokens que ya están en `tailwind.config.js` sin usarse.
3. **ErrorBoundary** (2h) — gap puro, no hay nada que migrar, evita pantallas en blanco.
4. **EmptyState component** (3h) — 10 mensajes ya casi idénticos, solo falta extraerlos.
5. **Certificaciones legales visibles** (4h) — sin backend nuevo, es contenido + un componente de presentación.
6. **"¿Cómo funciona?" en Home** (4h) — el contenido (`processSteps`) ya existe en `AboutPage.jsx`, solo falta extraerlo y mostrarlo donde realmente convierte.
7. **Contraste de texto WCAG AA** (2h) — cambiar clase de color, sin riesgo.
8. **Chat widget vía Tawk.to** (2h, sujeto a aprobación) — script embebido, sin desarrollo custom.
9. **`WHATSAPP_NUMBER` única fuente + limpiar `package.json` + `React.memo`** (2.5h combinadas) — housekeeping trivial, hacerlo en el mismo PR que cualquier sprint temprano.

---

## 9. Roadmap por sprints (Paso 7)

Cada sprint solo incluye tareas que no rompen el resto del proyecto. Las dependencias entre sprints están explícitas.

### Sprint 1 — Seguridad + cimientos de infraestructura
*Objetivo: cerrar el único riesgo crítico real y construir la base que abarata todo lo que sigue.*
- [P0] Rotar credenciales + purgar historial de git (coordinado, fuera de horario de desarrollo activo)
- [P1] Índices en `Lead`/`Analytics`/`AuditLog`
- [P1] Sistema de Input/Select/Textarea — componente + migración de los 3 formularios públicos (`ContactForm`, `AlertSubscriptionForm`, futuros de calculadoras)
- [Quick win] Tokens de color dark mode (find/replace)
- [Quick win] `WHATSAPP_NUMBER` único, limpiar `package.json`, `React.memo` en `PropertyCard`
- [Quick win] ErrorBoundary en `App.jsx`

**Dependencias:** ninguna tarea de este sprint depende de otra fuera de él. Es el único sprint que puede arrancar de inmediato sin esperar nada.

### Sprint 2 — Conversión rápida (quick wins de producto)
*Objetivo: capturar el ROI competitivo más barato antes de construir las calculadoras.*
- [P1] CTA sticky mobile
- [P1] Certificaciones legales visibles
- [P1] Fix de números de confianza (endpoint real + validar cifras con negocio)
- [P1] "¿Cómo funciona?" en Home
- [Quick win] Contraste de texto WCAG AA
- [P2, si se aprueba proveedor] Chat widget (Tawk.to)

**Dependencias:** ninguna técnica dura, pero usa el sistema de Input de Sprint 1 si alguna de estas tareas toca un formulario.

### Sprint 3 — Diferenciador competitivo (calculadoras)
*Objetivo: construir lo que el documento competitivo señala como la oportunidad de mayor diferenciación.*
- [P1] Calculadora hipotecaria
- [P1] Calculadora de ROI/rentabilidad
- Integración de ambas en `PropertyDetailPage.jsx`, cerca del CTA sticky de Sprint 2

**Dependencias:** requiere el sistema de Input de Sprint 1 (ambas calculadoras son formularios). Se beneficia de que el CTA sticky de Sprint 2 ya exista para no competir por espacio en el layout sin haberlo decidido antes.

### Sprint 4 — Sistema de diseño (Cards, Modal, Button) + Accesibilidad
*Objetivo: terminar la consolidación de infraestructura antes de que el catálogo de páginas siga creciendo (Blog en Sprint 5 lo necesitaría desde cero si no).*
- [P2] Card primitive — empezar por `DashboardPage.jsx` (9 instancias, mayor ROI) y el duplicado `HomePage`/`AboutPage`
- [P2] Modal base wrapper — migrar `JobsPage.jsx` y `UsersPage.jsx` a extender `ConfirmDialog`
- [P2] Button primitive (recrear, conectado de inmediato a los 6 estilos identificados)
- [P2] Badge: unificar `SOURCE_COLORS` con `Badge.jsx`
- [P2] Accesibilidad de `Lightbox.jsx` (focus trap, `role="dialog"`, `aria-label`)
- [P2] Soporte táctil del Kanban de leads

**Dependencias:** Card/Modal/Button deben ir antes del Blog (Sprint 5) para no sumar una tercera generación de "card" duplicada.

### Sprint 5 — Contenido y cierre de deuda restante
*Objetivo: lo que requiere más esfuerzo sostenido (contenido editorial, decisiones de negocio externas) o no es urgente.*
- [P2] Testimonios: agregar campo de video + cifra de resultado numérico
- [P2] Optimización mobile de `BuzonPage`/`ContactPage`/`FavoritesPage`/`UnsubscribeAlertPage`
- [P3] Blog — modelo + CRUD admin + páginas públicas (usa el Card primitive de Sprint 4); el ritmo de publicación de contenido continúa después del sprint, no es un entregable de una sola vez
- [P3] Tours 3D Matterport — **requiere decisión de negocio sobre presupuesto antes de empezar** (no es solo trabajo de ingeniería)
- [P3] `Promise.all` en `analyticsController.getDashboard`, división de `exportController.js`
- [P3] Evaluar migración a Sequelize CLI/Umzug (decisión de proceso, no solo código)

---

## 10. Riesgos y dependencias transversales

- **El roadmap completo está condicionado a P0.** Si las credenciales no se rotan, cualquier feature nueva se construye sobre un backend potencialmente comprometido — no es un riesgo teórico, el repo tiene remoto activo en GitHub.
- **Button primitive (Sprint 4) tiene riesgo de repetir su propio ciclo de muerte.** Ya se creó y se borró una vez por falta de adopción. No debe recrearse "por si acaso" — solo cuando se vaya a conectar de inmediato a call sites reales en el mismo PR.
- **Fix de números de confianza (Sprint 2) es technical pero también de negocio.** Las cifras "27+ años", "500+ clientes" pueden ser ciertas y solo faltar conectarlas a datos reales, o pueden ser aspiracionales — esto requiere una conversación con el negocio antes de publicar un número derivado de la base de datos que podría ser menor al que se mostraba antes.
- **Matterport (Sprint 5) depende de presupuesto externo recurrente**, no es una decisión que el equipo de desarrollo pueda tomar solo.
- **Blog (Sprint 5) tiene un componente de esfuerzo no-código** (10 artículos de contenido real) que no escala con velocidad de desarrollo — debe planearse en paralelo con quien escriba el contenido, no como tarea de un sprint cerrado.
- **Purga de historial de git** es disruptiva para cualquier colaborador con un clone existente — coordinar el force-push, no ejecutarlo unilateralmente.

---

## 11. Orden recomendado de implementación (resumen ejecutable)

1. Rotar credenciales + purgar historial de git (P0, bloqueante de todo lo demás en términos de riesgo).
2. Sistema de Input/Select/Textarea + tokens de color dark mode (infraestructura barata que abarata el resto).
3. Índices en `Lead`/`Analytics`/`AuditLog` + quick wins de housekeeping (`WHATSAPP_NUMBER`, `package.json`, `React.memo`, ErrorBoundary).
4. Quick wins de conversión: CTA sticky, certificaciones, "cómo funciona", fix de números de confianza.
5. Calculadora hipotecaria + calculadora de ROI (el diferenciador competitivo real).
6. Card + Modal + Button primitives, Badge unificado, accesibilidad de Lightbox, Kanban táctil.
7. Testimonios con video/cifras, optimización mobile de páginas rezagadas.
8. Blog, Matterport (sujeto a presupuesto), limpieza final de deuda técnica (`exportController.js`, `Promise.all`, migraciones formales).

---

## Registro de actualizaciones

| Fecha | Cambio | Commit |
|---|---|---|
| 2026-06-30 | Creación del documento — auditoría completa, cruce competitivo, re-verificación de hallazgos previos contra HEAD | — |
