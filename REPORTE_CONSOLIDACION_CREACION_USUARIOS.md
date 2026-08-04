# Reporte: Consolidación de la lógica de creación de usuarios

**Fecha:** 2026-08-03
**Alcance:** `POST /api/auth/register` (`authController.js`) y `POST /api/users` (`usersController.js`).
**Naturaleza:** refactorización de arquitectura, sin cambios de comportamiento externo. Implementa la opción E recomendada en `AUDITORIA_CREACION_USUARIOS.md` (§Arquitectura recomendada / §Recomendación).

---

## Resumen de la refactorización

Se creó `server/src/services/userService.js` como única fuente de verdad para crear un usuario: chequeo de email duplicado, validación de `crmRole`, hash de password, `User.create` con sus defaults, y el punto de invocación de auditoría. Ambos controladores (`authController.register` y `usersController.createUser`) ahora delegan en `userService.createUser()` y conservan únicamente la responsabilidad de leer el request, decidir qué opciones pasarle al servicio (si auditar o no, si validar `crmRole` o no — porque `register` nunca lo acepta) y construir su propia respuesta HTTP, que sigue siendo distinta en cada endpoint (con/sin token, `user` vs `data: safeUser(...)`).

```
Controller (authController.register / usersController.createUser)
        ↓ valida su propio contrato de entrada, arma su propia respuesta
userService.createUser(data, { audit })
        ↓ valida crmRole → valida email duplicado → hashea password → User.create
        ↓ invoca audit(user) si el caller lo pidió
Model (User) → Database
```

## Responsabilidades movidas al servicio

- Verificación de email duplicado (`User.findOne({ where: { email } })` → error `DUPLICATE_EMAIL`).
- Validación de `crmRole` contra la whitelist `VALID_CRM_ROLES` (antes vivía solo en `usersController.js`, duplicada además dentro del mismo archivo en `updateUser`) → error `INVALID_CRM_ROLE`.
- Hash de password (`hashPassword`, bcrypt salt 12).
- `User.create(...)` con los defaults de negocio: `role: role || 'editor'`, `crmRole: crmRole || null`.
- Punto de invocación de auditoría: el servicio llama a un callback `audit(user)` si el caller lo provee — no importa `logAudit` ni conoce `req`/`res`/Express. Esto mantiene al servicio libre de acoplamiento a Express, tal como pedía el objetivo, sin perder la capacidad de auditar.
- `safeUser()` — antes definida solo en `usersController.js` (no exportada, no reutilizable); ahora vive en el servicio y `usersController.js` la reexporta para sus propios usos (`createUser` y `updateUser`).
- `VALID_CRM_ROLES` — misma situación: ahora se define una sola vez en el servicio; `usersController.js` la reexporta para `createUser` y `updateUser`.

El servicio **no genera JWT** (eso se quedó exclusivamente en `authController.register`, que lo emite después de recibir el usuario creado) y **no usa `res`/conoce Express** — su única superficie hacia el exterior es lanzar `Error` con `.code` (`'DUPLICATE_EMAIL'` | `'INVALID_CRM_ROLE'`), que cada controlador traduce al status code HTTP que ya usaba.

## Código duplicado eliminado

- Dos llamadas independientes a `hashPassword` antes de `User.create` → una sola, dentro del servicio.
- Dos implementaciones del chequeo "email ya registrado" (`User.findOne` + `409`) → una sola.
- `VALID_CRM_ROLES` declarado dos veces en `usersController.js` (en el módulo, usado por `createUser` y `updateUser`) → ahora una declaración en el servicio, reexportada.
- Objeto de respuesta "usuario seguro" construido a mano dos veces dentro de `authController.js` (`register` y `login`, líneas 28-34 y 68-74 del original) — **no se tocó `login`**, fuera de alcance de esta tarea (crea el objeto en el contexto de un login, no de una creación); se documenta como mejora futura más abajo.

## Diferencias que se conservaron por compatibilidad

Estas diferencias entre los dos endpoints ya existían y **no se eliminaron ni se unificaron** — se preservaron dentro/alrededor del servicio exactamente con el mismo efecto observable:

| Diferencia | Cómo se preservó |
|---|---|
| `register` nunca acepta `crmRole` desde el body | `authController.register` sigue sin desestructurar/pasar `crmRole` a `userService.createUser` — el usuario creado por esta vía sigue quedando siempre con `crmRole: null` |
| `register` nunca llama a `logAudit` | `authController.register` no pasa la opción `audit` al servicio — sigue sin auditar, igual que antes (comportamiento documentado como inconsistente en `AUDITORIA_CREACION_USUARIOS.md §Diferencias funcionales`, **no corregido aquí** por instrucción explícita de no alterar comportamiento) |
| `register` exige `role` (sin default); `createUser` lo hace opcional con default `'editor'` | Cada controlador sigue haciendo su propia validación previa (`validateRegister` vs. checks inline) antes de invocar al servicio; el servicio solo aplica `role || 'editor'` como fallback, que en el caso de `register` nunca se activa porque `validateRegister` ya garantiza que `role` viene presente |
| Formas de error distintas: `register` → `400 { errors: [...] }` (array); `createUser` → `400 { error: '...' }` (string) | La validación de formato de entrada (presencia/longitud de campos, formato de email) sigue viviendo en cada controlador tal cual estaba; el servicio solo añade sus propios errores (`DUPLICATE_EMAIL`, `INVALID_CRM_ROLE`) que cada controlador traduce a su propio formato de respuesta ya existente |
| Orden de precedencia de errores en `createUser`: si `crmRole` es inválido **y** el email ya existe a la vez, ganaba el error de `crmRole` (400) antes que el de duplicado (409) | El servicio preserva ese mismo orden (valida `crmRole` antes que duplicado de email) para no cambiar cuál error gana en ese caso límite |
| `register` devuelve un JWT nuevo; `createUser` no devuelve token | Sin cambios — la generación de JWT sigue exclusivamente en `authController.register`, fuera del servicio |
| `register` construye su objeto de respuesta a mano (`{id,name,email,role,crmRole}`); `createUser` usa `safeUser()` (con más campos: `isActive`, `profilePhoto`, `lastLogin`, `createdAt`) | No se migró `register` a `safeUser()` porque eso agregaría campos nuevos a su contrato de respuesta actual — se mantuvo su objeto inline tal cual |
| Rate limiter distinto (`authLimiter` vs `apiLimiter`) | No se tocó — vive en las rutas, fuera del alcance de esta tarea |

No se detectaron diferencias nuevas ni se "corrigieron" bugs históricos silenciosamente; las inconsistencias señaladas en la auditoría previa (falta de `logAudit` en `register`, ausencia de `crmRole` en `register`) siguen existiendo con el mismo efecto observable, solo que ahora están documentadas explícitamente en el código del servicio (comentarios en `userService.js`) en vez de estar implícitas en la duplicación.

## Archivos modificados

- **Nuevo:** `server/src/services/userService.js` — `createUser(data, { audit })`, `safeUser(user)`, `VALID_CRM_ROLES`.
- `server/src/controllers/authController.js` — `register` ahora delega en `userService.createUser`; captura `DUPLICATE_EMAIL` y responde `409` igual que antes. Import nuevo: `userService`. `User`/`hashPassword` se mantienen importados porque `login`/`changePassword` los siguen usando directamente.
- `server/src/controllers/usersController.js` — `createUser` ahora delega en `userService.createUser` con un callback `audit` que llama a `logAudit` con el `req` real; captura `INVALID_CRM_ROLE` (400) y `DUPLICATE_EMAIL` (409). `VALID_CRM_ROLES` y `safeUser` locales fueron reemplazados por una reexportación desde `userService` (`const { VALID_CRM_ROLES, safeUser } = userService`), usada también por `updateUser` sin cambiar su lógica.

No se modificaron rutas, middleware, nombres de endpoints, Swagger, ni permisos.

## Validaciones ejecutadas

- `npm run lint` (server) → **0 errores** (12 warnings preexistentes en archivos no tocados por este cambio: `emailService.js`, `exportHelpers.js`, `fileSignature.js`, `pipelineHelpers.js`).
- `npm test` (server, Jest) → **184/184 tests pasando**, 22 suites. Nota: como ya señalaba `AUDITORIA_CREACION_USUARIOS.md`, no existía (ni existe hoy) un test de integración dedicado a `POST /api/auth/register` ni a `POST /api/users` — los tests existentes crean usuarios vía el factory `User.create()` directo, bypaseando ambos controladores. Esto significa que la suite verifica que **nada más se rompió** (login, CRM, auditoría de otros recursos, etc.) pero no ejerce directamente el código nuevo del servicio. Ver "Riesgos".
- `npm run build` (raíz) → build completo exitoso, incluido el gate `postbuild` (`check-deploy-safety.js`) sin hallazgos.

## Confirmación explícita

- **Ahora existe una única fuente de verdad para la creación de usuarios**: `userService.createUser()`, invocada por ambos controladores.
- **Los controladores únicamente coordinan la petición y la respuesta**: leen `req.body`, aplican su propia validación de forma de entrada (que ya era distinta entre ambos y se conservó así), invocan al servicio, traducen sus errores a códigos HTTP, y arman su propia respuesta (token vs. `safeUser`).
- **No se modificó el comportamiento externo de la API**: mismos endpoints, mismas rutas, mismos middlewares, mismos status codes, mismos formatos de respuesta y de error, mismos defaults, misma auditoría (presente en `createUser`, ausente en `register`, igual que antes).
- **No se eliminaron endpoints ni se rompió compatibilidad**: `POST /api/auth/register` y `POST /api/users` siguen existiendo con idéntico contrato.

## Riesgos detectados

- **Ausencia de test de integración directo sobre ambos endpoints** (preexistente, no introducido por este cambio): un futuro cambio accidental en `userService.js` que alterara sutilmente el comportamiento no sería detectado por la suite actual. Mitigado parcialmente por la cobertura indirecta (184 tests pasando que ejercitan login, CRM, auditoría, etc., todos dependientes del mismo modelo `User`), pero no reemplaza un test directo de `register`/`createUser`.
- **`register` sigue sin auditoría y sin `crmRole`** — riesgo ya documentado en la auditoría previa (§Seguridad), no corregido aquí por instrucción explícita de la tarea ("no corregirla automáticamente").
- El callback `audit` del servicio asume que el caller le pasa una función correcta; si un futuro tercer consumidor del servicio pasa un `audit` que lanza una excepción de forma síncrona, esa excepción se propagaría hacia arriba del `try/catch` del controlador que lo llamó (mismo comportamiento que tenía `logAudit` inline antes, ya que `logAudit` en sí es fire-and-forget y no lanza).

## Mejoras futuras posibles (no implementadas)

1. Deprecar formalmente `POST /api/auth/register` (opción B/A de la auditoría previa) una vez confirmado que no tiene consumidores externos no versionados.
2. Unificar los dos formatos de validación de entrada (`errors: [...]` vs `error: '...'`) y los dos estilos de reglas (name/email format en `register`, ausentes en `createUser`) — implicaría un cambio de contrato HTTP, fuera de alcance de esta tarea.
3. Agregar `logAudit` a `register` para cerrar el gap de trazabilidad, si se decide mantenerlo vivo.
4. Reutilizar el objeto de respuesta duplicado en `authController.login` (mismo patrón `{id,name,email,role,crmRole}` que `register` ya no construye a mano, `login` sigue haciéndolo) — fuera de alcance porque `login` no crea usuarios.
5. Escribir tests de integración directos para `POST /api/auth/register` y `POST /api/users`, incluyendo el caso límite de precedencia `crmRole` inválido + email duplicado simultáneos.
