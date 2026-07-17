# Auditoría CTO Extrema — Triomphe Remates

**Fecha:** 2026-06-29
**Alcance:** `server/` y `client/` completos, estado actual en disco incluyendo working tree sin commitear (feature WhatsApp: `whatsappService.js` nuevo + cambios en `leadController.js`, `propertyController.js`, `alertController.js`, modelos, rutas, `app.js` con helmet/CSP) y **todo el historial de git** (`git log`, `git show`) cuando fue relevante (credenciales committeadas).
**Metodología:** lectura completa del código fuente (no solo grep superficial), 4 líneas de investigación independientes y paralelas (arquitectura/código muerto/calidad, seguridad, performance/BD/escalabilidad, testing/DevOps/producto/riesgos-IA), verificación cruzada manual de los hallazgos de mayor severidad antes de incluirlos, y contraste contra el reporte de auditoría previo (`REPORTE_REVISION_FINAL.md`, 2026-06-18, no commiteado) para no repetir lo ya señalado y en su lugar verificar si sigue vigente.
**Relación con el reporte anterior:** ese reporte sigue siendo válido como base — su veredicto general (6.1/10, no listo para producción) era correcto. Esta auditoría lo extiende: confirma qué se corrigió, qué sigue igual, y agrega una capa de hallazgos que el reporte anterior no cubrió (transacciones, índices por tabla, credenciales en git, dead code verificado por referencias, riesgos de desarrollo asistido por IA).

---

## FASE 1 — Auditoría contradictoria

Antes de aceptar cualquier hallazgo se intentó refutarlo. Se documentan los casos donde el intento de refutación es informativo (sobrevivió con más fuerza, sobrevivió con matices, o fue descartado).

| # | Hipótesis inicial | Intento de refutación | Veredicto |
|---|---|---|---|
| 1 | "Hay credenciales reales de producción committeadas en git" | Podrían ser credenciales viejas/rotadas, de un deploy IIS abandonado, sin relación con el entorno actual en Render. **Verificado directamente** (`git show HEAD:server/web.config`, `git show HEAD:server/update-admin.js`): el archivo sigue en `HEAD` (no es solo historial antiguo, está en el commit actual), contiene `DB_PASSWORD=REDACTED_DB_PASSWORD`, `JWT_SECRET=REDACTED_JWT_SECRET`, `EMAIL_PASS=REDACTED_EMAIL_APP_PASSWORD` (App Password de Gmail), host real de BD. El repo tiene remoto activo en GitHub (`github.com/Ericolink/triomphe-remates`). Aunque el deploy IIS esté abandonado, el patrón de contraseña (`REDACTED_DB_PASSWORD` / `@REDACTED_DB_PASSWORD` en `update-admin.js`) sugiere reutilización de credenciales débiles entre entornos — riesgo no descartable sin rotación explícita. | **SOBREVIVE — se eleva a CRÍTICO.** No se pudo refutar; al contrario, se encontró evidencia adicional (`update-admin.js`, backup de 26MB) que lo agrava. |
| 2 | "`POST /api/auth/register` permite crear admins sin auth" (hallazgo del reporte anterior) | Se verificó el código actual: `server/src/routes/auth.js:41` ya tiene `authenticate, authorize('admin')`. | **REFUTADO — corregido correctamente.** Se retira de la lista de riesgos activos. |
| 3 | "Falta `trust proxy` invalida el rate limiting" | Depende de que Render efectivamente actúe como proxy inverso que reescribe `X-Forwarded-For` — no se tiene acceso a la configuración de Render para confirmarlo al 100%. Es la arquitectura estándar de Render (documentada públicamente), por lo que la suposición es razonable pero no verificable desde el código. | **SOBREVIVE con matiz** — se mantiene como hallazgo MEDIO, explícitamente condicionado a la plataforma de hosting. |
| 4 | "CSRF es explotable" | Se revisó el esquema de auth: JWT vía header `Authorization: Bearer`, no cookies (salvo `credentials: true` en CORS, sin uso práctico de cookies de sesión), CORS con whitelist explícita. Un atacante no puede forzar al navegador a adjuntar el JWT desde un origen ajeno sin robarlo primero (vector ya cubierto por XSS, que está mitigado con `escapeHtml`). | **REFUTADO como riesgo práctico explotable** — se reclasifica de "posible vulnerabilidad" a BAJO/INFO (ausencia de defensa en profundidad, no vulnerabilidad activa). |
| 5 | "El envío en paralelo de email+WhatsApp sin `Promise.allSettled` puede tirar el proceso por unhandled rejection" | Se leyó `propertyController.js:245-254` línea por línea: cada `sendPropertyAlertNotification(...)` y `sendPropertyAlertWhatsApp(...)` tiene su propio `.catch()` individual. No hay riesgo de crash del proceso. | **REFUTADO parcialmente** — el riesgo de crash se descarta; el riesgo real (ráfagas sin control de concurrencia hacia APIs externas de terceros) se mantiene y se reclasifica correctamente como ALTO de negocio/abuso de plataforma, no de estabilidad. |
| 6 | "`updateProperty` no relanza el matching de alertas" | Se leyó `updateProperty` completo (`propertyController.js:271-340`): efectivamente no contiene ningún bloque de búsqueda/notificación de alertas, a diferencia de `createProperty`. | **CONFIRMADO con lectura completa del código**, no solo grep — alta confianza. |
| 7 | "`PropertyAlert` sin asociación en `models/index.js` es un bug" | Se verificó que ningún controller depende de un `include` de Sequelize sobre esa asociación; todas las consultas son standalone (`findAll`/`findOne`). Hoy no rompe nada. | **REFUTADO como bug actual** — se reclasifica de "hallazgo de severidad" a nota de consistencia arquitectónica (BAJO), no a riesgo funcional. |
| 8 | "`pool.max:5` va a saturar el sitio" | Con el tráfico actual (inmobiliaria regional, sin evidencia de carga alta), 5 conexiones probablemente bastan hoy. El riesgo es real solo en combinación con la ausencia de índices (queries que retienen la conexión más tiempo) y bajo picos de tráfico concurrente. | **SOBREVIVE pero se reclasifica** — no es un riesgo de producción inmediato, es un hallazgo de escalabilidad (ver FASE 10), no de performance actual. |
| 9 | "`client/components/ui/Button.jsx` es código muerto" | Se confirmó con `grep -rn "ui/Button\|import Button"` en todo `client/src`: cero resultados fuera de su propia definición/export. | **CONFIRMADO con evidencia de referencias**, no es una suposición. |
| 10 | "El botón de WhatsApp en `LeadsPage` falla silenciosamente para el usuario" | Se leyó el diff de `LeadsPage.jsx`: la mutación tiene `onError: (e) => toast.error(...)`. El frontend SÍ informa al usuario del fallo. | **REFUTADO en el frontend** — el problema real no es la UX del botón, sino que el backend (`leadController.js:297-315`) pierde el audit log/nota cuando falla, lo cual el usuario no puede ver ni recuperar desde la UI. Se reformula el hallazgo con precisión. |

Ningún hallazgo de los reportados a continuación se incluye sin haber sobrevivido a este proceso o sin evidencia directa de archivo/línea.

---

## FASE 2 — Arquitectura

### Hallazgo principal: lógica de negocio de un dominio embebida en el controller de otro
`server/src/controllers/propertyController.js:226-256` (dentro de `createProperty`) contiene la regla completa de "qué alerta de suscriptor hace match con una propiedad nueva" — construcción de query `Op.or` por ciudad/tipo, filtro de precio, envío de email y WhatsApp. Esta lógica pertenece al dominio de alertas, no al de propiedades, y **no se replica en `updateProperty`** (confirmado en FASE 1, ítem 6): una propiedad que cambia de estatus a "disponible" mediante edición nunca notifica a los suscriptores. Es el caso de libro de texto de "un cambio que requiere modificar varios archivos para una sola regla de negocio" porque la regla vive en el lugar equivocado.
**Refactor propuesto:** `alertService.notifyMatchingAlerts(property)` invocado desde ambos métodos. Esfuerzo: medio. Riesgo de modificarlo: bajo (es lógica aislable, con tests manuales sencillos: crear alerta, crear/editar propiedad, verificar envío).

### `createProperty` — función con 7 responsabilidades distintas
Validación de input → generación de slug único → persistencia → registro de historial de estatus → construcción de query de matching de alertas → notificación email → notificación WhatsApp → audit log, todo en ~85 líneas de una sola función (`propertyController.js:183-268`). Es la función más sobrecargada del backend. Impacto: alto en mantenibilidad — cualquier cambio en una de las 7 responsabilidades obliga a leer y entender las otras 6 para no romper algo. Probabilidad de bug futuro: alta.

### Archivos gigantes con responsabilidades mezcladas
- **`server/src/controllers/exportController.js` (841 líneas)** — mezcla paleta de marca, helpers de logo/imagen (Jimp + fetch a Cloudinary), queries Sequelize, generación de Excel (ExcelJS) y generación de PDF (PDFKit) con su propio sistema de layout. Ningún módulo separa "obtener datos" de "renderizar". Además (ver FASE 6) duplica sus propias copias de `cityLabel`/`typeLabel`/`statusLabel` en vez de importar `utils/constants.js`.
- **`client/src/pages/admin/LeadsPage.jsx` (500+ líneas)** — un único componente `LeadDetailPanel` concentra mutación de notas, mutación de WhatsApp, mutación de status, batch actions y export. Crecimiento por acumulación de features sin descomponer.
- **`PropertyFormPage.jsx` (568 líneas, según reporte previo, sin cambios en el diff actual)** — formulario + drag&drop + documentos + historial + analytics en un solo componente.

### Dependencias circulares
Verificado con `madge --circular` sobre los 77 archivos de `client/src` y los 53 de `server/src`: **ninguna dependencia circular**. No es un problema de este proyecto — se documenta como verificado y descartado, no como hallazgo.

### Branching por tipo/rol
El branching por rol existente (`adminLinks` vs `baseLinks` en `AdminLayout.jsx`) es simple, no frágil, y no escala mal con nuevos roles porque solo hay dos. No se encontró branching frágil por tipo de propiedad o por plantilla. **Se buscó explícitamente y se descarta como hallazgo.**

### Rutas inaccesibles
Se verificó cada ruta de `App.jsx` contra la navegación (sidebar admin, navbar público): todas tienen entrada de acceso. **No hay rutas huérfanas — verificado y descartado.**

---

## FASE 3 — Seguridad

### CRÍTICO

**Credenciales de producción reales committeadas a git, en el commit actual (`HEAD`), con remoto activo en GitHub**
- `server/web.config` (líneas con `DB_PASSWORD=REDACTED_DB_PASSWORD`, `JWT_SECRET=REDACTED_JWT_SECRET`, `EMAIL_PASS=REDACTED_EMAIL_APP_PASSWORD`, host real de BD `mysql5048.site4now.net`), introducido en el commit `289d3c2` (2026-05-28) y `58383e0` (2026-05-29).
- `server/update-admin.js` (commit `5029204`): hashea y asigna la contraseña `@REDACTED_DB_PASSWORD` al admin con email real `TriompheSistemas@gmail.com`.
- `server/production_site8_3494768.tar.gz.backup` (26.27 MB, commit `58383e0`): backup completo de un deploy de producción anterior, sin revisar su contenido (puede contener más secretos o dumps de BD).
- **Impacto:** cualquiera con acceso de lectura al repositorio (colaboradores actuales/pasados, un fork, un CI mal configurado, o si el repo llegó a ser público en algún momento) tiene la contraseña de la base de datos, el secreto de firma de JWT (permite **forjar tokens de admin válidos** sin necesidad de credenciales) y el App Password de Gmail de la cuenta institucional.
- **Probabilidad de explotación:** depende de quién tuvo/tiene acceso al repo — no verificable desde el código, pero el daño potencial (control total del backend vía JWT forjado + acceso a BD + acceso a la cuenta de Gmail institucional) es máximo.
- **Acción inmediata recomendada:** (1) rotar YA `JWT_SECRET`, `DB_PASSWORD`, y el App Password de Gmail en todos los entornos donde se usen — aunque el deploy IIS esté abandonado, si el patrón de contraseña se reutilizó en Render esto sigue siendo explotable; (2) eliminar estos 4 archivos del **historial** de git (no basta con `git rm` en un commit nuevo — el secreto sigue en el historial; requiere `git filter-repo` o BFG Repo-Cleaner) y forzar push coordinado con el equipo; (3) agregar `web.config`, `*.backup`, `*.tar.gz`, `update-admin.js` a `.gitignore`.
- **Riesgo de la corrección:** bajo en sí misma (rotar secrets es seguro), pero reescribir historial de git es disruptivo para cualquier colaborador con un clone existente — coordinar antes de hacerlo.

### ALTO

**`updateProperty` no notifica alertas (email+WhatsApp) al reactivar una propiedad** — confirmado en FASE 1/2. Impacto de negocio, no de seguridad per se, pero se incluye aquí porque interactúa con el flujo de notificaciones a terceros (ver siguiente punto).

**Pérdida de audit log y nota de seguimiento cuando falla el envío de WhatsApp**
`server/src/controllers/leadController.js:297-315`. Si `sendLeadFollowUpWhatsApp` lanza (token de Meta expirado, plantilla no aprobada, error de red), la excepción se captura ANTES de crear el `LeadNote` y ANTES de `logAudit`. El frontend sí muestra un `toast.error` (confirmado en FASE 1/10 — no es un problema de UX), pero el backend no deja ningún rastro de que se intentó el contacto. En un dominio legal/financiero (remates bancarios) donde el audit log es la prueba de seguimiento, esto es una pérdida de trazabilidad real. Probabilidad: alta (cualquier fallo de Meta API lo dispara).

**Notificaciones masivas por WhatsApp+email sin control de concurrencia ni deduplicación**
`propertyController.js:245-254`. Con N alertas coincidentes se generan hasta 2N llamadas HTTP simultáneas a Gmail SMTP y Meta Graph API, sin `Promise.allSettled` agrupado, sin límite de concurrencia ni backoff. Riesgo de rate-limit o suspensión de la cuenta de WhatsApp Business de Meta por ráfagas reportadas como spam. Probabilidad: media-alta si crece la base de alertas.

### MEDIO

**Validación de subida de archivos basada solo en extensión + `mimetype` declarado por el cliente**
`server/src/middleware/uploadMiddleware.js`. `file.mimetype` viene de la cabecera `Content-Type` que el cliente controla. Sin verificación de magic bytes, un usuario autenticado (editor/admin) podría subir un archivo disfrazado. Cloudinary reprocesa imágenes (mitiga ejecución), pero los documentos (`resource_type: 'raw'`) se sirven tal cual. Impacto medio, probabilidad baja (requiere cuenta ya autenticada).

**Validación de teléfono ausente de punta a punta**
Confirmado en `AlertSubscriptionForm.jsx` (solo `maxLength={20}`), `alertController.js`, `Lead.js`/`PropertyAlert.js` (sin `validate`), y `whatsappService.js:8-11` (`toE164` no defensivo ante `null`/formato raro — un `phone` no-string lanza `TypeError`, lo que en `sendLeadWhatsApp` agrava el hallazgo anterior de pérdida de audit log). Sigue igual que en el reporte previo, ahora con más superficie (alertas + seguimiento manual).

**CSP pública permite `styleSrc: 'unsafe-inline'`** (`server/app.js:23-37`) — práctica común y de riesgo residual bajo en navegadores modernos, pero es un hueco real frente a `scriptSrc` que correctamente no lo permite. La separación de política `/api/docs` vs sitio público es una buena práctica que vale la pena resaltar (no es habitual verla bien hecha).

**Documentos legales de propiedades expuestos sin autenticación** — `server/src/routes/properties.js:33`, `GET /:id/documents` sigue sin `authenticate`. **Sigue vigente**, sin cambios desde el reporte anterior.

**Falta `trust proxy`** — sigue vigente, condicionado a la configuración real de Render (ver FASE 1, ítem 3).

### BAJO / INFO

- Archivo de debug `server/_csp_test_start.js` sin commitear, sin relación con producción pero debe limpiarse antes de cualquier `git add -A`.
- `.env.example` sigue sin documentar `CLOUDINARY_*` y mantiene `SENDGRID_API_KEY`/`FROM_EMAIL` muertas.
- CSRF: ausencia de mitigación explícita, pero riesgo práctico bajo (ver FASE 1, ítem 4).
- **Positivo verificado:** no hay SQL injection (Sequelize parametrizado en todo `server/src`), CORS con whitelist explícita, rate limiting diferenciado por sensibilidad de ruta, bcrypt 12 rounds, JWT con `algorithms: ['HS256']` explícito, `escapeHtml` aplicado consistentemente en los 6 tipos de email, ninguna ruta admin sin `authenticate`+`authorize` (excepto el caso ya señalado de documentos), no hay endpoint de `forgot-password` (sin superficie de enumeración de usuarios por esa vía), no hay secrets hardcodeados en el código fuente activo (`server/src`, `client/src` — el problema está en archivos de configuración de deploy abandonados, no en el código de aplicación).

---

## FASE 4 — Performance

| # | Hallazgo | Archivo:línea | Impacto | Probabilidad |
|---|---|---|---|---|
| 1 | `UPDATE` síncrono de `views` en cada page view pública de una propiedad (`property.increment('views')`) | `propertyController.js:145,173` | Hot row real bajo picos de tráfico (ej. campaña en redes sociales sobre una sola propiedad); atómico (sin lost-update) pero sin agregación/debounce | Media — depende de tráfico por propiedad individual |
| 2 | `reorderImages` ejecuta N `UPDATE` paralelos sin transacción/bulk | `propertyController.js:484` | Consumo desproporcionado del pool de conexiones (ver FASE 5) para una operación de UI menor | Baja-media |
| 3 | `CalendarPage.jsx` con `limit:500` + filtrado/agrupado por mes en el cliente | `client/src/pages/admin/CalendarPage.jsx:24-25` | Citas fuera de las primeras 500 quedan invisibles sin aviso — mismo patrón sistémico que `LeadsPage` (ya reportado), confirma que no es un caso aislado | Media, crece con el volumen de leads con cita |
| 4 | 3 `queryKey` distintas de React Query para el mismo endpoint `getLeads` (`leads-notifications`, `leads`, `leads-calendar`) | `useNotifications.js:17`, `LeadsPage.jsx:278`, `CalendarPage.jsx:24` | Sin compartición de caché — navegar Dashboard→Leads→Calendario dispara 3 fetches independientes al mismo recurso | Baja hoy, crece linealmente con volumen de leads cargado |
| 5 | Export Excel/PDF carga el inventario completo en memoria sin streaming | `exportController.js` | Bajo con volumen actual — no prioritario salvo crecimiento a miles de registros | Baja |
| 6 | `PropertyCard` sin `React.memo` | `client/src/components/ui/PropertyCard.jsx` | Bajo (12-50 tarjetas en pantalla) | Baja |
| 7 | PDF público de cotización descarga la imagen de Cloudinary en resolución original | `exportController.js`, ruta sin auth en `routes/export.js` | Bajo, pero es un endpoint sin autenticación — conviene que sea liviano | Baja |

**Verificado sin hallazgos relevantes:** React Query con `staleTime` razonable sin refetch agresivo; `buildImageUrl`+`loading="lazy"` aplicados consistentemente; code splitting por ruta correcto; rate limiting calibrado para tráfico regional moderado.

---

## FASE 5 — Base de datos

### Cero uso de `sequelize.transaction()` en todo el backend
`grep -rn "transaction" server/src/` no arroja resultados. Casos concretos con riesgo real de inconsistencia:
- **`promoteProperty` (`propertyController.js:508-522`)**: `Property.update({isPromoted:false}, {where:{isPromoted:true}})` seguido de `property.update({isPromoted:true})` como dos statements separados, no atómicos. Dos admins promoviendo propiedades distintas casi simultáneamente pueden terminar con 0 o 2 propiedades `isPromoted:true`, violando la invariante de negocio ("solo una activa a la vez"). Probabilidad: baja-media (requiere concurrencia real de dos admins). Esfuerzo de fix: bajo (`sequelize.transaction`).
- **`createProperty`**: el primer registro de `PropertyStatusHistory` es fire-and-forget (`.catch(console.error)`) — si falla, la propiedad queda creada sin su historial inicial. Inconsistencia silenciosa, no abortable, pero de bajo impacto real (historial es informativo, no transaccional por diseño).
- **`deleteProperty`**: borra imágenes de Cloudinary en un loop antes de `property.destroy()`. Si el proceso muere a la mitad, quedan registros huérfanos con imágenes ya borradas remotamente. No puede ser 100% atómico (Cloudinary es externo) pero debe documentarse como limitación conocida.

### Ausencia total de índices explícitos, en más tablas de las que señalaba el reporte previo
Ningún modelo Sequelize (`Property`, `Lead`, `Analytics`, `AuditLog`, `PropertyAlert`) define bloque `indexes: []`. El reporte anterior señalaba esto solo para `Property`/`Lead`; se confirma que el alcance es **todo el dominio**, incluyendo las dos tablas de mayor tasa de crecimiento del sistema (`Analytics`, que crece con cada vista pública, y `AuditLog`, que crece con cada mutación admin y no tiene mecanismo de purga/TTL).

### `Analytics` — la consulta más pesada del sistema, sin índice
`analyticsController.js` ejecuta `GROUP BY DATE(createdAt)` con filtro `where: { createdAt: {[Op.gte]: ...} }` para alimentar el Dashboard. Sin índice en `createdAt` (ni compuesto con `propertyId`/`event`), es un full table scan + filesort en cada carga del Dashboard admin. Es la tabla con mayor tasa de crecimiento (cada page view pública, no solo mutaciones admin) — la primera en degradar el sistema.

### `pool: { max: 5 }` (`server/config/db.js`) — amplificador de cualquier query lenta
Combinado con la ausencia de índices, cualquier query con table-scan retiene una conexión más tiempo. Con solo 5 conexiones, varios requests lentos concurrentes (ej. varios admins abriendo el Dashboard a la vez, ~15 queries cada uno) saturan el pool y todas las demás requests — incluidas las públicas — quedan en cola esperando `acquire` (timeout 30s). Convierte "una query lenta" en "el sitio completo no responde". No es un riesgo de producción hoy (tráfico bajo), pero es el primer parámetro a subir cuando el tráfico crezca.

### Hot row confirmado
`property.increment('views')` en cada vista pública individual de una propiedad (ver FASE 4, #1) — mecanismo exacto identificado, no una suposición genérica.

---

## FASE 6 — Calidad del código

### Fuente de verdad fragmentada: labels de dominio (ciudad/tipo/status)
`cityLabel`/`typeLabel` redefinidos de forma independiente en **al menos 7 archivos backend**: `emailService.js:78-79` (y un segundo `typeLabel2` duplicado dentro del propio archivo, línea 260), `whatsappService.js:4`, `exportController.js:11-13`. En frontend existen centralizados en `utils/constants.js` (`CITY_LABELS`, `TYPE_LABELS`) pero **se reinventan localmente en al menos 6 componentes más**: `JobsPage.jsx`, `JobsAdminPage.jsx`, `LeadsPage.jsx`, `CalendarPage.jsx`, `PropertiesPage.jsx`, `AlertSubscriptionForm.jsx`. Hasta 9 copias independientes que deben mantenerse sincronizadas manualmente; el ENUM de los modelos Sequelize es una décima fuente de verdad (lista de ciudades/tipos válidos). Es el hallazgo de calidad de mayor riesgo real: agregar una ciudad nueva exige tocar ~10 lugares sin que nada avise si se olvida uno.

### Patrón de paginación duplicado literalmente en 6 controllers
`page/limit` → `offset` → `findAndCountAll` → `{data, pagination:{total,page,limit,totalPages}}`, copiado en `propertyController.js`, `leadController.js`, `feedbackController.js`, `alertController.js`, `auditController.js`, `testimonialController.js`. Nunca extraído a un helper común.

### Bloque try/catch idéntico repetido en casi cada handler
`console.error('Error en X:', error); return res.status(500).json({ error: 'Error interno del servidor' })` — decenas de ocurrencias, candidato directo a middleware de error centralizado de Express (`app.use((err, req, res, next) => ...)`), nunca implementado.

### Código muerto verificado por referencias
- **`client/src/components/ui/Button.jsx`** — componente completo con variantes y tamaños, cero referencias en todo `client/src` fuera de su propia definición (confirmado con grep). El resto del código construye botones con clases Tailwind inline en cada archivo.
- **`SENDGRID_API_KEY`/`FROM_EMAIL`** en `server/.env.example` — cero referencias en `server/src`/`app.js`/`server.js`/`config`. Residuo de una integración SendGrid abandonada (el proyecto usa Gmail/Nodemailer exclusivamente).
- **`WHATSAPP_NUMBER` hardcodeado en 2 lugares** (`client/src/utils/constants.js`: `'526565792750'`, y `exportController.js`: `COMPANY_WHATSAPP = '526565792750'`) en vez de una sola fuente — un cambio de número de contacto en un solo lado deja el otro canal (PDF vs sitio web) desactualizado.

### Funciones/archivos más grandes (candidatos a dividir)
- `exportController.js` — 841 líneas (ver FASE 2).
- `propertyController.js` — `createProperty` con 7 responsabilidades (ver FASE 2).
- `analyticsController.js` — `getDashboard` con ~165 líneas y ~15 queries secuenciales (sin paralelizar con `Promise.all` donde serían independientes).
- `LeadsPage.jsx` — 500+ líneas con componentes internos que deberían ser archivos propios.

---

## FASE 7 — Testing

### Estado confirmado: cero tests automatizados reales
`npm test` en `server/package.json` es literalmente `echo 'Tests pendientes' && exit 0`. Cero carpetas `__tests__`/archivos `*.test.js`/`*.spec.js`/Cypress/Playwright en todo el repositorio (backend y frontend). El CI (`.github/workflows/ci.yml`) monta un servicio MySQL real para el job `server-test` — **infraestructura lista, ejecutando un no-op**. Esto es peor que no tener pipeline: da una falsa señal de que "los tests pasan".

### Rutas críticas de negocio sin ninguna red de seguridad
1. **`authController.js:42` (`login`)** — comparación de password, emisión de JWT, `lastLogin`. Cualquier cambio en el orden de checks (ej. mover la verificación de `isActive` después de `comparePassword`) podría introducir un bypass sin que nada lo detecte.
2. **`leadController.js:9` (`createLead`)** — único punto de entrada de negocio para todo el sitio público. Efectos secundarios no transaccionales (2 emails async, `Analytics.create`, evento SSE), todos best-effort. Sin test que fije ese contrato.
3. **Lógica de `auctionDate`/`acquisitionStage`/precio `null`="PENDIENTE"** (`propertyController.js`) — el dominio más específico y más propenso a malinterpretarse en un refactor automatizado, sin ningún test que documente el contrato.
4. **`exportController.js`** — el archivo más grande del repo, con su propia copia de labels/formatters, cero cobertura.
5. **`authMiddleware.js`/`roleMiddleware.js`** — único gate entre rutas admin y público; la variante `authenticateSSE` (JWT por query string) es una superficie de auth distinta nunca ejercida en CI.

---

## FASE 8 — UX

(Base: hallazgos verificados del reporte previo del 2026-06-18, re-contextualizados con los cambios del working tree actual; no se repiten como descubrimiento propio, se marca explícitamente qué cambió.)

- **Drag & drop del Kanban de leads solo funciona con mouse** (`LeadsPage.jsx`) — sin soporte táctil ni alternativa de botón "mover a siguiente estado". Sigue vigente, sin cambios en el diff actual.
- **`Lightbox.jsx` sin `role="dialog"`/`aria-modal`, sin focus trap** — botones de control sin `aria-label`. Sigue vigente.
- **Botones hamburguesa/menú sin `aria-label`/`aria-expanded`** en `Navbar.jsx`, `AdminLayout.jsx`, botón mostrar/ocultar contraseña en `LoginPage.jsx`. Sigue vigente.
- **Contraste insuficiente** (`text-gray-400` sobre fondo blanco, ~2.8:1, bajo WCAG AA 4.5:1) en metadatos/fechas a lo largo de varias páginas. Sigue vigente.
- **Campo teléfono nuevo (`AlertSubscriptionForm.jsx`) sin validación de formato visible al usuario** — coherente con el hallazgo de seguridad de FASE 3 (sin validación end-to-end), pero aquí el ángulo es de UX: el usuario puede escribir cualquier cosa y no se entera de que el número es inválido hasta que (quizás nunca) reciba o no un WhatsApp.
- **Verificado y corregido respecto a lo que se temía inicialmente:** el botón "Enviar WhatsApp" en `LeadsPage.jsx` (`LeadDetailPanel`) **sí** tiene manejo de error visible (`onError: toast.error`) y de éxito (`toast.success` / aviso `data.warning`) — el frontend no falla silenciosamente. El problema real de esta feature está en el backend (pérdida de audit log, FASE 3), no en la UX del botón. Se documenta este matiz para no sobre-reportar.
- **`PageFallback` (`App.jsx`) es solo un spinner sin texto ni `aria-live`** — mejorable para conexiones móviles lentas. Sigue vigente.

No se relanzó una auditoría de accesibilidad completa en esta pasada porque ningún cambio del working tree actual toca componentes de UI compartidos (Lightbox, Navbar, AdminLayout); el diff se limita a `AlertSubscriptionForm.jsx` y `LeadsPage.jsx`, ambos cubiertos arriba con verificación directa del código actual.

---

## FASE 9 — DevOps

### Pipeline: el único gate real es ESLint + build, no tests
CI (`.github/workflows/ci.yml`) ejecuta lint primero (`server-lint`, `client-lint`), y `server-test`/`client-build` dependen de ellos vía `needs:` — el orden de jobs está bien diseñado, pero el job de tests es el placeholder ya descrito (FASE 7). `eslint.config.js` (server) tiene `no-console: 'off'` y solo `no-unused-vars` como warning — análisis estático mínimo, sin reglas de seguridad (`eslint-plugin-security`, `eslint-plugin-sonarjs` no están configuradas).

**Lo que sí está bien hecho:** CodeQL (`.github/workflows/codeql.yml`) y `npm audit` (`security.yml`) corren en push a main/develop más cron semanal — es la parte más robusta del pipeline y vale la pena resaltarlo como acierto, no solo como crítica.

### Sin logging ni monitoreo estructurado en producción
Cero `winston`/`pino`/`morgan`/Sentry en todo el proyecto — todo el observability es `console.log`/`console.error` (confirmado en 16+ archivos). En Render esto va a stdout sin structured logging ni alerting. Diagnosticar un incidente real depende de leer logs crudos sin trazabilidad ni niveles de severidad.

### Tres configuraciones de deploy distintas conviviendo en el repo
`server/web.config` (IIS/httpPlatformHandler apuntando a `site4now.net`), `netlify.toml` (raíz, apunta `client` a Netlify), y la configuración real activa para Render (descrita en `CLAUDE.md`: build único que compila a `server/client/`). Esto genera confusión real sobre cuál es la fuente de verdad de producción para cualquier persona nueva en el proyecto — y los dos primeros, al estar abandonados pero presentes, son además el vector del hallazgo crítico de credenciales (FASE 3).

### Sin estrategia de rollback documentada
Servicio único en Render; un deploy roto requiere revertir el commit y esperar el siguiente build. No hay blue/green ni feature flags. Razonable para el tamaño actual del equipo, pero debe ser una decisión consciente y documentada, no implícita.

### Residuos de depuración sueltos en el repo
`server/_csp_test_start.js` (sin commitear), `server/production_site8_3494768.tar.gz.backup` (26MB, commiteado), `server/update-admin.js` (commiteado) — todos deberían limpiarse o moverse fuera del control de versiones.

---

## FASE 10 — Escalabilidad

Proyección basada en el código real (modelos, índices, configuración de pool), no en supuestos genéricos:

- **100 usuarios / 100 registros:** sin síntomas. Todo cabe en buffer pool de MySQL; cualquier query sin índice resuelve en microsegundos. `pool.max:5` sobra.
- **1,000 usuarios / 1,000 registros:** sin síntomas perceptibles. `Analytics` empieza a acumular más rápido que `Property`/`Lead` (1 fila por vista pública, no por mutación admin), pero 1,000 filas siguen siendo triviales.
- **10,000 registros:** en `Analytics`, el `GROUP BY DATE(createdAt)` del Dashboard (sin índice) empieza a mostrar latencia perceptible (decenas-cientos de ms) por full scan + filesort. `getAuditLogs` con `ORDER BY createdAt DESC` se notaría igual si hay 10K+ acciones admin acumuladas (poco probable a este volumen salvo alta actividad). `properties`/`leads` aún resuelven rápido porque MySQL cachea la tabla completa en RAM.
- **100,000 propiedades:** `getProperties` (`propertyController.js`) — el filtro `where.status != 'vendido'` + `ORDER BY isFeatured DESC, createdAt DESC` sin índices en esas columnas fuerza un scan completo de 100K filas + filesort **en el endpoint con más tráfico de todo el sistema** (el listado público). Con `pool.max:5`, varias requests concurrentes de este endpoint saturan el pool y arrastran al resto del sitio (público + admin). **Este es el punto de quiebre más probable y más visible al usuario final**, no uno hipotético.
- **1,000,000 de leads/auditoría:** el `COUNT(*)` exacto de `findAndCountAll` en `getLeads` sobre 1M de filas sin índice en `status`/`propertyId`/`createdAt` es costoso por sí solo, independientemente del `LIMIT/OFFSET` (que ya está correctamente implementado server-side, a diferencia de `LeadsPage`/`CalendarPage` en frontend). Mismo problema, más agudo, en `AuditLog` si no hay purga — no existe ningún mecanismo de retención/TTL en el modelo. `CalendarPage.jsx` con `limit:500` se queda definitivamente corto y oculta citas sin ningún indicador visual al usuario.

**Cuello de botella ordenado por cuándo se manifestaría primero:** (1) Dashboard de Analytics a ~10K vistas, (2) listado público de propiedades a ~100K registros (el más grave, por ser tráfico público + amplificado por `pool.max:5`), (3) AuditLog/Leads a escala de 1M sin política de retención.

---

## FASE 11 — Producto

### Funcionalidad activa en producción local sin versionar
`server/src/services/whatsappService.js` está en `git status` como `??` (untracked) pero ya está integrado activamente en `propertyController.js` y `leadController.js` — es una feature de negocio en uso que no está en control de versiones. Si se pierde el working tree (un `git clean -fd` accidental, un cambio de máquina), se pierde la feature completa silenciosamente, sin ningún registro de qué se implementó.

### Desincronización backend/frontend en labels de dominio (ver también FASE 6)
`exportController.js` genera PDFs/Excel para uso administrativo/legal con su propia copia de `cityLabel`/`typeLabel`/`statusLabel`, separada de `client/src/utils/constants.js`. Si se agrega una ciudad o tipo de propiedad nuevo, el sitio web lo mostrará correctamente pero los reportes exportados (que en este dominio tienen valor legal/administrativo) mostrarán el valor crudo del enum. CLAUDE.md no documenta que existe esta segunda copia — riesgo real de que se actualice un lado y se olvide el otro.

### Mapeo backend↔frontend, verificado limpio
No se detectaron endpoints de backend sin consumo desde `client/src/services` — el mapeo de rutas es 1:1 entre `alerts`, `analytics`, `audit`, `auth`, `export`, `feedback`, `jobs`, `leads`, `properties`, `testimonials`, `users`. **Verificado y descartado como hallazgo** — es un acierto, no una omisión.

### Sin marcadores de trabajo a medias en el código fuente
No hay `TODO`/`FIXME`/`HACK` en `client/src`/`server/src` — contrasta favorablemente con la cantidad de archivos sueltos de debug fuera de `src/` (ver FASE 9). El código fuente en sí no deja features a medio construir.

---

## FASE 12 — Riesgos para desarrollo con IA

1. **Fuente de verdad duplicada de labels de dominio (~10 copias)** — la más peligrosa para un agente de IA, porque CLAUDE.md documenta `utils/constants.js` como "la" fuente de verdad pero no menciona las copias en `exportController.js`, `emailService.js`, `whatsappService.js` ni los selects locales de componentes. Una IA que edite solo el lugar "obvio" deja el resto desincronizado sin ningún error visible.
2. **`WHATSAPP_NUMBER`/teléfono de empresa hardcodeado en 2 lugares** (`client/src/utils/constants.js` y `exportController.js`) — mismo patrón de riesgo en miniatura.
3. **`server.js` como sistema de migraciones implícito** (`runMigrations()`, sin tabla de versión, sin rollback, ejecutado en cada arranque) — una IA que agregue una columna al modelo Sequelize sin replicar el bloque correspondiente aquí: funciona en local con `alter:true` manual, pero en producción (`sync({alter:false})`) la columna nunca se crea — fallo silencioso hasta que algo intenta leer/escribirla.
4. **`createLead` con efectos colaterales no documentados y deliberadamente no atómicos** (`leadController.js:9-67`) — 2 emails async sin await + `Analytics.create` async sin await + evento SSE, todos con `.catch(console.error)` aislado. El contrato implícito ("responder rápido al lead público, notificaciones best-effort") no está documentado en ningún comentario; una IA que "limpie" esto con `await Promise.all(...)` cambiaría silenciosamente la latencia percibida por el usuario público.
5. **CSP de doble política por path en `app.js`** (`docsCsp` vs `publicCsp`) — bien comentado (acierto, poco común verlo así), pero frágil ante reordenamiento de middlewares de Express; ningún test ni lint lo protege.
6. **Archivos de configuración de deploy abandonados con secretos reales** (FASE 3/9) — el mayor riesgo de "IA que ayuda de más": un agente con permiso de `git add -A` podría re-commitear o exponer estos archivos en un PR sin saber que ya están comprometidos, o un agente que lea el repo completo para dar contexto podría filtrar las credenciales en un resumen o log.

---

# CTO FINAL REVIEW

## Top 25 problemas reales (orden de severidad real, no de aparición)

1. Credenciales de producción reales committeadas en `HEAD` con remoto en GitHub (`web.config`, `update-admin.js`, backup 26MB) — FASE 3.
2. Cero tests automatizados con CI ejecutando un placeholder que siempre da verde — FASE 7.
3. `sync({alter:false})` + migraciones manuales no versionadas en `server.js` — riesgo de desincronización esquema↔modelo — FASE 5/12.
4. `updateProperty` no notifica alertas (email+WhatsApp) al reactivar una propiedad — FASE 1/2/3.
5. Pérdida de audit log/nota cuando falla el envío de WhatsApp de seguimiento de leads — FASE 3.
6. Lógica de matching de alertas embebida en `propertyController.createProperty` en vez de un servicio dedicado — FASE 2.
7. `createProperty` con 7 responsabilidades distintas en una sola función — FASE 2/6.
8. Ausencia de índices en `Property`, `Lead`, `Analytics`, `AuditLog`, `PropertyAlert` — FASE 5.
9. `Analytics` sin índice en `createdAt`, consultada con `GROUP BY DATE()` en el Dashboard — primer cuello de botella esperado — FASE 5/10.
10. `pool.max:5` amplifica cualquier query lenta a una caída total del sitio — FASE 5/10.
11. `getProperties` (listado público) sin índices en columnas de filtro/orden — punto de quiebre más visible al usuario final a 100K propiedades — FASE 10.
12. Notificaciones masivas WhatsApp+email sin control de concurrencia — riesgo de suspensión de cuenta de Meta — FASE 3.
13. Validación de teléfono ausente end-to-end (frontend, modelos, `toE164` no defensivo) — FASE 3.
14. Cero uso de `sequelize.transaction()` en operaciones multi-tabla (`promoteProperty` con riesgo de doble-promoción concurrente) — FASE 5.
15. ~10 copias independientes de labels de ciudad/tipo/status sin fuente de verdad única — FASE 6/11/12.
16. `exportController.js` (841 líneas) mezclando datos+Excel+PDF+branding con sus propias copias de labels — FASE 2/6/11.
17. `whatsappService.js` (feature activa en producción local) sin commitear — FASE 11.
18. Documentos legales de propiedades expuestos sin autenticación (`GET /:id/documents`) — FASE 3.
19. Validación de subida de archivos por extensión/mimetype declarado, sin magic bytes — FASE 3.
20. Sin logging estructurado ni monitoreo en producción (solo `console.log`) — FASE 9.
21. Tres configuraciones de deploy distintas conviviendo (IIS/Netlify/Render) — confusión operativa real — FASE 9.
22. Patrón de paginación duplicado en 6 controllers sin helper común — FASE 6.
23. `client/components/ui/Button.jsx` código muerto confirmado por referencias — FASE 6.
24. Drag & drop de Kanban de leads inoperable en touch/móvil — FASE 8.
25. Falta `trust proxy` (condicionado a configuración de Render) — FASE 3.

## Top 10 quick wins (<1 hora)

1. Rotar `JWT_SECRET`, `DB_PASSWORD`, `EMAIL_PASS` ya mismo (la rotación en sí, no la limpieza del historial de git).
2. Agregar `app.set('trust proxy', 1)` en `server/app.js`.
3. Agregar `sequelize.transaction()` a `promoteProperty` (dos statements → uno transaccional).
4. Eliminar `client/src/components/ui/Button.jsx` (código muerto confirmado) o adoptarlo en un componente nuevo.
5. Eliminar `SENDGRID_API_KEY`/`FROM_EMAIL` de `.env.example`, agregar `CLOUDINARY_*` que faltan.
6. Borrar `server/_csp_test_start.js` y agregar `*.tar.gz.backup`, `web.config`, `update-admin.js` a `.gitignore` (no resuelve la exposición en historial, pero evita reincidencia).
7. Agregar `React.memo` a `PropertyCard`.
8. Centralizar `WHATSAPP_NUMBER` en una sola constante importada por `exportController.js` y el frontend.
9. Cambiar `text-gray-400` a `text-gray-500`/`600` en metadatos sobre fondo blanco (contraste WCAG AA).
10. Agregar `pattern` HTML al input de teléfono en `AlertSubscriptionForm.jsx` (validación mínima de formato en frontend).

## Top 10 mejoras (1 día)

1. Extraer `alertService.notifyMatchingAlerts(property)` y llamarlo desde `createProperty` y `updateProperty` — resuelve el bug #4 del Top 25.
2. Capturar errores de WhatsApp por separado en `leadController.js` y garantizar que la `LeadNote`/audit log se cree siempre, incluso si falla el envío.
3. Agregar índices a `Property` (`status`, `city`, `isFeatured`, `auctionDate`), `Lead` (`status`, `propertyId`), `Analytics` (`createdAt`, `propertyId`).
4. Extraer `utils/pagination.js` y reemplazar el bloque duplicado en los 6 controllers.
5. Crear `server/src/utils/labels.js` único y reemplazar las copias en `emailService.js`, `whatsappService.js`, `exportController.js`.
6. Validar formato de teléfono en modelo (Sequelize `validate`) + frontend (regex), y hacer `toE164` defensivo ante `null`/no-string.
7. Proteger `GET /properties/:id/documents` con `authenticate` o separar documentos públicos/privados con flag `isPublic`.
8. Agregar magic-byte validation (`file-type`) a `uploadMiddleware.js` para documentos.
9. Limitar concurrencia de envíos masivos de WhatsApp/email (batch con `Promise.allSettled` + límite de N simultáneos).
10. Commitear `whatsappService.js` y el resto de cambios pendientes del working tree (feature en riesgo de pérdida).

## Top 10 mejoras (1 semana)

1. Purgar el historial de git de los 4 archivos con secretos (`git filter-repo`/BFG) y coordinar el force-push con el equipo.
2. Implementar middleware de error centralizado en Express, reemplazando los ~10+ bloques try/catch idénticos.
3. Escribir tests de los 5 puntos críticos identificados en FASE 7 (login/JWT, `createLead`, lógica de `auctionDate`/precio null, export, middleware de auth) — reemplazar el placeholder de `npm test`.
4. Dividir `exportController.js` en módulos: obtención de datos / generación Excel / generación PDF / branding compartido con `emailService.js`.
5. Dividir `createProperty` en pasos explícitos (validación → persistencia → side-effects vía servicio).
6. Paginar `LeadsPage.jsx` y `CalendarPage.jsx` correctamente (usar `data.pagination` del backend en vez de `limit` fijo).
7. Unificar `queryKey` de React Query para `getLeads` entre `useNotifications`, `LeadsPage`, `CalendarPage`.
8. Implementar logging estructurado mínimo (`pino` o `winston`) en reemplazo de `console.log`/`console.error`.
9. Accesibilidad: focus trap + `aria-label`/`aria-modal` en `Lightbox.jsx`, reemplazar `<div onClick>` por `<button>` en Kanban/lista de leads.
10. Documentar y decidir explícitamente cuál es la única configuración de deploy vigente (Render), y eliminar/archivar `web.config`/`netlify.toml` fuera del repo de producción.

## Top 10 mejoras (1 mes)

1. Migrar `sync({alter:false})` a un sistema de migraciones formal (Sequelize CLI o Umzug) con historial versionado y rollback.
2. Suite de tests de integración con MySQL real (ya hay infraestructura de CI lista) cubriendo los flujos críticos de negocio end-to-end.
3. Agregar `Promise.all`/paralelización donde sea seguro en `analyticsController.getDashboard` (~15 queries secuenciales).
4. Implementar control de concurrencia optimista (columna `version`) en `Property`/`Lead` para ediciones multiusuario.
5. Monitoreo activo de producción (Sentry o equivalente) con alertas reales, no solo logs pasivos.
6. Política de retención/TTL para `AuditLog` (o archivado a almacenamiento frío) antes de que crezca sin control.
7. Soporte táctil completo para el Kanban de leads (botones "mover a siguiente estado" como alternativa al drag&drop).
8. Auditoría de accesibilidad completa con corrección sistemática (no solo los puntos señalados, sino una pasada con axe-core/Lighthouse).
9. Health-check periódico del token de WhatsApp Business (detección proactiva de expiración, no reactiva).
10. Evaluar Redis Pub/Sub para SSE si el negocio crece a multi-instancia (hoy no es necesario, documentarlo como decisión consciente).

## Top 10 riesgos de producción

1. Compromiso total del backend vía JWT forjado con el secreto expuesto en git (si el secreto no ha sido rotado).
2. Pérdida de trazabilidad legal de seguimiento de leads si falla WhatsApp (audit log no se crea).
3. Suspensión de la cuenta de WhatsApp Business de Meta por notificaciones masivas sin control de concurrencia/validación.
4. Caída total del sitio (público + admin) por saturación del pool de conexiones bajo tráfico concurrente con queries sin índice.
5. Propiedades reactivadas que nunca notifican a suscriptores (alertas "rotas" silenciosamente).
6. Pérdida de la feature de WhatsApp completa si se descarta el working tree sin commitear.
7. Fuga de documentos legales de propiedades vía el endpoint sin autenticación.
8. Despliegue mal configurado por `.env.example` desactualizado (faltan Cloudinary, sobra SendGrid).
9. Doble-promoción o ninguna promoción activa por race condition en `promoteProperty`.
10. Diagnóstico lento de incidentes reales por falta de logging estructurado/monitoreo.

## Top 10 riesgos de negocio

1. Reportes exportados (PDF/Excel) con datos legales/administrativos incorrectos si se agrega una ciudad/tipo y se olvida sincronizar `exportController.js`.
2. Pérdida de leads/oportunidades de venta por alertas que nunca se disparan al reactivar propiedades.
3. Daño reputacional/legal por spam de WhatsApp a terceros no consintientes (números mal validados).
4. Exposición de credenciales institucionales (Gmail, BD) con impacto más allá del sistema (acceso a correo institucional real).
5. Imposibilidad de defender ante un cliente/comité que "todo está probado" cuando el CI ejecuta un placeholder.
6. Citas de seguimiento invisibles en `CalendarPage` más allá de las primeras 500 — citas perdidas operativamente.
7. Confusión operativa sobre el entorno de deploy real (3 configuraciones conviviendo) ante un incidente urgente.
8. Costos ocultos de soporte por degradación de performance no anticipada al crecer el inventario.
9. Dependencia de un solo desarrollador/máquina para una feature de negocio activa no versionada (WhatsApp).
10. Riesgo de incumplimiento de políticas de Meta/WhatsApp Business por volumen no controlado, afectando un canal de negocio completo.

## Top 10 refactors con mayor retorno

1. `alertService.notifyMatchingAlerts(property)` — resuelve el bug de negocio más visible con el menor esfuerzo.
2. `utils/labels.js` único — elimina la fuente de verdad más fragmentada del proyecto (~10 copias).
3. Middleware de error centralizado en Express — elimina decenas de bloques try/catch idénticos.
4. `utils/pagination.js` — elimina duplicación en 6 controllers de un solo golpe.
5. División de `exportController.js` en módulos — el archivo más grande, mayor ganancia de mantenibilidad.
6. Servicio dedicado para WhatsApp con manejo de errores que no descarte el audit log.
7. División de `createProperty` en pasos explícitos con servicio de side-effects.
8. Migración a Sequelize CLI/Umzug — elimina el riesgo de desincronización esquema↔modelo de raíz.
9. Logging estructurado — habilita observabilidad real para todos los refactors futuros (sin esto, cualquier regresión es invisible).
10. Suite mínima de tests sobre los 5 puntos críticos — habilita refactors futuros sin miedo a romper producción silenciosamente.

## Roadmap técnico priorizado

**Semana 0 (inmediato, antes de cualquier otra cosa):** rotar credenciales expuestas; commitear/proteger `whatsappService.js`; `trust proxy`; transacción en `promoteProperty`.

**Semanas 1-2:** purgar historial de git de secretos (coordinado); `alertService.notifyMatchingAlerts`; fix de audit log en fallo de WhatsApp; índices en `Property`/`Lead`/`Analytics`; validación de teléfono end-to-end; protección de `/documents`.

**Mes 1:** middleware de error centralizado; `utils/labels.js` y `utils/pagination.js`; división de `exportController.js`; control de concurrencia para notificaciones masivas; magic-byte validation en uploads.

**Meses 2-3:** suite de tests sobre flujos críticos (reemplazar el placeholder de CI con sustancia real); logging estructurado/monitoreo; migración a Sequelize CLI/Umzug; paginación real en `LeadsPage`/`CalendarPage`; accesibilidad sistemática.

**Mes 4+ (según crecimiento real del negocio, no por defecto):** control de concurrencia optimista multiusuario; política de retención de `AuditLog`; Redis Pub/Sub para SSE si se escala a multi-instancia; soporte táctil completo del Kanban.

## Orden exacto en el que resolvería cada problema (como CTO responsable)

1. Rotar todas las credenciales expuestas (JWT_SECRET, DB_PASSWORD, EMAIL_PASS) — es el único hallazgo donde cada hora de demora es riesgo activo, no acumulado.
2. Commitear `whatsappService.js` y el resto del working tree pendiente — proteger trabajo de negocio ya construido de una pérdida accidental.
3. `trust proxy` + transacción en `promoteProperty` — correcciones de una línea con riesgo de regresión nulo.
4. `alertService.notifyMatchingAlerts` (resuelve simultáneamente el bug de `updateProperty` y el coupling arquitectónico).
5. Fix de audit log/nota en fallo de WhatsApp en `leadController.js`.
6. Validación de teléfono end-to-end + límite de concurrencia en notificaciones masivas (mismo sprint, mismo dominio).
7. Protección de `/properties/:id/documents` + magic-byte validation en uploads.
8. Índices en `Property`, `Lead`, `Analytics` (preventivo, antes de que el inventario crezca).
9. `utils/labels.js` + `utils/pagination.js` (deuda técnica de mayor apalancamiento, antes de que el equipo crezca y la duplicación se multiplique).
10. Middleware de error centralizado + logging estructurado (habilita diagnosticar todo lo anterior en producción).
11. Purga del historial de git de los secretos (coordinada, no urgente una vez rotadas las credenciales, pero no debe olvidarse).
12. División de `exportController.js`/`createProperty` (mantenibilidad, sin presión de fecha).
13. Suite de tests sobre los 5 puntos críticos (reemplazo real del placeholder de CI).
14. Migración a Sequelize CLI/Umzug.
15. Accesibilidad, soporte táctil del Kanban, y el resto del backlog de UX — sin urgencia técnica, pero con valor real para el usuario final.

---

## Veredicto final

El proyecto mantiene la base sólida ya identificada en la auditoría previa (separación de capas, decisiones de arquitectura razonables, buenas prácticas de frontend) y ha corregido correctamente los 3 hallazgos más graves de esa ronda (registro admin abierto, XSS en emails, ausencia de helmet). Sin embargo, esta auditoría más profunda encontró un hallazgo de severidad superior a todo lo identificado antes: **credenciales reales de producción committeadas en el historial de git con remoto activo en GitHub**, que requiere acción inmediata independiente de cualquier otra prioridad. Más allá de eso, el patrón dominante de esta ronda no es "bugs aislados" sino **fragmentación de fuentes de verdad** (labels de dominio en ~10 lugares, validación de teléfono en ningún lugar consistente, configuración de deploy en 3 lugares distintos) y **ausencia total de mecanismos que detecten regresiones** (cero tests reales, cero transacciones, cero logging estructurado) — el tipo de deuda técnica que no rompe nada hoy, pero que convierte cualquier cambio futuro, humano o asistido por IA, en una apuesta sin red de seguridad.
