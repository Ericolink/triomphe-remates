# Auditoría de despliegue: Triomphe Remates → SmarterASP.NET

**Fecha:** 2026-06-30
**Alcance:** Solo diagnóstico. No se modificó código.
**Nota de partida:** este proyecto **no es .NET**. Es un monorepo Node.js/Express (backend) + React/Vite (frontend SPA), con MySQL vía Sequelize y subida de imágenes a Cloudinary. SmarterASP.NET puede hostear esto igualmente, pero como **app Node.js corriendo bajo IIS vía `httpPlatformHandler`**, no como una app ASP.NET Core nativa. Todas las fases de abajo están adaptadas a ese hecho.

Ya existen tres auditorías previas en el repo (`AUDITORIA_CTO_EXTREMA.md`, `REPORTE_REVISION_FINAL.md`, `IMPLEMENTATION_MASTER_PLAN.md`) que cubren calidad de código general. Este documento **no las repite**: se enfoca exclusivamente en lo que afecta la publicación en SmarterASP.NET y referencia esas auditorías donde se solapan.

---

## Fase 1 — Auditoría del proyecto (arquitectura real)

### Arquitectura

```
repo root/
├── package.json          → build raíz: compila client/ y lo copia a server/client/
├── web.config             → IIS httpPlatformHandler (raíz, sin secretos) — SOBRA, ver hallazgos
├── netlify.toml            → intento de deploy abandonado (Netlify)
├── server/                → Express 5 API + sirve el SPA compilado
│   ├── server.js           → entry point: valida env, conecta MySQL, corre migraciones ad-hoc, levanta Express
│   ├── app.js               → CORS, helmet/CSP, rate limiting, rutas, static serving del SPA
│   ├── web.config            → IIS httpPlatformHandler CON SECRETOS REALES hardcodeados (ver Fase 1.4)
│   ├── config/db.js           → Sequelize (mysql2), pool max=5
│   └── src/{controllers,models,routes,middleware,services,utils}
└── client/                → React 19 + Vite 8 (SPA), Zustand, React Query, Tailwind
    └── src/services/api.js → axios con baseURL = import.meta.env.VITE_API_URL (se hornea en build time)
```

### Flujo de ejecución

1. `npm run build` (raíz) → `cd client && npm run build` (Vite genera `client/dist`) → se copia a `server/client/` → `npm install --omit=dev` en `server/`.
2. `node server/server.js` → `dotenv.config()` → `validateEnvironment()` (aborta si faltan `DB_HOST/DB_USER/DB_NAME/JWT_SECRET`) → `sequelize.authenticate()` → `sequelize.sync({alter:false})` → corre un bloque de migraciones manuales ad-hoc (`ALTER TABLE` directos en `server.js`, no Sequelize CLI) → `verifyConnection()` de email → `app.listen(PORT)`.
3. Express sirve `/api/*` y, para cualquier otra ruta, `server/client/index.html` (SPA fallback) — todo bajo el mismo proceso/puerto.

### Dependencias relevantes para despliegue

- **`server/package.json`**: express 5, sequelize 6 + mysql2, jsonwebtoken, bcryptjs (JS puro, no requiere compilación nativa), multer (memoryStorage), cloudinary, nodemailer, winston, helmet, express-rate-limit. **Sin `engines` ni `.nvmrc`** — no hay versión de Node fijada en ningún lado.
- **`client/package.json`**: contiene `express`, `cors`, `multer`, `mysql2`, `nodemailer`, `sequelize` como dependencias de un SPA estático — verificado por grep, **no se usan en ningún archivo de `client/src`**. Es peso muerto en el build (aumenta tiempo/RAM de `npm install` en el paso de build) y confusión de superficie. Ya señalado como ítem menor en `IMPLEMENTATION_MASTER_PLAN.md`.

### Hallazgos críticos para despliegue (no cubiertos a fondo por las auditorías previas)

**1.1 — Dos `web.config` distintos, uno con secretos reales.**
`./web.config` (raíz, limpio, solo `NODE_ENV`/`PORT`) y `./server/web.config` (con `DB_PASSWORD=Sistemas12`, `JWT_SECRET=triomphe_jwt_super_secreto_2024`, `EMAIL_PASS` real de Gmail, host `mysql5048.site4now.net`, dominio `triomphebienes-001-site8.ktempurl.com`). Ambos están en `.gitignore` y no trackeados en `HEAD` actualmente, pero **siguen en el disco local** y, según memoria del proyecto, los mismos secretos siguen vivos en el historial de git (commit `289d3c2` y otros) con remoto público activo en GitHub. **Esto ya estaba documentado como P0 y sigue sin confirmarse rotación.** No se puede publicar nada en SmarterASP.NET reusando estas credenciales — hay que rotar `DB_PASSWORD`, `JWT_SECRET` y `EMAIL_PASS` antes de tocar producción, y purgar el historial de git (`git filter-repo`/BFG).

**1.2 — Las dos rutas de `processPath` apuntan al mismo argumento (`.\server\server.js`), lo cual es incoherente si los dos `web.config` se usan en raíces de sitio distintas.** Si `server/web.config` se llegara a desplegar como `web.config` en la raíz del sitio de IIS, `.\server\server.js` resolvería a `server/server/server.js`, que no existe. Indica que es un artefacto residual de un intento anterior, no algo verificado en funcionamiento.

**1.3 — `sitemap.xml` tiene el dominio de producción hardcodeado.** `server/src/routes/sitemap.js:11` → `const baseUrl = 'https://rematesbancarios.net'`. Si el sitio se publica bajo el dominio temporal de SmarterASP (`*.ktempurl.com`) antes de apuntar el dominio final, o bajo cualquier otro dominio, el sitemap seguirá anunciando URLs canónicas equivocadas a Google — esto es silencioso (no rompe nada visualmente) pero daña SEO. Debería leer de `process.env.CLIENT_URL`.

**1.4 — `VITE_API_URL` se hornea en build time, no en runtime.** `client/src/services/api.js` usa `import.meta.env.VITE_API_URL`, que Vite reemplaza como string literal durante `vite build`. El build raíz (`npm run build`) no setea esta variable explícitamente — depende de que `client/.env.production` exista o que la variable esté en el entorno del proceso que ejecuta el build. En Render esto se resuelve porque Render permite setear env vars disponibles durante el build. **En SmarterASP.NET, el build casi seguro se hace en tu máquina local (Windows o no) antes de subir por FTP/Web Deploy** — así que hay que asegurarse de compilar con `VITE_API_URL` apuntando al dominio final de SmarterASP antes de subir, o el frontend compilado llamará a la URL equivocada (localhost o el dominio de Render).

**1.5 — `trust proxy` y CSP fueron ajustados pensando específicamente en Render.** `app.js:12-14` documenta explícitamente "Render actúa como proxy inverso". IIS con `httpPlatformHandler` también actúa como único hop de proxy reverso hacia el proceso Node, así que `trust proxy = 1` sigue siendo correcto, pero esto no estaba verificado contra IIS — solo contra Render.

**1.6 — Logging solo a `Console` (winston), a propósito.** `server/src/utils/logger.js` documenta que es así porque el filesystem de Render es efímero. En IIS, `stdoutLogEnabled="true" stdoutLogFile=".\log.txt"` (ya presente en ambos `web.config`) captura ese mismo stdout a un archivo de log — compatible sin cambios, pero nadie lo ha probado en este entorno.

**1.7 — `CLIENT_URLS`/CORS no incluye ningún dominio de SmarterASP.** La lista hardcodeada en `app.js:61-67` trae Netlify y localhost, y todo lo demás viene de `CLIENT_URL`/`CLIENT_URLS` por env var — correcto en diseño, pero hay que recordar setear esa variable con el dominio real de SmarterASP (temporal y/o final) o el navegador bloqueará las llamadas a la API por CORS.

**1.8 — Migraciones manuales embebidas en `server.js`, no Sequelize CLI/Umzug.** Ya señalado en `IMPLEMENTATION_MASTER_PLAN.md` como ítem P3 pendiente. Riesgo bajo para una sola instancia, pero significa que cualquier cambio de esquema requiere editar `server.js` y redeployar — no hay forma de "aplicar migraciones" como paso independiente del Roadmap (ver Fase 4).

**1.9 — Carpeta `server/uploads` se sirve estáticamente (`app.js:92`) pero no se usa en ningún controlador** (verificado por grep) — todo el flujo real de imágenes pasa por Cloudinary vía buffer en memoria (`multer.memoryStorage()`, sin escribir a disco). Es código muerto inofensivo, no bloqueante, pero confunde sobre si el hosting necesita persistir disco para uploads (no lo necesita).

**1.10 — Sin versión de Node fijada.** No hay `engines` en ningún `package.json` ni `.nvmrc`. Local usa Node 24. Express 5 / multer 2 requieren Node moderno (≥18, idealmente ≥20). SmarterASP.NET no garantiza qué versión de Node trae por defecto en la cuenta compartida — hay que verificarlo y, si no coincide, subir un `node.exe` propio (sección Fase 2).

---

## Fase 2 — Requisitos de SmarterASP.NET para Node.js

(Investigado contra la documentación oficial vigente de SmarterASP.NET, junio 2026.)

- **Mecanismo de hosting:** SmarterASP.NET corre Node.js **dentro de IIS en Windows** vía el módulo **`httpPlatformHandler`** (su método principal y recomendado actualmente) o, alternativamente, **`iisnode`** (también soportado; requiere un entry point `.cjs` si el proyecto usa ESM). Este proyecto es CommonJS (`"type": "commonjs"` en `server/package.json`), así que `httpPlatformHandler` es la ruta más directa — no necesita el truco del wrapper `.cjs`.
- **`web.config` obligatorio** en la raíz del sitio IIS, con esta forma mínima (la que ya tiene el repo):
  ```xml
  <handlers>
    <add name="httpPlatformHandler" path="*" verb="*" modules="httpPlatformHandler" resourceType="Unspecified" requireAccess="Script" />
  </handlers>
  <httpPlatform processPath="node" arguments="server.js" startupTimeLimit="20" startupRetryCount="2" stdoutLogEnabled="true" stdoutLogFile=".\log.txt">
    <environmentVariables>
      <environmentVariable name="PORT" value="%HTTP_PLATFORM_PORT%" />
      <environmentVariable name="NODE_ENV" value="production" />
    </environmentVariables>
  </httpPlatform>
  ```
  El código **ya** lee `process.env.PORT` (`server.js:17`), así que esto es compatible sin cambios de código.
- **Versión de Node.js:** no hay una versión fija documentada por defecto; si necesitas una específica, **subes tu propio `node.exe`** a `/App_Data` y apuntas `processPath` a esa ruta absoluta (`H:\root\home\...\App_Data\node.exe`). Esto es un paso manual, no automático.
- **`node_modules` se sube tal cual** — SmarterASP.NET no corre `npm install` por ti en el flujo estándar de FTP/File Manager. Se instala localmente y se sube la carpeta completa (o se usa npm vía su panel, según el plan). Esto implica: **compilar/instalar en un entorno cuyo SO coincida en compatibilidad de binarios nativos con el del hosting (Windows)** — riesgo solo si hay dependencias nativas; aquí no las hay (bcryptjs en vez de bcrypt, mysql2 es JS+binding opcional pero funciona sin compilar nativo). Bajo riesgo en este proyecto específico.
- **Métodos de publicación:** FTP, File Manager del panel, Web Deploy desde Visual Studio, o integración con GitHub para build/deploy automático (mencionado en su marketing, sin detalle técnico verificado en la documentación pública de soporte).
- **Base de datos MySQL:** SmarterASP.NET ofrece MySQL como servicio propio dentro de tu cuenta de hosting (mismo origen que el viejo `mysql5048.site4now.net` ya visto en el `web.config` filtrado — confirma que este proyecto **ya usó la MySQL nativa de SmarterASP en el pasado**). Se administra con MySQL Workbench o su panel. mysql2/Sequelize se conectan igual que cualquier cliente MySQL estándar — no hay nada .NET-específico en la capa de datos.
- **Conexiones salientes a DB de terceros:** **bloqueadas por defecto.** Si decides NO usar la MySQL propia de SmarterASP y mantener una base externa (p. ej. seguir usando la de Render/PlanetScale/etc.), hay que habilitar el destino explícitamente en *Control Panel → Security → Outgoing Port Manager*.
- **SSL:** Let's Encrypt gratuito vía *Control Panel → SSL → Request Free SSL*, sin CSR manual. Para múltiples subdominios hay que instalar el binding en cada uno por separado.
- **Dominios:** se apuntan vía DNS estándar (A/CNAME) al hosting; el dominio temporal `*.ktempurl.com` (visto en el `web.config` filtrado) es el que asigna SmarterASP antes de tener dominio propio configurado — explica ese valor histórico de `CLIENT_URL`.
- **Variables de entorno:** SmarterASP **no tiene un panel nativo de env vars** tipo Render/Vercel — se inyectan a través del propio `web.config` (bloque `<environmentVariables>`), como ya hace `server/web.config`. Esto es justamente lo que vuelve tan peligroso tener secretos ahí: **es el único mecanismo soportado para pasar variables**, así que el archivo en sí *debe* contener los secretos reales para que la app funcione — la mitigación no es "no poner secretos en `web.config`", sino **nunca commitear ese archivo a git** (ya corregido vía `.gitignore`, pendiente purgar historial).
- **Logs:** `stdoutLogEnabled`/`stdoutLogFile` en `web.config` es el mecanismo estándar para capturar stdout/stderr de Node a un archivo de log dentro del hosting (compatible con winston→Console tal como está configurado en el proyecto).
- **Archivos que NO deben subirse:** `node_modules` de `client/` (no se ejecuta en el servidor, solo `server/node_modules` + `server/client/` compilado), `.git/`, `.env*`, `*.tar.gz.backup`, `update-admin.js`, archivos de test, `.github/`, código fuente sin compilar de `client/src` (no se sirve, solo el build).

---

## Fase 3 — Comparación: proyecto vs requisitos SmarterASP.NET

| # | Requisito SmarterASP.NET | Estado | Por qué | Riesgo | Cómo solucionarlo |
|---|---|---|---|---|---|
| 1 | App escucha en `process.env.PORT` | ✔ Cumple | `server.js:17` ya usa `process.env.PORT \|\| 3001` | — | — |
| 2 | `web.config` con `httpPlatformHandler` apuntando al entry point correcto | ⚠ Requiere cambios | Existen 2 `web.config` inconsistentes entre sí y uno con secretos reales; ninguno fue verificado funcionando contra una cuenta real de SmarterASP | Despliegue falla al primer intento o expone secretos si se sube el archivo equivocado | Consolidar en **un solo** `web.config` limpio (sin secretos) en la raíz del sitio IIS; los secretos van solo como `<environmentVariables>` puestos manualmente en el panel o en un `web.config` que NUNCA se commitea (ver fila 8) |
| 3 | Node.js disponible/compatible (Express 5, multer 2 requieren Node ≥18-20) | ⚠ Requiere cambios | Sin `engines` ni versión fijada; no se sabe qué Node trae la cuenta por defecto | App no arranca o falla en runtime con errores difíciles de diagnosticar | Verificar versión de Node en la cuenta SmarterASP contratada; si no es ≥18, subir `node.exe` propio a `/App_Data` y fijar `processPath` |
| 4 | `node_modules` subido manualmente (sin dependencias nativas que requieran compilación) | ✔ Cumple | Todas las dependencias del backend son JS puro o con bindings opcionales (bcryptjs, mysql2) | — | — |
| 5 | Build del frontend compilado ANTES de subir (no hay build-on-server garantizado) | ⚠ Requiere cambios | `VITE_API_URL` se hornea en build time; el script de build raíz no fija esa variable explícitamente | El SPA compilado llama a la URL de API equivocada (localhost o Render) si se compila sin la variable correcta | Crear `client/.env.production` con `VITE_API_URL=https://<dominio-smarterasp>/api` antes de correr `npm run build`, o exportar la variable en el shell que ejecuta el build |
| 6 | MySQL accesible desde la app Node | ✔ Cumple (con matiz) | SmarterASP ofrece MySQL propio (mismo origen ya usado antes, `mysql5048.site4now.net`); mysql2/Sequelize se conectan sin problema | Si se opta por una DB externa en vez de la nativa, las conexiones salientes están bloqueadas por defecto | Si se usa MySQL propio de SmarterASP, no se requiere acción; si se usa DB externa, habilitar el destino en *Outgoing Port Manager* |
| 7 | Variables de entorno (`DB_*`, `JWT_SECRET`, `EMAIL_*`, `CLOUDINARY_*`, `CLIENT_URL`) inyectadas de forma segura | ❌ No cumple | El único mecanismo soportado por SmarterASP es el bloque `<environmentVariables>` dentro de `web.config`; el repo ya demostró que ese archivo terminó commiteado con secretos reales en el pasado | Fuga de credenciales si el `web.config` con secretos se vuelve a commitear (ya ocurrió una vez, sigue en el historial de git) | Mantener el `web.config` con secretos **fuera de git siempre** (ya en `.gitignore`), subirlo solo por FTP directo al servidor, y rotar `DB_PASSWORD`/`JWT_SECRET`/`EMAIL_PASS` antes de usarlos en cualquier entorno nuevo |
| 8 | Secretos no expuestos en historial de git con remoto público | ❌ No cumple | Confirmado en memoria del proyecto: secretos removidos de `HEAD` el 2026-06-30 pero siguen alcanzables en commits antiguos (`289d3c2` y otros); repo con remoto público en GitHub | Cualquiera con acceso de lectura al repo (o que ya lo clonó) tiene las credenciales reales de la DB/JWT/email | Purgar historial con `git filter-repo` o BFG, **y** rotar las 3 credenciales — ambos pasos son obligatorios, uno sin el otro no cierra el riesgo |
| 9 | SSL/HTTPS | ✔ Cumple (acción pendiente, no código) | Let's Encrypt gratis vía panel, sin cambios de código necesarios | Ninguno técnico; solo operativo | Activar desde *Control Panel → SSL → Request Free SSL* una vez el dominio apunte al hosting |
| 10 | CORS configurado para el dominio final | ⚠ Requiere cambios | `CLIENT_URLS`/`CLIENT_URL` ya es configurable por env var, pero nadie ha puesto ahí el dominio de SmarterASP (temporal `*.ktempurl.com` o el definitivo) | Frontend no puede llamar a la API — bloqueado por CORS | Setear `CLIENT_URL`/`CLIENT_URLS` con el dominio real en el `web.config`/panel antes de probar |
| 11 | Sitemap/SEO con dominio correcto | ⚠ Requiere cambios | `sitemap.js:11` tiene `https://rematesbancarios.net` hardcodeado | URLs canónicas incorrectas en Google Search Console si el dominio final difiere o durante la fase con dominio temporal | Reemplazar el literal por `process.env.CLIENT_URL` |
| 12 | Logs persistentes/accesibles | ✔ Cumple | winston→Console + `stdoutLogEnabled`/`stdoutLogFile` en `web.config` es exactamente el patrón que IIS espera | — | Validar una vez desplegado que `log.txt` efectivamente recibe contenido |
| 13 | Migraciones de esquema aplicables de forma controlada | ⚠ Requiere cambios | Migraciones embebidas como `ALTER TABLE` ad-hoc dentro de `server.js`, no Sequelize CLI/Umzug (ya señalado en `IMPLEMENTATION_MASTER_PLAN.md` como P3) | Cualquier cambio de esquema futuro requiere editar código fuente y redeployar; sin rollback fácil | No bloqueante para el primer despliegue; formalizar con Sequelize CLI antes de que el equipo crezca |
| 14 | Dependencias del `client/package.json` limpias (no se sube código fuente del frontend, solo el build) | ⚠ Requiere cambios | `express`, `cors`, `multer`, `mysql2`, `nodemailer`, `sequelize` están en dependencies del SPA sin usarse — no rompen el despliegue (no se suben, solo afectan tiempo de `npm install` en build) | Bajo — solo build más lento y confusión, no afecta runtime en SmarterASP | Eliminar esas 6 dependencias de `client/package.json` |
| 15 | Verificar que `processPath`/`arguments` de `web.config` apunten al `server.js` correcto desde la raíz real del sitio IIS | ❌ No cumple (sin verificar) | Los dos `web.config` actuales tienen rutas relativas inconsistentes entre sí (ver hallazgo 1.2); ninguno fue probado contra una cuenta SmarterASP real | Despliegue falla en el primer arranque con error 502/500 de IIS sin mensaje claro | Definir explícitamente cuál carpeta es la raíz del sitio IIS y escribir un único `web.config` consistente con esa raíz |

---

## Fase 4 — Roadmap de publicación (checklist detallado)

> Orden recomendado: seguridad → configuración → build → infraestructura SmarterASP → despliegue → validación.

### Bloque A — Seguridad (bloqueante, antes de cualquier otra cosa)

**□ A1. Confirmar si `DB_PASSWORD`, `JWT_SECRET`, `EMAIL_PASS` (los valores filtrados: `Sistemas12`, `triomphe_jwt_super_secreto_2024`, `tzxhknuvuwonzvnk`) ya fueron rotados en el entorno vivo (Render).**
- *Objetivo:* saber si el riesgo P0 ya documentado sigue abierto.
- *Archivos:* ninguno — esto es un chequeo en Render/Gmail/MySQL, no en el repo.
- *Comando:* revisar variables de entorno actuales en el dashboard de Render y compararlas contra los valores filtrados.
- *Riesgo si se omite:* publicar en SmarterASP reusando las mismas credenciales filtradas equivale a usar contraseñas ya comprometidas.
- *Validación:* los 3 valores en producción son distintos a los que aparecen en `server/web.config` local.

**□ A2. Rotar las 3 credenciales si no se ha hecho.**
- *Objetivo:* invalidar las credenciales expuestas.
- *Archivos:* variables de entorno en Render (y, después, en el `web.config` de SmarterASP).
- *Riesgo:* downtime breve durante la rotación si no se coordina; necesita reiniciar el servicio.
- *Validación:* login admin sigue funcionando con el nuevo `JWT_SECRET` (invalida tokens viejos — avisar a usuarios admin), conexión a MySQL exitosa con el nuevo password, email de prueba sale con el nuevo app password de Gmail.

**□ A3. Purgar el historial de git de los 3 archivos filtrados (`web.config`, `update-admin.js`, `*.tar.gz.backup`).**
- *Objetivo:* cerrar la exposición en el remoto público de GitHub.
- *Comandos:* `git filter-repo --path server/web.config --path server/update-admin.js --path server/production_site8_3494768.tar.gz.backup --invert-paths` (en un fork/backup del repo primero) seguido de `git push --force` al remoto — **acción destructiva, requiere coordinación con todo el equipo** (todos deben re-clonar).
- *Riesgo:* reescribir historia rompe cualquier clon/fork existente; hacer solo con el equipo avisado y un backup previo.
- *Validación:* `git log --all --full-history -- server/web.config` ya no devuelve commits.

### Bloque B — Preparar configuración para SmarterASP

**□ B1. Decidir la base de datos: ¿MySQL propio de SmarterASP, o mantener la actual (Render/otro) vía conexión externa?**
- *Objetivo:* fijar `DB_HOST`/`DB_PORT`/`DB_NAME`/`DB_USER`/`DB_PASSWORD` reales.
- *Archivos:* ninguno de código — decisión de infraestructura.
- *Riesgo:* si se usa DB externa, falta habilitar el destino en *Outgoing Port Manager* (Bloque D).

**□ B2. Si se usa MySQL propio de SmarterASP: crear la base, usuario y exportar/importar el esquema actual.**
- *Comandos:* `mysqldump` desde el origen actual → importar con MySQL Workbench o el panel de SmarterASP.
- *Riesgo:* `sequelize.sync({alter:false})` no crea tablas nuevas si la DB está vacía la primera vez — **sí las crea** en realidad (`sync` crea tablas que no existen; `alter:false` solo evita modificar las existentes), pero confirmar que el primer arranque corre limpio contra una DB vacía.
- *Validación:* `sequelize.authenticate()` exitoso en los logs (`stdout` → `log.txt`).

**□ B3. Reemplazar el literal de `sitemap.js:11` por `process.env.CLIENT_URL`.**
- *Objetivo:* sitemap correcto en cualquier dominio.
- *Archivo:* `server/src/routes/sitemap.js`.
- *Riesgo:* ninguno, cambio aislado.
- *Validación:* `GET /sitemap.xml` refleja el dominio configurado en `CLIENT_URL`.

**□ B4. Limpiar `client/package.json` de las 6 dependencias de servidor no usadas.**
- *Objetivo:* build más rápido y limpio.
- *Archivo:* `client/package.json`.
- *Comando:* `cd client && npm uninstall express cors multer mysql2 nodemailer sequelize`.
- *Validación:* `npm run build` en `client/` sigue funcionando igual.

**□ B5. Fijar versión de Node objetivo y agregar `engines` en ambos `package.json`.**
- *Objetivo:* documentar qué versión se espera, para poder comparar contra lo que ofrezca SmarterASP.
- *Riesgo:* si SmarterASP no ofrece esa versión por defecto, hay que subir `node.exe` propio (Bloque D).

### Bloque C — Build

**□ C1. Crear `client/.env.production` con `VITE_API_URL=https://<dominio-final-o-temporal-smarterasp>/api`.**
- *Objetivo:* que el SPA compilado apunte a la API correcta.
- *Riesgo:* si el dominio cambia después (de temporal `*.ktempurl.com` a uno propio), hay que **recompilar y resubir** el frontend — `VITE_API_URL` no es runtime.
- *Validación:* inspeccionar el bundle compilado (`server/client/assets/*.js`) y confirmar que la URL correcta aparece en el JS.

**□ C2. Correr `npm run build` desde la raíz.**
- *Comando:* `npm run build` (repo root).
- *Riesgo:* el paso `npm install --include=dev` en `client/` puede ser pesado en memoria si se corre en una máquina con pocos recursos — hacerlo local, no en el hosting compartido.
- *Validación:* `server/client/index.html` y assets existen y son recientes.

**□ C3. Instalar dependencias de producción del servidor.**
- *Comando:* ya incluido en el build raíz (`npm install --omit=dev` dentro de `server/`), pero confirmar que `server/node_modules` resultante no incluye `devDependencies` (jest, eslint, nodemon, etc. no deberían subirse).
- *Validación:* `server/node_modules/.bin` no contiene `jest`/`eslint`.

### Bloque D — Infraestructura SmarterASP.NET

**□ D1. Verificar versión de Node disponible en la cuenta contratada.**
- *Riesgo:* si es incompatible con Express 5 (Node <18), la app no arranca.
- *Solución si falla:* descargar `node.exe` (Windows x64) de la versión deseada, subirlo a `/App_Data`, apuntar `processPath` en `web.config` a esa ruta absoluta.

**□ D2. Crear/activar la app Node.js en el panel de control** (*Control Panel → Websites → Node.js APP*).

**□ D3. Habilitar Outgoing Port Manager si la DB queda fuera de la red de SmarterASP** (solo si B1 = DB externa).

**□ D4. Configurar el dominio (temporal `*.ktempurl.com` primero, definitivo después vía DNS).**

**□ D5. Solicitar SSL gratuito (Let's Encrypt) una vez el dominio resuelva al hosting.**
- *Panel:* *Control Panel → SSL → Request Free SSL*.
- *Riesgo:* falla si el DNS aún no propagó — esperar antes de solicitar.

### Bloque E — `web.config` final y despliegue

**□ E1. Escribir UN solo `web.config` consistente con la raíz real del sitio IIS** (consolidar los dos existentes, eliminando el inconsistente).
- *Contenido:* `processPath="node"` (o ruta a `node.exe` propio), `arguments` apuntando al `server.js` real desde esa raíz, `stdoutLogEnabled="true"`, y el bloque `<environmentVariables>` con TODAS las variables (`PORT`, `NODE_ENV=production`, `DB_HOST`, `DB_PORT`, `DB_NAME`, `DB_USER`, `DB_PASSWORD` rotado, `JWT_SECRET` rotado, `JWT_EXPIRES_IN`, `EMAIL_USER`, `EMAIL_PASS` rotado, `EMAIL_TO`, `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET`, `CLIENT_URL`/`CLIENT_URLS`).
- *Riesgo:* este archivo final, con secretos reales, **nunca debe commitearse** — subir solo por FTP directo al servidor.

**□ E2. Subir vía FTP/File Manager: `server/` completo (incluyendo `node_modules` y `client/` compilado dentro de `server/client/`), excluyendo `server/uploads/*` (vacío, código muerto), tests, `.env*` locales.**

**□ E3. Confirmar arranque** revisando `log.txt` generado por `stdoutLogFile`.
- *Validación:* sin stack traces de `validateEnvironment()` ni de `sequelize.authenticate()`.

**□ E4. Probar `GET /api/health`** desde el dominio público.

**□ E5. Probar autenticación admin** (login con JWT rotado) end-to-end.

**□ E6. Probar subida de imágenes/documentos** (Cloudinary) desde el panel admin en el entorno real — confirma que `CLOUDINARY_*` está bien seteado vía `web.config`.

**□ E7. Probar envío de email transaccional** (alta de lead, alerta) — confirma `EMAIL_*` rotado funcionando con Gmail.

**□ E8. Probar CORS real:** abrir el frontend en el dominio público y confirmar que las llamadas a `/api/*` no se bloquean (consola del navegador sin errores CORS).

**□ E9. Verificar `sitemap.xml`** refleja el dominio correcto (post B3).

**□ E10. Verificar SSE de notificaciones admin** (`useNotifications`) funciona detrás de IIS — este es el punto más incierto: IIS/httpPlatformHandler con conexiones de larga duración (Server-Sent Events) no está documentado explícitamente por SmarterASP y puede requerir ajustar `startupTimeLimit`/timeouts de IIS si las conexiones se cortan. **Validar específicamente esto antes de dar por cerrado el despliegue.**

**□ E11. Activar SSL/HTTPS y forzar redirección HTTP→HTTPS**, y volver a correr E4-E10 sobre `https://`.

**□ E12. Carga básica de rendimiento:** confirmar que el `pool: {max:5}` de Sequelize no se agota bajo el tráfico esperado en el plan de hosting contratado (planes compartidos de IIS pueden reciclar el proceso Node periódicamente — revisar si SmarterASP recicla el worker process y cómo afecta esto a conexiones DB persistentes).

---

## Fase 5 — Confirmación

No se modificó ningún archivo del proyecto. Este documento es solo diagnóstico (`AUDITORIA_SMARTERASP_DEPLOY.md`, nuevo). Cuando autorices, puedo empezar por el Bloque A (seguridad) o por donde prefieras del roadmap.
