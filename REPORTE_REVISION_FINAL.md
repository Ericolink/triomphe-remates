# Reporte de Revisión Final — Triomphe Remates

**Fecha de revisión:** 2026-06-18
**Alcance:** `server/` y `client/` completos, incluyendo cambios sin commitear en el working tree (feature de notificaciones por WhatsApp: `server/src/services/whatsappService.js` nuevo + cambios en `leadController.js`, `propertyController.js`, `alertController.js`, modelos `Lead`/`PropertyAlert`, rutas, y frontend de leads/alertas).
**Metodología:** revisión estática de código (white-box) por área — seguridad, bugs/calidad, rendimiento, UX/accesibilidad y evaluación académica — con verificación de archivo y línea para cada hallazgo.

---

## 1. Resumen ejecutivo

El proyecto tiene una base sólida: separación de capas consistente (controllers/models/routes/services/middleware/utils), buenas decisiones de arquitectura (code splitting del panel admin, Zustand para estado compartido, SSE para tiempo real, Cloudinary con transformaciones on-demand, audit logging transversal) y convenciones de frontend bien respetadas (`formatPrice`, `buildImageUrl`, `animations.js`).

Sin embargo, **no está listo para producción tal como está**. El hallazgo más grave es un endpoint de registro (`POST /api/auth/register`) que permite a cualquier persona no autenticada crearse una cuenta con rol `admin` — control de acceso roto sobre todo el panel administrativo. Junto a esto hay XSS por HTML sin escapar en los correos transaccionales, ausencia de cabeceras de seguridad HTTP, un endpoint público que expone documentos legales de propiedades, y varios bugs concretos en la feature de WhatsApp recién añadida (sin commitear) que pueden perder el rastro de seguimiento de leads cuando falla el envío.

A nivel de calidad y mantenibilidad el código es razonable pero con duplicación significativa (paginación, subida a Cloudinary, generación de Excel/PDF, labels de ciudades/tipos repetidos en 3 archivos del backend) y algunos archivos/controladores que mezclan demasiadas responsabilidades (`propertyController.js`, `exportController.js`, `LeadsPage.jsx`). El `client/package.json` arrastra 11 dependencias de servidor sin usar — sin impacto en runtime, pero es el tipo de descuido que un cliente técnico o un profesor notará en los primeros segundos.

Para el tráfico esperado (inmobiliaria regional, no escala masiva) el rendimiento actual es aceptable; los riesgos de escalabilidad (SSE en memoria, falta de índices, exportaciones sin streaming) son reales pero no urgentes salvo que el negocio crezca considerablemente.

**Veredicto:** el proyecto es defendible como tesis y viable para entrega al cliente, pero requiere corregir los hallazgos Críticos y Altos de seguridad antes de exponerlo a tráfico real, y se beneficiaría de admitir abiertamente —no ocultar— la ausencia de tests automatizados y migraciones formales ante el comité.

---

## 2. Calificación general del proyecto

| Área | Calificación (1-10) | Justificación breve |
|---|---|---|
| Tecnologías utilizadas | 8 | Stack moderno y coherente (React 19, Express 5, Sequelize, Cloudinary, Zustand, React Query); sin sobre-ingeniería injustificada |
| Arquitectura | 7 | Separación de capas clara; pero lógica de negocio (notificación de alertas) acoplada directamente a `propertyController` en vez de un servicio dedicado |
| Patrones utilizados | 7 | Buen uso de Zustand, lazy loading, audit log, repositorio de servicios por recurso; pero patrón de paginación/upload/labels repetido sin abstraer |
| Calidad general del código | 6 | Funcional y legible, pero con duplicación notable y controladores de 500-800+ líneas con responsabilidades mezcladas |
| Mantenibilidad | 6 | Archivos grandes (`exportController.js` 841 líneas, `PropertyFormPage.jsx` 568 líneas) dificultan cambios futuros sin tests de regresión |
| Escalabilidad | 5 | SSE en memoria no escala horizontalmente; faltan índices en columnas de filtro frecuente; exportaciones cargan todo en memoria |
| Seguridad | 4 | Hallazgo crítico de control de acceso (registro admin abierto) + XSS en emails + falta de helmet bajan la nota pese a buenas prácticas en CORS, JWT y SQLi |
| Profesionalismo / pulcritud | 6 | CI bien diseñado y Swagger presentes, pero `client/package.json` contaminado, tests placeholder, `.env.example` desactualizado |
| **Promedio general** | **6.1 / 10** | Aprobable con observaciones — requiere remediar hallazgos Críticos/Altos antes de producción |

---

## 3. Hallazgos de seguridad

### Crítico

**[CRÍTICO] [CORREGIDO] Registro público de administradores — Control de acceso roto (A01:2021)**
- **Archivo:** `server/src/routes/auth.js:36`, `server/src/controllers/authController.js:7-39`, `server/src/utils/validators.js:24`
- `POST /api/auth/register` no tiene `authenticate` ni `authorize('admin')` — solo `authLimiter`. El body acepta `role: 'admin'` libremente.
- **Impacto:** cualquier visitante no autenticado puede crear una cuenta admin y tomar control total del panel.
- **Solución:** proteger la ruta con `authenticate, authorize('admin')` y reutilizar `usersController.createUser` (ya protegido) como único punto de creación de usuarios.
- **Corrección aplicada (2026-06-18):** se agregó `authenticate, authorize('admin')` a `router.post('/register', ...)` en `server/src/routes/auth.js:41`, junto con el import de `authorize` y la actualización del comentario Swagger (`security: bearerAuth`, respuestas 401/403). El controlador `register` no se modificó. Se verificó que el frontend no consume este endpoint (sin referencias en `client/src`), por lo que no hay riesgo de regresión funcional. Mini auditoría adicional de escalación de privilegios/roles no encontró otros hallazgos de severidad Crítica o Alta (ver hallazgos Bajo/Info agregados en la sección de seguimiento).

### Alto

**[ALTO] [CORREGIDO] XSS / HTML Injection en correos transaccionales**
- **Archivo:** `server/src/services/emailService.js` líneas 107, 113, 138, 166-173, 231-235, 261, 264-265
- Campos de formularios públicos sin autenticación (`lead.name`, `lead.email`, `lead.phone`, `lead.message`, `application.name/email/phone/motivation`, `feedback.name/subject/message`, `alert.name`) se interpolaban crudos en HTML de email sin escapar. La validación de email propia (`validateEmail` en `validators.js`) tampoco bloqueaba HTML, así que el campo `email` también era vector de XSS.
- **Impacto:** un atacante podía inyectar `<img src=x onerror=...>` u otro HTML en el correo que recibe el admin (`EMAIL_TO`) o el propio remitente — phishing visual o exfiltración pasiva vía imagen remota. Afectaba tanto a administradores (impacto alto, vía notificaciones) como a clientes (impacto bajo, vía sus propios correos de confirmación).
- **Corrección aplicada (2026-06-18):** se agregó un helper `escapeHtml()` en `emailService.js` y se aplicó a los 10 puntos de interpolación de datos de usuario identificados en las 6 funciones de envío (`sendNewLeadNotification`, `sendLeadConfirmation`, `sendJobApplicationNotification`, `sendJobApplicationConfirmation`, `sendFeedbackNotification`, `sendPropertyAlertNotification`), incluyendo los *fallbacks* de `cityLabel`/`typeLabel`/`expLabel`/`categoryLabel` por defensa en profundidad. Se verificó con un script de prueba (mock de `nodemailer`) que: (a) payloads como `<img src=x onerror=...>`, `<script>...</script>` y `"><svg onload=...>` en `name`/`email`/`phone`/`message` quedan completamente neutralizados en el HTML generado, y (b) datos benignos con acentos, `&` y apóstrofes (`"José D'Ángelo & Cía."`) se escapan a entidades HTML (`&amp;`, `&#39;`) que renderizan visualmente igual, sin alterar el diseño de la plantilla. Búsqueda global confirmó que `emailService.js` es el único archivo del backend que construye HTML por interpolación, y que el frontend no usa `dangerouslySetInnerHTML` ni `.innerHTML` en ningún componente — no se encontraron vulnerabilidades similares en otros archivos.

**[ALTO] Ausencia de cabeceras de seguridad HTTP (helmet)**
- **Archivo:** `server/app.js` (no presente en todo el archivo)
- No hay `helmet` ni configuración manual de `X-Frame-Options`, `Content-Security-Policy`, `Strict-Transport-Security`.
- **Impacto:** mayor superficie ante clickjacking sobre `/admin` y mayor impacto de cualquier XSS futuro.
- **Solución:** `npm install helmet` y `app.use(helmet())` antes de `cors()`.

### Medio

**[MEDIO] Documentos legales de propiedades expuestos sin autenticación**
- **Archivo:** `server/src/routes/properties.js:41`
- `GET /:id/documents` no exige `authenticate`. Si no es intencional, expone escrituras/avalúos a cualquiera que adivine el ID.
- **Solución:** proteger la ruta o separar documentos públicos vs. privados con un flag `isPublic`.

**[MEDIO] Falta `app.set('trust proxy', ...)` detrás de Render**
- **Archivo:** `server/app.js`
- Sin esto, `req.ip` puede resolver siempre a la IP del proxy interno, inutilizando rate limiting por IP y falseando logs de auditoría/analytics.
- **Solución:** `app.set('trust proxy', 1);` antes de declarar los rate limiters.

**[MEDIO] WhatsApp: sin validación de formato de teléfono + vector de spam a terceros**
- **Archivo:** `server/src/services/whatsappService.js:8-11`, `server/src/controllers/alertController.js:7,20`, `server/src/models/PropertyAlert.js`, `server/src/models/Lead.js`
- Cualquier visitante puede registrar un teléfono ajeno en `POST /api/alerts` sin verificación de propiedad; cuando se publique una propiedad coincidente, Meta enviará un WhatsApp a un tercero no consintiente — riesgo de abuso de plataforma y de que Meta suspenda la cuenta de WhatsApp Business.
- **Solución:** validar formato de teléfono en modelo y frontend, y considerar doble opt-in antes de activar notificaciones por WhatsApp.

### Bajo

**[BAJO] Dependencias de servidor declaradas en `client/package.json`**
- 11+ paquetes backend (`express`, `sequelize`, `mysql2`, `jsonwebtoken`, etc.) sin uso real en `client/src`. Sin impacto en runtime (Vite no los empaqueta), pero infla `npm audit` del cliente con CVEs irrelevantes.

**[BAJO] JWT en query string para SSE**
- **Archivo:** `server/src/middleware/authMiddleware.js:32-55`, `client/src/hooks/useNotifications.js:38-40`
- Trade-off necesario porque `EventSource` no soporta headers personalizados; riesgo limitado por expiración del JWT y por el alcance del endpoint. Aceptable si se documenta como decisión consciente.

**[BAJO] Log de error de WhatsApp con cuerpo crudo de la respuesta de Meta**
- **Archivo:** `server/src/services/whatsappService.js:39-40` — solo llega a logs de servidor, no al cliente. Truncar el mensaje en el log es suficiente.

**[BAJO] Sin guardia contra democión del admin principal** *(hallazgo de mini auditoría de roles, 2026-06-18)*
- **Archivo:** `server/src/controllers/usersController.js:113` (`updateUser`)
- Cualquier admin puede cambiar el `role` de otro admin —incluido el "admin principal"— ya que solo está protegido contra *eliminación* (`permanentDeleteUser:152-155`), no contra *democión* a `editor`. Es admin-vs-admin (mismo nivel de confianza), pero inconsistente con la protección existente para borrado.

**[BAJO] `JWT_EXPIRES_IN` sin fallback en código** *(hallazgo de mini auditoría de roles, 2026-06-18)*
- **Archivo:** `server/src/utils/helpers.js:5-8`
- Si la variable de entorno no está definida, `jwt.sign` genera tokens sin expiración. Está documentada en `.env.example` (`7d`), pero el código no valida ni avisa si se omite en un despliegue nuevo.

**[INFO] Validación de `role` en `usersController.createUser` depende solo del ENUM de la BD** *(hallazgo de mini auditoría de roles, 2026-06-18)*
- No valida explícitamente que `role` sea `'admin'`/`'editor'` antes de pasar a Sequelize (a diferencia de `validateRegister`); un valor inválido cae en el `ENUM` del modelo y termina en un 500 genérico — no explotable, solo un mensaje de error menos claro.

### Verificado sin hallazgos (positivo)
- No se encontró SQL Injection (Sequelize parametrizado en todo `server/src`, ningún `sequelize.query` con interpolación).
- CORS configurado correctamente con whitelist explícita (`server/app.js:13-30`).
- Rate limiting presente y diferenciado por sensibilidad de ruta (login, alertas, exportaciones, uploads).
- bcrypt con 12 rounds, JWT verificado con `algorithms: ['HS256']` explícito (mitiga confusión de algoritmo).
- Mensajes de error genéricos al cliente; no se filtran stack traces ni SQL.

---

## 4. Hallazgos de calidad (bugs y código)

### Bugs — feature WhatsApp (código sin commitear)

| Hallazgo | Archivo:línea | Probabilidad | Impacto |
|---|---|---|---|
| Si falla el envío de WhatsApp, no se crea la `LeadNote` ni se llama `logAudit` — se pierde el rastro de seguimiento | `leadController.js:297-315` | Alta | Alto |
| Notificación masiva a WhatsApp sin control de concurrencia/backoff (`forEach` + `fetch` en paralelo) | `propertyController.js:245-254` | Alta (con muchas alertas) | Medio-alto |
| `phone` sin validación (`STRING(20)` sin regex) en ambos modelos | `Lead.js:19-22`, `PropertyAlert.js` | Media | Medio |
| `toE164` no es defensiva ante `null`/`undefined` | `whatsappService.js:9` | Media | Medio |
| `updateProperty` no replica la notificación de alertas que sí tiene `createProperty` — una propiedad que vuelve a "disponible" nunca notifica | `propertyController.js` | Media | Negocio |

### Otros bugs confirmados

- **`className` duplicado en JSX** — `client/src/pages/admin/AdminPropertiesPage.jsx:169-171`: el primer `className` se descarta silenciosamente por Babel/JSX, perdiendo padding/peso de fuente en la celda de precio.
- **Sin validación de `JWT_SECRET` al boot** — si falta en producción, todas las rutas devuelven 401 indistinguible sin error visible en logs de arranque.
- **`.env.example` desactualizado** — no documenta `CLOUDINARY_*` (usadas en `config/cloudinary.js`) pero sí mantiene `SENDGRID_*` muertas (el proyecto usa Gmail/Nodemailer).
- **`getFirstImagePath` en `exportController.js:106-112` nunca funciona** — intenta resolver URLs de Cloudinary (siempre remotas) como rutas de archivo local; las miniaturas del PDF de inventario nunca se renderizan. Existe `getImageBuffer` (maneja URLs remotas) sin usarse ahí.
- **`setState` durante el render** (antipatrón) en `PropertyFormPage.jsx:136-139, 242-245` para hidratar formulario desde datos del servidor — mover a `useEffect`.
- **~34 de 45 `useMutation` en el admin sin `onError`** — fallos de red silenciosos (ej. drag&drop de Kanban en `LeadsPage.jsx` que falla sin avisar).
- **`AdminPropertiesPage.jsx` (`handleExport`) usa `fetch()` nativo en vez de la instancia `api.js`** — si el JWT expira a mitad de la descarga, no dispara el interceptor de logout/redirect.

### Calidad de código — duplicación y acoplamiento

| Problema | Dónde | Refactor propuesto |
|---|---|---|
| Bloque de paginación repetido | `leadController.js`, `alertController.js`, `feedbackController.js`, `testimonialController.js`, `auditController.js` | Extraer `paginate(Model, { where, order, page, limit, include })` en `utils/pagination.js` |
| Wrapper de subida a Cloudinary repetido | `propertyController.js`, `usersController.js`, `testimonialController.js`, `documentController.js` | `utils/cloudinaryUpload.js` → `uploadBuffer(buffer, options)` |
| Boilerplate de Excel/PDF repetido (~125 líneas x 3) | `exportController.js` (841 líneas) | `buildExcelHeader(sheet, workbook, {...})` + `utils/logo.js` compartido con `emailService.js` |
| `cityLabel`/`typeLabel` duplicados en 3 archivos backend | `emailService.js`, `exportController.js`, `whatsappService.js` | `server/src/utils/labels.js` compartido |
| Agrupamiento semanal duplicado | `analyticsController.js` (`weekMap`/`leadsOverTime` vs `viewWeekMap`/`viewsOverTime`) | Extraer `groupByWeek(rawRows, valueKey)` |
| Lógica de notificación de alertas acoplada al controller de propiedades | `propertyController.js:227-256` | `alertService.notifyMatchingAlerts(property)` reutilizable (resuelve también el bug de `updateProperty`) |
| Store de tema (`themeStore.js`) nunca usado; `ThemeToggle.jsx` reimplementa la misma lógica con `useState` + `MutationObserver` | `client/src/store/themeStore.js` | Eliminar el store muerto o migrar `ThemeToggle` a usarlo (mismo patrón que `useFavorites`/`useComparator`) |
| `client/package.json` con 11 dependencias de servidor sin usar (incluye `react-hook-form` declarado pero no usado en formularios revisados) | `client/package.json` | Limpiar dependencias no usadas |

### Archivos/funciones más grandes (candidatos a dividir)
- `exportController.js` — 841 líneas, 4 funciones de ~120-150 líneas.
- `PropertyFormPage.jsx` — 568 líneas (formulario + drag&drop + documentos + historial + analytics en un solo componente).
- `LeadsPage.jsx` — 500 líneas con 3 componentes internos completos que deberían ser archivos propios.
- `propertyController.js` — 592 líneas; `createProperty`/`updateProperty` mezclan validación + slug + persistencia + historial + notificaciones + audit log (violación SRP).
- `analyticsController.js` — `getDashboard` en una función de ~165 líneas con ~15 queries secuenciales.

### Top 5 de calidad
1. Pérdida de rastro de seguimiento cuando falla el WhatsApp (`leadController.js:297-315`).
2. Falta de control de concurrencia + validación de teléfono en notificaciones masivas de WhatsApp.
3. `className` duplicado en `AdminPropertiesPage.jsx` (bug real, fácil de detectar en revisión de código).
4. `client/package.json` contaminado con dependencias de servidor.
5. Falta de validación de `JWT_SECRET` al boot + `.env.example` desactualizado — ambos generan fallos silenciosos difíciles de diagnosticar en un despliegue real.

---

## 5. Hallazgos de rendimiento

| # | Hallazgo | Archivo:línea | Impacto actual | Acción recomendada |
|---|---|---|---|---|
| 1 | Sin índices en columnas de filtro frecuente (`status`, `city`, `isFeatured`, `auctionDate` en `Property`; `status`, `propertyId` en `Lead`) | `server/src/models/Property.js`, `Lead.js` | Imperceptible hoy; degrada con miles de registros | Agregar bloque `indexes: []` en la definición del modelo y aplicar `ALTER TABLE` en producción |
| 2 | Export Excel/PDF carga el inventario completo en memoria sin límite | `exportController.js:79-104, 133-257` | Bajo con volumen actual | No prioritario; limitar a futuro si el inventario crece a miles |
| 3 | PDF público de cotización descarga la imagen en resolución original | `exportController.js:115-128`, ruta sin auth en `routes/export.js:18` | Bajo | Aplicar transform `w_800` antes del `fetch` a Cloudinary |
| 4 | SSE con `EventEmitter` en memoria no escala horizontalmente (cluster/multi-instancia) | `leadController.js:192-226`, `utils/leadEvents.js` | Nulo en deploy de un solo proceso (caso actual en Render) | Documentar la limitación; Redis Pub/Sub solo si se escala a cluster |
| 5 | Subida de imágenes sin límite de resolución antes de Cloudinary | `propertyController.js:384` | Bajo (gasta ancho de banda de subida, no afecta al visitante final) | Agregar `width: 2000, crop: 'limit'` a la transformación de subida |
| 6 | `LeadsPage` carga `limit: 100` fijo sin paginación real; el Kanban filtra in-memory | `client/src/pages/admin/LeadsPage.jsx:279` | Bajo hoy; leads más antiguos quedan invisibles si se supera el límite | Usar `data.pagination` ya devuelto por el backend o control "cargar más" |
| 7 | `PropertyCard` sin `React.memo` | `client/src/components/ui/PropertyCard.jsx` | Bajo (12-50 tarjetas en pantalla) | `export default memo(function PropertyCard...)` |

### Verificado sin hallazgos relevantes
- React Query con `staleTime` global razonable, sin refetch agresivo.
- `buildImageUrl` y `loading="lazy"` aplicados consistentemente en tarjetas y galería.
- Code splitting por ruta correcto; bundle del cliente no incluye las dependencias de servidor pese a estar declaradas (Vite las descarta por tree-shaking de imports).
- Rate limiting calibrado razonablemente para tráfico regional moderado.

### Top 5 priorizado (impacto/esfuerzo)
1. Índices en `Property`/`Lead` — mayor apalancamiento futuro, esfuerzo bajo.
2. Límite de resolución en subida a Cloudinary — una línea de cambio.
3. Limpiar `client/package.json` — esfuerzo trivial, mejora higiene de auditoría.
4. Paginar `LeadsPage` correctamente — previene bug silencioso de leads "perdidos".
5. Transform `w_800` en el PDF público de cotización — endpoint sin auth, conviene que sea liviano.

---

## 6. Hallazgos de UX / Accesibilidad

### Navegación
- Botón de filtros sin `aria-expanded`/`aria-controls` — `client/src/pages/public/PropertiesPage.jsx:113-138`.
- Labels de filtros sin `htmlFor`/`id` vinculados a sus inputs — `PropertiesPage.jsx:157-212`.
- "Cerrar sesión" en el admin no pide confirmación, a diferencia de las eliminaciones (que sí usan `ConfirmDialog`) — `AdminLayout.jsx:50`.

### Formularios
- `AlertSubscriptionForm.jsx:28` y `ContactForm.jsx:23`: validación mínima vía `toast.error` genérico, sin marcar el campo específico con error inline — para un usuario ansioso (proceso de remate bancario) esto deja sin rastro de qué corregir.
- Campo `phone` nuevo sin validación de formato ni en frontend ni en backend (`alertController.js`) — falla silenciosamente más adelante en `whatsappService.js`.
- Loading states correctos en general (`disabled={mutation.isPending}` + spinner).

### Experiencia móvil
- Responsive bien aplicado (grids, navbar hamburguesa, `overflow-x-auto` en tablas admin).
- **Drag & drop del Kanban de leads solo funciona con mouse** — sin soporte táctil ni alternativa de botón "mover a siguiente estado", inutilizable desde tablet/móvil — `LeadsPage.jsx:194-267`.
- Drawer móvil del admin sin transición de entrada/salida (a diferencia del menú público que sí anima).

### Accesibilidad
- **`Lightbox.jsx`**: sin `role="dialog"`/`aria-modal`, sin focus trap, botones de control sin `aria-label`, y los "dots" de paginación son interactivos pero no hacen nada (`onClick` solo con `stopPropagation`) — confuso para teclado y lectores de pantalla.
- Botones hamburguesa/menú sin `aria-label`/`aria-expanded` en `Navbar.jsx:85-97`, `AdminLayout.jsx:90-92`, y botón mostrar/ocultar contraseña en `LoginPage.jsx:66-69`.
- `<div onClick>` sin `role="button"`/`tabIndex`/`onKeyDown` en tarjetas de Kanban y lista de `LeadsPage.jsx` — no operables por teclado.
- Contraste sistemático insuficiente: `text-gray-400` sobre fondo blanco (~2.8:1, bajo el mínimo WCAG AA de 4.5:1) en metadatos/fechas/placeholders a lo largo de varias páginas.
- Botón "+" para agregar nota sin `aria-label` (`LeadsPage.jsx:183-186`); ícono de papelera para una acción que en realidad abre confirmación de cierre, no de borrado directo.
- Puntos positivos: `alt` descriptivo y decorativo correctamente diferenciado en imágenes de propiedad; uso consistente de `Badge`/`STATUS_VARIANTS`.

### Rendimiento percibido
- Skeletons bien implementados (`PropertyCardSkeletonGrid`, `animate-pulse`).
- `PageFallback` en `App.jsx:42` es solo un spinner sin texto ni `aria-live` — mejorable para conexiones móviles lentas.

---

## 7. Riesgos para producción

### Crítico (bloqueante)
- ~~`POST /api/auth/register` permite crear cuentas admin sin autenticación.~~ **CORREGIDO** (2026-06-18) — ver detalle en sección 3.

### Alto
- ~~XSS por HTML sin escapar en `emailService.js` (vector: formularios públicos de contacto/postulación/feedback/alertas).~~ **CORREGIDO** (2026-06-18) — ver detalle en sección 3.
- Ausencia de `helmet` / cabeceras de seguridad HTTP.
- Pérdida de rastro de seguimiento de leads cuando falla el envío de WhatsApp (no se crea nota ni audit log).
- Notificaciones masivas de WhatsApp sin control de concurrencia ni validación de teléfono — riesgo de suspensión de la cuenta de WhatsApp Business por abuso/spam reportado.

### Medio
- `GET /properties/:id/documents` público sin autenticación (posible fuga de documentos legales).
- Falta `trust proxy` — invalida rate limiting por IP y logs de auditoría detrás de Render.
- `.env.example` desactualizado (faltan `CLOUDINARY_*`, sobran `SENDGRID_*` muertas) — riesgo de despliegues mal configurados.
- Sin validación de `JWT_SECRET` al boot — fallos de auth silenciosos difíciles de diagnosticar.
- Miniaturas del PDF de inventario nunca se renderizan (`getFirstImagePath` roto).

### Bajo
- `client/package.json` con dependencias de servidor sin usar.
- SSE en memoria no escala a múltiples instancias (sin impacto en el deploy actual de un solo proceso).
- Falta de índices explícitos en columnas de filtro frecuente (sin impacto al volumen actual).
- Drag & drop de Kanban inoperable en touch.

---

## 8. Riesgos para la tesis

### Fortalezas a resaltar en la presentación
- Code splitting que excluye el panel admin del bundle de visitantes anónimos (decisión de seguridad + performance, no solo performance).
- Zustand para estado compartido entre componentes desconectados (`useFavorites`/`useComparator`), evitando prop drilling y desincronía.
- SSE con manejo correcto de heartbeat, limpieza de listeners y whitelist de CORS reflejado.
- Audit logging transversal con trazabilidad completa (`userId`, `ip`, `detail`) en mutaciones administrativas — relevante para un dominio legal/financiero.
- Modelo de dominio rico con 14 entidades Sequelize y políticas de cascada (`CASCADE` vs `SET NULL`) aplicadas con criterio.
- CI con jobs y dependencias bien estructurados, aunque el test en sí sea un placeholder.
- Manejo explícito del dominio ambiguo `price: null → "PENDIENTE"` centralizado, evitando reglas ad-hoc por componente.

### Puntos que un evaluador exigente criticaría (preparar respuesta, no ocultar)
- **Cero tests automatizados** — el script `npm test` es un placeholder (`echo 'Tests pendientes' && exit 0`) que siempre da verde en CI, lo cual es peor que no tener pipeline de test porque da una falsa señal de confianza.
- **Sin migraciones formales de base de datos** — `sync({ alter: false })` no deja historial versionado de cambios de schema ni permite rollback.
- **Manejo de errores duplicado y genérico** — mismo bloque `try/catch → console.error → 500` repetido en ~10 controladores, sin middleware de error centralizado ni logging estructurado (todo vía `console.error`, sin niveles ni persistencia más allá de lo que capture el hosting).
- **Sin control de concurrencia optimista** en actualizaciones multiusuario (leads, propiedades) — el último `update` gana sin aviso de conflicto.
- **Validación inconsistente entre frontend y backend**, evidente en el campo `phone` nuevo (solo `maxLength` en HTML, sin patrón en ningún lado).
- **`client/package.json` contaminado** — primer indicio visible de descuido al abrir el repo.

### Preguntas probables del comité (con guía de respuesta)
1. *¿Por qué `sync({alter:false})` en vez de migraciones formales?* → Limitación consciente por tamaño de equipo/plazo; explicar riesgo real y qué se haría distinto en v2 (Sequelize CLI/Umzug).
2. *¿Por qué no hay tests automatizados si el CI los ejecuta?* → Admitir la ausencia honestamente; mostrar qué se probaría primero (controllers críticos, `formatPrice`, cálculo de días restantes de subasta).
3. *¿Cómo se garantiza que rutas admin no sean accesibles sin autenticación, en frontend y backend?* → Explicar el doble control: `ProtectedRoute` (UX) + middleware `authenticate`/`authorize` (seguridad real); aclarar que el code-splitting es optimización, no control de acceso.
4. *¿Qué pasa si dos admins editan el mismo lead a la vez?* → Admitir ausencia de optimistic locking; proponer columna `version`.
5. *¿Por qué se repite el mismo `try/catch` en cada controlador en vez de un middleware de error global?* → Reconocer la duplicación y proponer `app.use((err, req, res, next) => ...)` con `next(error)`.
6. *¿Cómo escalarían SSE con múltiples instancias/cluster?* → Admitir que el `EventEmitter` en memoria no se comparte entre procesos; proponer Redis Pub/Sub si se necesitara escalar.
7. *¿Qué pasa si el token de WhatsApp expira? ¿Cómo se detecta?* → Mostrar el guard `isConfigured()`, admitir falta de monitoreo activo, proponer health-check periódico.
8. *`toE164` asume código de país +52 por defecto — ¿qué pasa con números de otros países?* → Admitir la limitación de código nuevo sin tests; proponer selector de país explícito.
9. *¿Cómo se previene XSS al renderizar contenido de usuario (mensajes, notas)?* → React escapa JSX por defecto (no se usa `dangerouslySetInnerHTML` en el frontend); admitir que la sanitización de backend es mínima y que los emails HTML sí tienen ese hueco (hallazgo de este reporte).
10. *¿Hay documentación de API más allá de Swagger?* → Mostrar `/api/docs`; admitir falta de versionado (`/api/v1`) y de contratos formales.

---

## 9. Plan de mejoras priorizado

| Prioridad | Mejora | Impacto | Esfuerzo |
|---|---|---|---|
| 1 | ~~Bloquear `POST /api/auth/register` con `authenticate + authorize('admin')`~~ **CORREGIDO** | Crítico — cierra el control de acceso roto | Bajo |
| 2 | ~~Escapar HTML de inputs de usuario en `emailService.js` (helper `escapeHtml`)~~ **CORREGIDO** | Alto — elimina XSS en correos transaccionales | Bajo |
| 3 | Agregar `helmet()` en `server/app.js` | Alto — cabeceras de seguridad básicas en todo el sitio | Bajo |
| 4 | Capturar errores de WhatsApp por separado en `leadController.js` y crear siempre la `LeadNote`/audit log | Alto — evita perder rastro de seguimiento de leads | Medio |
| 5 | Validar formato de teléfono (modelo + frontend) y limitar concurrencia de envíos masivos de WhatsApp | Alto — evita spam a terceros y suspensión de cuenta de Meta | Medio |
| 6 | Proteger `GET /properties/:id/documents` o separar documentos públicos/privados | Medio — evita fuga de documentos legales | Bajo |
| 7 | Agregar `app.set('trust proxy', 1)` | Medio — corrige rate limiting y logs de auditoría detrás de Render | Bajo |
| 8 | Validar `JWT_SECRET` al boot + actualizar `.env.example` (Cloudinary sí, SendGrid no) | Medio — evita fallos silenciosos en despliegue | Bajo |
| 9 | Arreglar `getFirstImagePath` en `exportController.js` (usar `getImageBuffer`) | Medio — restaura miniaturas en PDF de inventario | Bajo |
| 10 | Limpiar `client/package.json` de dependencias de servidor sin usar | Bajo — higiene de auditoría, sin impacto en runtime | Bajo |
| 11 | Extraer `alertService.notifyMatchingAlerts(property)` y llamarlo también en `updateProperty` | Medio — corrige notificaciones faltantes al reactivar propiedades | Medio |
| 12 | Agregar índices a `Property` (`status`, `city`, `isFeatured`, `auctionDate`) y `Lead` (`status`, `propertyId`) | Medio (preventivo) — evita degradación al crecer el inventario | Bajo |
| 13 | Paginar `LeadsPage` correctamente en vez de `limit: 100` fijo | Medio — evita leads "perdidos" de vista | Bajo |
| 14 | Accesibilidad: focus trap + `aria-label`/`aria-modal` en `Lightbox.jsx`; `aria-label` en botones de solo ícono; reemplazar `<div onClick>` por `<button>` en tarjetas de Kanban/lista | Medio — corrige operabilidad por teclado y lectores de pantalla | Medio |
| 15 | Mejorar contraste de `text-gray-400` a `text-gray-500`/`600` en metadatos sobre fondo blanco | Bajo — cumplimiento WCAG AA | Bajo |
| 16 | Extraer duplicación: paginación (`utils/pagination.js`), upload a Cloudinary (`utils/cloudinaryUpload.js`), labels backend (`utils/labels.js`), boilerplate Excel/PDF | Bajo (mantenibilidad) — reduce ~800 líneas de duplicación entre controllers | Medio-alto |
| 17 | Agregar fallback táctil (botones "mover a siguiente estado") al Kanban de leads para uso desde tablet/móvil | Bajo | Medio |
| 18 | Agregar `React.memo` a `PropertyCard` | Bajo | Bajo |
| 19 | Documentar honestamente en la tesis la ausencia de tests automatizados y migraciones formales, con plan de qué se haría en v2 | Alto para la defensa académica, nulo para producción | Bajo |
