# AUDITORÍA TÉCNICA COMPLETA — TRIOMPHE BIENES RAÍCES

**Fecha:** 2026-08-31
**Tipo:** Auditoría de solo lectura (ningún archivo fue modificado)
**Alcance:** Backend (Express/Sequelize/MySQL), Frontend (React 19/Vite), CRM, calendario/citas, formularios, seguridad, rendimiento, base de datos, escalabilidad, dependencias, deployment (SmarterASP.NET/IIS)
**Metodología:** 6 revisiones paralelas independientes (seguridad/autorización backend, rendimiento/BD/escalabilidad backend, rendimiento/calidad frontend, CRM/calendario/formularios, bugs/manejo de errores/logging/código muerto/tests, configuración/deploy/dependencias/compatibilidad), cada una con lectura completa de código fuente, `npm audit`, y verificación cruzada contra 9 auditorías previas documentadas en el repositorio (no se asumió como vigente ningún hallazgo histórico sin re-verificarlo contra el código actual).

**Verificación de no-modificación:** `git status` al cierre de la auditoría confirma que el único cambio pendiente en el árbol de trabajo (`server/box_stays_check2.mjs` eliminado, staged) es previo al inicio de esta auditoría — ningún archivo fue creado, editado ni borrado durante el proceso de análisis.

---

## Resumen ejecutivo

Triomphe Remates es una base de código madura, con varias generaciones de auditorías previas y correcciones reales incorporadas (migración completa a `ApiError`, hardening de JWT con `tokenVersion`, rate limiting por capas bien diseñado, row-level access control documentado y en su mayoría bien aplicado, transacciones Sequelize en todos los flujos críticos de cierre de venta, cero código muerto real detectado, cero vulnerabilidades en `npm audit` del backend). La arquitectura de fondo es sólida y las decisiones de diseño documentadas en `CLAUDE.md` se reflejan fielmente en el código.

Dicho esto, esta auditoría encontró **8 hallazgos críticos confirmados por lectura directa de código**, concentrados en tres patrones recurrentes:

1. **Control de acceso incompleto en el módulo de analítica del CRM** (`crmAnalyticsController.js`): dos endpoints (`/api/crm/dashboard`, `/api/crm/reports`) exponen PII de clientes de otros asesores y cifras financieras/de desempeño de toda la empresa a un rol de bajo privilegio (`asesor_ventas`), rompiendo el mismo modelo de "solo veo lo mío" que el resto del CRM aplica correctamente. El propio código lo admite en comentarios como una brecha conocida.
2. **Estado stale/race conditions en flujos de alta frecuencia**: el panel de detalle de prospecto puede guardar el texto de un prospecto sobre el registro de otro (bug de `key` faltante en React), la comprobación de teléfono duplicado tiene una condición de carrera real sin respaldo a nivel de base de datos, y no existe ninguna configuración de zona horaria en todo el stack — las citas se persisten con una hora "naive" que depende silenciosamente de la zona horaria del proceso Node en el host de producción.
3. **Observabilidad rota exactamente donde más se necesita**: un uso extendido de `console.*` en vez del logger winston configurado significa que, en producción (SmarterASP/IIS con `stdout` deshabilitado), los fallos de auditoría, envío de correos, historial de precios y generación de sitemap son completamente invisibles — el propio código de `logger.js` documenta esta limitación de la plataforma y aun así no se respeta consistentemente.

Ningún hallazgo constituye una vulnerabilidad de inyección SQL, bypass de autenticación, o RCE — la superficie "clásica" de OWASP Top 10 está bien resuelta. El riesgo real está en la ejecución específica de reglas de negocio (autorización por fila, deduplicación, zonas horarias) y en la capacidad de detectar y diagnosticar problemas en producción.

### Puntuación por categoría

| Categoría | Puntuación | Justificación breve |
|---|---|---|
| Seguridad | 68/100 | Autenticación/JWT/rate-limiting/CSP sólidos y sin vulnerabilidades clásicas, pero 2 endpoints de analítica CRM exponen PII y datos financieros entre roles (broken access control confirmado) y el leak de SSE de leads sigue sin corregirse desde 2026-08-20 |
| Rendimiento (Backend+Frontend) | 60/100 | Patrones correctos en la mayoría de rutas (transacciones, fire-and-forget de emails, paginación estandarizada, Kanban virtualizado), pero un full-table-scan en cada creación de lead, exports sin cota que pueden agotar memoria/sockets, y una dependencia de 200KB cargada de forma estática en la página pública de mayor tráfico |
| Arquitectura | 76/100 | Convenciones bien establecidas y mayormente respetadas (ApiError, RBAC, migraciones, lazy-loading, Zustand), pero el módulo más nuevo (CRM rediseñado 2026-08-31) no heredó la misma disciplina de índices/tests que el resto |
| Calidad de código | 80/100 | Sin código muerto real, sin `dangerouslySetInnerHTML`, duplicaciones históricas en su mayoría ya resueltas; quedan drifts menores y localizados |
| Estabilidad | 58/100 | El motor de estados del pipeline CRM es robusto, pero el bug de `key` faltante (corrupción cruzada de datos), ausencia total de zona horaria, y 4 pantallas admin que muestran pantalla en blanco ante un error real, son fallas concretas y reproducibles hoy |
| Escalabilidad | 55/100 | Diseño de paginación cuidado en el núcleo del CRM, pero tablas nuevas/adyacentes (`lead_notes`, `property_status_history`, `businessLine`/`category`) carecen de los índices que ya se aplicaron en el resto — degradación proyectada real a partir de miles de registros |

**Puntuación global estimada: 66/100** — proyecto en buen estado general, con deuda técnica identificable, localizada y corregible sin rediseño, pero con varios hallazgos que ya son reproducibles hoy (no solo a futuro) y merecen atención antes del próximo ciclo de crecimiento de datos.

---

## Hallazgos críticos 🔴

### SEC-001 — Dashboard CRM expone PII de prospectos de otros asesores a `asesor_ventas`
**Categoría:** Seguridad — Broken Access Control
**Problema:** `GET /api/crm/dashboard` filtra la conexión por rol (`requireCrmAccess`) pero no por fila. De sus 9 consultas paralelas, solo el contador `prospectosEstancados` aplica `getLeadVisibilityWhere`; `citasHoy` incluye `{ model: Lead, attributes: ['id','name','phone'] }` y `actividadReciente` incluye nombre del lead, ambas sin filtrar por `assignedToUserId`.
**Ubicación:** `server/src/controllers/crmAnalyticsController.js:72-143` (`getCrmDashboard`); ruta en `server/src/routes/crm.js:17`
**Por qué es un problema:** Contradice directamente la regla documentada en `server/src/utils/leadAccess.js` ("asesor_ventas ve/edita únicamente los leads asignados a él"), aplicada correctamente en todos los demás endpoints de leads/citas/tareas/deals/export. El propio código admite el gap en un comentario inline.
**Impacto:** Cualquier `asesor_ventas` autenticado ve nombre+teléfono de prospectos ajenos agendados para hoy, actividad reciente de todo el pipeline, y cifras de ventas/ingresos de toda la empresa.
**Cómo reproducirlo:** Autenticarse como `asesor_ventas` y llamar `GET /api/crm/dashboard`; comparar `citasHoy`/`actividadReciente` contra los leads realmente asignados a ese usuario.
**Recomendación:** Aplicar `getLeadVisibilityWhere(req.user, { alias: 'lead' })` a `citasHoy` y `actividadReciente`; para los agregados de ventas/ingresos, decidir explícitamente si deben restringirse a `authorize('admin','asistente_administrativo')`.
**Estado:** CONFIRMADO

### SEC-002 — Endpoint de reportes CRM expone ingresos y desempeño por asesor a cualquier rol con acceso al CRM
**Categoría:** Seguridad — Broken Access Control
**Problema:** `GET /api/crm/reports` no aplica ningún filtro de visibilidad por fila y devuelve un desglose "por asesor" (nombre, cantidad de leads, ventas cerradas, ingresos) a cualquier usuario con `requireCrmAccess`, incluyendo `asesor_ventas`.
**Ubicación:** `server/src/controllers/crmAnalyticsController.js:207-327` (`getCrmReports`); ruta `server/src/routes/crm.js:18`
**Por qué es un problema:** El propio comentario del código (línea 237-239) dice que un "leaderboard" fue deliberadamente excluido del alcance de la Fase 1 del CRM, pero el endpoint lo expone igual. Es dato de desempeño/compensación sensible internamente.
**Impacto:** Un asesor de ventas puede ver ingresos, ventas cerradas y volumen de leads de sus compañeros.
**Cómo reproducirlo:** `GET /api/crm/reports` autenticado como `asesor_ventas`; inspeccionar `data.porAsesor`.
**Recomendación:** Restringir la ruta a `authorize('admin','asistente_administrativo')`, o filtrar `porAsesor` a solo la fila del propio usuario si `asesor_ventas` debe conservar acceso.
**Estado:** CONFIRMADO

### DB-001 — Comprobación de teléfono duplicado: full-table-scan en cada creación de lead + condición de carrera sin respaldo en BD
**Categoría:** Base de Datos / CRM
**Problema:** `findDuplicatePhoneLead` carga **toda** la tabla `leads` a memoria en cada `POST/PUT` de lead con teléfono y compara normalizando en JavaScript, sin índice único sobre `leads.phone`. El check-then-insert ocurre fuera de la transacción de creación, sin lock: dos capturas casi simultáneas del mismo teléfono pueden ambas superar la validación.
**Ubicación:** `server/src/controllers/leadController.js:261-272` (`findDuplicatePhoneLead`), invocado en `createLead` (:310-315, antes de la transacción de :368-425) y `updateLead` (:649). Ninguna migración crea un índice único sobre `phone`.
**Por qué es un problema:** Es la única regla de negocio explícita del cliente ("un teléfono no puede repetirse"), aplicada solo en código de aplicación, con un patrón de lectura que escala linealmente con el tamaño total de la tabla en la ruta más transitada del negocio.
**Impacto:** A 10k leads, cada request de captura carga y recorre ~10k filas en memoria del proceso Node — latencia creciente sin techo. Bajo concurrencia (doble clic, dos asesores capturando el mismo prospecto, un tab duplicado), la regla de unicidad puede bypassearse silenciosamente y crear duplicados — justo lo que pretende evitar.
**Cómo reproducirlo:** Poblar `leads` con miles de filas con teléfono y medir `POST /api/leads`; para la carrera, disparar dos `POST /api/leads` concurrentes con el mismo teléfono (ambos devuelven 201).
**Recomendación:** Agregar una columna `phoneNormalized` (mantenida en un hook `beforeSave`) con índice único en migración, y capturar el error de duplicado de MySQL (`ER_DUP_ENTRY`) como 409 en el controller, en vez de un `findAll` completo.
**Estado:** CONFIRMADO (confirmado independientemente desde dos ángulos: rendimiento/escalabilidad y condición de carrera de negocio)

### PERF-B-001 — Exports sin cota de filas + N descargas paralelas sin límite a Cloudinary (riesgo de agotar memoria/sockets del proceso)
**Categoría:** Rendimiento Backend / Escalabilidad
**Problema:** Todos los exports (`exportExcel`, `exportPDF`, `exportLeadsExcel`, `exportFeedbackExcel`, `exportWaitingListExcel/PDF`, `exportCatalogPDF`) hacen `findAll()` sin ningún límite de filas, y los dos exports de inventario disparan `Promise.all(properties.map(getCoverThumbnailBuffer))` — N peticiones HTTPS paralelas sin límite de concurrencia a Cloudinary, una por propiedad del resultado. El workbook de ExcelJS se construye entero en memoria (no `WorkbookWriter` en modo streaming).
**Ubicación:** `server/src/controllers/exportController.js:65,152,347,378,482,609`; `server/src/services/exportHelpers.js:111-179,193-206`
**Por qué es un problema:** No hay techo de filas ni backpressure en las descargas de imágenes.
**Impacto:** Con un inventario de miles de propiedades con foto, un solo export dispara miles de fetches HTTP simultáneos a Cloudinary — puede agotar sockets del proceso Node, disparar rate-limiting de Cloudinary, consumir cientos de MB de RAM, y bloquear el event loop mientras ExcelJS arma miles de filas de forma síncrona. Puede volver el proceso inutilizable para el resto de requests concurrentes.
**Cómo reproducirlo:** `GET /api/export/excel` (o `/pdf`) sin filtros contra una base con miles de propiedades con imágenes; observar memoria/sockets del proceso.
**Recomendación:** (1) Tope duro de filas por export (ej. 2,000) con error claro si se excede; (2) descargar miniaturas con concurrencia limitada (mismo patrón `CONCURRENCY_LIMIT` ya usado en `alertService.js`); (3) usar `ExcelJS.stream.xlsx.WorkbookWriter` para no retener todo el workbook en memoria.
**Estado:** CONFIRMADO

### PERF-F-001 — Dependencia de 200KB cargada estáticamente en la página pública de mayor tráfico
**Categoría:** Rendimiento Frontend
**Problema:** `html2canvas` (~200KB minificado) se importa de forma estática en `DownloadQuoteButton.jsx`, aunque solo se usa dentro del handler de clic de un botón secundario. El chunk de `PropertyDetailPage` pesa 225KB (54.86KB gzip) — más grande que `react-vendor` y casi el doble que `CrmPage`.
**Ubicación:** `client/src/components/ui/DownloadQuoteButton.jsx:5`, usado en `client/src/pages/public/PropertyDetailPage.jsx:30,476`
**Por qué es un problema:** Contradice el propio patrón de lazy-loading que el resto de la app aplica correctamente a nivel de ruta.
**Impacto:** Todo visitante que abre una ficha de propiedad descarga html2canvas completo aunque nunca use la función de descarga; +54KB gzip en la página más visitada del sitio, penalizando LCP/TTI en móvil.
**Cómo reproducirlo:** `npm run build` y comparar `dist/assets/PropertyDetailPage-*.js` contra cualquier otra página pública.
**Recomendación:** Import dinámico dentro de `handleDownload`: `const { default: html2canvas } = await import('html2canvas')`.
**Estado:** CONFIRMADO

### CRM-001 — `LeadDetailPanel` sin `key` por lead en 2 de 3 rutas de montaje → un guardado puede sobrescribir el registro de otro prospecto
**Categoría:** CRM / Bugs
**Problema:** `LeadDetailPanel` mantiene los campos editables en `useState` local, inicializado una vez al montar desde `selected`. La columna de escritorio fuerza correctamente un remount por lead (`key={selected.id}`), pero el overlay móvil (`DetailPanelSlot`) y `LeadDetailWithActions.jsx` (usado desde "Ver prospecto" en el Calendario) montan el mismo componente **sin** ese `key`.
**Ubicación:** `client/src/components/admin/LeadDetailPanel.jsx:1383-1409` (rama móvil); `client/src/components/admin/crm/LeadDetailWithActions.jsx:46-54`
**Por qué es un problema:** Si `selected` cambia a otro lead mientras el componente permanece montado (ej. clic en "Ver prospecto" de una segunda cita mientras el panel de la primera sigue abierto — `CalendarioSection` lo permite deliberadamente al no usar backdrop), los buffers de input conservan los valores del lead anterior mientras el guardado por blur (`saveField`) los envía con el `id` del lead nuevo.
**Impacto:** Contaminación silenciosa de datos entre prospectos — el `searchZone`/`budgetAmount`/teléfono de un lead se sobrescribe con valores destinados a otro. En un CRM inmobiliario esto corrompe directamente el registro usado para hacer match cliente-propiedad.
**Cómo reproducirlo:** En móvil (o vía Calendario), abrir el panel de un lead, empezar a editar un campo sin guardar/salir, y disparar una segunda acción "Ver prospecto" que cambia `selected` a otro lead sin cerrar el panel primero — el texto viejo permanece, ahora ligado a los handlers de guardado del lead nuevo.
**Recomendación:** Agregar `key={selected.id}` en ambos puntos de render, igual que en la rama de escritorio.
**Estado:** CONFIRMADO

### CAL-001 — Ninguna configuración de zona horaria en todo el stack; las citas se persisten con hora "naive"
**Categoría:** Calendario y Citas
**Problema:** No hay `timezone`/`TZ` configurado en `server/config/db.js` ni en variables de entorno. Toda captura de fecha/hora de cita (`ContactForm.jsx`, el agendador admin, el modal de reprogramación) usa `<input type="datetime-local">` sin offset, enviado directamente a `Appointment.create({ scheduledAt })`.
**Ubicación:** `server/config/db.js` (sin opción de timezone); `server/src/controllers/appointmentController.js:116-156,211-250`; `client/src/components/ui/ContactForm.jsx:79`; `client/src/components/admin/LeadDetailPanel.jsx:1330`; `client/src/components/admin/crm/AppointmentDetailModal.jsx:214`
**Por qué es un problema:** Una hora "naive" se interpreta según la zona horaria del proceso Node/driver MySQL en el momento de escritura. El propio código (`leadController.js:81-85`) ya tiene un workaround (regex) para proteger solo la *validación* de horario, pero no protege el valor que finalmente se persiste.
**Impacto:** Si el host de producción tiene un `TZ` distinto al de México (común en hosting genérico), cada cita almacenada queda desplazada por la diferencia de horas — puede incluso saltar al día calendario incorrecto cerca de medianoche.
**Cómo reproducirlo:** Desplegar con el proceso Node en UTC mientras staff/clientes están en America/Chihuahua; agendar una cita a las 9:00 AM e inspeccionar el `scheduledAt` almacenado.
**Recomendación:** Fijar `timezone` explícito en la configuración de Sequelize (o `TZ=America/Chihuahua` en el proceso Node), y/o enviar ISO strings con offset desde el cliente en vez de `datetime-local` naive.
**Estado:** CONFIRMADO

### LOG-001 — Uso extendido de `console.*` en vez del logger winston: fallos críticos invisibles en producción
**Categoría:** Logging / Observabilidad
**Problema:** Rutas de fallo silencioso ("fire-and-forget") en `utils/audit.js`, `authController.js`, `leadController.js`, `feedbackController.js`, `jobController.js`, `propertyController.js`, `sitemap.js`, `services/exportHelpers.js`, `emailService.js`, `whatsappService.js` usan `console.log/error/warn` en vez de `logger` (winston).
**Ubicación:** `server/src/utils/audit.js:13`; `authController.js:131`; `leadController.js:429,431,441`; `feedbackController.js:38`; `jobController.js:154,157`; `propertyController.js:532,553`; `sitemap.js:45`; `exportHelpers.js:57`; `emailService.js:106,108`; `whatsappService.js:23`
**Por qué es un problema:** `server/src/utils/logger.js:7-11` documenta explícitamente que en producción (SmarterASP/IIS) `stdoutLogEnabled="false"` — cualquier `console.*` no pasa por winston ni se escribe a `logs/*.log`; en producción esos mensajes no van a ningún lado.
**Impacto:** Fallos de auditoría, de envío de emails de notificación (leads/feedback/vacantes), de registro de historial de estatus/precio de propiedades, y de generación del sitemap son completamente invisibles en producción — imposible investigar un reporte de usuario relacionado.
**Cómo reproducirlo:** Provocar un fallo de Gmail/SMTP en producción y revisar `logs/error.log` — no aparecerá nada, aunque el email no se envió.
**Recomendación:** Reemplazar todos por `logger.error/warn` — el patrón correcto ya existe en `alertService.js:61-92`.
**Estado:** CONFIRMADO

---

## Hallazgos de alto riesgo 🟠

### SEC-003/BUG-001 — Stream SSE de leads nuevos transmite PII a todos los clientes CRM sin filtrar por asignación
**Categoría:** Seguridad / Bugs
**Problema:** `GET /api/leads/stream` transmite cada evento `new-lead` (nombre, email, tipo, propiedad) a **todos** los clientes CRM conectados, sin aplicar el filtrado por fila que sí aplica cada endpoint REST del módulo. La conexión está gateada por `requireCrmAccess`, pero no el payload.
**Ubicación:** `server/src/controllers/leadController.js:444` (emisión) y `:1139-1165` (`streamLeads`); ruta `server/src/routes/leads.js:47`
**Por qué es un problema:** `leadEvents` es un `EventEmitter` global sin partición por usuario; cada endpoint REST del módulo (`getLeads`, `getLeadById`, citas, tareas, deals, export) sí aplica `getLeadVisibilityWhere`/`canViewLead`, rompiendo la consistencia del modelo de acceso.
**Impacto:** Un `asesor_ventas` ve en tiempo real datos de contacto de prospectos que no le pertenecen.
**Cómo reproducirlo:** Loguearse como `asesor_ventas` sin leads asignados, abrir el panel con notificaciones activas, y crear un lead público — el evento llega igual.
**Recomendación:** Filtrar en `onNewLead` contra `getLeadVisibilityWhere`/`canViewLead` por conexión antes de `res.write`, o segmentar el emisor por usuario.
**Estado:** RE-CONFIRMADO por dos revisiones independientes — hallazgo documentado desde 2026-08-20, sigue sin corregirse. Ver también TEST-002 (sin cobertura de test que hubiera detectado esto).

### DB-002 — `property_status_history` sin índice sobre `propertyId`, consultada desde la ficha pública de propiedad
**Categoría:** Base de Datos
**Problema:** No existe índice sobre `propertyId` en el modelo ni en ninguna migración, pero se consulta con `WHERE propertyId = ?` desde el endpoint público de historial de precio, llamado desde cada ficha de propiedad.
**Ubicación:** `server/src/models/PropertyStatusHistory.js`; `server/src/controllers/propertyController.js:766-772,775-789`
**Impacto:** Cada vista de ficha pública dispara un full-table-scan sobre una tabla que crece indefinidamente con cada cambio de estatus/precio de cualquier propiedad — degradación silenciosa que empeora con los años de operación.
**Recomendación:** `addIndex('property_status_history', ['propertyId', 'createdAt'])`.
**Estado:** CONFIRMADO

### DB-003 — `lead_notes` sin índice sobre `leadId`; subconsulta correlacionada ejecutada por cada lead en el Dashboard CRM
**Categoría:** Base de Datos
**Problema:** `lead_notes` (tabla predata el sistema de migraciones, sin índice) se usa dentro de una subconsulta correlacionada (`staleSinceExpr()`) evaluada por cada fila de `leads`, tanto en `getLeads(?staleDays=)` como en el widget "prospectos estancados" del Dashboard CRM (recalculado en cada carga).
**Ubicación:** `server/src/models/LeadNote.js`; `server/src/utils/pipelineHelpers.js:118-124`; `leadController.js:520-526`; `crmAnalyticsController.js:91-97`
**Impacto:** A 10k leads y 50k notas, cargar el widget del Dashboard ejecuta el equivalente a ~10k table-scans contra `lead_notes` en una sola request.
**Recomendación:** `addIndex('lead_notes', ['leadId'])` — el fix de mayor relación impacto/esfuerzo de todo el audit.
**Estado:** CONFIRMADO

### DB-004 — `properties.businessLine`/`category` sin índice, siendo los ejes principales del catálogo público
**Categoría:** Base de Datos / Escalabilidad
**Problema:** Ninguna migración indexa `businessLine`/`category`, pese a ser las dimensiones de filtro principales de las 5 secciones públicas de `/propiedades`.
**Ubicación:** `server/src/models/Property.js:37-48`; `propertyController.js:66-67`
**Impacto:** Un filtro compuesto `status`+`businessLine` (caso típico de cualquier sección pública) degrada a escanear todas las filas que matchean `status`; con miles de propiedades, cada carga de sección escala con el tamaño total de la tabla, no con el de la sección.
**Recomendación:** Índice compuesto `['status', 'businessLine']`.
**Estado:** CONFIRMADO

### CAL-002 — Sin verificación de traslape/doble reserva de citas
**Categoría:** Calendario y Citas
**Problema:** Nada impide que dos citas se agenden para el mismo asesor en el mismo horario, en creación ni en reprogramación. El propio código lo admite en comentario ("No existe todavía un sistema de disponibilidad").
**Ubicación:** `server/src/controllers/appointmentController.js:116-156,211-250`
**Impacto:** Asesores doblemente agendados, visitas de cliente perdidas/duplicadas, sin ninguna señal del sistema más allá del catch visual en el calendario.
**Cómo reproducirlo:** Crear dos leads asignados al mismo asesor y agendar una cita para cada uno al mismo `scheduledAt` — ambas se crean con 201.
**Recomendación:** Verificación de conflicto contra citas no-canceladas del mismo asesor dentro de una ventana configurable, antes de crear/reprogramar.
**Estado:** CONFIRMADO

### CRM-003 — `reopenLead` permite a cualquier asesor borrar permanentemente el registro de una venta cerrada
**Categoría:** CRM
**Problema:** `PUT /:id/reopen` es alcanzable por cualquier usuario con `canEditLead` sobre ese lead — incluyendo el `asesor_ventas` propietario, no solo admin. Al reabrir un lead `venta_realizada`, hace `Deal.destroy()` (hard delete, `Deal` no es `paranoid`). El audit log no captura el `amount`/`propertyId`/`closedAt` antes de borrar.
**Ubicación:** `server/src/controllers/leadController.js:1006-1082`, específicamente `:1032-1034` (destroy) y `:1070-1075` (audit); ruta `server/src/routes/leads.js:75` usa `requireCrmAccess`, no `authorize('admin','asistente_administrativo')`
**Impacto:** Un registro de venta cerrada (base de comisiones/métricas) puede borrarse permanentemente con un clic, sin aprobación de un rol superior y sin rastro suficiente para reconstruir qué se borró.
**Cómo reproducirlo:** Como `asesor_ventas`, cerrar un lead propio como ganado, luego llamar `PUT /:id/reopen` — el `Deal` se borra de inmediato.
**Recomendación:** Restringir la reapertura de un lead *ganado* a roles con `canAssignLeads`, o capturar los campos del Deal en el audit log/Activity antes de destruirlo (o usar soft-delete).
**Estado:** CONFIRMADO

### PERF-F-002 — Sin debounce en las dos barras de búsqueda más usadas (CRM y catálogo público)
**Categoría:** Rendimiento Frontend
**Problema:** Las búsquedas de prospectos CRM y del catálogo público actualizan el estado en cada `onChange`, disparando una request nueva por cada tecla — mientras que otra pantalla del mismo proyecto (`WaitingListPage.jsx`) ya usa correctamente `useDebouncedValue` (300ms).
**Ubicación:** `client/src/components/admin/crm/ProspectosSection.jsx:66,86,200`; `client/src/pages/public/PropertiesPage.jsx:81-108,220`
**Impacto:** Escribir "juan perez" dispara ~10 requests a `/leads` o `/properties`; carga innecesaria en backend/BD y parpadeo de resultados.
**Recomendación:** Envolver `search` con el `useDebouncedValue` ya existente en el proyecto.
**Estado:** CONFIRMADO

### PERF-F-003 — Componente oculto de "ficha para descarga" carga imágenes extra en cada visita a una propiedad
**Categoría:** Rendimiento Frontend
**Problema:** `FichaTecnica` (plantilla oculta rasterizada a PNG) se monta incondicionalmente fuera de pantalla en cada render de `DownloadQuoteButton` — es decir, en cada visita a una ficha de propiedad, no solo al hacer clic en "Descargar". Dispara carga de hasta 6 imágenes que el usuario nunca ve.
**Ubicación:** `client/src/components/ui/DownloadQuoteButton.jsx:63-65`; `client/src/components/ui/FichaTecnica.jsx:60,153`
**Impacto:** Ancho de banda desperdiciado en cada visita, se agrava junto con PERF-F-001.
**Recomendación:** Montar `FichaTecnica` solo al invocar `handleDownload`, esperar carga, rasterizar y desmontar.
**Estado:** CONFIRMADO

### PERF-F-004 — Stores de favoritos/comparador sin selectores: re-render de toda la grilla en cada toggle
**Categoría:** Rendimiento Frontend
**Problema:** `useFavorites`/`useComparator` desestructuran el store Zustand completo sin selector; cualquier `set()` re-renderiza todo componente que use el hook, sin importar si el cambio le concierne.
**Ubicación:** `client/src/hooks/useFavorites.js:73`; `client/src/hooks/useComparator.js:71`; `FavoriteButton.jsx:6`; `ComparatorButton.jsx:6`
**Impacto:** En una grilla no virtualizada (ver PERF-F-005), marcar una propiedad favorita re-renderiza todos los `FavoriteButton` de la página.
**Recomendación:** Selectores por propiedad (`useShallow`), separando acciones (referencia estable) de datos.
**Estado:** CONFIRMADO

### ERR-001 — `authController.login` no sigue el patrón `ApiError`; errores 500 no llegan al logger
**Categoría:** Manejo de Errores
**Problema:** Usa try/catch manual, `console.error` y `res.status(500).json()` directamente, en vez de propagar como `ApiError` (patrón migrado en el resto de controllers en 2026-08-03).
**Ubicación:** `server/src/controllers/authController.js:98-134`
**Impacto:** Un fallo real en login (ej. error de conexión a MySQL) queda sin rastro alguno en producción — el `console.error` es invisible ahí (ver LOG-001).
**Recomendación:** Eliminar el try/catch, dejar que propague como en `register`/`changePassword` del mismo archivo.
**Estado:** CONFIRMADO

### ERR-002 — 4 pantallas admin no manejan `isError`: pantalla en blanco ante un fallo real
**Categoría:** Manejo de Errores
**Problema:** `AlertsAdminPage.jsx`, `AuditPage.jsx`, `BuzonAdminPage.jsx`, `ApplicationsPage.jsx` destructuran solo `isLoading`. Al fallar la query, `isLoading` pasa a `false`, `data` queda `undefined` — ni la rama de carga, ni la de error, ni la de "vacío" (`data?.length === 0`, que con `undefined` es falso) se activan.
**Ubicación:** líneas indicadas por cada archivo (ver detalle del agente de bugs/errores)
**Impacto:** Un admin ve una tabla vacía sin ninguna pista de que la carga falló, en 4 pantallas administrativas.
**Recomendación:** Manejo explícito de `isError` en cada página, o un `onError` global en `QueryCache` como red de seguridad mínima.
**Estado:** CONFIRMADO

### DEP-001 — Vulnerabilidad "high" en dependencia de build (`nanoid` vía PostCSS), invisible al CI de seguridad
**Categoría:** Dependencias
**Problema:** `npm audit` en `client/` reporta 1 vulnerabilidad high (`nanoid < 3.3.18`, GHSA-2v37-7h3g-55p8), transitiva vía `postcss`. El workflow `security.yml` corre con `--omit=dev`, así que esta dependencia de dev nunca aparece en el reporte de CI.
**Ubicación:** `client/node_modules/nanoid` (vía postcss, devDependency)
**Impacto:** Riesgo de explotación real bajo (requiere invocar el generador con `size=0`, no ocurre en este pipeline de build), pero es una brecha de visibilidad: una vulnerabilidad "high" puede persistir indefinidamente sin que el CI la señale.
**Recomendación:** `npm audit fix` en `client/`; considerar correr `npm audit` sin `--omit=dev` en modo warn-only para no perder visibilidad total.
**Estado:** CONFIRMADO

### TEST-001 — El rediseño completo del CRM de prospectos (2026-08-31) no tiene ninguna prueba de frontend
**Categoría:** Tests
**Problema:** Cero archivos de test para `LeadDetailWithActions.jsx`, `LeadDetailModals.jsx`, `useLeadDetailActions.js`, `ProspectosSection.jsx`, `CreateLeadModal.jsx`, ni para los 7 nuevos campos de criterios de búsqueda. El frontend completo solo tiene 5 archivos de test en total.
**Ubicación:** `client/src/components/admin/crm/` (sin `__tests__`)
**Impacto:** La superficie de UI más grande, más nueva y de mayor complejidad de negocio del proyecto queda sin ninguna red de seguridad de regresión.
**Recomendación:** Priorizar tests RTL para `useLeadDetailActions` y el flujo feliz de `CreateLeadModal`/`ProspectosSection`.
**Estado:** CONFIRMADO

### TEST-002 — El endpoint SSE de leads (con el leak de PII confirmado en SEC-003/BUG-001) no tiene ninguna prueba
**Categoría:** Tests
**Problema:** Ningún test de integración cubre `streamLeads`/`leads/stream`/`leadEvents`.
**Ubicación:** `server/src/__tests__/` (sin referencia a SSE)
**Impacto:** Es precisamente el endpoint con el bug de control de acceso confirmado — la ausencia de tests es la razón por la que esta regresión (documentada desde 2026-08-20) sigue sin corregirse dos auditorías después.
**Recomendación:** Test de integración que verifique que un `asesor_ventas` conectado al stream NO recibe eventos de leads no asignados a él.
**Estado:** CONFIRMADO

### BUG-002 — Catálogo público muestra "sin resultados" también cuando la petición realmente falló
**Categoría:** Bugs
**Problema:** `PropertiesPage.jsx` no extrae `isError` de su `useInfiniteQuery`; al fallar la query, cae en la misma rama visual que "sin resultados para estos filtros".
**Ubicación:** `client/src/pages/public/PropertiesPage.jsx:108,497-518`
**Impacto:** Un usuario final ve "no hay propiedades" y un botón "Limpiar filtros" inútil, en vez de un aviso de error/reintentar, en la página pública de mayor tráfico.
**Recomendación:** Extraer `isError` y renderizar un estado de error distinto antes de la comprobación de longitud cero.
**Estado:** CONFIRMADO

---

## Hallazgos medios 🟡

### SEC-004 — Validación de magic bytes no aplicada a subida de testimonios ni foto de perfil
**Ubicación:** `testimonialController.js:84-100,144-174`; `usersController.js:113-147` (comparar con el uso correcto en `propertyController.js:601`)
**Problema/Impacto:** `fileSignature.js` (validación de bytes reales, no extensión/MIME declarados por el cliente) solo se invoca desde `propertyController`. Un admin/asistente podría subir un archivo no-imagen disfrazado a Cloudinary vía testimonios o su propia foto de perfil.
**Recomendación:** Extraer la llamada a un middleware común aplicado también en `testimonials.js`/`users.js`.
**Estado:** CONFIRMADO

### LOG-002 — `changePassword` no registra auditoría (a diferencia de la ruta equivalente en `usersController`)
**Ubicación:** `server/src/controllers/authController.js:142-169`
**Impacto:** El flujo principal de autoservicio de cambio de contraseña no deja rastro en `AuditLog`; ante un incidente de cuenta comprometida, no hay entrada de cuándo se cambió la contraseña. Gap identificado en 2026-07-22 y aún sin corregir.
**Recomendación:** Agregar `logAudit(req, 'update', 'user', user.id, { passwordChanged: true })`, igual que en `usersController.updateUser`.
**Estado:** CONFIRMADO (regresión persistente)

### CAL-003 — Validación de horario laboral solo aplicada en el formulario público, no en los endpoints admin de citas
**Ubicación:** `leadController.js:86-115` (regla, solo usada en `:338-341`); `appointmentController.js:116-156,211-250` (sin llamarla)
**Impacto:** Datos inconsistentes — algunas citas garantizadas dentro de horario laboral/24h de anticipación, otras no; el reagendado admin puede crear una cita en el pasado o en domingo a las 2am.
**Recomendación:** Extraer `validateAppointmentDate` a un util compartido, reutilizado por `createAppointment`/`rescheduleAppointment`.
**Estado:** CONFIRMADO

### CRM-004 — Estado "vencida" de tareas calculado de forma distinta en servidor y cliente
**Ubicación:** `taskController.js:27-29` (servidor, autoritativo) vs `KanbanBoard.jsx:44` (cliente, con el reloj del dispositivo)
**Impacto:** Dos admins con relojes de dispositivo distintos pueden ver estados de "vencida" distintos para la misma tarea; el badge del Kanban puede no coincidir con el widget del Dashboard.
**Recomendación:** Calcular "vencida" en el servidor e incluirlo en el payload de la API.
**Estado:** CONFIRMADO

### CRM-005 — Sin bloqueo optimista en ediciones concurrentes de un mismo Lead
**Ubicación:** `server/src/models/Lead.js` (sin columna de versión); `leadController.js:602-784`
**Impacto:** Dos admins con el mismo lead abierto simultáneamente pueden perder ediciones silenciosamente (last-write-wins, sin aviso).
**Recomendación:** Conditional update basado en `version`/`updatedAt` con 409 en caso de conflicto.
**Estado:** CONFIRMADO (gap de diseño)

### FORM-001 — `searchZone` truncado silenciosamente a 150 caracteres, sin feedback en el input
**Ubicación:** `leadController.js:184-186` (`.slice(0,150)`); `LeadDetailPanel.jsx:1015-1025` (sin `maxLength`)
**Impacto:** El PUT devuelve 200/"Guardado" sin señal de que parte del texto se perdió.
**Recomendación:** Agregar `maxLength={150}` al input.
**Estado:** CONFIRMADO

### CRM-006 — Fallos de autoguardado por campo solo se muestran en la pestaña activa, se pierden al cambiar de tab
**Ubicación:** `LeadDetailPanel.jsx:403-432` (`saveField`)
**Impacto:** Si la red falla justo al cambiar de pestaña, el admin nunca ve el error y cree que el cambio se guardó.
**Recomendación:** Toast global además del indicador inline.
**Estado:** CONFIRMADO

### CRM-007/FORM-002 — Lista de espera/alertas de propiedad sin deduplicación → notificaciones duplicadas
**Ubicación:** `waitingListController.js:84-92`; `leadController.js:923-1000`; `alertService.js:10-19` (sin filtro por `source`)
**Impacto:** El mismo cliente puede terminar con N filas activas para el mismo criterio y recibir N emails/WhatsApp duplicados por cada propiedad nueva que matchee.
**Recomendación:** `findOrCreate`/dedup por teléfono o email, igual que ya hace `alertController.subscribe`.
**Estado:** CONFIRMADO

### SCALE-001 — `notifyMatchingAlerts` carga toda la tabla de alertas en memoria en cada escritura de propiedad
**Ubicación:** `server/src/services/alertService.js:10-45`
**Impacto:** Con decenas de miles de alertas/lista de espera acumuladas, cada guardado de propiedad dispara una carga completa a memoria, compitiendo por CPU con el resto del tráfico.
**Recomendación:** Mover el matching (ciudad/tipo/businessLine/precio) a un `WHERE` de SQL.
**Estado:** CONFIRMADO

### SCALE-002 — Subconsultas correlacionadas no-sargables en el cálculo de "prospectos estancados"
**Ubicación:** `pipelineHelpers.js:106-124`; usado en `leadController.js:520-526` y `crmAnalyticsController.js:91-97`
**Impacto:** Aun con el índice de DB-003 aplicado, el costo escala linealmente con el número de leads activos, no con el de leads realmente estancados.
**Recomendación:** Columna desnormalizada `lastTouchedAt` en `leads`, mantenida por hook, con índice propio.
**Estado:** CONFIRMADO (mitigado, no eliminado, por DB-003)

### SCALE-003 — Dashboard de analítica ejecuta 20 agregaciones sin límite temporal y sin caché
**Ubicación:** `server/src/controllers/analyticsController.js:19-109`
**Impacto:** Con 50k+ leads acumulados, cada carga del dashboard admin recalcula desde cero sobre el historial completo.
**Recomendación:** Cachear el resultado por unos minutos o acotar agregaciones de "toda la vida" a una ventana razonable.
**Estado:** POSIBLE (no crítico hoy, riesgo de crecimiento)

### PERF-B-002 — Borrado de imágenes de propiedad en Cloudinary de forma secuencial, no paralela
**Ubicación:** `propertyController.js:573-582` (comparar con la subida correcta en paralelo, `:622`)
**Impacto:** Una propiedad con 15-20 fotos puede tardar varios segundos en borrarse, con el cliente admin esperando esa respuesta síncrona.
**Recomendación:** `Promise.all` en vez de `for...of` secuencial.
**Estado:** CONFIRMADO

### PERF-B-003 — Llamada a la API de WhatsApp sin timeout, bloqueando la respuesta al admin
**Ubicación:** `whatsappService.js:20-53`; `leadController.js:1232-1288`
**Impacto:** Si la API de Meta responde lento, la petición del admin queda colgada indefinidamente.
**Recomendación:** `AbortSignal.timeout(10000)` en el `fetch`.
**Estado:** CONFIRMADO

### DB-005 — `leads.businessLine` sin índice, usado como filtro y `GROUP BY` en reportes CRM
**Ubicación:** `server/src/models/Lead.js:87-90`; `crmAnalyticsController.js:215-257`
**Impacto:** Filtrar reportes por línea de negocio se vuelve progresivamente más lento con el historial acumulado.
**Recomendación:** Índice compuesto `['businessLine', 'createdAt']`.
**Estado:** CONFIRMADO

### PERF-F-005 — Catálogo público sin virtualización pese a tener la librería ya integrada
**Ubicación:** `PropertiesPage.jsx:528-531` (sin virtualizar) vs `KanbanBoard.jsx:222-320` (bien virtualizado con `@tanstack/react-virtual`)
**Impacto:** DOM creciente sin límite en sesiones de scroll largas en la superficie de mayor tráfico.
**Recomendación:** Migrar la grilla a `useVirtualizer`.
**Estado:** CONFIRMADO

### PERF-F-006 — Panel de detalle de lead dispara 5 queries concurrentes sin importar la pestaña activa
**Ubicación:** `LeadDetailPanel.jsx:312-351`
**Impacto:** Cada clic en un prospecto dispara 5 requests aunque el asesor solo vaya a ver "Resumen" — tráfico innecesario, especialmente en conexión lenta.
**Recomendación:** Gatear "Seguimiento"/"Citas" con `enabled: activeTab === '...'`.
**Estado:** CONFIRMADO

### QUAL-F-001 — Formulario público de Buzón duplica constantes de categoría ya centralizadas
**Ubicación:** `BuzonPage.jsx:10-31` vs `constants.js` (`FEEDBACK_CATEGORY_LABELS/COLORS`, usado por `BuzonAdminPage.jsx`)
**Impacto:** Riesgo de drift si se agrega/renombra una categoría solo en un lado.
**Recomendación:** Extraer a `constants.js` y consumir desde ambos lados.
**Estado:** CONFIRMADO

### ERR-003 — Formato de error inconsistente en `authController` (array vs objeto)
**Ubicación:** `authController.js:54,101` (`{errors: [...]}`) vs el resto de la API migrada a `ApiError` (`{error: "mensaje"}`)
**Impacto:** Riesgo de manejo inconsistente en frontend si algún consumidor futuro asume siempre un formato.
**Recomendación:** Unificar a `ApiError`.
**Estado:** CONFIRMADO (no explota actualmente)

### LOG-003 — Sin ID de correlación (request-id) en los logs
**Ubicación:** `server/src/utils/logger.js`; `errorHandler.js:27-33`
**Impacto:** Correlacionar líneas de log de la misma petición depende de coincidencia de timestamp/mensaje — investigar un bug reportado es más lento de lo necesario.
**Recomendación:** Middleware que genere un `requestId` por request e inclúyalo en cada log.
**Estado:** CONFIRMADO

### DUP-001 — `NotificationBell` reimplementa formateo de fecha ya centralizado
**Ubicación:** `NotificationBell.jsx:33-37` vs `formatters.js:19-28` (`formatDateTime`)
**Impacto:** Un cambio futuro en el formato de fecha del resto de la app no se propaga aquí.
**Recomendación:** Reutilizar `formatDateTime` (o agregar variante sin año).
**Estado:** CONFIRMADO

### TEST-003 — Sin test para la rama de error 500 de `authController.login`
**Ubicación:** `server/src/__tests__/auth.integration.test.js` (sin cubrir el catch manual)
**Recomendación:** Cubrir junto con la corrección de ERR-001.
**Estado:** CONFIRMADO

### DEPLOY-001 — Imágenes de prueba filtradas a `server/uploads/`, carpeta que se sube completa por FTP
**Ubicación:** `server/uploads/properties/` (5 archivos)
**Impacto:** `AUDITORIA_SMARTERASP_DEPLOY.md` documenta esta carpeta como código muerto que debe estar vacía en el FTP; ya no lo está. `app.js` la sirve estáticamente, quedando accesible en producción sin gestión de la app.
**Recomendación:** Vaciar antes de cada deploy; añadir chequeo al `check-deploy-safety.js`.
**Estado:** CONFIRMADO

### DEPLOY-002 — Checklist de deploy desactualizado: faltan variables de WhatsApp y `LOG_LEVEL`
**Ubicación:** `AUDITORIA_SMARTERASP_DEPLOY.md:213` vs `validateEnv.js:18-28`
**Impacto:** Quien despliegue puede olvidar setear las variables de WhatsApp; la feature queda silenciosamente deshabilitada en producción sin error visible.
**Recomendación:** Actualizar el checklist con las 4 variables de WhatsApp y `LOG_LEVEL`.
**Estado:** CONFIRMADO

### COMPAT-001 — Acceso a `localStorage` sin try/catch en todo el frontend; riesgo de pantalla en blanco total
**Ubicación:** `client/src/main.jsx:8` (síncrono, antes de renderizar); `authStore.js`, `api.js`, `themeStore.js`, `useFavorites.js`, `useComparator.js`
**Impacto:** En navegadores/perfiles con almacenamiento bloqueado (modo privado estricto, extensiones de privacidad, cuota agotada), una excepción en `main.jsx` rompe el arranque completo de la SPA.
**Recomendación:** Envolver los accesos críticos (especialmente `main.jsx` y el interceptor de `api.js`) en try/catch con fallback silencioso.
**Estado:** CONFIRMADO

---

## Hallazgos bajos 🟢

| ID | Problema | Ubicación | Recomendación |
|---|---|---|---|
| SEC-005 | Helmet con `hsts: false`; Node nunca emite `Strict-Transport-Security` | `server/app.js:30` | Activar `hsts` en helmet igualmente, como defensa independiente de IIS |
| DB-006 | Sin constraint/dedup para citas duplicadas por doble clic | `appointmentController.js:116-156` | Índice único `['leadId','scheduledAt']` o ventana de deduplicación, si se confirma como problema real observado |
| PERF-F-007 | Cero uso de `React.memo` en toda la app | `PropertyCard`, `KanbanCard`, `GradientListCard` | Envolver componentes de lista de alta repetición |
| PERF-F-008 | Kanban dispara 8 queries de tareas al cargar (una por columna) | `KanbanBoard.jsx:207-211` | Opcional: consolidar en una sola query (trade-off razonable, no bug) |
| QUAL-F-002 | `SEO.jsx` con mapa de ciudad incompleto (falta `'otra'`) | `SEO.jsx:10-11` | Importar `CITY_LABELS` en vez de mapa paralelo |
| QUAL-F-003 | `NotificationBell` con colores de tipo de lead hardcodeados | `NotificationBell.jsx:8-18` | Mover a `constants.js` como `LEAD_TYPE_COLORS` |
| QUAL-F-004 | `ApplicationsPage` con mapa local de nivel de experiencia | `ApplicationsPage.jsx:16-21` | Mover a `constants.js` si se reutiliza |
| QUAL-F-005 | UX de error de cambio de contraseña inconsistente entre `UsersPage` y `ChangePasswordModal` | `UsersPage.jsx:77-90` | Reutilizar el patrón de resaltado de campo de `ChangePasswordModal` |
| FORM-003 | `budgetAmount` sin cota superior; overflow produce error crudo de BD | `leadController.js:141-151` | Cap con mensaje 400 claro |
| FORM-004 | Formulario público de contacto sin honeypot | `ContactForm.jsx` | Agregar campo honeypot oculto |
| BUG-003 | Email placeholder de la oficina de Chihuahua servido en producción | `constants.js:1-14` (TODO explícito) | Confirmar y actualizar el email real |
| DEAD-001 | `POST /auth/register` sin consumidor verificado en frontend | `authController.js:49-95` | Ya monitoreado en código (`logRegisterUsage`); ninguna acción inmediata |
| COMPAT-002 | `useNotifications` sin `onerror`/reconexión visible en el SSE | `useNotifications.js:38-48` | Agregar `onerror` con backoff e indicador de conexión |
| DEP-002 | Excepción de auditoría obsoleta para `react-router` en el script de CI | `scripts/check-audit-exceptions.js:14-24` | Remover si se confirma que la vulnerabilidad ya no aplica |
| DEP-003 | `framer-motion`/`tailwindcss`/`lucide-react` con majors pendientes | `client/package.json` | Planificar migración a Tailwind v4 como tarea propia, sin urgencia |
| DEP-004 | Dependencias de servidor con minors pendientes (sin CVE) | `server/package.json` | Actualizar en ciclo de mantenimiento regular |
| DEPLOY-003 | Gate de seguridad de deploy es blacklist por nombre, no whitelist | `scripts/check-deploy-safety.js:14-22` | Considerar ampliar cobertura o documentar como revisión manual complementaria |
| DEPLOY-004 | Archivos de log locales sueltos en `server/logs/` | `server/logs/` | Limpiar antes de cada FTP (ya cubierto por `.gitignore`) |
| CFG-002 | `client/package.json` sin `engines.node`, a diferencia de `server`/raíz | `client/package.json` | Agregar `"engines": {"node": ">=20.0.0"}` por consistencia |

**Verificaciones positivas relevantes** (no requieren acción, documentadas para evitar retrabajo futuro): sin secretos trackeados en git (`.gitignore` correcto y verificado contra `git ls-files`); CORS con whitelist explícita sin comodín; CSP sin `unsafe-inline`/`eval` en el sitio público; único uso de SQL crudo con input de usuario está parametrizado; row-level access de leads/citas/tareas/deals/export bien aplicado en el resto del módulo; JWT con `tokenVersion` e invalidación en cambios sensibles; `validateEnv.js` con fail-fast y blocklist de secretos triviales; 0 vulnerabilidades en `npm audit` del backend; CI/CD honesto sobre su alcance (lint+test+build, sin "deploy fantasma"); varios hallazgos de la auditoría de deploy de junio 2026 ya resueltos (CORS, sitemap, dependencias muertas del cliente, `engines.node`).

---

## Tabla de prioridades

| ID | Categoría | Severidad | Archivo | Problema | Impacto | Esfuerzo |
|---|---|---|---|---|---|---|
| CRM-001 | CRM/Bugs | 🔴 | LeadDetailPanel.jsx / LeadDetailWithActions.jsx | Falta `key` por lead en 2 rutas de montaje | Corrupción cruzada de datos de prospectos | Bajo |
| CAL-001 | Calendario | 🔴 | db.js / appointmentController.js | Sin zona horaria configurada | Citas persistidas con hora incorrecta | Medio |
| SEC-001 | Seguridad | 🔴 | crmAnalyticsController.js | Dashboard CRM sin filtro por fila | Fuga de PII entre asesores | Bajo |
| SEC-002 | Seguridad | 🔴 | crmAnalyticsController.js | Reportes CRM exponen ingresos/desempeño | Fuga de datos financieros internos | Bajo |
| DB-001 | Base de Datos | 🔴 | leadController.js | Full-table-scan + race en dedup de teléfono | Duplicados de negocio + latencia creciente | Medio |
| PERF-B-001 | Rendimiento Backend | 🔴 | exportController.js | Exports sin cota + N fetches paralelos | Posible caída del proceso por agotamiento de memoria/sockets | Medio |
| PERF-F-001 | Rendimiento Frontend | 🔴 | DownloadQuoteButton.jsx | html2canvas cargado estáticamente | +54KB gzip en la página más visitada | Bajo |
| LOG-001 | Logging | 🔴 | múltiples | `console.*` invisible en producción | Fallos críticos sin rastro | Medio |
| SEC-003/BUG-001 | Seguridad/Bugs | 🟠 | leadController.js | SSE de leads sin filtrar por asignación | Fuga de PII, sin corregir desde 2026-08-20 | Medio |
| DB-002 | Base de Datos | 🟠 | PropertyStatusHistory.js | Sin índice en tabla de historial | Degradación de la ficha pública con el tiempo | Bajo |
| DB-003 | Base de Datos | 🟠 | LeadNote.js | Sin índice + subconsulta N veces | Dashboard CRM lento a escala | Bajo |
| DB-004 | Base de Datos | 🟠 | Property.js | Sin índice en businessLine/category | Catálogo público lento a escala | Bajo |
| CAL-002 | Calendario | 🟠 | appointmentController.js | Sin verificación de traslape | Doble reserva de asesores | Medio |
| CRM-003 | CRM | 🟠 | leadController.js | Reapertura borra Deal sin control adicional | Pérdida de registro financiero | Medio |
| PERF-F-002 | Rendimiento Frontend | 🟠 | ProspectosSection.jsx / PropertiesPage.jsx | Búsqueda sin debounce | Carga innecesaria por cada tecla | Bajo |
| PERF-F-003 | Rendimiento Frontend | 🟠 | DownloadQuoteButton.jsx | Ficha oculta carga imágenes siempre | Ancho de banda desperdiciado | Bajo |
| PERF-F-004 | Rendimiento Frontend | 🟠 | useFavorites.js / useComparator.js | Store sin selectores | Re-render de toda la grilla | Medio |
| ERR-001 | Manejo de Errores | 🟠 | authController.js | login no usa ApiError | Errores 500 sin rastro | Bajo |
| ERR-002 | Manejo de Errores | 🟠 | 4 páginas admin | Sin manejo de isError | Pantalla en blanco ante fallo | Bajo |
| DEP-001 | Dependencias | 🟠 | client (postcss/nanoid) | Vuln "high" invisible al CI | Deuda de seguridad no monitoreada | Bajo |
| TEST-001 | Tests | 🟠 | client/src/components/admin/crm/ | Cero tests en el CRM rediseñado | Regresiones no detectadas | Alto |
| TEST-002 | Tests | 🟠 | server/src/__tests__/ | Sin test para el leak de SSE | Regresión de seguridad no detectada | Bajo |
| BUG-002 | Bugs | 🟠 | PropertiesPage.jsx | Error real se muestra como "sin resultados" | Confusión de usuario final | Bajo |
| SEC-004 | Seguridad | 🟡 | testimonialController.js / usersController.js | Sin validación de magic bytes | Subida de archivo no-imagen disfrazado | Bajo |
| LOG-002 | Logging | 🟡 | authController.js | changePassword sin audit log | Gap forense en incidentes | Bajo |
| CAL-003 | Calendario | 🟡 | appointmentController.js | Reglas de horario no aplicadas uniformemente | Citas fuera de horario vía admin | Bajo |
| CRM-004 | CRM | 🟡 | taskController.js / KanbanBoard.jsx | "Vencida" calculada distinto server/cliente | Inconsistencia visual entre admins | Bajo |
| CRM-005 | CRM | 🟡 | Lead.js / leadController.js | Sin bloqueo optimista | Pérdida silenciosa de ediciones concurrentes | Medio |
| FORM-001 | Formularios | 🟡 | leadController.js / LeadDetailPanel.jsx | Truncado silencioso de searchZone | Pérdida de datos invisible | Bajo |
| CRM-006 | CRM | 🟡 | LeadDetailPanel.jsx | Error de autoguardado se pierde al cambiar tab | Admin cree que guardó y no | Bajo |
| CRM-007/FORM-002 | CRM/Formularios | 🟡 | waitingListController.js / alertService.js | Sin dedup de lista de espera | Notificaciones duplicadas a clientes | Bajo |
| SCALE-001 | Escalabilidad | 🟡 | alertService.js | Carga completa de alertas en memoria | Degradación con miles de alertas | Medio |
| SCALE-002 | Escalabilidad | 🟡 | pipelineHelpers.js | Subconsultas no-sargables | Costo O(n) por carga de Dashboard | Medio |
| SCALE-003 | Escalabilidad | 🟡 | analyticsController.js | Agregaciones sin límite temporal ni caché | Dashboard lento a escala | Medio |
| PERF-B-002 | Rendimiento Backend | 🟡 | propertyController.js | Borrado de imágenes secuencial | Respuesta lenta al borrar propiedad | Bajo |
| PERF-B-003 | Rendimiento Backend | 🟡 | whatsappService.js | Fetch sin timeout | Request colgada ante API lenta | Bajo |
| DB-005 | Base de Datos | 🟡 | Lead.js | Sin índice en businessLine | Reportes lentos a escala | Bajo |
| PERF-F-005 | Rendimiento Frontend | 🟡 | PropertiesPage.jsx | Catálogo sin virtualizar | DOM creciente sin límite | Medio |
| PERF-F-006 | Rendimiento Frontend | 🟡 | LeadDetailPanel.jsx | 5 queries concurrentes sin importar tab | Tráfico innecesario | Bajo |
| QUAL-F-001 | Calidad | 🟡 | BuzonPage.jsx | Constantes de categoría duplicadas | Riesgo de drift | Bajo |
| ERR-003 | Manejo de Errores | 🟡 | authController.js | Formato de error inconsistente | Riesgo de manejo inconsistente en frontend | Bajo |
| LOG-003 | Logging | 🟡 | logger.js | Sin request-id | Diagnóstico más lento | Medio |
| DUP-001 | Duplicación | 🟡 | NotificationBell.jsx | Formateo de fecha duplicado | Drift de formato futuro | Bajo |
| TEST-003 | Tests | 🟡 | auth.integration.test.js | Sin cobertura de rama 500 de login | Comportamiento no documentado por test | Bajo |
| DEPLOY-001 | Deploy | 🟡 | server/uploads/ | Imágenes de prueba en el payload FTP | Contenido irrelevante público en producción | Bajo |
| DEPLOY-002 | Deploy | 🟡 | AUDITORIA_SMARTERASP_DEPLOY.md | Checklist desactualizado | Feature de WhatsApp deshabilitada sin aviso | Bajo |
| COMPAT-001 | Compatibilidad | 🟡 | main.jsx / stores | localStorage sin try/catch | Posible pantalla en blanco total | Bajo |
| (19 hallazgos 🟢) | — | 🟢 | — | Ver tabla de hallazgos bajos | Mejoras de calidad/mantenibilidad | Bajo |

---

## TOP 10 — Problemas que debemos solucionar primero

Ordenados por combinación de Impacto × Probabilidad × Riesgo:

1. **CRM-001** — Bug de `key` faltante en `LeadDetailPanel`: corrompe silenciosamente datos de prospectos reales, en un flujo (móvil + Calendario) que ya está en producción. Fix de bajo esfuerzo, impacto de integridad de datos alto.
2. **CAL-001** — Sin zona horaria configurada: cada cita agendada puede estar silenciosamente mal, dependiendo de la configuración del host. Afecta la confianza operativa completa en el módulo de citas.
3. **SEC-001 / SEC-002** — Broken access control en analítica CRM: fuga confirmada y reproducible de PII y datos financieros entre roles, con el propio código admitiéndolo como gap conocido. Fix acotado (aplicar un filtro ya existente en el codebase).
4. **DB-001** — Full-table-scan + condición de carrera en la única regla de deduplicación de negocio del CRM: afecta rendimiento hoy y permite duplicados bajo concurrencia.
5. **PERF-B-001** — Exports sin cota: un uso legítimo (export de fin de mes con inventario grande) puede saturar memoria/sockets del proceso y tumbar el servicio para todos los usuarios simultáneos.
6. **LOG-001** — Observabilidad rota: mientras no se corrija, cualquier otro incidente de esta lista (fallos de email, de auditoría, de historial de precio) será indetectable en producción — es un multiplicador de riesgo para todo lo demás.
7. **PERF-F-001** — Bundle inflado en la página pública de mayor tráfico: impacto de UX/SEO/conversión medible en cada visita, fix de una línea.
8. **SEC-003/BUG-001** — Leak de SSE de leads: confirmado independientemente por dos revisiones, documentado desde 2026-08-20 y aún sin corregir ni sin test que lo detecte — patrón de "se sabe y no se arregla" que amerita prioridad.
9. **CAL-002** — Sin prevención de doble reserva: impacto operativo directo (asesores/clientes chocando), sin ninguna mitigación hoy.
10. **TEST-001** — Cero cobertura de test en el CRM rediseñado (2026-08-31): amplifica el riesgo de que CRM-001, CRM-005, CRM-006 y cualquier regresión futura en esa superficie pasen inadvertidos indefinidamente.

---

## Plan de acción

### FASE 1 — Seguridad crítica
- SEC-001, SEC-002: aplicar `getLeadVisibilityWhere` en `crmAnalyticsController.js` o restringir las rutas a roles administrativos.
- SEC-003/BUG-001: filtrar el broadcast de `streamLeads` por visibilidad de usuario; agregar TEST-002.
- SEC-004: conectar `fileSignature.js` en subida de testimonios y foto de perfil.
- SEC-005: activar `hsts` en helmet.

### FASE 2 — Bugs críticos
- CRM-001: agregar `key={selected.id}` en las 2 rutas de montaje faltantes.
- CAL-001: fijar `timezone`/`TZ` explícito en Sequelize/Node.
- DB-001 (parte de condición de carrera): índice único sobre teléfono normalizado + manejo de `ER_DUP_ENTRY`.
- CAL-002: verificación de traslape en creación/reprogramación de citas.
- CRM-003: restringir reapertura de leads ganados o snapshot del Deal antes de borrar.
- ERR-001, ERR-002: migrar `login` a `ApiError`; agregar manejo de `isError` en las 4 páginas admin.
- BUG-002: distinguir error real de "sin resultados" en el catálogo público.
- CRM-005, CRM-006: bloqueo optimista básico y toast global de fallo de autoguardado.

### FASE 3 — Performance
- PERF-B-001: cota de filas + concurrencia limitada en exports; streaming real de ExcelJS.
- DB-002, DB-003, DB-004, DB-005: agregar los 4 índices faltantes (esfuerzo bajo, impacto alto).
- PERF-F-001, PERF-F-003: import dinámico de html2canvas; montaje condicional de FichaTecnica.
- PERF-F-002, PERF-F-004, PERF-F-005, PERF-F-006: debounce de búsquedas, selectores de Zustand, virtualización del catálogo público, queries gateadas por tab.
- SCALE-001, SCALE-002, SCALE-003: mover matching de alertas a SQL, desnormalizar `lastTouchedAt`, cachear el dashboard de analítica.
- PERF-B-002, PERF-B-003: paralelizar borrado de imágenes; timeout en fetch de WhatsApp.

### FASE 4 — Arquitectura
- LOG-001, LOG-002, LOG-003: reemplazar `console.*` por `logger`; audit log en `changePassword`; middleware de `requestId`.
- CAL-003: extraer y reutilizar `validateAppointmentDate` en los endpoints admin de citas.
- CRM-007/FORM-002: deduplicación en lista de espera/alertas.
- ERR-003: unificar formato de error en `authController`.

### FASE 5 — Código muerto
- DEAD-001: seguir monitoreando `POST /auth/register` antes de decidir su remoción.
- DUP-001, QUAL-F-001 a QUAL-F-005: consolidar duplicaciones menores de constantes/formateo.
- DEPLOY-001, DEPLOY-003, DEPLOY-004: limpiar `server/uploads/` y `server/logs/`; endurecer el gate de deploy.

### FASE 6 — Mejoras
- TEST-001, TEST-002, TEST-003: cerrar los gaps de cobertura de test señalados.
- DEP-001 a DEP-004, CFG-002: actualizaciones de dependencias y consistencia de `engines.node`.
- COMPAT-001, COMPAT-002: try/catch en `localStorage`; manejo de `onerror` en SSE.
- FORM-003, FORM-004, BUG-003, DEPLOY-002: cotas de validación, honeypot, email placeholder, checklist de deploy.

---

## Alcance no cubierto por esta auditoría

Ninguno de los 6 revisores ejecutó la aplicación en runtime ni corrió pruebas dinámicas — todo el análisis es revisión estática de código, cruzada con `npm audit`/`npm outdated` reales. No se realizó `EXPLAIN ANALYZE` contra una base poblada (los impactos de escalabilidad son estimaciones basadas en ausencia confirmada de índices, no mediciones). No se revisó en profundidad: `jobController.js`/`feedbackController.js` completos, `CalendarioSection.jsx`/`CampanasSection.jsx`/`CasosExitoSection.jsx` línea por línea, el pool de conexiones de Sequelize, ni compatibilidad cruzada de navegadores mediante pruebas reales (solo inspección estática de APIs usadas). Se recomienda una segunda pasada dinámica (staging con datos de volumen realista + pruebas manuales cross-browser) antes de considerar cerrado el ciclo de auditoría.
