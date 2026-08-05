# Auditoría de revisión final — post-limpieza del proyecto

**Fecha:** 2026-08-04
**Rol:** Staff Software Engineer / Code Auditor
**Alcance:** `client/` (React 19 + Vite) y `server/` (Node/Express 5 + Sequelize/MySQL), monorepo completo.
**Naturaleza:** revisión de solo lectura. No se modificó, movió, renombró ni eliminó ningún archivo del proyecto durante esta auditoría.

## Contexto

Esta es la **revisión final** posterior a una serie de tareas de limpieza ya completadas (eliminación de código muerto, consolidación de lógica duplicada, limpieza de exports, instrumentación de endpoints legacy, adopción de `ApiError`, unificación de Swagger). Existen dos auditorías previas de solo lectura en la raíz del repo que sirvieron de línea base:

- `AUDITORIA_LIMPIEZA_PROYECTO.md` (2026-08-03 14:20)
- `AUDITORIA_SERVICIOS_SIN_CONSUMIDOR.md` (2026-08-03 20:27)

Entre esa línea base y hoy se integraron 5 commits adicionales:

| Commit | Fecha | Mensaje |
|---|---|---|
| `519fd04` | 2026-08-03 20:20 | feat: se adoptop apierror en todo el backend |
| `714f331` | 2026-08-03 21:46 | feat: limpieza de exports no utilizados |
| `339b869` | 2026-08-03 22:10 | feat: se instrumentaron endpoint legacy |
| `7374440` | 2026-08-03 22:25 | feat: se integro sistema de permisos del frontend |
| `51d062d` | 2026-08-04 10:12 | feat: se unifico la api de documentacion swagger |

También se detectaron, fuera de esa lista, otros 3 commits del mismo día 2026-08-03 (`fb31dd3` consolidación de creación de usuarios, `f90bf49` centralización de teléfono/animaciones, `3f419de` eliminación de assets huérfanos, `62199f8` centralización de formato de fechas/precios) que ya habían resuelto varios hallazgos de la primera auditoría antes de que se escribiera la segunda.

**Metodología:** validaciones ejecutadas directamente (tests, lint, build, `npm audit`) más 4 investigaciones paralelas evidenciadas por grep/lectura de código/`git show`/diffs sobre backend, frontend, endpoints+Swagger, y dependencias+assets+documentación. Cada hallazgo de las auditorías previas fue re-verificado con evidencia fresca, no asumido.

---

## 1. Resumen ejecutivo

El proyecto está en buen estado general. La ronda de limpieza fue en gran parte exitosa y autocorrectiva: la mayoría de los hallazgos de `AUDITORIA_LIMPIEZA_PROYECTO.md` ya fueron resueltos por commits del mismo día, antes incluso de que se le pidiera a alguien hacerlo. Todas las suites de tests pasan, el build de producción es exitoso, y el lint no tiene errores (solo warnings esperados de `eslint-plugin-security`).

Sin embargo, la revisión final **no puede cerrarse sin pendientes**: se encontraron 2 hallazgos nuevos de bajo riesgo en frontend, 1 hallazgo nuevo en backend (guard de `headersSent` inconsistente en exportación), 1 dependencia nueva sin uso, 1 vulnerabilidad de dependencia runtime a vigilar (aunque de explotabilidad baja en este contexto), una brecha de cobertura de Swagger mucho mayor de lo que sugiere el nombre del commit que la introdujo, y una documentación de proyecto (`CLAUDE.md`, `IMPLEMENTATION_MASTER_PLAN.md`, ausencia de `README.md` raíz) que quedó desactualizada frente al sistema de roles CRM ya en producción.

| Categoría | Resultado |
|---|---|
| Tests backend | ✅ 189/189 pasan (23 suites) |
| Tests frontend | ✅ 19/19 pasan (2 archivos) |
| Lint backend | ✅ 0 errores / 12 warnings (baseline `security/*`, sin cambios) |
| Lint frontend | ✅ 0 errores / 27 warnings (baseline `security/*` + 1 warning de React Compiler ya conocida) |
| Build de producción | ✅ exitoso, gate `check-deploy-safety.js` pasa |
| Código muerto real | Muy poco — casi todo lo señalado en 2026-08-03 ya fue limpiado; quedan 2-3 ítems puntuales de bajo riesgo |
| Endpoints sin consumidor | 9 de 10 siguen igual que el 03-08 (solo `reopenLead` ganó UI) |
| Cobertura de Swagger | 8 de 101 rutas documentadas (8%) pese al commit "unificación" |
| Dependencias sin uso confirmadas | 1 nueva (`nodemon` en `client/package.json`) |
| Vulnerabilidades de dependencias | 1 alta en runtime (`react-router-dom`, explotabilidad baja aquí), 1 alta transitiva de bajo riesgo (`ip-address`), 2 dev-only de baja prioridad |
| Assets huérfanos | 0 (los 4 previos ya se eliminaron); `favicon.svg` sigue sin referencia explícita |
| Documentación desactualizada | `CLAUDE.md` no menciona el sistema de roles CRM; sin `README.md` raíz; `IMPLEMENTATION_MASTER_PLAN.md` con 2 filas resueltas sin marcar y bitácora desactualizada desde 2026-07-22 |

---

## 2. Código muerto encontrado

### 2.1 Ya resuelto por commits del propio 2026-08-03 (verificado, no requiere acción)

| Hallazgo original | Commit que lo resolvió | Evidencia |
|---|---|---|
| `client/src/utils/animations.js`: `fadeInDown`, `scaleIn`, `staggerContainerFast`, `pageTransition`, `cardHover` sin uso | `f90bf49` | Archivo actual (53 líneas) solo exporta `fadeIn`, `fadeInUp`, `fadeInLeft`, `fadeInRight`, `staggerContainer`, `scrollReveal`, `buttonHover`, `buttonTap` — todos en uso confirmado |
| Assets huérfanos (`hero.png`, `react.svg`, `vite.svg`, `client/public/icons.svg`) | `3f419de` | `client/src/assets/` está vacío; commit de eliminación confirmado por `git log` |
| Regex de teléfono duplicado en `ContactForm.jsx`/`AlertSubscriptionForm.jsx` | `f90bf49` | Nuevo `client/src/utils/phone.js` (`PHONE_PATTERN`), ambos formularios lo importan (`ContactForm.jsx:8,95-96`, `AlertSubscriptionForm.jsx:9,117-118`) |
| Formateo ad-hoc de fecha/precio bypasseando `formatPrice`/`formatDate` | `62199f8` | Los 3 casos genuinamente duplicados en `PropertyFormPage.jsx` migrados; los otros 6 quedaron documentados como excepciones legítimas caso por caso en `AUDITORIA_FORMATO_FECHAS_PRECIOS.md` (inputs editables sin símbolo de moneda, formatos de fecha de un solo uso no cubiertos por los helpers) |
| `server/src/utils/corsOrigins.js`: `allowedOrigins`/`isDevLocalOrigin` exportados sin uso externo | `714f331` | `module.exports` reducido a `{ isOriginAllowed }` |
| `server/src/services/exportBranding.js`: `ST_RED`/`ST_RED_ARGB` sin uso | `714f331` | Ambos removidos de `module.exports` |
| `ApiError` exportado pero nunca instanciado | `519fd04` | `throw new ApiError(...)` confirmado en los 18 controladores; `errorHandler.test.js` (5 casos) verificado línea por línea contra la implementación real |
| Duplicación `authController.register()` vs `usersController.createUser()` | `fb31dd3` (anterior a los 5 commits revisados, mismo día) | Nuevo `server/src/services/userService.js` (`createUser`, `safeUser`, `VALID_CRM_ROLES`) es ahora la única fuente de verdad; ambos controladores delegan en él |
| `client/src/utils/permissions.js`: `hasCrmAccess` sin consumidor | `7374440` | `AdminLayout.jsx:78` ahora usa `hasCrmAccess(user)` para mostrar/ocultar el grupo "CRM Comercial" del sidebar |

### 2.2 Confirmado aún presente (bajo riesgo, no urgente)

| Hallazgo | Estado | Evidencia |
|---|---|---|
| `server/src/utils/pagination.js` `MAX_LIMIT` sin usar; `appointmentController.js` sigue hardcodeando `500` | **Sin resolver** — el commit `714f331` de limpieza de exports no tocó estos archivos | `appointmentController.js:17,33` siguen con el literal `500`; nota: no es el mismo valor que `MAX_LIMIT` (que es `100`), así que no es un caso de "usar la constante existente" trivial — requiere decidir si 500 es un límite deliberadamente distinto y, de serlo, expresarlo como su propia constante nombrada en vez de un literal repetido |
| `authController.js` inlinea `{id,name,email,role,crmRole}` en `register`/`login` en vez de `safeUser()` | **Sin resolver, deliberado y documentado** | `REPORTE_CONSOLIDACION_CREACION_USUARIOS.md:53` explica que `safeUser()` expone campos adicionales (`isActive`, `profilePhoto`, `lastLogin`, `createdAt`) que cambiarían el contrato de respuesta de `register`; decisión consciente, no descuido |
| `client/src/utils/permissions.js`: `isCapturista`, `isAsesor`, `seesAllLeads` siguen sin consumidor | **Sin resolver, bajo riesgo** | El commit `7374440` conectó `hasCrmAccess`, y agregó y conectó `isAdmin`/`canEditLead` (nuevos), pero no los 3 símbolos originalmente señalados. La visibilidad de fila por rol ya se aplica 100% en el backend (`leadAccess.js:getLeadVisibilityWhere`, aplicado en `leadController.js:382`), por lo que el frontend no necesita replicar ese filtro — arquitectónicamente correcto que sigan sin uso, pero si no se van a conectar como ayuda de UI adicional, son candidatos a limpieza |
| 8 wrappers de servicio frontend sin consumidor (`deleteAppointment`, `getMe`, `changePassword`, `getDealById`, `getPositionById`, `getLeadTasks`, `reassignTask`, `getTestimonialById`) | **Sin cambios desde el 03-08** | Ver sección 3 (Endpoints) — la mayoría son gaps de producto documentados en `AUDITORIA_SERVICIOS_SIN_CONSUMIDOR.md`, no basura |
| `client/public/favicon.svg` sin referencia explícita | **Sin cambios, confianza media** | `index.html` solo referencia `/logo.png`; los navegadores pueden solicitar `/favicon.svg` por convención aunque no haya `<link>` — no eliminar sin confirmar |

### 2.3 Hallazgos nuevos (no detectados en las auditorías previas)

| Hallazgo | Severidad | Evidencia |
|---|---|---|
| **`server/src/controllers/exportController.js`: guard de `res.headersSent` inconsistente entre las 5 funciones de exportación con streaming** | Media (bug latente preexistente, no introducido por la migración a `ApiError`, pero recién documentado con evidencia de línea) | Solo `exportPropertyQuotePDF` (línea 887) chequea `!res.headersSent`, y únicamente en la rama `ApiError` — si ocurre un error no-`ApiError` a mitad del streaming del PDF (headers ya enviados), igual cae en `res.status(500).json(...)` en la línea 891, lo que lanzará `ERR_HTTP_HEADERS_SENT`. Las otras 4 funciones (`exportExcel:155`, `exportPDF:342`, `exportFeedbackExcel:456`, `exportLeadsExcel:592`) no tienen ningún guard de este tipo |
| **`client/src/components/admin/crm/CampanasSection.jsx`: botón "Eliminar" no gateado por rol** | Baja (no es hueco de seguridad — el backend bloquea correctamente con `authorize('admin')` — pero es una inconsistencia de UX) | Línea 346-362 renderiza un ítem de menú "Eliminar" incondicional aunque `DELETE /api/campaigns/:id` sea admin-only (`server/src/routes/campaigns.js:24`); cualquier editor con acceso CRM verá una opción que siempre falla con 403. Es el mismo patrón preexistente en Properties/Testimonials/Jobs/Alerts/Feedback (ninguno gatea el botón de eliminar por rol), pero el commit `7374440` sí introdujo ese patrón mejor (ocultar en vez de mostrar y fallar) para Leads — no se aplicó de forma consistente a la pestaña hermana Campañas dentro de la misma `CrmPage` |
| **Lógica de validación de presupuesto (`budget`) duplicada** | Baja | `client/src/components/admin/CreateLeadModal.jsx:66-69` y `client/src/components/admin/crm/ProspectosSection.jsx:116-118` implementan la misma validación inline (`Number.isNaN(Number(x)) \|\| Number(x) < 0`) bajo nombres de variable distintos — candidato claro a un helper compartido `isValidBudgetAmount()` |
| **`client/package.json`: `nodemon` en devDependencies sin ningún uso** | Baja | Ningún script de `package.json` (`dev`/`build`/`lint`/`preview`/`test`) lo invoca (todos usan `vite`/`eslint`/`vitest`); no existe `nodemon.json`; sin referencias en el resto del repo. Presente desde el primer commit que agregó devDependencies — parece copiado por error desde `server/package.json`, que sí usa `nodemon` legítimamente para su propio `dev` |

---

## 3. Endpoints candidatos a revisión

### 3.1 Los 10 endpoints previamente señalados sin consumidor — estado actual

| Endpoint | Consumidor frontend | Swagger | Recomendación (confirmada/heredada de `AUDITORIA_SERVICIOS_SIN_CONSUMIDOR.md`) |
|---|---|---|---|
| `POST /api/auth/register` | 0 (sin cambios) | ✅ documentado, `deprecated: true`, con nota de migración a `POST /api/users` | **Deprecación en curso, correctamente gestionada**: `339b869` agregó instrumentación de uso en producción (`logRegisterUsage`, evento `legacy_register_endpoint_used`) + script `scripts/register-usage-report.js` para decidir con datos reales antes de eliminar. No requiere acción adicional ahora — es el único de los 10 con un plan de salida activo |
| `PUT /api/leads/:id/reopen` | ✅ **ahora consumido** (`ReopenLeadModal.jsx`, `ProspectosSection.jsx`) | ❌ no documentado | Cerrar el hallazgo de "sin consumidor" (resuelto); pendiente documentarlo en Swagger dado que ahora es un endpoint real y activo |
| `GET /api/auth/me` | 0 | ✅ documentado (superficial, sin schema) | Mantener — utilidad futura de sincronización de sesión, documentar la decisión de "confiar en localStorage hasta 401" |
| `PUT /api/auth/change-password` | 0 | ✅ documentado (superficial — no documenta que la respuesta reemite `token`) | **Prioridad Alta de producto**: no existe ninguna UI de autogestión de contraseña; implementar es la recomendación más clara de todo este bloque |
| `DELETE /api/appointments/:id` | 0 | ❌ no documentado | Mantener sin UI — la cancelación vía `status: cancelada` ya cubre el caso de uso; documentar la decisión |
| `GET /api/deals/:id` | 0 | ❌ no documentado | Mantener sin UI — el listado ya es autosuficiente |
| `GET /api/jobs/:id` (pública) | 0 | ❌ no documentado | Inconsistente con el patrón de detalle público que sí existe para propiedades — decidir si se construye la página o se documenta como descartado |
| `GET /api/leads/:id/tasks` | 0 | ❌ no documentado | Redundante frente a `getTasks({leadIds})`, ya señalado como tal en un comentario del propio backend — candidato real a deprecar |
| `PATCH /api/tasks/:id/reassign` | 0 | ❌ no documentado | **Prioridad Alta de producto**: el propio `leadController.js` no cascada `assignedToUserId` a la tarea abierta del lead al reasignar — esto deja tareas huérfanas asignadas al responsable anterior. Es un bug operativo real, no solo un gap de UI |
| `GET /api/testimonials/:id` | 0 | ❌ no documentado | Mantener sin UI — el listado ya es autosuficiente |

Solo 1 de los 10 (`reopenLead`) ganó consumidor desde el 03-08; los otros 9 no cambiaron. Ninguno de los 9 restantes está marcado como `deprecated` en Swagger — o no están documentados en absoluto (8 de 9), o están documentados como endpoints normales sin ninguna nota (`getMe`/`changePassword`).

### 3.2 Cobertura real de Swagger — hallazgo principal de esta sección

El commit `51d062d` ("se unificó la API de documentación swagger") **no unificó la documentación**: agregó 2 schemas reutilizables (`User`, `Error`) y documentó por completo `server/src/routes/users.js` (6 rutas, antes sin documentar) más profundizó `auth.js#register` (marcado deprecado). Los otros 15 archivos de rutas quedaron intactos.

- **101 rutas totales** en `server/src/routes/*.js`, verificado contra el spec generado en vivo (`node -e "require('./config/swagger.js')"`).
- **Solo 8 rutas documentadas (8%)** — las 4 de `auth.js` + las 6 de `users.js`, menos coincidencias exactas de método+path = 8.
- **`properties.js` (18 rutas) y `leads.js` (21 rutas) — los dos recursos de mayor tráfico del sistema — 0% documentados.**
- 3 archivos de rutas (`alerts.js`, `audit.js`, `feedback.js`) no tienen ni siquiera un bloque `tags:`, por lo que no aparecerán agrupados en Swagger UI aunque se documenten después sin agregar también el tag.
- 10 archivos más registran un tag pero documentan 0 endpoints bajo él → Swagger UI mostrará 10 secciones vacías y engañosas.
- Dentro de los archivos "hechos", tampoco hay consistencia interna: en `auth.js`, solo `register` recibió el tratamiento completo (schemas, descripciones detalladas); `login`, `me`, `change-password` siguen en estilo superficial (solo `description` de texto, sin schema de request/response).
- Sin documentación obsoleta: los 8 paths documentados corresponden 1:1 a rutas reales y son precisos frente al controlador real.
- El marcado de "legacy" (`339b869` + `51d062d` sobre `register`) es el único caso de este tipo en todo el código y está bien cruzado — es lo único que la unificación hizo de forma completa y consistente.

### 3.3 Cobertura de tests de integración

11 archivos de test de integración en `server/`, cubriendo un segmento angosto: flujo de cierre/reapertura de leads, operaciones batch, bordes de paginación, y algunos smoke tests de auditoría/tracking de vistas. La mayoría de los endpoints de mutación CRUD (crear/editar/eliminar) en `properties`, `testimonials`, `campaigns`, `alerts`, `jobs`, `users` **no tienen ningún test de integración**. Esto es un patrón general del repo, no un defecto introducido por la limpieza reciente — ya estaba señalado puntualmente para creación de usuarios en `AUDITORIA_CREACION_USUARIOS.md`.

---

## 4. Dependencias posiblemente eliminables

| Paquete | Ubicación | Estado | Evidencia |
|---|---|---|---|
| `nodemon` | `client/package.json` devDependencies | **Confirmado sin uso** | Ningún script lo invoca, sin `nodemon.json`, sin referencias fuera de `package.json`/lockfile. Aparenta ser copiado por error desde `server/package.json` |
| `mysql2` | `server/package.json` dependencies | Falso positivo (confirmado nuevamente) | Sin `require()` directo — es el driver de dialecto que Sequelize carga internamente vía `dialect: 'mysql'` |
| Todo lo demás (server + client) | — | Necesario, con uso confirmado | Verificación fresca de cada dependency/devDependency contra imports/scripts reales; sin nuevas incorporaciones desde el 03-08 |

`overrides.uuid` (server) y `overrides.eslint-plugin-jsx-a11y.eslint` (client) siguen justificados como deduplicación de versiones, sin relación con ninguna CVE.

### Vulnerabilidades de dependencias (`npm audit`)

| Paquete | Severidad | Tipo | Explotabilidad real en este proyecto | Prioridad |
|---|---|---|---|---|
| `ip-address` (transitiva de `express-rate-limit@8.5.2`) | Alta | Runtime, indirecta | Solo se usa para normalizar direcciones IPv6 como clave de bucket de rate-limit (`rateLimitMiddleware.js:15`); no hay ningún sink de clasificación IP-pública/privada antes de una petición saliente en este código, por lo que el escenario de SSRF del advisory no tiene un sink equivalente aquí. Peor caso realista: bypass de bucketing de rate-limit. Fix trivial disponible sin breaking change (`npm audit fix`, sin `--force`) | **Media** |
| `react-router-dom` (resuelto en `7.18.1`) | Alta | Runtime, directa | CVE `GHSA-qwww-vcr4-c8h2` (CSRF bypass en modo RSC) — el advisory dice explícitamente que solo afecta a apps que usan las APIs RSC/framework-mode inestables. Esta app usa enrutamiento SPA clásico (`<BrowserRouter>`, sin `react-router.config`, sin server actions) — el vector de ataque no existe en la configuración actual. El fix real requiere un upgrade mayor planeado (8.3+), no un parche de emergencia | **Media** (vigilar, no urgente) |
| `brace-expansion` (transitiva de eslint/eslint-plugin-jsx-a11y) | Alta | Solo dev | DoS/ReDoS; nunca se empaqueta en el bundle de producción de Vite | **Baja** |
| `postcss` (directa) | Moderada | Solo dev | Lectura arbitraria de `.map` con `sourceMappingURL` no controlado; solo procesa CSS propio del repo en build time, sin CSS de terceros en runtime | **Baja** |

---

## 5. Assets huérfanos o inconsistentes

- Los 4 assets previamente huérfanos (`hero.png`, `react.svg`, `vite.svg`, `client/public/icons.svg`) **ya fueron eliminados** (`3f419de`, 2026-08-03 14:29) — `client/src/assets/` está actualmente vacío.
- `client/public/favicon.svg` sigue sin referencia explícita en `index.html` (que usa `/logo.png`) — estado sin cambios, confianza media (posible auto-solicitud de navegador por convención). No se recomienda tocar sin confirmación.
- Sin referencias rotas: se verificaron todas las referencias `/xxx.ext` en `src`+`index.html` — todas resuelven a archivos reales en disco.
- Sin duplicados: comparación por hash (`md5sum`) de todos los assets restantes en `public/` y `src/assets/` — sin coincidencias.

---

## 6. Problemas de documentación

| Problema | Detalle |
|---|---|
| **Sin `README.md` en la raíz del repo** | El único `README.md` del proyecto es `client/README.md`, y es el boilerplate sin editar del template de Vite (incluso menciona `plugin-react-swc`, que ni siquiera se usa). No hay ningún punto de entrada de documentación general para alguien nuevo en el repo — `CLAUDE.md` cumple otro propósito (guía específica para Claude Code, no documentación de producto/arquitectura general) |
| **`CLAUDE.md` desactualizado sobre roles** | La sección "Auth Flow" (líneas 87-89) solo describe 2 roles (`admin`/`editor`), sin mencionar el sistema de `crmRole` (Coordinador/Capturista/Asesor) que ya está en producción desde el commit `7374440` y documentado en el propio Swagger actualizado por `51d062d`. Amerita una actualización |
| **`IMPLEMENTATION_MASTER_PLAN.md` con filas resueltas sin marcar** | Fila #4 (dependencias de servidor sin uso en `client/package.json` + `react-hook-form`) — **resuelta pero sin anotar**, el `package.json` actual ya no tiene ninguno de esos paquetes. Fila #6 (accesibilidad de `Lightbox.jsx`: `role="dialog"`, `aria-modal`, focus trap) — **resuelta pero sin anotar**, el componente actual ya tiene `role="dialog"` (línea 33), `aria-modal="true"` (34), `aria-label` en el diálogo y en los controles. Filas #3 y #5 verificadas como aún vigentes (no stale) |
| **Bitácora del master plan desactualizada** | La "Registro de actualizaciones" del documento tiene una única entrada, fechada 2026-07-22, pese a ~15 features/fixes más entregados desde entonces (Infonavit, rediseño de Propiedad Estrella, roles CRM, endpoint+UI de reopen-lead, migración a `ApiError`, unificación parcial de Swagger, permisos de frontend) — el propio contrato del documento ("debe actualizarse cada vez que se implemente un ítem del backlog") no se está cumpliendo |
| **`AUDITORIA_CREACION_USUARIOS.md` ahora desactualizada** | Su evidencia de línea (`authController.js:7-40` vs `usersController.js:49-92`) describe el código previo a la consolidación (`fb31dd3`, 9 minutos posterior); y su nota de seguridad sobre falta de `logAudit` en `register` quedó resuelta por `339b869`. No se recomienda tocar el archivo histórico, pero conviene no citarlo como estado actual sin verificar primero |
| **`web.config` vs `CLAUDE.md`** | Consistentes, sin desviación detectada |

---

## 7. Oportunidades menores de mejora (arquitectura)

- Reutilizar `MAX_LIMIT` (o crear una constante nombrada explícita si 500 es un techo deliberadamente distinto) en `appointmentController.js` en vez de repetir el literal `500` dos veces.
- Extraer un helper compartido `isValidBudgetAmount()` para la validación de presupuesto duplicada entre `CreateLeadModal.jsx` y `ProspectosSection.jsx`.
- Aplicar el mismo patrón de "ocultar en vez de mostrar-y-fallar" que ya tiene Leads (vía `isAdmin()`) al botón "Eliminar" de `CampanasSection.jsx`, y evaluar si conviene extenderlo al resto de listados admin que comparten el mismo patrón preexistente (Properties/Testimonials/Jobs/Alerts/Feedback) — es una decisión de producto/UX, no un bug de seguridad.
- Añadir un guard consistente de `res.headersSent` en las 5 funciones de exportación con streaming de `exportController.js` (hoy solo una de cinco lo tiene, y de forma parcial).
- Decidir el destino de `isCapturista`/`isAsesor`/`seesAllLeads` en `permissions.js`: conectarlos como ayuda de UI (mensajes contextuales, estados vacíos por rol) o eliminarlos si la aplicación server-side de visibilidad de fila es suficiente y no se planea usarlos.
- Planificar una segunda pasada de Swagger que efectivamente cubra `properties.js` y `leads.js` (los recursos de mayor uso) antes de que el nombre "API unificada" se tome como cierto en el futuro.

---

## 8. Riesgos detectados

1. **Brecha de documentación de API mucho mayor de lo que sugiere el nombre del commit** — riesgo de que futuros desarrolladores (humanos o agentes) asuman que la API está documentada cuando el 92% de las rutas no lo están, incluyendo los dos recursos centrales del negocio (propiedades, leads).
2. **`react-router-dom` en rango de CVE alto** — bajo riesgo real hoy por la configuración SPA clásica del proyecto, pero debe programarse un upgrade mayor a 8.3+ antes de que cambie la superficie de la app (p. ej. si algún día se adopta un modo framework/RSC).
3. **Posible `ERR_HTTP_HEADERS_SENT` no manejado** en 4 de las 5 rutas de exportación con streaming si ocurre un error después de iniciar el envío de bytes — bug preexistente, baja frecuencia, pero puede tumbar la respuesta a medio archivo sin manejo consistente.
4. **Cobertura de tests de integración muy desigual** — la mayoría de los endpoints de mutación (crear/editar/eliminar) en `properties`, `testimonials`, `campaigns`, `alerts`, `jobs`, `users` no tienen ningún test, lo que aumenta el riesgo de regresión silenciosa en cambios futuros a esos controladores.
5. **Documentos de auditoría propios desactualizándose rápido** — al menos uno (`AUDITORIA_CREACION_USUARIOS.md`) ya quedó obsoleto en horas por commits posteriores del mismo día; si se sigue usando como referencia sin verificar, puede inducir a error.

Ningún riesgo de la lista anterior es crítico o bloqueante para producción.

---

## 9. Recomendaciones priorizadas

### Crítica
Ninguna. No se encontró nada que represente un riesgo inmediato de seguridad, disponibilidad o corrección de datos en producción.

### Alta
1. Implementar la cascada de reasignación de tarea al reasignar un lead (`leadController.js` → `reassignTask`), o al menos conectar `reassignTask` a la UI de reasignación de lead en `ProspectosSection.jsx` — es un bug operativo real y reproducible (tareas huérfanas), no solo un gap de UI.
2. Implementar la UI de autogestión de contraseña (`PUT /api/auth/change-password`) — gap de producto claro, sin ninguna vía de autoservicio hoy para editores/asesores/capturistas.
3. Aplicar `npm audit fix` (sin `--force`) para `ip-address` en `server/` — corrección trivial sin breaking change disponible.

### Media
1. Completar la documentación de Swagger para `properties.js` y `leads.js` como mínimo (los dos recursos de mayor tráfico), o renombrar/reencuadrar la expectativa de "API unificada" mientras eso no ocurra.
2. Agregar guard consistente de `res.headersSent` en las 5 funciones de streaming de `exportController.js`.
3. Planificar (no ejecutar de urgencia) el upgrade mayor de `react-router-dom` a 8.3+ para salir del rango de CVE, dado que es una dependencia runtime.
4. Actualizar `CLAUDE.md` para reflejar el sistema de roles CRM (`crmRole`) ya en producción.
5. Decidir el destino de `getPositionById` (construir página pública de detalle de vacante, análoga a `PropertyDetailPage`, o documentar explícitamente que se descarta) — es la única inconsistencia de patrón de producto entre recursos públicos.

### Baja
1. Eliminar `nodemon` de `client/package.json` devDependencies (confirmado sin uso).
2. Extraer helper compartido para la validación de presupuesto duplicada (`CreateLeadModal.jsx`/`ProspectosSection.jsx`).
3. Aplicar gating por rol al botón "Eliminar" de `CampanasSection.jsx` (consistencia de UX, no de seguridad).
4. Marcar como resueltas las filas #4 y #6 de `IMPLEMENTATION_MASTER_PLAN.md` y actualizar su bitácora con los ítems entregados desde 2026-07-22.
5. Crear un `README.md` mínimo en la raíz del repo (hoy inexistente; el único README es boilerplate de Vite sin editar).
6. Reutilizar/renombrar `MAX_LIMIT` en `appointmentController.js` en vez de repetir el literal `500`.
7. Decidir si `isCapturista`/`isAsesor`/`seesAllLeads` de `permissions.js` se conectan a algún uso de UI o se retiran.
8. Documentar en Swagger el endpoint `PUT /api/leads/:id/reopen` ahora que tiene consumidor real y activo.
9. Agregar una nota de errata a `AUDITORIA_CREACION_USUARIOS.md` señalando que fue superada por `fb31dd3` y `339b869`.

---

## 10. Conclusión final

El proyecto puede considerarse **limpio y estable**, pero no completamente cerrado. La base de código no tiene código muerto significativo, no tiene archivos completos huérfanos, no tiene componentes o hooks sin uso, y las dependencias de ambos `package.json` están casi en su totalidad justificadas — la ronda de limpieza cumplió su objetivo. Todos los tests pasan (208 en total entre backend y frontend), el build de producción es exitoso y el lint no reporta errores.

Lo que queda pendiente no es "código muerto" sino trabajo real de producto y documentación: un bug de consistencia de datos ya identificado (tareas huérfanas al reasignar leads), un gap de UI de autogestión de contraseña, una brecha de cobertura de Swagger bastante más amplia de lo que el nombre del último commit sugiere, y una documentación de proyecto (`CLAUDE.md`, `IMPLEMENTATION_MASTER_PLAN.md`, ausencia de `README.md`) que no se actualizó al mismo ritmo que el código. Ninguno de estos puntos es crítico ni bloquea el estado actual en producción, pero justifican una siguiente iteración corta y dirigida antes de considerar el ciclo de limpieza completamente cerrado.
