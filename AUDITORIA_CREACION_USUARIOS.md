# Auditoría de creación de usuarios

**Fecha:** 2026-08-03
**Alcance:** `POST /api/auth/register` vs. `POST /api/users`, todos los consumidores (frontend, tests, scripts, docs, Swagger), historial de git relevante.
**Metodología:** lectura completa de rutas/controladores/middleware/validadores involucrados, `grep` exhaustivo de consumidores en `client/src`, `server/src/__tests__`, `scripts/`, documentación y Swagger, y reconstrucción de la línea de tiempo vía `git log -p` sobre `server/src/routes/auth.js` y `usersController.js`.
**Naturaleza de la tarea:** exclusivamente de análisis. No se modificó, eliminó ni refactorizó ningún archivo de código. Este documento es nuevo, no reemplaza a los tres audits previos que ya tocaban el tema (`REPORTE_REVISION_FINAL.md`, `AUDITORIA_CTO_EXTREMA.md`, `AUDITORIA_LIMPIEZA_PROYECTO.md`) — los cita y verifica en vez de repetir sus hallazgos a ciegas.

---

## Resumen ejecutivo

Existen dos caminos de creación de usuario porque **se construyeron en momentos distintos del proyecto con propósitos distintos, y uno de ellos quedó obsoleto sin ser retirado formalmente**:

- `POST /api/auth/register` (`authController.js`) es el endpoint **original** del módulo de autenticación (commit `66bbd67`, 2026-05-12). En su diseño original era de **registro público sin autenticación** — cualquiera podía crear una cuenta, incluida una cuenta `admin`, simplemente enviando `role: 'admin'` en el body. Este patrón es típico de un bootstrap inicial ("crear el primer admin") en un proyecto que todavía no tenía panel de gestión de usuarios.
- `POST /api/users` (`usersController.createUser`) apareció **tres semanas después** (commit `cc417b3`, "v1.4: ...gestión de usuarios", 2026-06-04) como parte de un panel de administración de usuarios real: paginación, `crmRole`, `logAudit`, respuesta saneada (`safeUser`). Este es el endpoint que el frontend usa hoy y el único con consumidor real.
- El 2026-06-18, una auditoría externa (`REPORTE_REVISION_FINAL.md`) encontró que `register` seguía siendo invocable **sin autenticación** — un usuario anónimo podía crear una cuenta `admin` y tomar control total del panel. Se corrigió agregando `authenticate, authorize('admin')` a la ruta, **sin tocar el controlador ni consolidarlo con `createUser`** (la corrección recomendada explícitamente en ese mismo reporte, línea 47: "reutilizar `usersController.createUser`... como único punto de creación de usuarios", no se aplicó).
- Auditorías posteriores (`AUDITORIA_CTO_EXTREMA.md`, 2026-06-29; `AUDITORIA_LIMPIEZA_PROYECTO.md`, sin fecha de commit propia pero posterior al 2026-08-03) confirman que el fix de acceso sigue vigente y que **el frontend no llama a `register` en ningún punto** (`grep -rn "register" client/src` → 0 resultados), pero el endpoint nunca fue deprecado ni eliminado.

**Conclusión de esta auditoría:** `register` ya no cumple ninguna función que `createUser` no cumpla, hoy tiene **peor comportamiento de seguridad y de datos** que `createUser` (ver §Diferencias funcionales), y su único usuario posible con las credenciales de admin que requiere sería un admin que, si quisiera crear un usuario, ya tiene `POST /api/users` disponible con mejor UX (log de auditoría, respuesta saneada, `crmRole`). No hay evidencia de ningún consumidor externo (Postman, scripts, tests, documentación de integración) que dependa de él.

---

## Consumidores encontrados

Búsqueda exhaustiva en: `client/src` (frontend completo), `server/src/__tests__` (11 suites de integración), `scripts/` (2 scripts de utilidad de build), `server/config/swagger.js` (fuente de la doc Swagger), y todo archivo `.md` del repo. No existen colecciones Postman/OpenAPI exportadas como archivo en el repo — la documentación de API vive únicamente en los comentarios `@swagger` inline de cada ruta, que Swagger UI renderiza en tiempo de ejecución.

| Endpoint | Frontend | Tests | Scripts | Documentación | Swagger |
|---|---|---|---|---|---|
| `POST /api/auth/register` | **0 referencias** (`grep -rn "register" client/src` → vacío) | **0 referencias** — `auth.integration.test.js` solo cubre `POST /api/auth/login`; ninguna suite ejercita `register` | 0 referencias | Mencionado únicamente en los 3 audits previos como hallazgo de seguridad / código muerto, nunca como endpoint activo de producto | Documentado (`server/src/routes/auth.js:14-40`), con `security: bearerAuth` desde el fix de 2026-06-18 |
| `POST /api/users` | `client/src/services/usersService.js:9` → `api.post('/users', userData)`, invocado desde `client/src/pages/admin/UsersPage.jsx` (formulario "Nuevo usuario" del panel admin) | Sin test de integración dedicado (los tests crean usuarios directamente vía `User.create()` en `server/src/__tests__/helpers/factories.js`, sin pasar por ningún endpoint) | 0 referencias | No documentado con `@swagger` (`server/src/routes/users.js` no tiene comentarios Swagger en ninguna de sus 6 rutas — brecha de documentación preexistente, no introducida por esta auditoría) | **No aparece en Swagger UI** |

**Hallazgo colateral no solicitado pero relevante:** ninguno de los dos endpoints tiene cobertura de test de integración real (`register` no se prueba en absoluto; `createUser` tampoco — los tests bypasean ambos usando el factory `createUser()` de `helpers/factories.js`, que llama `User.create()` directo). Esto significa que un cambio en cualquiera de los dos controladores no rompería ningún test existente, lo cual reduce el riesgo técnico de tocarlos pero también significa que no hay red de seguridad automatizada para esta auditoría ni para una futura consolidación.

**Conclusión de consumidores:** `register` no tiene ni un solo consumidor verificable dentro del repo. La única forma de que "consuma" el endpoint sería un admin autenticado llamándolo manualmente vía curl/Postman fuera del código versionado — posibilidad que ningún documento del proyecto sugiere que exista, y que los tres audits previos ya señalaron como "poco probable" sin poder descartarla al 100% por definición (no se puede probar la ausencia de un consumidor externo no documentado).

---

## Comparación entre endpoints

### Flujo — `POST /api/auth/register`

```
Request (name, email, password, role)
  ↓ authLimiter          → rate limit 20 req/15min por IP (mismo bucket que /login, pensado para frenar fuerza bruta de credenciales)
  ↓ authenticate          → valida JWT, adjunta req.user   (agregado 2026-06-18)
  ↓ authorize('admin')    → exige req.user.role === 'admin' (agregado 2026-06-18)
  ↓ Controller: register()
      ↓ validateRegister(body)   → valida name/email/password/role vía server/src/utils/validators.js
      ↓ User.findOne({email})   → chequeo de duplicado
      ↓ hashPassword(password)  → bcrypt, salt 12
      ↓ User.create({name,email,password,role})   ← crmRole NO se asigna (queda en el default del modelo)
      ↓ generateToken({id, role, tokenVersion})    ← genera y devuelve un JWT del usuario recién creado
  ↓ Respuesta: 201 { message, token, user:{id,name,email,role,crmRole} }
```
**No hay `logAudit`.** La creación de un usuario nuevo por esta vía no queda registrada en la bitácora de auditoría del panel.

### Flujo — `POST /api/users`

```
Request (name, email, password, role, crmRole)
  ↓ apiLimiter            → rate limit 500 req/15min (límite genérico de API autenticada, no específico de auth)
  ↓ authenticate          → valida JWT, adjunta req.user
  ↓ authorize('admin')    → exige req.user.role === 'admin'
  ↓ Controller: createUser()
      ↓ validación inline (name/email/password requeridos, password.length >= 8, crmRole ∈ VALID_CRM_ROLES)
      ↓ User.findOne({email})   → chequeo de duplicado
      ↓ hashPassword(password)  → bcrypt, salt 12 (mismo helper que register)
      ↓ User.create({name,email,password,role: role||'editor', crmRole: crmRole||null})
      ↓ logAudit(req, 'create', 'user', user.id, {name,email,role,crmRole})   ← queda en bitácora
  ↓ Respuesta: 201 { message, data: safeUser(user) }   ← safeUser() excluye password explícitamente; NO se emite token nuevo
```

### Tabla comparativa

| Aspecto | `POST /api/auth/register` | `POST /api/users` |
|---|---|---|
| Autenticación/autorización | `authenticate` + `authorize('admin')` (agregados como parche de seguridad, 2026-06-18) | `authenticate` + `authorize('admin')` (parte del diseño original) |
| Rate limiting | `authLimiter` — 20/15min, pensado para intentos de login/credenciales | `apiLimiter` — 500/15min, límite genérico de API |
| Validación | `validateRegister()` centralizado en `utils/validators.js`; `role` es **obligatorio** y debe ser `admin` o `editor` | Validación inline en el controlador; `role` es opcional (default `'editor'`); valida además `crmRole` contra una whitelist que `register` ignora por completo |
| Hash de password | `bcrypt`, salt 12 (`utils/helpers.js`) | Idéntico — mismo helper compartido |
| Campo `crmRole` | **No se asigna nunca** — el usuario creado por `register` queda sin acceso al CRM de leads salvo que un admin lo edite después vía `PUT /api/users/:id` | Se asigna explícitamente, validado contra `VALID_CRM_ROLES` |
| Respuesta | Devuelve **un JWT nuevo**, como si el creador estuviera iniciando sesión como el usuario recién creado | No devuelve token; devuelve el usuario saneado con `safeUser()` |
| Sanitización de la respuesta | Construye el objeto de respuesta a mano (`{id,name,email,role,crmRole}`) — funciona pero duplica lo que `safeUser()` ya centraliza en `usersController.js` | Usa `safeUser()`, reutilizable y con más campos (`isActive`, `profilePhoto`, `lastLogin`, `createdAt`) |
| Auditoría (`logAudit`) | **Ausente** — crear un usuario por esta vía no deja rastro en la bitácora | Presente |
| Documentado en Swagger | Sí | No (brecha preexistente, no introducida aquí) |

---

## Diferencias funcionales

No hacen lo mismo solo porque ambos "crean un usuario". Diferencias con impacto real:

1. **`register` genera y devuelve un token de sesión para el usuario creado; `createUser` no.** Esto es coherente con un flujo de auto-registro (`el usuario se registra y queda logueado`), no con un flujo de administración (`un admin crea una cuenta para otra persona, no tiene sentido que el admin reciba el token de esa otra persona`). Es la evidencia más fuerte de que `register` nunca fue pensado para el caso de uso que hoy lo protege (admin creando usuarios desde el panel).
2. **`register` no escribe en la bitácora de auditoría.** Si hoy un admin lo usara en vez de `POST /api/users` (por ejemplo, vía Postman manual), la creación del usuario sería invisible en `AuditPage` — inconsistencia silenciosa con la garantía documentada en `CLAUDE.md` ("Audit logging: llamar a `logAudit(...)` siempre que un admin mute datos").
3. **`register` no soporta `crmRole`.** Un usuario creado por esta vía no puede recibir rol de CRM (`coordinador_ventas`/`capturista`/`asesor_ventas`) en el mismo paso; requeriría una segunda llamada a `PUT /api/users/:id`.
4. **Validación duplicada con reglas ligeramente distintas**: `register` exige `role` explícito (falla si no se manda), `createUser` lo hace opcional con default `'editor'`. Son dos fuentes de verdad para "qué es un usuario válido" que pueden divergir con el tiempo sin que nada lo detecte (no hay test que compare ambas).

---

## Código duplicado

| Archivo / función | Duplica con | Motivo | Riesgo | Reutilizable |
|---|---|---|---|---|
| `authController.js:7-40` (`register`) | `usersController.js:49-92` (`createUser`) | Ambos hacen: buscar email existente → 409 si existe → `hashPassword` → `User.create` → responder 201. Es el mismo flujo transaccional escrito dos veces con forma de respuesta distinta | Bajo-medio — hoy no ha causado un bug funcional, pero cualquier cambio futuro a las reglas de creación de usuario (ej. requerir verificación de email, agregar un campo obligatorio) tiene que aplicarse en dos lugares y ya se ha visto que no siempre pasa (`crmRole` se agregó solo en uno) | Alta — ambos ya comparten `hashPassword`/`comparePassword`/`generateToken` de `utils/helpers.js`; falta extraer el "crear usuario" en sí a un servicio común |
| `authController.js` construye `{id,name,email,role,crmRole}` a mano en `register` y en `login` | `usersController.js:11-21` (`safeUser()`) | `usersController.js` ya centralizó exactamente este patrón de "forma segura del usuario para la respuesta"; `authController.js` no lo reutiliza | Bajo | Alta — es un import directo, sin refactor de lógica |

No se encontró duplicación adicional relacionada con este flujo (middleware, rate limiters y validadores de email/password ya están correctamente centralizados y compartidos por ambos).

---

## Casos de uso — propósito original probable

Con evidencia de `git log -p`, no por suposición:

- **`register` (commit `66bbd67`, 2026-05-12, "módulo de autenticación JWT con roles"):** en su primera versión la ruta era literalmente `router.post('/register', register)` — **sin ningún middleware**, ni siquiera rate limiting. Esto es el patrón típico de **bootstrap inicial de un proyecto sin UI de administración todavía**: el primer commit que introduce JWT necesita alguna forma de crear el primer usuario admin antes de que exista un panel para hacerlo. El rate limiter se agregó 2 semanas después (`410928e`, 2026-05-26, "seguridad: rate limiting en todas las rutas") como parte de un endurecimiento general, no específico de este endpoint.
- **`createUser` (commit `cc417b3`, 2026-06-04, "v1.4: ...gestión de usuarios"):** apareció junto con el panel de administración de usuarios real (`UsersPage.jsx`, `usersService.js`). Este es, con alta confianza, el momento en que el proyecto dejó de necesitar `register` como mecanismo de creación de usuarios — pero nadie lo retiró ni lo redirigió.
- El 2026-06-18 se descubrió que `register` seguía siendo alcanzable sin autenticación (el rate limiter de 2026-05-26 no incluye `authenticate`/`authorize`), lo cual confirma que en ese momento **nadie lo estaba usando ni monitoreando** — de haber tenido tráfico real de administración, el hueco de seguridad probablemente se habría notado antes por el propio flujo de trabajo del equipo, no por una auditoría externa.

No hay evidencia de que `register` haya sido pensado alguna vez como "API pública de auto-registro" en el sentido de un producto orientado a usuarios finales (el dominio de Triomphe Remates es un panel admin interno, no una plataforma con cuentas de usuario público) — su diseño con `role` seleccionable por quien llama a la API descarta esa hipótesis; un registro público real jamás dejaría elegir el rol al que se llama a sí mismo.

---

## Riesgos

**A) Eliminar `POST /auth/register` por completo**
- Ventaja: elimina la duplicación de raíz, reduce la superficie de ataque (un endpoint menos que auditar/mantener), simplifica `authController.js`.
- Riesgo: si existiera algún consumidor externo no documentado (Postman personal de algún desarrollador, script de un colaborador anterior, integración futura no versionada), rompería sin aviso. Dado que requiere ya ser admin autenticado para usarlo, el universo de "quién podría estar usándolo hoy" se reduce a personas que ya tienen acceso admin — y ese mismo universo tiene `POST /api/users` disponible como alternativa funcionalmente superior.
- Probabilidad de romper algo: baja, según la evidencia recolectada (cero referencias en todo el repo, tres auditorías independientes coinciden).

**B) Marcar como deprecated (mantener funcional, documentar en Swagger como obsoleto, loguear un warning si se usa)**
- Ventaja: cero riesgo de romper un consumidor desconocido; da visibilidad si alguien lo sigue usando (vía logs) antes de decidir eliminarlo con evidencia adicional.
- Desventaja: no resuelve la duplicación de lógica ni la inconsistencia de auditoría/`crmRole`; el endpoint sigue siendo una segunda fuente de verdad que puede divergir.

**C) Mantener ambos tal como están**
- Ventaja: ninguna, más allá de "no tocar nada".
- Desventaja: la duplicación documentada en §Código duplicado sigue creciendo con cada cambio a las reglas de creación de usuario; el gap de auditoría (`register` no llama `logAudit`) es una inconsistencia real con la garantía de `CLAUDE.md`, no cosmética.

**D) Reutilizar `register` como endpoint interno (ej. llamarlo desde `createUser` o viceversa)**
- Ventaja: elimina la duplicación sin eliminar ningún endpoint públicamente.
- Desventaja: las formas de respuesta son incompatibles (uno devuelve token+user, el otro devuelve `data: safeUser(user)`) — "reutilizar" uno desde el otro requeriría que uno de los dos cambie su contrato de respuesta, lo cual sí podría romper al consumidor real (`UsersPage.jsx` espera `data: safeUser(user)`).

**E) Consolidar ambos mediante un servicio compartido (`userService.createUser()` interno, sin exponer la lógica de un endpoint a través del otro)**
- Ventaja: resuelve la duplicación de raíz sin forzar a ninguno de los dos controladores a depender del otro ni a cambiar su contrato HTTP externo; permite que cada endpoint decida su propia forma de respuesta (con o sin token) sobre una única función de creación con las reglas de negocio centralizadas (hash, chequeo de duplicado, `crmRole`, `logAudit`).
- Desventaja: es el camino con más trabajo de los cinco (requiere diseñar la interfaz del servicio), aunque el riesgo de romper algo es bajo dado el estado actual del código.

---

## Seguridad

- **Antes del 2026-06-18:** `register` era explotable — control de acceso roto (OWASP A01:2021), cualquier visitante podía autoasignarse `role: 'admin'`. Corregido.
- **Estado actual:** ambos endpoints exigen `authenticate` + `authorize('admin')`. No hay diferencia de exposición pública entre ambos hoy.
- **Diferencia residual de abuso:** `register` usa `authLimiter` (20 req/15min, pensado para intentos de credenciales) mientras `createUser` usa `apiLimiter` (500 req/15min, genérico). Dado que ambos ya requieren ser admin autenticado, esta diferencia no es un riesgo de seguridad práctico hoy — pero es una inconsistencia que sobrevive del diseño original de `register` como endpoint público de alto riesgo, y no fue reconsiderada cuando se lo convirtió en admin-only.
- **`register` sigue sin `logAudit`.** Desde una perspectiva de seguridad operativa (trazabilidad forense), esto es la diferencia más relevante que queda: un admin comprometido o malicioso podría crear cuentas usando `register` específicamente para evadir la bitácora de auditoría, algo que no puede hacer usando `createUser`. Es un riesgo de bajo impacto (requiere ya tener credenciales admin) pero de arquitectura de auditoría real.
- No se encontraron diferencias en validación de fuerza de contraseña, CORS, ni en el propio `hashPassword` — ambos comparten el mismo helper con los mismos parámetros (`bcrypt`, salt 12).

---

## Arquitectura recomendada (sin implementar)

Estructura destino sugerida, consistente con el patrón de capas que el proyecto ya sigue en otras áreas (ej. `emailService.js` centraliza toda la lógica de email en vez de que cada controlador construya HTML inline, según `CLAUDE.md`):

```
Controller (authController.register / usersController.createUser)
        ↓ cada uno arma su propio request/response shape
UserService.createUser({ name, email, password, role, crmRole, actorReq })
        ↓ valida duplicado de email, hashea password, aplica reglas de crmRole,
        ↓ crea el registro, llama logAudit si corresponde
Model (User) → Database
```

- El servicio centraliza: chequeo de email duplicado, hash de password, validación de `crmRole`, creación del registro y el `logAudit`.
- Cada controlador conserva su propia responsabilidad de forma de respuesta: `register` puede seguir devolviendo un token si se decide conservar ese comportamiento; `createUser` sigue devolviendo `safeUser()`.
- Esto no obliga a elegir entre las opciones A-E de la sección de riesgos — es compatible tanto con "mantener `register` deprecated pero funcional" como con "eliminarlo", ya que el servicio compartido de todas formas resuelve la duplicación de lógica de negocio independientemente de cuántos controladores lo llamen.

---

## Recomendación

**Deprecar `POST /api/auth/register` y consolidar la lógica de creación de usuario en un servicio compartido (combinación de las opciones B + E), no eliminarlo de inmediato.**

Justificación basada en evidencia, no en suposición:

1. **No hay evidencia de consumidor real** (frontend, tests, scripts, documentación) — pero tampoco hay forma de descartar al 100% un consumidor externo no versionado, dado que el endpoint requiere solo credenciales admin válidas, que técnicamente cualquier admin del sistema posee. Eliminarlo de inmediato (opción A) es defendible pero innecesariamente arriesgado cuando la opción B da la misma señal con costo casi nulo.
2. **La duplicación de lógica es real y ya diverge** (`crmRole` solo existe en un lado, `logAudit` solo en el otro) — consolidar en un servicio compartido (opción E) es la única opción de las cinco que resuelve esto de raíz sin forzar a ninguno de los dos endpoints a romper su contrato de respuesta actual con su único consumidor real (`UsersPage.jsx`).
3. **El propósito original de `register` (bootstrap del primer admin antes de que existiera panel de gestión) ya fue reemplazado funcionalmente por `createUser` desde 2026-06-04.** No hay caso de uso vigente que `register` cubra y `createUser` no.
4. Antes de eliminar, vale la pena instrumentar el endpoint (log o métrica de invocación) durante un período — de ahí la recomendación de deprecar primero, eliminar después con datos reales de uso (o ausencia de uso) en producción, en vez de basar la decisión final únicamente en un análisis estático de repositorio.
