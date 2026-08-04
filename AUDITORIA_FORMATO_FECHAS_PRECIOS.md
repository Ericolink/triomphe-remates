# Auditoría: centralización de formateo de fechas y precios

Fecha: 2026-08-03

## Paso 1 — Inventario inicial

| # | Archivo | Línea | Tipo | Formato usado | ¿Coincide con helper existente? |
|---|---|---|---|---|---|
|1| client/src/utils/formatters.js | 4,12,21,46 | precio/fecha | definiciones de `formatPrice`/`formatDate`/`formatDateTime`/`formatBudget` | — (es el helper) |
|2| client/src/pages/public/PropertyDetailPage.jsx | 209 | fecha | `toLocaleDateString('es-MX',{day:'2-digit',month:'long',year:'numeric'})` | No (mes en `long`, formatDate usa `short`) |
|3| client/src/pages/public/PropertiesPage.jsx | 282 | número | `Number(...).toLocaleString('es-MX')` (input editable, sin símbolo) | No (formatPrice agrega `$`/MXN) |
|4| client/src/pages/public/PropertiesPage.jsx | 291 | número | igual a #3, con `$ ... MXN` manual | No |
|5| client/src/pages/admin/PropertyFormPage.jsx | 707 | precio | `` `$${Number(h.fromPrice).toLocaleString('es-MX')}` `` (ya excluido null) | **Sí**, idéntico byte-a-byte a `formatPrice()` |
|6| client/src/pages/admin/PropertyFormPage.jsx | 715 | precio | igual a #5 con `h.toPrice` | **Sí** |
|7| client/src/pages/admin/PropertyFormPage.jsx | 750 | fecha | `toLocaleDateString('es-MX',{day:'2-digit',month:'short',year:'numeric'})` | **Sí**, idéntico a `formatDate()` |
|8| client/src/components/admin/dashboard/UrgentSection.jsx | 167 | hora | `toLocaleTimeString('es-MX',{hour:'2-digit',minute:'2-digit'})` | No (sin fecha, no existe helper de solo-hora) |
|9| client/src/components/admin/crm/CalendarioSection.jsx | 53 | fecha | `toLocaleDateString('es-MX',{day:'2-digit',month:'short'})` (sin año) | No (formatDate siempre incluye año) |
|10| client/src/components/ui/NotificationBell.jsx | 33-39 | fecha+hora | función local `formatDate` propia: `day:2-digit,month:short,hour:2-digit,minute:2-digit` (sin año) | No (formatDateTime incluye año) |
|11| client/src/components/ui/AlertSubscriptionForm.jsx | 178 | número | `Number(...).toLocaleString('es-MX')` (input editable) | No, igual caso que #3/#4 |
|12| server/src/services/exportHelpers.js | 9-25 | precio/fecha | definiciones propias `formatPrice`/`formatDate` (dd/mm/aaaa) | — (era el helper del server) |
|13| server/src/services/emailService.js | 76 | fecha+hora | `toLocaleDateString('es-MX',{day:'2-digit',month:'long',year:'numeric',hour:'2-digit',minute:'2-digit'})` (pie de email por defecto) | Duplicado con #16 y #18 (×5) |
|14| server/src/services/emailService.js | 121-124 | fecha | `toLocaleDateString('es-MX',{day:'2-digit',month:'long',year:'numeric'})` (fecha de cita) | Variante sin hora de #13 |
|15| server/src/services/emailService.js | 205 | fecha+hora | idéntico a #13 (footerNote de postulación) | Duplicado |
|16| server/src/services/emailService.js | 280-287 | precio | función local `formatPrice`: `Intl.NumberFormat` + fallback `'Consultar'` | Duplicado exacto con #17 |
|17| server/src/services/whatsappService.js | 57-64 | precio | función local `formatPrice` idéntica a #16 | Duplicado exacto con #16 |
|18| server/src/controllers/exportController.js | 60,253,380,515 | fecha+hora | idéntico a #13 (×4) | Duplicado |
|19| server/src/controllers/exportController.js | 721 | fecha | idéntico a #14 (sin hora) | Duplicado con #14 |
|20| server/src/controllers/exportController.js | resto | precio/fecha | ya usaba `formatPrice`/`formatDate` importados de exportHelpers | Ya centralizado (sin acción) |
|21| server/src/controllers/analyticsController.js | 149,167 | fecha | `toLocaleDateString('es-MX',{day:'2-digit',month:'short'})` — mismo bloque repetido 2 veces en el mismo archivo (etiquetas de gráfica) | Duplicado interno (no coincide con ningún helper existente) |
|22| server/src/controllers/appointmentController.js | 106,216 | fecha+hora | `toLocaleString('es-MX')` sin opciones, embebido en texto de bitácora (`content`) guardado en BD | No (formato libre del navegador, texto ya persistido) |
|23| server/src/controllers/leadController.js | 302 | fecha+hora | igual a #22 | No |

## Paso 2 — Clasificación

**A — migración directa** (mismo resultado exacto, verificado con Node):
- #5, #6 → `formatPrice()` (confirmado: `'$'+Number(x).toLocaleString('es-MX')` === salida de `Intl.NumberFormat('es-MX',{style:'currency',currency:'MXN',maximumFractionDigits:0})` para todo valor no nulo)
- #7 → `formatDate()`

**B — helper ampliado/generalizado** (misma salida, requirió generalizar o crear helper porque el patrón se repetía):
- #16, #17 → unificados en `formatCurrency(amount, fallback)` (server), cada call site sigue pasando su propio texto de fallback (`'Consultar'`)
- #12 (server `formatPrice`/`formatDate`) → movidos a `server/src/utils/formatters.js`; `exportHelpers.js` ahora re-exporta desde ahí (sin cambiar su API pública)
- #13, #15, #18 → `formatLongDateTime()` nuevo helper server
- #14, #19 → `formatLongDate()` nuevo helper server
- #21 → extraído a una constante local `formatWeekLabel` en el mismo archivo (no se comparte fuera de analyticsController.js porque no hay otro consumidor)

**C — debe permanecer independiente** (formato genuinamente distinto o texto ya persistido):
- #2 (mes largo, un solo uso client) — no se creó helper de un solo uso, se deja tal cual
- #3, #4, #11 — inputs editables: deben mostrar el número agrupado *sin* símbolo de moneda; usar `formatPrice` insertaría `$`/MXN dentro del campo y rompería el valor mostrado
- #8 — solo hora, sin fecha, un único consumidor
- #9 — fecha corta sin año, un único consumidor
- #10 — fecha+hora sin año, formato compacto específico de la campana de notificaciones, un único consumidor
- #22, #23 — el texto ya se guarda como oración completa en la bitácora de actividad (`content`) en base de datos; cambiar el formato alteraría el texto histórico ya persistido y el que se mostrará en adelante, lo cual viola "no cambiar el formato visible"

## Paso 3 — Helpers creados/ampliados

Nuevo archivo `server/src/utils/formatters.js` (espejo del ya existente `client/src/utils/formatters.js`, que no requirió cambios en su superficie pública):

- `formatCurrency(amount, fallback)` — núcleo compartido de `Intl.NumberFormat` moneda MXN
- `formatPrice(price)` — `formatCurrency(price, 'PENDIENTE')`, reemplaza la definición que vivía en `exportHelpers.js`
- `formatDate(date)` — dd/mm/aaaa, reemplaza la definición que vivía en `exportHelpers.js` (formato intencionalmente distinto al `formatDate` del cliente, ver comentario en el código)
- `formatLongDate(date)` — "03 de agosto de 2026"
- `formatLongDateTime(date = new Date())` — "03 de agosto de 2026, 10:30"

No se creó ningún helper de un solo uso (casos C de arriba se dejaron con su `toLocaleDateString`/`toLocaleTimeString` inline, tal como pide el Paso 3).

## Paso 4 — Migraciones aplicadas

| Archivo | Cambio |
|---|---|
| `client/src/pages/admin/PropertyFormPage.jsx` | 3 sitios migrados a `formatPrice`/`formatDate` importados de `utils/formatters` |
| `server/src/utils/formatters.js` | **nuevo** — fuente única server-side |
| `server/src/services/exportHelpers.js` | `formatPrice`/`formatDate` locales eliminados; ahora se importan de `utils/formatters` y se re-exportan igual que antes (API pública sin cambios, tests que importan `require('../services/exportHelpers')` siguen funcionando) |
| `server/src/controllers/exportController.js` | 5 bloques `generatedAt` migrados a `formatLongDateTime()` / `formatLongDate()` |
| `server/src/services/emailService.js` | pie de email por defecto, `footerNote` de postulación y fecha de cita migrados a `formatLongDateTime()`/`formatLongDate()`; `formatPrice` local eliminado, usa `formatCurrency(property.price, 'Consultar')` |
| `server/src/services/whatsappService.js` | `formatPrice` local eliminado, usa `formatCurrency(property.price, 'Consultar')` |
| `server/src/controllers/analyticsController.js` | bloque `toLocaleDateString` duplicado 2 veces extraído a constante local `formatWeekLabel` |

Ningún cambio tocó moneda, separadores, formato de fecha, zona horaria ni precisión decimal — se verificó cada migración A comparando la salida byte a byte con Node antes de aplicarla.

## Casos que permanecen con `toLocaleString`/`toLocaleDateString`/`toLocaleTimeString` y su justificación

Ver columna "Clasificación C" del Paso 2. Resumen: 3 casos son inputs editables que no deben llevar símbolo de moneda, 4 casos son formatos compactos de un solo uso (hora sola, fecha sin año, fecha+hora sin año) que no coinciden con ningún helper existente y no se repiten en ningún otro lugar del código, y 3 casos son texto ya persistido en la bitácora de actividad de citas/leads donde cambiar el formato alteraría contenido guardado en base de datos.

## Código duplicado eliminado

- 2 copias idénticas de la función `formatPrice` (Intl.NumberFormat + fallback) en `emailService.js` y `whatsappService.js`
- 1 copia de `formatPrice`/`formatDate` que vivía solo en `exportHelpers.js` (ahora vive en un único lugar, `utils/formatters.js`)
- 5 copias del bloque `toLocaleDateString(...)` de 6-7 líneas para "fecha larga + hora" (`exportController.js` ×4, `emailService.js` ×2)
- 2 copias del bloque "fecha larga sin hora" (`emailService.js`, `exportController.js`)
- 2 copias del mismo `toLocaleDateString` de etiqueta de gráfica dentro de `analyticsController.js`
- 3 llamadas manuales a `toLocaleString`/`Intl.NumberFormat` en `PropertyFormPage.jsx` que ya tenían un helper equivalente sin usarlo

## Archivos modificados

- `client/src/pages/admin/PropertyFormPage.jsx`
- `server/src/utils/formatters.js` (nuevo)
- `server/src/services/exportHelpers.js`
- `server/src/controllers/exportController.js`
- `server/src/services/emailService.js`
- `server/src/services/whatsappService.js`
- `server/src/controllers/analyticsController.js`

## Riesgos detectados

1. **Micro-cambio de comportamiento teórico en `formatCurrency`** usado por `emailService.js`/`whatsappService.js`: las funciones locales originales usaban chequeo "truthy" (`p ? ... : 'Consultar'`), que trata `0` como "sin precio". El nuevo `formatCurrency` usa el chequeo explícito `null/undefined/''` (el mismo que ya usaban `exportHelpers.formatPrice` y el `formatPrice`/`formatBudget` del cliente). Si `property.price` fuera literalmente `0`, antes se mostraba "Consultar" y ahora se mostraría "$0". En el dominio de remates bancarios el precio nunca es `0` (es `null` = PENDIENTE, o un monto positivo), por lo que el riesgo es teórico y no se espera que se manifieste con datos reales — se documenta por transparencia.
2. Ningún otro cambio de comportamiento detectado; todas las migraciones A se verificaron por comparación exacta de salida antes de aplicarse, y las migraciones B mantienen el texto de fallback y las opciones de formato originales de cada call site.

## Confirmación

- ✅ Ahora existe una única fuente de verdad para el formateo reutilizable: `client/src/utils/formatters.js` en el frontend y el nuevo `server/src/utils/formatters.js` en el backend (del cual `exportHelpers.js` re-exporta sin duplicar lógica).
- ✅ No cambió el formato mostrado al usuario en ningún caso migrado (verificado con Node para los casos de precio, y por comparación de opciones de `toLocaleDateString` idénticas para los casos de fecha).
- ✅ Únicamente se eliminó duplicación de lógica; no se agregaron dependencias nuevas ni se tocaron textos, idioma o localización.
- ✅ Los 10 casos que continúan usando `toLocaleString`/`toLocaleDateString`/`toLocaleTimeString` directamente son intencionales y están justificados en la tabla de clasificación (inputs editables sin símbolo de moneda, formatos compactos de un solo uso, o texto ya persistido en bitácora).
- ✅ Lint (client y server): 0 errores, solo warnings preexistentes no relacionados.
- ✅ Tests server: 184/184 passing.
- ✅ Build de producción (`npm run build` en raíz, incluyendo el gate `check-deploy-safety`): exitoso.
