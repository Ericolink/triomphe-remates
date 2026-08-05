# Auditoría de limpieza del proyecto

**Alcance:** `client/` (React + Vite SPA) y `server/` (Node.js/Express + Sequelize/MySQL). El proyecto no usa Firebase ni Cloud Functions — el backend es un proceso Express de larga duración desplegado en SmarterASP.NET/IIS, por lo que la sección "Firebase" del checklist original no aplica.

**Metodología:** para cada símbolo (import, componente, hook, helper, constante, endpoint, dependencia) se verificó su uso mediante búsqueda exhaustiva (`grep`/`ripgrep`) en todo el árbol de `client/src` y `server/`, cruzando además `client/src/services/*.js` contra `server/src/routes/*.js` para detectar endpoints sin consumidor. No se asumió nada solo por convención de nombres. Los hallazgos con evidencia ambigua se marcan explícitamente como "Requiere verificación manual" en vez de darlos por muertos.

Esta auditoría es de **solo lectura**. No se modificó, movió, renombró ni eliminó ningún archivo del proyecto.

---

## Resumen ejecutivo

| Categoría | Total encontrado |
|---|---|
| Imports muertos | 0 |
| Componentes sospechosos | 0 |
| Hooks sin uso | 0 |
| Helpers/constantes/exports huérfanos | 11 (9 frontend, 4 backend — ver detalle) |
| Assets sin referencias | 4 confirmados + 1 dudoso |
| Dependencias sospechosas (package.json) | 0 reales (1 falso positivo explicado) |
| Funciones/endpoints backend sin consumidores | 2 endpoints + 2 exports de servicio |
| Código duplicado detectado | 4 casos (2 backend, 2 frontend) |

**Conclusión rápida:** el codebase está inusualmente limpio para su tamaño. No hay imports muertos, componentes huérfanos, hooks sin uso, archivos completos sin referenciar, ni dependencias de `package.json` sin uso real. Los hallazgos son puntuales: variantes de animación sin usar, un módulo de permisos de cliente que parece scaffolding adelantado del feature de roles CRM (2026-08-03), un endpoint de registro duplicado con la creación de usuarios del panel admin, y algunos assets residuales del template de Vite.

---

## Hallazgos

### 1. Imports muertos

**Ninguno encontrado.** Verificado con grep símbolo por símbolo en cada archivo de `client/src`, más una pasada de `eslint` (regla `no-unused-vars`) sobre el proyecto — cero resultados.

- **Confianza:** Alta
- **Riesgo de eliminación:** N/A (no hay nada que eliminar)

### 2. Funciones (backend)

No se encontraron funciones privadas nunca llamadas, funciones exportadas de controladores sin consumidor en rutas, ni código inalcanzable. Cada `export`/`module.exports` de los 17 controladores tiene una coincidencia 1:1 en su archivo de rutas.

Sí se encontraron **endpoints expuestos sin ningún llamador desde el frontend** (no es lo mismo que "función sin usar" — la función existe y está montada en una ruta, pero ningún cliente la invoca):

| Archivo | Nombre | Motivo | Evidencia | Confianza | Riesgo |
|---|---|---|---|---|---|
| `server/src/routes/auth.js:70`, `server/src/controllers/authController.js:7` (`register`) | `POST /api/auth/register` | Endpoint de registro de usuarios nunca llamado; la creación de usuarios admin pasa por `POST /api/users` (`usersController.createUser`) | `grep -rn "register" client/src` → 0 coincidencias en todo el cliente | Alta | Bajo-medio: eliminarlo rompería cualquier integración externa no documentada que lo use directamente (poco probable, pero API pública) |
| `server/src/routes/leads.js:52` (`reopenLead`) | `PUT /api/leads/:id/reopen` | Construido el 2026-07-20 (ver memoria de proyecto) para resolver una inconsistencia Deal/Task, pero ninguna UI lo invoca | `grep -rn "reopen\|Reabrir" client/src` → 0 coincidencias | Alta | Bajo si se elimina; medio si se conserva sin uso — probablemente falta la UI, no el backend |

- **Riesgo general de eliminar `register`:** requiere confirmar que no hay clientes externos (Postman collections, integraciones futuras) que dependan de él antes de tocarlo. Recomendado: **no eliminar, marcar como deprecated** o conectarlo a una futura UI de auto-registro si existe en el roadmap.
- **Riesgo de `reopen`:** más probable que sea una UI faltante que un endpoint muerto — revisar si el Kanban/CRM planea exponer "reabrir lead" antes de eliminar el backend.

### 3. Componentes React

**Ninguno sin uso.** Los 100% de los componentes bajo `client/src/components/` y `client/src/pages/` tienen al menos un import + uso JSX confirmado, incluyendo los de referencia única (`WelcomeScreen`, `LeadToast`, `ComparatorBar`, `Lightbox`, etc., que son legítimamente específicos de una sola página). No se detectaron componentes duplicados ni componentes reemplazados por otros sin limpiar el anterior.

- **Confianza:** Alta

### 4. Hooks

**Ninguno sin uso.** Los 8 hooks personalizados (`useComparator`, `useFavorites`, `useDebouncedValue`, `usePropertySync`, `useModalA11y`, `usePopoverA11y`, `useNotifications`, `useFilePreviews`) tienen consumidores confirmados. No hay hooks duplicados ni parcialmente reemplazados.

- **Confianza:** Alta

### 5. Context API

**No aplica.** El proyecto no usa `createContext`/`useContext` en ningún lugar de `client/src` — todo el estado compartido pasa por Zustand (`authStore`, `themeStore`), consistente con lo documentado en `CLAUDE.md`. No hay Providers innecesarios que evaluar.

### 6. Helpers / Utils

| Archivo | Nombre | Motivo | Evidencia | Confianza | Riesgo |
|---|---|---|---|---|---|
| `client/src/utils/permissions.js` | `hasCrmAccess`, `isCapturista`, `isAsesor`, `seesAllLeads` | Exports sin ningún import externo | `grep -rn '\bhasCrmAccess\b' client/src` (y análogos) → solo la definición | Alta | **Medio** — coincide temporalmente con el feature de roles CRM de 4 niveles (2026-08-03, ver memoria de proyecto); podría ser scaffolding de cliente adelantado al espejo del helper de backend `server/src/utils/leadAccess.js`, aún no conectado a filtrado de filas en UI. **No eliminar sin confirmar con el equipo si esto es deuda intencional a completar.** |
| `client/src/utils/animations.js` | `fadeInDown`, `scaleIn`, `staggerContainerFast`, `pageTransition`, `cardHover` | Variantes de Framer Motion exportadas, cero referencias fuera del archivo | grep por cada nombre → 0 coincidencias externas | Alta | Bajo — son variantes de animación aisladas, eliminarlas no afecta las demás (`fadeIn`, `fadeInUp`, etc. sí están en uso activo) |
| `server/src/utils/pagination.js:7,35` | `MAX_LIMIT` | Exportado pero solo usado internamente como default de `paginate()`; `appointmentController.js:33` hardcodea `500` en vez de importar la constante | `grep -rn "MAX_LIMIT" server/src` → sin `require` externo | Alta | Bajo — es una inconsistencia menor más que código muerto real (vale la pena que `appointmentController` lo importe en vez de eliminar la constante) |
| `server/src/utils/corsOrigins.js:9,20,26` | `allowedOrigins`, `isDevLocalOrigin` | Solo `isOriginAllowed` se importa fuera del archivo | grep confirma 0 usos externos de los otros dos | Alta | Bajo |

### 7. Servicios (frontend — wrappers de API sin consumidor)

Todos corresponden a endpoints que **sí existen** en el backend, así que no son llamadas rotas — son wrappers de cliente sin UI que los dispare:

| Archivo | Función | Evidencia | Confianza |
|---|---|---|---|
| `client/src/services/appointmentService.js` | `deleteAppointment` | 0 refs; sin acción de borrado en `CalendarioSection.jsx` | Alta |
| `client/src/services/authService.js` | `getMe` | 0 refs; el estado de auth se deriva del JWT en localStorage, no de este endpoint | Alta |
| `client/src/services/authService.js` | `changePassword` | 0 refs; no existe UI de "cambiar contraseña" propia en el panel admin | Alta |
| `client/src/services/dealService.js` | `getDealById` | 0 refs; `CasosExitoSection.jsx` solo usa el listado | Alta |
| `client/src/services/jobService.js` | `getPositionById` | 0 refs; las páginas de vacantes solo usan listados | Alta |
| `client/src/services/taskService.js` | `getLeadTasks` | 0 refs; Kanban y Prospectos usan `getTasks({ leadIds })` genérico | Alta |
| `client/src/services/taskService.js` | `reassignTask` | 0 refs; sin UI de reasignación de tareas | Alta |
| `client/src/services/testimonialService.js` | `getTestimonialById` | 0 refs; la página admin solo usa el listado | Alta |

- **Riesgo de eliminación:** Bajo para todos — son wrappers delgados sobre endpoints que siguen existiendo en el backend; su ausencia en el cliente no rompe nada, pero también son baratos de dejar por si se planea la UI correspondiente (ej. "cambiar contraseña" es un gap de producto razonable a resolver antes que a limpiar).

**Servicios de backend (funciones de `services/`):** todos con consumidor, excepto:

| Archivo | Nombre | Motivo | Evidencia | Confianza |
|---|---|---|---|---|
| `server/src/services/exportBranding.js` | `ST_RED`, `ST_RED_ARGB` | Exports redundantes — `exportController.js` no los destructura; el mismo rojo ya vive embebido en `statusHex.vendido`/`statusArgb.vendido` | `grep -rn "ST_RED" server/src` → solo definición | Alta |

### 8. Tipos e interfaces

**No aplica.** El proyecto es JavaScript puro (sin TypeScript) tanto en `client/` como en `server/` — no hay `interface`/`type`/`enum` que auditar.

### 9. Constantes

**Ninguna constante muerta en el frontend.** Los 42 exports de `client/src/utils/constants.js` (`CITY_LABELS`, `TYPE_LABELS`, `STATUS_LABELS`, `STATUS_VARIANTS`, etc.) tienen uso confirmado. Ver sección 6 para las constantes de backend sin consumidor (`MAX_LIMIT`, `allowedOrigins`, `isDevLocalOrigin`).

### 10. Assets

| Archivo | Motivo | Evidencia | Confianza | Riesgo |
|---|---|---|---|---|
| `client/src/assets/hero.png` | Sin referencias | `grep -rn "hero.png"` → 0 | Alta | Bajo |
| `client/src/assets/react.svg` | Residuo del template default de Vite | 0 referencias | Alta | Bajo |
| `client/src/assets/vite.svg` | Residuo del template default de Vite | 0 referencias | Alta | Bajo |
| `client/public/icons.svg` | Sin referencias; no hay patrón de sprite SVG (`<use href>`/`xlinkHref`) que lo consuma dinámicamente | 0 referencias | Alta | Bajo |
| `client/public/favicon.svg` | `index.html` usa `/logo.png` como ícono, no este archivo | 0 referencias explícitas | **Media — Requiere verificación manual** (los navegadores a veces auto-solicitan `/favicon.svg` por convención aunque no haya `<link>` explícito) | Bajo |

`client/public/logo.png` **no** está muerto — se usa activamente en 7 lugares (Navbar, Footer, AdminLayout, LoginPage, AboutPage, WelcomeScreen, meta tags de SEO).

### 11. Backend — endpoints, triggers, cron jobs

- **Cron/scheduled jobs:** no existen. No hay `node-cron`, `setInterval` de tipo scheduler, ni la dependencia `node-cron` en `package.json`. N/A para este proyecto.
- **Middleware:** todos en uso, incluyendo los 6 rate limiters y `requireCrmAccess`. Único caso a notar: `ApiError` (clase en `errorHandler.js`) está exportada pero nunca instanciada — es scaffolding documentado explícitamente en un comentario del propio archivo ("controllers nuevos... los existentes no se tocaron"), no código huérfano por descuido. Confianza Media, no se recomienda tocar.
- **Modelos:** los 19 modelos de Sequelize están asociados y consultados activamente. Ninguno huérfano.
- **Migraciones:** sin migraciones duplicadas ni huérfanas. La secuencia de creación/eliminación de `property_documents` (feature revertido, ver `git log`: "se quito la opcion de subir documentos") está completamente limpia — cero referencias residuales fuera de las migraciones históricas, que es lo esperado (las migraciones no se reescriben). `server/.sequelizerc` apunta a un `seeders-path` que no existe (`server/seeders`), pero es inofensivo porque no hay script `db:seed` en `package.json`.

### 12. Frontend — llamadas a endpoints inexistentes

No se encontraron llamadas del cliente a endpoints que no existan en el backend. Los dos casos que parecían sospechosos en primera instancia se confirmaron como patrones legítimos:
- `GET /api/leads/stream` — no aparece en `leadService.js` porque se consume directo vía `new EventSource(...)` en `useNotifications.js` (SSE no soporta headers custom, por diseño documentado en CLAUDE.md).
- `GET /api/export/excel` y `/pdf` — se construyen dinámicamente (`` `/export/${format}` ``) en `AdminPropertiesPage.jsx`, no como string literal en el service.

### 13. Firebase

**No aplica.** El proyecto usa MySQL + Sequelize, no Firebase/Firestore. Sin colecciones, reglas ni índices que auditar.

### 14. Dependencias (package.json)

**Cliente (`client/package.json`):** los 10 dependencies de runtime tienen import confirmado (`@tanstack/react-query`, `@tanstack/react-virtual` — uso puntual en `KanbanBoard.jsx`, legítimo —, `axios`, `framer-motion`, `lucide-react`, `react-helmet-async`, `react-hot-toast`, `react-router-dom`, `zustand`, `react`/`react-dom`). Sin duplicados ni paquetes pesados usados para funciones triviales.

**Servidor (`server/package.json`):** todas las dependencies tienen `require()` real, con una excepción explicable:

| Paquete | Motivo | Confianza |
|---|---|---|
| `mysql2` | Sin `require()` directo en código de aplicación — es el driver de dialecto que Sequelize carga internamente según `dialect: 'mysql'` en `config/db.js` | **Falso positivo — no es código muerto**, es un peer dependency requerido indirectamente |

No se detectaron dependencias transitivas sospechosas ni librerías reemplazadas sin limpiar (`devDependencies` como `eslint`, `vite`, `jest`, `sequelize-cli`, `pdf-parse`, etc. están todas invocadas vía scripts de `package.json`).

### 15. Código duplicado

| Ubicación | Descripción | Confianza | Riesgo |
|---|---|---|---|
| `server/src/controllers/authController.js:7-38` (`register`) vs. `server/src/controllers/usersController.js:47` (`createUser`) | Ambas hashean password y crean un `User`, pero con validación (`validateRegister` vs. checks inline) y forma de respuesta distintas. Junto con el hallazgo de la sección 2, sugiere que `register` es scaffolding anterior al panel de Users, no reemplazado formalmente | Alta | Bajo — consolidar reduciría superficie de mantenimiento, pero no es urgente |
| `authController.js` repite inline la forma `{ id, name, email, role, crmRole }` en `register` y `login`, mientras `usersController.js` ya tiene un helper `safeUser()` para lo mismo | Menor — 2 ocurrencias, bajo impacto | Media | Bajo |
| `ContactForm.jsx:94` y `AlertSubscriptionForm.jsx:116` (frontend) | Ambos hardcodean el mismo regex de teléfono `pattern="^(\+?52)?\d{10}$"` en vez de compartir una constante/helper (existe un comentario en `formatters.js:31` que referencia "mismo criterio que validatePhone en el backend", sugiriendo que debería centralizarse) | Media | Bajo |
| Formateo ad-hoc de precio/fecha bypassing `formatPrice`/`formatDate` en `PropertiesPage.jsx`, `PropertyFormPage.jsx`, `AlertSubscriptionForm.jsx`, `PropertyDetailPage.jsx`, `CalendarioSection.jsx`, `UrgentSection.jsx`, `NotificationBell.jsx` | Llaman `toLocaleString`/`toLocaleDateString` directo con opciones custom en vez de los helpers compartidos. Podría ser intencional (formatean números/fechas arbitrarios sin necesitar el manejo de `null` → "PENDIENTE"), o podría ser una desviación de la convención documentada en CLAUDE.md | **Media — Requiere verificación manual** | Bajo si se decide extraer helpers adicionales |

### 16. Archivos completos sospechosos de estar muertos

**Ninguno.** Tanto en `client/src` como en `server/`, cada archivo `.js`/`.jsx` no-test tiene al menos un `import`/`require` desde otro archivo o está montado directamente en `App.jsx` (rutas) / `server/src/routes` (endpoints) / `.sequelizerc` (config CLI). No hay candidatos de Alta ni Media confianza en esta categoría.

---

## Acciones recomendadas

### Prioridad Alta
*(Alta confianza + bajo riesgo — seguros de limpiar tras un vistazo rápido de confirmación)*

1. Eliminar assets sin referencias: `client/src/assets/hero.png`, `react.svg`, `vite.svg`, `client/public/icons.svg`.
2. Eliminar variantes de animación sin uso en `client/src/utils/animations.js`: `fadeInDown`, `scaleIn`, `staggerContainerFast`, `pageTransition`, `cardHover`.
3. Eliminar exports muertos `ST_RED`/`ST_RED_ARGB` de `server/src/services/exportBranding.js`.
4. Eliminar (o importar donde corresponde) `MAX_LIMIT` en `server/src/utils/pagination.js` — hoy `appointmentController.js` hardcodea `500` en su lugar; lo ideal es que lo importe en vez de eliminarlo.
5. Eliminar exports `allowedOrigins`/`isDevLocalOrigin` de `server/src/utils/corsOrigins.js` si de verdad no se necesitan fuera del módulo.

### Prioridad Media
*(Requieren una revisión rápida de contexto de producto antes de actuar)*

1. **`client/src/utils/permissions.js`** (`hasCrmAccess`, `isCapturista`, `isAsesor`, `seesAllLeads`): confirmar con el equipo si es scaffolding pendiente de conectar al feature de roles CRM (2026-08-03) antes de eliminar — probablemente es trabajo a completar, no basura.
2. **`PUT /api/leads/:id/reopen`**: decidir si falta la UI (más probable) o si el endpoint debe retirarse.
3. **`POST /api/auth/register`**: confirmar que ningún cliente externo lo usa antes de deprecarlo; considerar consolidar con `usersController.createUser` para eliminar la lógica duplicada.
4. 8 funciones de servicio del frontend sin UI que las dispare (`deleteAppointment`, `getMe`, `changePassword`, `getDealById`, `getPositionById`, `getLeadTasks`, `reassignTask`, `getTestimonialById`) — varias apuntan a gaps de producto (ej. "cambiar contraseña" propia) más que a código muerto; revisar caso por caso.
5. Duplicación de regex de teléfono entre `ContactForm.jsx` y `AlertSubscriptionForm.jsx` — candidato a extraer a un helper compartido.

### Prioridad Baja
*(Necesitan validación manual antes de cualquier cambio)*

1. `client/public/favicon.svg` — podría estar sirviendo como fallback de navegador por convención aunque no tenga `<link>` explícito.
2. Formateo ad-hoc de precios/fechas que bypassa `formatPrice`/`formatDate`/`formatDateTime` en 7 ubicaciones — evaluar si son casos legítimamente distintos (rangos numéricos, opciones de fecha no soportadas por los helpers) o desviación de convención.
3. Clase `ApiError` en `server/src/middleware/errorHandler.js` — scaffolding documentado, no adoptada aún por los controllers existentes; no requiere acción, solo mantenerla en mente al escribir controllers nuevos.
4. Diff completo columna-por-columna entre modelos Sequelize y migraciones — se hicieron verificaciones puntuales sin discrepancias, pero no se completó una auditoría exhaustiva atributo por atributo.

---

## Resumen final

- **Cantidad aproximada de archivos candidatos para limpieza:** muy baja — 0 archivos completos muertos. Los hallazgos son a nivel de símbolos individuales (exports, funciones, variantes) dentro de archivos que siguen en uso, más 4-5 assets sueltos.
- **Reducción potencial del tamaño del proyecto:** marginal (unos pocos KB de assets sin usar + algunas decenas de líneas de exports sin consumidor). Este no es un proyecto con acumulación significativa de deuda muerta.
- **Áreas con mayor deuda técnica real:** no es "código muerto" per se, sino trabajo a medio completar — el módulo `permissions.js` del cliente parece ser scaffolding del feature de roles CRM aún no conectado a la UI, y el endpoint `reopen` sugiere que la UI correspondiente quedó pendiente tras el fix de backend del 2026-07-20.
- **Riesgos identificados:** bajos en general. El único punto que merece una conversación de producto antes de tocar código es si `permissions.js` y el endpoint `reopen` son trabajo pendiente (no tocar) o descartado (limpiar). Todo lo demás (assets, variantes de animación, exports de export/branding y CORS) es limpieza segura de bajo riesgo.

**Nota metodológica:** esta auditoría se basó en búsqueda estática de referencias (grep/import graph) en el estado actual del working tree; no cubre referencias dinámicas exóticas (ej. carga de assets por URL construida en runtime desde datos de la base de datos) más allá de lo verificado explícitamente arriba. Los ítems marcados "Requiere verificación manual" deben confirmarse antes de cualquier eliminación.
