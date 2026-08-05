# Auditoría del endpoint "Reabrir Lead"

**Endpoint auditado:** `PUT /api/leads/:id/reopen`
**Alcance:** solo lectura — backend (`server/`), frontend (`client/src`), historial de git, documentación del repo.
**Metodología:** grep exhaustivo de `reopen`/`Reabrir`/`REOPEN_STAGES` en todo el árbol, lectura completa del controlador y la ruta, `git log -S` para ubicar el commit que introdujo el símbolo, y lectura de los componentes de Leads/Kanban para verificar cada punto de entrada de cambio de etapa.

---

## Resumen ejecutivo

El endpoint **existe, está completo, probado (12 tests) y protegido correctamente**, pero **ningún componente del frontend lo invoca**. No es código abandonado ni un experimento: es la mitad backend de una funcionalidad cuya mitad frontend nunca se construyó. Peor aún, el propio backend **ya asume que el frontend la va a llamar** — el PUT genérico de leads bloquea explícitamente el cambio de etapa de un lead cerrado y devuelve un mensaje de error que dice literalmente *"usa PUT /:id/reopen para reactivarlo"* (`server/src/controllers/leadController.js:502`). El Kanban y el panel de detalle de prospecto tienen dos rutas de interacción (drag & drop y el selector móvil de etapa) que **sí permiten al usuario intentar mover un lead cerrado a una etapa activa**, y ambas terminan en ese error crudo mostrado como toast, sin que nada dispare `/reopen`.

Esto no es una decisión de producto pendiente de tomar — es un flujo a medio terminar con evidencia directa en el propio código de que faltó el último paso.

---

## Consumidores encontrados

**Ninguno.** Búsqueda exhaustiva:

```
grep -rn "reopen\|Reabrir" client/src   →  0 coincidencias
```

Verificado específicamente en:
- **Frontend** (`client/src/services/leadService.js`): expone `closeLeadAsWon` y `closeLeadAsLost` (líneas 59-65), pero no existe una función `reopenLead` equivalente en el servicio de API.
- **Componentes** (`ProspectosSection.jsx`, `KanbanBoard.jsx`, `StageBottomSheet.jsx`): sin botones, menús, ni acciones con el texto "Reabrir" ni lógica que llame a `/reopen`.
- **Hooks/store**: sin mutations de React Query relacionadas (`closeWonMutation` y `closeLostMutation` existen en `ProspectosSection.jsx:1031-1053`; no hay `reopenMutation`).
- **Scripts, tests de integración del lado backend**: el único consumidor real del endpoint son los tests de `server/src/__tests__/leadClose.integration.test.js` (supertest, no un cliente real).
- **Documentación**: sin mención en ningún `.md` del repo salvo `AUDITORIA_LIMPIEZA_PROYECTO.md` (auditoría previa, ver sección Historia).
- **Swagger**: `server/src/routes/leads.js` solo tiene un bloque `@swagger` para el tag general de "Leads" (línea 33); ninguna de las rutas `close-won`, `close-lost` ni `reopen` tiene anotación JSDoc propia, así que tampoco aparecen documentadas individualmente en Swagger UI. Esto no es exclusivo de `reopen` — es la convención (o falta de ella) para todo este controlador.
- **Postman**: no existe ninguna colección de Postman en el repo (`find . -iname "*postman*"` → 0 resultados).
- **Comentarios TODO/FIXME**: no hay ningún `TODO`/`FIXME` asociado a `reopen`; en cambio hay comentarios de intención ya resueltos (ver Flujo completo).

## Historia del endpoint

`git log -S"reopenLead"` ubica un único commit que introdujo el símbolo:

```
3a12746  2026-07-20 11:42:05 -0600  feat: se implementaron pruebas automatizadas en la logica del negocio
```

- **Cuándo:** 2026-07-20, en el mismo commit que agregó la suite de tests automatizados de reglas de negocio del CRM (no en un commit dedicado — el mensaje del commit ni siquiera menciona "reopen"/"reabrir").
- **Por qué:** según la memoria de proyecto de esa sesión (`project_lead_reopen_fix_2026_07_20`), la suite de tests descubrió un bug real: un lead en etapa terminal (`venta_realizada`/`no_interesado`) podía volver a una etapa activa a través del `PUT /:id` genérico, dejando un `Deal` huérfano y sin `Task` abierta (nada volvía a disparar `ensureOpenTask` en ese camino).
- **Qué reemplazó:** nada — es funcionalidad nueva, no un reemplazo. La corrección elegida fue crear un endpoint dedicado que espeja exactamente el patrón ya establecido por `close-won`/`close-lost` (transacción, `logActivity`, `logAudit`), en vez de bloquear la reapertura por completo o corregir el invariante silenciosamente dentro del PUT genérico.
- **Evidencia de que el frontend quedó pendiente, no descartado:** no hay ningún commit posterior que revierta, documente como "no se implementará", o mencione una decisión consciente de dejar `reopen` sin UI. El rastro se corta en el commit del backend.

No hay evidencia suficiente en el historial para determinar si en algún momento se planeó explícitamente construir la UI en un ticket separado que nunca se ejecutó, o si simplemente se dio por completo el trabajo tras arreglar el bug de backend — el historial de git no distingue entre esas dos posibilidades.

## Flujo completo

```
Request: PUT /api/leads/:id/reopen   Body opcional: { pipelineStage?: string }
  │
  ▼
Middleware (server/src/routes/leads.js:56)
  apiLimiter → authenticate → requireCrmAccess
  (mismo nivel de acceso que close-won/close-lost: cualquier rol con acceso al CRM,
   no está restringido a admin como sugería la memoria de la sesión que lo creó —
   la ruta se actualizó de authorize('admin','editor') a requireCrmAccess en el
   feature de roles CRM del 2026-08-03, ver git blame de la línea)
  │
  ▼
Controller: reopenLead (server/src/controllers/leadController.js:735-817)
  1. Abre una transacción Sequelize.
  2. Busca el lead por PK; 404 si no existe.
  3. canEditLead(req.user, lead) — 403 si el usuario no tiene permiso de edición
     sobre ESE lead específico (ej. un asesor_ventas solo puede reabrir leads
     asignados a él).
  4. Verifica que lead.pipelineStage esté en TERMINAL_STAGES; 400 "Este prospecto
     no está cerrado" si no lo está (protege contra reabrir un lead ya activo).
  5. Resuelve la etapa destino: body.pipelineStage o 'contactado' por defecto.
     Valida contra REOPEN_STAGES (= todas las etapas válidas MENOS las terminales);
     400 si se intenta "reabrir hacia" otra etapa terminal.
  6. Si la etapa previa era 'venta_realizada' (wasWon=true): destruye el Deal
     asociado — la venta registrada deja de ser válida al reabrir.
  7. Actualiza el lead: nueva pipelineStage, status legacy correspondiente,
     limpia closeReason/closeReasonDetail.
  8. Registra una Activity de tipo 'sistema' describiendo la reapertura
     (y si se borró la venta).
  9. Si el lead tiene assignedToUserId, llama a ensureOpenTask para recrear la
     Task abierta (invariante "todo lead activo con responsable tiene una task
     abierta", que closeOpenTask había roto intencionalmente al cerrar).
  10. Commit de la transacción.
  │
  ▼
Servicios: ensureOpenTask / logActivity (server/src/utils/pipelineHelpers.js),
           logAudit (server/src/utils/audit.js) — fuera de la transacción,
           registra { reopened: true, fromStage, toStage, dealDeleted }
  │
  ▼
Base de datos (MySQL vía Sequelize, todo dentro de una única transacción):
  - tabla leads: UPDATE pipelineStage/status/closeReason/closeReasonDetail
  - tabla deals: DELETE si wasWon
  - tabla activities: INSERT (evento de sistema)
  - tabla tasks: INSERT si hay responsable asignado
  - tabla audit_logs: INSERT (fuera de transacción, vía logAudit)
  │
  ▼
Respuesta: 200 { message: 'Prospecto reabierto exitosamente', data: lead }
           (o 404/400/403/500 según el paso que falló, con rollback completo)
```

Todo el flujo replica byte a byte el patrón de `closeLeadAsWon`/`closeLeadAsLost` (mismo manejo de transacción, mismos tres efectos colaterales: Activity + Task + AuditLog). No hay atajos ni pasos a medio implementar dentro del controlador.

## Reglas de negocio

**¿Qué significa "reabrir" un lead?** Sacar un prospecto de una etapa terminal (`venta_realizada` o `no_interesado`) y devolverlo a una etapa activa del pipeline comercial, deshaciendo los efectos que produjo el cierre.

**¿Qué estados permite recuperar?** Cualquier etapa no terminal (`REOPEN_STAGES`, línea 176) — por defecto `'contactado'` si no se especifica una etapa destino en el body. No existe forma de recuperar la etapa exacta en la que estaba *antes* de cerrarse (esa información no se persiste en ningún lugar); quien reabre elige a qué etapa activa vuelve.

**¿Qué modifica?**
- `pipelineStage`, `status` (legacy), `closeReason`, `closeReasonDetail` del lead.
- Si venía de `venta_realizada`: **borra el `Deal`** asociado — la misma regla que ya usa `closeLeadAsLost` al corregir un cierre-ganado equivocado. Esto es intencional y documentado en el comentario de línea 764-765, pero es un efecto **destructivo e irreversible** desde la perspectiva de negocio: si el Deal tenía datos propios (monto, propiedad vinculada, fecha de cierre) que no se copiaron a ningún otro lado antes de reabrir, se pierden.
- Recrea la `Task` abierta si el lead tiene responsable asignado.

**¿Existe alguna regla de negocio relacionada?** Sí, y está activamente aplicada en dos lugares:
1. `reopenLead` mismo es la única vía permitida para sacar un lead de una etapa terminal.
2. El `PUT /:id` genérico (`updateLead`) tiene un guard simétrico (línea 499-503): si el lead **ya está** en etapa terminal y el body intenta tocar `pipelineStage`, rechaza con 400 y remite explícitamente a `/reopen`. Otros campos (notas, responsable, etc.) sí se pueden editar en un lead cerrado por la vía genérica — solo `pipelineStage` está bloqueado.

Esto confirma que la regla de negocio "reabrir es una operación con efectos colaterales, no un cambio de campo" está firmemente establecida y activamente forzada en el backend — no es una idea abandonada, es una invariante que el sistema protege hoy.

## Comparación con la interfaz

Se revisaron `ProspectosSection.jsx` (vista lista + kanban + panel de detalle), `KanbanBoard.jsx` y `StageBottomSheet.jsx`. Hallazgo clave: **existen dos puntos de entrada de UI que ya permiten al usuario intentar la operación que `reopen` resolvería, y ambos fallan silenciosamente contra el guard del PUT genérico**:

1. **Drag & drop en Kanban** (`KanbanBoard.jsx:308`, `ProspectosSection.jsx:1105-1114`): las tarjetas son `draggable` sin ninguna condición sobre su etapa actual — incluidas las columnas terminales `venta_realizada`/`no_interesado` (los propios estilos de columna ya distinguen visualmente estas etapas como terminales, líneas 24-35 de `KanbanBoard.jsx`). `attemptStageChange` decide el flujo según la etapa **destino**: si es terminal abre el modal de cierre; si NO es terminal, llama directo a `updateMutation.mutate(...)` — el PUT genérico. Arrastrar una tarjeta cerrada hacia una columna activa dispara exactamente el camino que el backend bloquea.
2. **Selector de etapa en el panel de detalle / bottom sheet móvil** (`ProspectosSection.jsx:449-456` botón "Etapa" → `StageBottomSheet.jsx:44-57`): el bottom sheet lista **todas** las etapas de `PIPELINE_STAGE_LABELS` sin filtrar por si el lead actual está cerrado. Tocar cualquier etapa activa desde un lead cerrado invoca el mismo `onSelectStage` → `attemptStageChange` → PUT genérico.

En ambos casos, el `onError` de `updateMutation` (línea 1028) hace `toast.error(e?.response?.data?.error || 'Error al actualizar')` — es decir, **el usuario efectivamente ve el mensaje "Este prospecto está cerrado — usa PUT /:id/reopen para reactivarlo" como un toast crudo**, con jerga de API, sin que la aplicación ofrezca ninguna acción para completar lo que el mensaje sugiere.

**¿Existe un lugar lógico donde debería aparecer "Reabrir"?** Sí, y ya está semi-construido:
- El botón "Etapa" del panel de detalle (línea 449) es el lugar más directo: al detectar que `TERMINAL_STAGES.includes(lead.pipelineStage)`, podría abrir un modal de reapertura (análogo a `CloseLeadModal`) en vez de (o antes de) intentar el PUT genérico.
- La columna terminal del Kanban es el segundo lugar natural — mismo patrón que ya usa `attemptStageChange` para decidir entre "cerrar" y "actualizar", solo falta la tercera rama: "reabrir".

## Estado de implementación

**Backend: completo y terminado**, no una implementación parcial:
- **Validaciones:** 404 (lead inexistente), 403 (`canEditLead`), 400 (no está cerrado), 400 (etapa destino inválida) — cobertura equivalente a `close-won`/`close-lost`.
- **Permisos:** `requireCrmAccess` a nivel de ruta + `canEditLead` a nivel de fila dentro del controller, igual que el resto del módulo de leads con el modelo de 4 roles.
- **Auditoría:** `logAudit(req, 'update', 'lead', lead.id, { reopened: true, fromStage, toStage, dealDeleted })` — cumple la convención de `CLAUDE.md` de loguear toda mutación admin.
- **Logs:** `console.error('Error en reopenLead:', error)` en el catch, igual que el resto de controllers del archivo.
- **Manejo de errores:** rollback explícito de transacción en cada branch de error, igual patrón que `closeLeadAsWon`/`closeLeadAsLost`.
- **Tests:** 12 tests de integración dedicados en `leadClose.integration.test.js` (rechazo si no está cerrado, 404, reapertura desde cada etapa terminal, destino explícito, rechazo de etapa terminal como destino, restauración del invariante de Task con y sin responsable, contenido del AuditLog, rollback de transacción simulando fallo de `Task.create`, y el test de regresión del bug original que motivó todo esto).

**Frontend: 0% implementado.** No hay servicio, no hay mutation, no hay componente, no hay botón. No es un MVP a medias de la UI — es la ausencia total de la mitad frontend de la feature.

## Riesgos

**A) Se implementa la interfaz**
- Ventaja: cierra un flujo de negocio real (reingreso de leads a seguimiento, corrección de cierres por error) que hoy termina en un error de API visible al usuario. Backend ya probado y sin trabajo adicional de validación/permisos/auditoría pendiente — el esfuerzo es 100% frontend (servicio + mutation + un modal/confirmación, siguiendo el patrón ya existente de `CloseLeadModal`).
- Desventaja/riesgo: el borrado del `Deal` al reabrir desde `venta_realizada` es irreversible y silencioso salvo por el mensaje de Activity — la UI debería advertir explícitamente esto (ej. un modal de confirmación, no un simple botón), igual que probablemente ya hace `CloseLeadModal` para el cierre.

**B) Se elimina el endpoint**
- Ventaja: reduce superficie de API sin consumidor.
- Desventaja: **reintroduce el bug original que motivó su creación** (lead cerrado que puede corromperse vía el PUT genérico) salvo que también se elimine el guard de `updateLead:499-503` — pero ese guard es lo único que previene el bug de Deal huérfano / Task faltante documentado en la memoria del 2026-07-20. Eliminar `reopen` sin also revertir ese guard deja al sistema **sin ninguna vía** para sacar un lead de una etapa terminal, lo cual en un negocio de re-engagement inmobiliario (un lead "perdido" hoy puede volver a ser viable en unos meses) es una regresión de producto, no una limpieza.

**C) Se deja como está**
- Ventaja: cero esfuerzo inmediato.
- Desventaja: el usuario sigue viendo el toast de error crudo cada vez que intenta mover un lead cerrado (evidencia de la sección "Comparación con la interfaz" — esto no es hipotético, es reproducible hoy con cualquier lead cerrado en Kanban o en el panel de detalle). Es la opción con peor relación esfuerzo/beneficio: no reduce riesgo ni mejora la experiencia, solo pospone una decisión ya evidenciada por el código mismo.

**D) Se documenta para uso futuro**
- Ventaja: dejar constancia explícita evita que una futura limpieza de código muerto lo elimine por error (ya casi ocurre: `AUDITORIA_LIMPIEZA_PROYECTO.md:46` lo lista como candidato de "Prioridad Media" a decidir).
- Desventaja: no resuelve el problema visible para el usuario final (el toast de error) — es una medida de higiene documental, no una solución de producto.

## Recomendación final

**Implementar la interfaz.**

Evidencia que sustenta esta recomendación, sin suposiciones:

1. El backend ya está terminado, probado (12/12 tests) y sigue exactamente el patrón arquitectónico establecido por `close-won`/`close-lost` — no requiere trabajo adicional de validación, permisos o auditoría.
2. El propio backend **ya depende de que exista una UI que llame a `/reopen`**: el mensaje de error del PUT genérico (`leadController.js:502`) instruye literalmente al llamador a usar ese endpoint. Un backend que emite ese mensaje sin que ningún cliente pueda actuar sobre él es, por definición, un flujo incompleto, no una decisión de diseño.
3. La UI actual ya tiene **dos rutas de interacción reproducibles hoy** (drag & drop en Kanban, selector de etapa en el panel de detalle/bottom sheet móvil) que permiten al usuario *intentar* reabrir un lead cerrado, y ambas terminan en un toast de error con texto de API cruda. Esto no es una carencia teórica — es un bug de UX activo y visible.
4. Una auditoría de limpieza previa del propio proyecto (`AUDITORIA_LIMPIEZA_PROYECTO.md:46,49,178,197`), hecha independientemente semanas antes que esta, llegó a la misma conclusión ("más probable que sea una UI faltante que un endpoint muerto") sin conocer el detalle de los puntos de entrada rotos documentado aquí.
5. El dominio de negocio (remates bancarios / bienes raíces) hace del reingreso de leads un caso de uso legítimo y frecuente — un prospecto marcado "no interesado" hoy puede reactivarse en semanas, y el propio sistema ya modela esa necesidad (de ahí que el backend se haya construido primero).

Descartar deprecar o eliminar el endpoint: hacerlo sin revertir el guard simétrico en `updateLead` reintroduciría el bug de datos que motivó la creación de `reopen` en primer lugar (Deal huérfano / Task faltante en leads cerrados movidos por el PUT genérico), documentado en la memoria de proyecto del 2026-07-20.
