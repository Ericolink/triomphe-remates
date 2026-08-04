# Auditoría: servicios del frontend sin consumidores

**Alcance:** 8 funciones exportadas desde `client/src/services/*.js` detectadas previamente sin ningún import/uso en `client/src` (ver `AUDITORIA_LIMPIEZA_PROYECTO.md`, sección 7). Este documento profundiza caso por caso: consumidores, endpoint backend, funcionalidad de producto, estado de implementación, riesgo y recomendación.

**Metodología:** búsqueda exhaustiva (`grep`) de cada nombre de función en todo `client/src` (componentes, páginas, hooks, stores, servicios), lectura de los 8 archivos de servicio completos, lectura de las rutas y controladores backend correspondientes, y cruce con comentarios de código, `git log` y memoria de proyecto (commits de `CRM Comercial Fase 1`, `Reopen-lead`, etc.) para distinguir código muerto de gaps de producto reales.

**Solo lectura.** No se modificó, refactorizó ni eliminó ningún archivo.

---

## 1. `deleteAppointment`

- **Endpoint:** `DELETE /api/appointments/:id` — existe, montado en `server/src/routes/appointments.js`, restringido a `authorize('admin')`.
- **Consumidores:** 0. `CalendarioSection.jsx`, `ProspectosSection.jsx` y `CasosExitoSection.jsx` usan `getAppointments`, `getLeadAppointments`, `createAppointment`, `updateAppointmentStatus` y `rescheduleAppointment` — el CRUD completo salvo el delete.
- **Funcionalidad:** borrado permanente (hard delete) de una cita.
- **Evidencia clave:** la "cancelación" de una cita en el producto ya existe y se usa activamente vía `updateAppointmentStatus(id, { status: 'cancelada' })` (`CalendarioSection.jsx:154`). `VALID_APPOINTMENT_STATUS` en el backend incluye `cancelada`, y el controlador registra actividad y libera al responsable cuando el estatus pasa a `cancelada`/`no_show`. Es decir: el producto ya resuelve "quitar una cita del calendario" con un soft-delete auditable; el hard-delete es una capacidad adicional, no una carencia bloqueante.
- **Estado:** **C/A híbrido** — funcionalidad de "cancelar" ya cubierta por otro flujo; "eliminar permanentemente" es una capacidad de limpieza administrativa que nunca se expuso en UI, probablemente a propósito (preservar histórico/auditoría es el patrón dominante en el resto del proyecto — `logAudit` en todas las mutaciones).
- **Riesgo de eliminar el wrapper:** Bajo. Nadie lo invoca; el endpoint backend seguiría existiendo para uso administrativo directo si se decide conservar.
- **Recomendación:** **Documentar**. No hay evidencia de que falte esta UI — el flujo de cancelación ya es el mecanismo de producto. Si se quiere una vía de purga para citas erróneas/duplicadas, sería una decisión de producto nueva, no una corrección de un gap existente.

---

## 2. `getMe`

- **Endpoint:** `GET /api/auth/me` — existe, protegido con `authenticate`.
- **Consumidores:** 0.
- **Funcionalidad:** obtener el usuario autenticado actual desde el servidor.
- **Evidencia clave:** `authStore.js` guarda el objeto `user` completo en `localStorage` en `setAuth` (login) y lo actualiza localmente vía `updateUser` (merge de campos) sin volver a golpear el backend. La app nunca re-sincroniza el usuario desde el servidor durante una sesión activa — confía en el snapshot cacheado hasta logout o un 401. `git log` confirma que `authService.js` no se ha tocado desde el commit inicial del scaffold del sitio (`baa8b73`), consistente con que `getMe` fue boilerplate de auth genérico nunca conectado.
- **Estado:** **E** (muerto respecto al diseño actual) con matiz **D**: si algún día un rol/`crmRole` cambia en el servidor mientras el usuario tiene sesión abierta, el cliente no se entera hasta el próximo login — `getMe` sería la pieza natural para resolver eso (p. ej. refrescar tras cada navegación a admin, o en un futuro flujo de refresh-token). Hoy esa necesidad no existe en el producto.
- **Riesgo:** Bajo.
- **Recomendación:** **Mantener para desarrollo futuro** (sincronización de sesión/rol) o **Documentar** si se decide que el modelo "confiar en localStorage hasta 401" es definitivo.

---

## 3. `changePassword`

- **Endpoint:** `PUT /api/auth/change-password` — existe, self-service, requiere `currentPassword` + `authenticate`.
- **Consumidores:** 0.
- **Funcionalidad:** que el usuario logueado cambie su propia contraseña.
- **Evidencia clave:** no existe ninguna página "Perfil"/"Ajustes"/"Mi cuenta" en `client/src/pages/admin/` (`find ... -iname "*perfil*" -o -iname "*profile*" -o -iname "*settings*"` → 0 resultados). El único lugar donde aparece "password" en el admin es `UsersPage.jsx`, pero ahí un **admin resetea la contraseña de otro usuario** vía `updateUser` (multipart, sin `currentPassword`) — un mecanismo distinto y ya implementado. El cambio de contraseña propio (autoservicio) no tiene ninguna interfaz.
- **Estado:** **A** — backend existe, frontend nunca implementado. Gap de producto genuino y común (todo panel admin con roles editor/asesor/capturista debería permitir auto-gestión de credenciales sin depender de un admin).
- **Riesgo:** Bajo (wrapper aislado, sin efectos colaterales).
- **Recomendación:** **Implementar UI**. Es el hallazgo de "carencia de producto" más claro de los 8: hoy, un editor/asesor que quiere cambiar su contraseña depende de que un admin se la resetee manualmente vía `UsersPage`.

---

## 4. `getDealById`

- **Endpoint:** `GET /api/deals/:id` — existe.
- **Consumidores:** 0. `CasosExitoSection.jsx` usa únicamente `getDeals` (paginado).
- **Funcionalidad:** detalle de una venta cerrada (deal).
- **Evidencia clave:** el componente `DealCard`/tarjeta expandida dentro de `CasosExitoSection.jsx` ya renderiza todos los campos relevantes (lead, propiedad, monto, fecha de cierre, asesor) directamente desde el item de la lista — no existe ningún modal o vista de "detalle" que necesitaría un fetch adicional por id. Según memoria de proyecto, el backend de `Deal` se construyó en Fase 1 del CRM Comercial (2026-07-14) y la galería de "Casos de Éxito" (2026-07-15) reutilizó ese scaffolding pero solo conectó el listado.
- **Estado:** **E** — muerto respecto al diseño actual; el patrón de lista autosuficiente no necesita drill-down.
- **Riesgo:** Bajo.
- **Recomendación:** **Documentar** / mantener sin implementar. Sin evidencia de necesidad de un detalle separado.

---

## 5. `getPositionById`

- **Endpoint:** `GET /api/jobs/:id` — existe, **ruta pública** (sin `authenticate`).
- **Consumidores:** 0. `JobsAdminPage.jsx` usa `getAllPositions`; `JobsPage.jsx` (pública) usa `getPositions` + `applyToPosition`. No existe ruta `/empleos/:id` ni equivalente en `App.jsx`.
- **Funcionalidad:** detalle de una vacante individual.
- **Evidencia clave:** que el endpoint sea público (sin middleware `authenticate`) y separado de `getAllPositions` (admin) es una señal fuerte de que fue diseñado para una página pública de detalle de vacante — el mismo patrón que ya existe para propiedades (`PropertyDetailPage`). Ese equivalente para vacantes nunca se construyó.
- **Estado:** **A/D** — backend construido deliberadamente para una funcionalidad pública de detalle, frontend no implementado. Es una inconsistencia de producto frente al patrón ya establecido con propiedades.
- **Riesgo:** Bajo eliminar el wrapper; riesgo de **no** implementarlo es de consistencia de producto (jobs es la única entidad pública con listado pero sin página de detalle propia).
- **Recomendación:** **Implementar UI** (página de detalle de vacante pública, análoga a `PropertyDetailPage`) o, si se descarta a propósito, **Documentar** explícitamente esa decisión.

---

## 6. `getLeadTasks`

- **Endpoint:** `GET /api/leads/:id/tasks` — existe.
- **Consumidores:** 0. `KanbanBoard.jsx` y `ProspectosSection.jsx` usan `getTasks({ leadIds: ... })`.
- **Funcionalidad:** tareas de un lead específico.
- **Evidencia clave — la más concluyente de las 8:** `taskController.js` tiene un comentario explícito sobre la rama `leadIds` de `getTasks`: *"la rama `leadIds` sigue sin paginar a propósito: Kanban/detalle de lead necesitan *todas* las tareas de su lote acotado de leadIds"*. El propio backend documenta que `getTasks({leadIds})` es el mecanismo real usado por Kanban y el detalle de lead — `getLeadTasks` es una variante de un solo lead que quedó funcionalmente subsumida por la versión batch, más flexible.
- **Estado:** **C** — funcionalidad descartada a favor de una alternativa genérica ya documentada en el propio código.
- **Riesgo:** Bajo. Genuinamente redundante.
- **Recomendación:** **Marcar como deprecated** el wrapper de frontend (o eliminarlo). El endpoint backend puede conservarse sin urgencia — no bloquea nada, pero no tiene ni un consumidor hipotético claro dado que `getTasks({leadIds})` ya cubre el caso de uso individual (`leadIds` con un solo id).

---

## 7. `reassignTask`

- **Endpoint:** `PATCH /api/tasks/:id/reassign` — existe, restringido a quienes pueden asignar leads (`canAssignLeads`).
- **Consumidores:** 0.
- **Funcionalidad:** reasignar el responsable de **una tarea puntual**, independiente del responsable del lead.
- **Evidencia clave — hallazgo más importante de esta auditoría:** en `leadController.js` (`updateLead`, ~línea 533), cuando cambia `assignedToUserId` de un lead, el código **no propaga** ese cambio a la tarea abierta existente de ese lead — solo crea una tarea nueva si el lead **no tenía** responsable previo (`if (assignedToUserId && !previousAssignee)`). El selector de "Responsable" en `ProspectosSection.jsx` (~línea 461) solo dispara `updateMutation` (`PUT /leads/:id`); nunca llama a `reassignTask`.
  Consecuencia real y reproducible: si un lead **ya asignado** se reasigna a otro usuario desde el panel, su tarea abierta ("próxima acción") sigue apareciendo en el Kanban/dashboard del responsable **anterior**, no del nuevo. El propio comentario del controlador de `reassignTask` dice explícitamente: *"Reasignar una tarea sigue la misma regla que reasignar el lead"* — fue construido a propósito para resolver este caso, pero nunca se conectó.
- **Estado:** **A** — backend construido específicamente para cerrar un gap de consistencia de datos real y demostrable; frontend no implementado.
- **Riesgo:** Bajo eliminar el wrapper en sí (nadie lo llama); **riesgo operativo real si se deja sin resolver**: tareas huérfanas asignadas a un responsable que ya no es dueño del lead, generando confusión en el equipo comercial.
- **Recomendación:** **Implementar UI** — máxima prioridad de los 8 hallazgos. No necesariamente como un control independiente: la corrección natural es que el flujo de reasignación de lead en `ProspectosSection.jsx` dispare también `reassignTask` sobre la(s) tarea(s) abiertas de ese lead cuando `assignedToUserId` cambia.

---

## 8. `getTestimonialById`

- **Endpoint:** `GET /api/testimonials/:id` — existe (`admin`/`editor`).
- **Consumidores:** 0. `TestimonialsAdminPage.jsx` usa únicamente `getAllTestimonials`.
- **Funcionalidad:** detalle de un testimonio individual.
- **Evidencia clave:** mismo patrón que `getDealById` — el modal de edición se prellena con el item ya presente en la lista cargada (`getAllTestimonials`), sin necesidad de un fetch adicional por id.
- **Estado:** **E** — muerto respecto al diseño actual.
- **Riesgo:** Bajo.
- **Recomendación:** **Documentar** / mantener sin implementar.

---

## Patrones de "grupos con pantallas faltantes"

| Servicio | Tiene UI para | Le falta UI para | Patrón |
|---|---|---|---|
| `testimonialService` | listado, crear, editar, eliminar | **detalle** (`getTestimonialById`) | Ejemplo exacto del enunciado: list+CRUD completos, sin vista de detalle — pero el listado ya es autosuficiente, así que no es urgente. |
| `dealService` | listado (paginado) | **detalle** (`getDealById`) | Mismo patrón que testimonials; también no urgente por el mismo motivo. |
| `jobService` (público) | listado, aplicar | **detalle público** (`getPositionById`) | Inconsistente con `propertyService`, que sí tiene detalle público. Este es el único caso donde falta una pantalla completa (no solo un modal), y el backend (ruta pública) sugiere que se planeó. |
| `authService` | login | **toda la sección de cuenta propia** (`getMe`, `changePassword`) | No es "falta el detalle", falta la sección completa de perfil/autogestión — inexistente en el admin. |
| `taskService` | listado por batch, completar | **reasignación individual** (`reassignTask`) | No es una pantalla faltante sino un paso faltante dentro de un flujo existente (reasignar lead debería cascadear a su tarea). |
| `appointmentService` | listado, crear, reprogramar, cambiar estatus (incl. cancelar) | **eliminar permanente** (`deleteAppointment`) | Único caso donde "falta" es una acción destructiva ya cubierta por un soft-delete equivalente — probablemente intencional, no un gap. |

---

## Tabla resumen

| Servicio | Endpoint | Consumidores | Estado | Riesgo | Recomendación |
|---|---|---|---|---|---|
| `deleteAppointment` | `DELETE /appointments/:id` ✅ existe | 0 | C/A — soft-delete (`cancelada`) ya cubre el caso de uso | Bajo | Documentar |
| `getMe` | `GET /auth/me` ✅ existe | 0 | E (con matiz D: sync de sesión futura) | Bajo | Mantener para desarrollo futuro |
| `changePassword` | `PUT /auth/change-password` ✅ existe | 0 | A — gap de producto real | Bajo | **Implementar UI** |
| `getDealById` | `GET /deals/:id` ✅ existe | 0 | E — lista autosuficiente | Bajo | Documentar |
| `getPositionById` | `GET /jobs/:id` ✅ existe (pública) | 0 | A/D — inconsistente con detalle de propiedades | Bajo | Implementar UI (o documentar decisión) |
| `getLeadTasks` | `GET /leads/:id/tasks` ✅ existe | 0 | C — redundante, documentado en el propio backend | Bajo | Marcar como deprecated |
| `reassignTask` | `PATCH /tasks/:id/reassign` ✅ existe | 0 | A — cubre un bug real de tareas huérfanas | Bajo (wrapper) / riesgo operativo si no se implementa | **Implementar UI (máxima prioridad)** |
| `getTestimonialById` | `GET /testimonials/:id` ✅ existe | 0 | E — lista autosuficiente | Bajo | Documentar |

---

## Prioridad

### Prioridad Alta
*(deberían tener interfaz)*

1. **`reassignTask`** — no es solo una carencia de UI, es la corrección de un bug de consistencia de datos ya reproducible (tareas huérfanas tras reasignar un lead ya asignado).
2. **`changePassword`** — carencia de producto clara: no existe ninguna vía de autogestión de contraseña para editores/asesores/capturistas.

### Prioridad Media
*(deberían documentarse, y evaluarse si conviene construir la UI)*

1. **`getPositionById`** — inconsistente con el patrón de detalle público que sí existe para propiedades; decidir si se construye la página de detalle de vacante o se documenta como descartado.
2. **`deleteAppointment`** — documentar que la cancelación (`status: cancelada`) es el mecanismo de producto vigente; el hard-delete queda como capacidad administrativa latente.
3. **`getMe`** — documentar que el modelo actual es "localStorage hasta 401"; dejar la función para una futura necesidad de sincronización de sesión/rol.

### Prioridad Baja
*(realmente eliminables o inertes sin riesgo)*

1. **`getLeadTasks`** — redundante frente a `getTasks({leadIds})`, ya señalado como tal en el propio comentario del backend.
2. **`getDealById`** — lista ya autosuficiente, sin necesidad demostrada de detalle.
3. **`getTestimonialById`** — mismo caso que `getDealById`.

---

## Nota metodológica

Ningún hallazgo se basó únicamente en "cero referencias" — para cada uno se buscó evidencia adicional en comentarios de código (`taskController.js`, `leadController.js`, `appointmentController.js`), en la existencia o ausencia de rutas/páginas equivalentes (`PropertyDetailPage` vs. ausencia de `JobDetailPage`), y en el historial de commits (`git log --follow`) para distinguir "nunca se implementó" de "se decidió no implementar" de "quedó subsumido por otra función". No se encontró ningún caso que requiera "Requiere verificación manual" — la evidencia disponible fue suficiente en los 8 casos.

Este documento corrobora y profundiza los hallazgos ya registrados en `AUDITORIA_LIMPIEZA_PROYECTO.md` (sección 7), que había identificado los mismos 8 símbolos con la misma metodología de "0 refs" pero sin el análisis caso por caso de funcionalidad/riesgo/recomendación que se pidió aquí.
