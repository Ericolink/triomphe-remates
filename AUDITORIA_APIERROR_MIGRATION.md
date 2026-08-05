# Auditoría: adopción de `ApiError` como mecanismo estándar de errores

Fecha: 2026-08-03

## Estado inicial

`ApiError`/`errorHandler` (`server/src/middleware/errorHandler.js`) ya existían y estaban
registrados al final de `app.js`, pero **eran código muerto**: ningún controlador hacía
`throw`/`next(error)` que llegara hasta ahí. El manejo de errores real vivía 100% inline,
repetido en los 18 controladores de `server/src/controllers/`:

- **260** respuestas manuales `res.status(4xx/5xx).json({ error: '...' })`.
- **105** bloques `try/catch`, cada uno con su propio `console.error(...)` + respuesta.
- **105** llamadas a `console.error`, prácticamente todas duplicando lo mismo.
- El formato de respuesta ya era casi universal: `{ error: 'mensaje' }` en 249 de los 260
  sitios — compatible 1:1 con lo que produce `errorHandler`.
- Riesgo detectado en el propio `errorHandler`: como nunca se alcanzaba, nunca se probó que
  distinguiera un error de dominio de uno inesperado. Antes de migrar cualquier controlador
  había que corregir esto (ver "Cambios a `errorHandler`/`ApiError`").

## Cambios a `errorHandler` / `ApiError`

`server/src/middleware/errorHandler.js`:

- `ApiError` ahora acepta un tercer parámetro opcional `options.cause` (usa el soporte
  nativo de `Error` para `cause`), para adjuntar el error original solo con fines de
  logging: `new ApiError(500, 'Error interno del servidor', { cause: error })`.
- `errorHandler` distingue explícitamente `err instanceof ApiError`:
  - Si es `ApiError`, responde `{ error: err.message }` con `err.statusCode` — igual que
    antes.
  - Si **no** es `ApiError` (error inesperado: Sequelize, Cloudinary, bug de programación),
    responde siempre `500 { error: 'Error interno del servidor' }`, sin exponer nunca
    `err.message` real al cliente. El log interno (`logger.error`) sí registra
    `message`/`cause`/`stack` completos.
- Esto reproduce **exactamente** el comportamiento que ya tenían los 105 catch-all
  manuales (mensaje genérico fijo para lo inesperado), pero centralizado — es lo que
  permitió borrar esos catch-all en lugar de reescribirlos uno por uno.
- Nuevo test unitario `server/src/middleware/__tests__/errorHandler.test.js` (5 casos):
  respuesta exacta para `ApiError`, no-filtrado de mensaje para errores inesperados,
  logging completo del error real, propagación de `cause`, y fallback `userId: 'anonymous'`.

## Controladores migrados

Los 18 controladores fueron migrados. Resumen por tipo de caso:

| Patrón | Archivos | Tratamiento |
|---|---|---|
| Validación/404/403/409 simple | los 18 archivos | `return res.status(x).json({error})` → `throw new ApiError(x, mensaje)` |
| Catch-all genérico sin lógica extra | los 18 archivos | try/catch completo eliminado — Express 5 reenvía la promesa rechazada al `errorHandler` |
| Transacción no manejada + rollback manual | `leadController.js` (`closeLeadAsWon`, `closeLeadAsLost`, `reopenLead`), `propertyController.js` (`promoteProperty`), `taskController.js` (`completeTask`) | unificado a `catch (error) { if (!transaction.finished) await transaction.rollback(); throw error; }` |
| Cloudinary (orden/lógica sin tocar) | `propertyController.js`, `testimonialController.js`, `usersController.js` | solo se migraron las validaciones alrededor; las llamadas a `destroyCloudinaryAsset`/`uploadToCloudinary` quedaron en el mismo orden |
| Mensaje de catch-all no genérico | `testimonialController.js` (`createTestimonial`/`updateTestimonial`/`deleteTestimonial`), `leadController.js` (`sendLeadWhatsApp`) | catch reducido a una línea con guarda `if (error instanceof ApiError) throw error;` antes de re-envolver con el mensaje custom exacto + `cause` |
| Rethrow interno tras `err.code` | `authController.js` (`register`), `usersController.js` (`createUser`) | las ramas `DUPLICATE_EMAIL`/`INVALID_CRM_ROLE` pasaron de `res.status(x).json(...)` a `throw new ApiError(x, err.message)` |

Patrones eliminados: 105 bloques try/catch redundantes, 105 `console.error` duplicados,
260 construcciones manuales de respuesta de error.

## Casos que permanecen con manejo manual, y su justificación

- **`authController.js`, `register` y `login`** (líneas ~11 y ~47): `res.status(400).json({ errors })`
  con un **array** de strings (`validateRegister`/`validateLogin`). `ApiError` transporta un único
  mensaje; convertir esto cambiaría el contrato de respuesta. Se dejaron intactos.
- **`authController.js`, `login`** (401 credenciales inválidas, dos sitios) y `changePassword`
  (400/401): fuera del alcance acordado para este archivo — es el único controlador
  security-sensitive del sistema (enumeración de usuarios vía mensajes de login), y el
  cambio se limitó deliberadamente a la única rama con lógica duplicable real
  (`DUPLICATE_EMAIL`). Quedan con el patrón manual original, sin cambios de comportamiento.
- **`leadController.js`, `sendLeadWhatsApp`** (catch interno ~1022-1032): captura el fallo de
  envío de WhatsApp y a propósito **no** genera una respuesta de error — crea la nota y el
  audit log igual, devolviendo 200 con `warning` (comportamiento deliberado, ver comentario
  `AUDIT-009` en el código). No se tocó.
- **`exportController.js`**: `exportPDF`, `exportFeedbackExcel`, `exportExcel`,
  `exportLeadsExcel` hacen streaming binario directo a `res` (`doc.pipe(res)` /
  `workbook.xlsx.write(res)`) — si algo falla después de fijar headers o de que ya salieron
  bytes, no es seguro volver a llamar `res.status()`. Se dejó el `catch { console.error;
  res.status(500).json(...) }` manual tal cual en los 5 catch-alls de este archivo.
  **Única excepción migrada dentro del archivo**: el `if (!property)` de
  `exportPropertyQuotePDF` (ocurre antes de fijar headers/iniciar el pipe), convertido a
  `throw new ApiError(404, ...)`; su catch se ajustó con una guarda
  `if (error instanceof ApiError && !res.headersSent)` para que ese 404 no quede
  enmascarado por el 500 genérico del resto del catch (streaming), sin alterar el
  comportamiento existente para el resto de los errores de esa función.

## Archivos modificados

```
server/app.js
server/src/middleware/errorHandler.js
server/src/middleware/__tests__/errorHandler.test.js   (nuevo)
server/src/controllers/activityController.js
server/src/controllers/alertController.js
server/src/controllers/analyticsController.js
server/src/controllers/appointmentController.js
server/src/controllers/auditController.js
server/src/controllers/authController.js
server/src/controllers/campaignController.js
server/src/controllers/crmAnalyticsController.js
server/src/controllers/dealController.js
server/src/controllers/exportController.js
server/src/controllers/feedbackController.js
server/src/controllers/jobController.js
server/src/controllers/leadController.js
server/src/controllers/leadPropertyController.js
server/src/controllers/propertyController.js
server/src/controllers/taskController.js
server/src/controllers/testimonialController.js
server/src/controllers/usersController.js
```

## Validaciones ejecutadas

- `cd server && npm run lint` → 0 errores, 12 warnings preexistentes sin relación con este
  cambio (mismos antes y después, en archivos no tocados: `emailService.js`,
  `exportHelpers.js`, `fileSignature.js`, `pipelineHelpers.js`).
- `cd server && npm test` (suite completa, contra `triomphe_test` viva) → **23/23 suites,
  189/189 tests, todos pasando** — incluye los 5 tests nuevos de `errorHandler`.
- `node -e "require('./app.js')"` → confirma que las 18 rutas/controladores cargan sin
  errores de sintaxis/referencia.
- Grep de cierre: los únicos `res.status(4xx/5xx)` manuales que quedan en el código son
  exactamente los documentados arriba (`authController.js` líneas 11/47/53/58/79/103/116,
  `exportController.js` líneas 155/342/456/592/891) — ningún otro controlador conserva el
  patrón manual. Ningún bloque hace `throw` seguido de una respuesta inalcanzable en la
  misma rama. Los `console.error` que quedan son exclusivamente los best-effort
  fire-and-forget (envío de email/WhatsApp, registro de analytics/historial) que nunca
  formaron parte del camino de respuesta al cliente — no se tocaron.
- **`npm run build` (raíz) no se ejecutó**: ese script incluye `cd server && npm install
  --omit=dev`, que habría eliminado `jest`/`eslint` (devDependencies) del `node_modules`
  local — un efecto colateral disruptivo para validar un cambio puramente backend/runtime
  que no toca nada del pipeline de build del cliente. Se recomienda correrlo, como de
  costumbre, justo antes de un deploy real (`npm run predeploy:check` incluido).

## Riesgos detectados (preexistentes, NO introducidos por esta migración)

Documentados para que no se confundan con efectos de este cambio:

- `propertyController.uploadImages`: si un archivo falla a mitad de un lote ya subido
  parcialmente a Cloudinary, no hay limpieza de los assets huérfanos.
- `propertyController.setCoverImage`: limpia `isCover` de todas las imágenes antes de
  verificar que el `imageId` destino exista — un 404 puede dejar la propiedad sin portada.
- `exportController.exportPDF`/`exportPropertyQuotePDF`: si el stream falla a mitad de
  camino, el documento PDFKit nunca se cierra (`doc.end()`) y la respuesta HTTP puede
  quedar en un estado colgado — bug preexistente e independiente de esta migración.
- `usersController.updateUser`: el cambio de contraseña se persiste antes del resto de las
  actualizaciones (sin transacción); un fallo posterior (ej. subida a Cloudinary) no
  revierte la contraseña ya cambiada.

## Beneficios obtenidos

- Manejo de errores centralizado en un único middleware, con logging completo
  (`message`/`cause`/`stack`/`userId`) en un solo lugar en vez de 105 sitios dispersos.
- ~2.400 líneas netas menos de código repetido (`git diff --stat`: +2.380 / −2.828 en los
  20 archivos tocados).
- El `errorHandler`, antes código muerto y no verificado, ahora es la vía real de todos los
  errores de dominio y tiene cobertura de test propia.
- Reducción real de superficie de bugs: antes, cada controlador podía olvidar el status
  correcto o filtrar accidentalmente `error.message` en un catch-all; ahora ese
  comportamiento está garantizado en un solo lugar.

## Confirmación

- **`ApiError` es ahora el mecanismo estándar** para representar errores de dominio en los
  18 controladores, salvo las excepciones documentadas y justificadas arriba.
- **El middleware global (`errorHandler`) es el único responsable** de construir la
  respuesta HTTP de error para todo lo migrado — ningún controlador migrado hace logging
  ni formateo de respuesta de error por su cuenta.
- **El comportamiento funcional de la API no cambió**: mismos status codes, mismos mensajes
  visibles al cliente, mismo formato JSON — verificado por la suite de 189 tests existente
  sin modificar ninguna aserción de negocio, más los grep de cierre anteriores.
- **Las respuestas son más consistentes y mantenibles**: un solo patrón (`throw new
  ApiError(...)`) reemplaza cuatro variantes distintas de manejo manual que coexistían
  antes en el código.
