# CRM Comercial — Diseño de UX y Arquitectura de Interfaz

**Estado:** diseño de producto, sin código. Guía de referencia para la implementación posterior del módulo CRM Comercial.
**Fecha:** 2026-07-14
**Contexto previo:** ver análisis funcional/técnico y modelo de entidades ya discutidos (Prospecto/`Lead` extendido, `Campaign`, `Activity`, `Appointment`, `Task` con la regla de "una próxima acción abierta", `Deal`, `LeadProperty` N:M). Este documento no repite ese modelo — se enfoca exclusivamente en experiencia de usuario e interfaz.

**Principio rector de todo el documento:** cada pantalla debe responder, sin que el usuario tenga que buscarlo, una de estas preguntas: ¿qué debo hacer hoy? ¿qué prospectos requieren atención? ¿qué citas tengo? ¿qué campañas funcionan? ¿qué se me está olvidando? ¿qué se cerró? Si una pantalla no responde ninguna, no debería existir en el MVP.

---

## 1. Arquitectura de navegación

Se integra al grupo de navegación que hoy se llama **"Contactos"** en `AdminLayout`, evolucionándolo a **"CRM Comercial"**:

```
CRM Comercial
├── Dashboard Comercial     (entrada por defecto del módulo)
├── Prospectos              (Kanban ⇄ Lista, una sola vista con toggle)
├── Calendario              (ya existe — pasa a leer de Appointment)
├── Campañas
└── Reportes
```

**Justificación de cada sección:**

- **Dashboard Comercial** — es la puerta de entrada, no una sección más. Responde "¿qué hago hoy?" antes que cualquier otra cosa. Se separa del Dashboard general del admin (que es sobre propiedades/tráfico del sitio) porque tiene una audiencia y un propósito distintos: un asesor comercial no necesita ver métricas de propiedades al iniciar su día.
- **Prospectos (Kanban ⇄ Lista)** — **decisión de diseño deliberada: no son dos secciones de nav separadas.** El pedido original sugería "Pipeline" y "Prospectos" como ítems distintos, pero son la misma información en dos formas de verla (visual/manipulable vs. densa/buscable). Separarlos en el menú fuerza al usuario a decidir "¿estoy en modo Pipeline o modo Prospectos?" cuando en realidad quiere lo mismo: "mis prospectos". Un solo ítem de menú con un toggle Kanban/Lista evita esa fragmentación (ver crítica §10.j).
- **Calendario** — ya existe como pantalla; se mantiene en el mismo lugar de la navegación para no romper el hábito ya formado, solo cambia su fuente de datos internamente.
- **Campañas** — se mantiene como sección propia (no fusionada con Reportes) porque tiene una necesidad de *gestión* (crear/cerrar campañas) distinta a la de *lectura* de Reportes — un CRUD y un reporte no deberían compartir pantalla.
- **Reportes** — analítico y de consulta, deliberadamente separado del Dashboard (mismo patrón que ya existe entre Dashboard/Estadísticas en el admin general). El Dashboard es para actuar; Reportes es para analizar. Mezclarlos generalmente termina en un dashboard sobrecargado de gráficas que nadie mira a diario.
- **No se agrega un ítem "Configuración"** al menú del CRM en el MVP — ver §10.e.

---

## 2. Flujos de usuario

Diseñados para el menor número de clics/pantallas posible; ninguno debería requerir "navegar a una página nueva" cuando un modal o panel lateral basta.

**a) Registrar un nuevo prospecto**
Botón `+ Nuevo prospecto` visible en Dashboard, Prospectos y como FAB en mobile → modal (no navegación) con: nombre, teléfono, campaña/origen (preseleccionada a la más reciente activa), propiedad de interés (buscador opcional). Al guardar: se crea el registro, se genera automáticamente la primera entrada del timeline ("Prospecto creado") y el modal **no se cierra** hasta capturar la próxima acción (chip rápido, ver §5). Total: 1 modal, ~4 campos.

**b) Dar seguimiento**
Desde la tarjeta (Kanban/Lista) → panel lateral (no cambia de página) con el timeline arriba y un campo de "agregar actividad" (tipo + texto corto). Las acciones de llamar/WhatsApp están en la tarjeta misma, sin necesidad de abrir el panel.

**c) Agendar una cita**
Botón "Agendar cita" en tarjeta o perfil → mini formulario (fecha/hora, propiedad opcional) → se crea la cita, se registra automáticamente en el timeline y la etapa avanza sola a "Cita agendada" (ahorra un paso manual).

**d) Reagendar una cita**
Desde el detalle de la cita → botón "Reagendar": cambia la fecha, la cita anterior se conserva marcada como reagendada (no se borra — es la razón de que la cita sea una entidad propia y no un campo suelto), y el timeline registra "Cita reagendada de X a Y".

**e) Registrar una venta**
Al soltar la tarjeta en "Venta realizada" (o botón directo en el perfil) → modal obligatorio y mínimo: monto + propiedad (de la lista de interés ya capturada) + fecha. Se cierra la próxima-acción pendiente automáticamente.

**f) Cerrar un caso (perdido)**
Al soltar la tarjeta en "No interesado" → modal obligatorio: motivo de cierre (selector) + comentario opcional. Libera al prospecto de "seguimientos pendientes" en el dashboard.

**g) Buscar un prospecto**
Barra de búsqueda persistente en el encabezado del módulo (no una pantalla aparte), por nombre o teléfono, resultados instantáneos. Accesible desde cualquier pantalla del CRM, no solo desde "Prospectos".

**h) Revisar el trabajo pendiente del día**
No es un flujo adicional — es la pantalla de entrada (Dashboard Comercial). Si hiciera falta "navegar" para verlo, el diseño ya falló.

---

## 3. Wireframes de baja fidelidad (ASCII)

### 3.1 Dashboard Comercial

```
┌──────────────────────────────────────────────────────────────────────┐
│  CRM Comercial          [ 🔍 Buscar prospecto...              ]  🔔 👤 │
├──────────────────────────────────────────────────────────────────────┤
│  Hola, Ana. Esto requiere tu atención hoy:                            │
│                                                                        │
│  ┌────────────┐  ┌────────────┐  ┌────────────┐  ┌────────────────┐ │
│  │ ⚠ VENCIDOS  │  │ 📞 NUEVOS   │  │ 📅 CITAS HOY│  │ 💰 VENTAS SEM.  │ │
│  │     7       │  │     4       │  │     3       │  │      3          │ │
│  │[Ver todos→]│  │[Ver todos→]│  │[Ver agenda→]│  │  [Ver →]        │ │
│  └────────────┘  └────────────┘  └────────────┘  └────────────────┘ │
│                                                                        │
│  ── Requieren acción inmediata ─────────────────────────────────────  │
│  🔴 Juan Pérez     Llamar (venció ayer)        [Llamar] [WhatsApp]    │
│  🔴 María Gómez    Confirmar cita (venció hoy) [Ver cita]             │
│  🟡 Carlos Ruiz    Enviar info (vence en 2h)   [Enviar]               │
│                                                 [Ver todos (7) →]     │
│                                                                        │
│  ── Citas de hoy ───────────┐   ── Actividad reciente ───────────────│
│  10:00 Ana López (Depto A)  │   Pedro cerró venta con L. Sánchez     │
│  16:30 Roberto Díaz (Casa B)│   Ana registró llamada con Juan Pérez  │
│  [Ver calendario →]         │   Nuevo prospecto: Sofía R. (FB Ads)   │
│                                                                        │
│  ── Campaña con mejor rendimiento este mes ─────────────────────────  │
│  "Remate Polanco Julio" · Facebook · 34 prospectos · 5 ventas (14.7%)│
└──────────────────────────────────────────────────────────────────────┘
```

**Por qué está así:** el orden vertical es por urgencia decreciente, no por tipo de dato. Los KPIs arriba son el resumen de 3 segundos; la lista de "acción inmediata" es lo único con botones de acción reales (llamar/confirmar) porque es lo que se espera que el usuario haga *ahora mismo*, sin abrir el prospecto. Citas y actividad van en paralelo porque son informativos, no accionables de inmediato. La campaña destacada va al final: es interesante, no urgente.

### 3.2 Prospectos — vista Kanban

```
┌──────────────────────────────────────────────────────────────────────┐
│ Prospectos         [+ Nuevo]      [Filtro: Mis prospectos ▾] [☰Lista]│
├───────────┬───────────┬───────────┬───────────┬───────────┬──────────┤
│ Nuevo (5) │Contactado │Interesado │Cita agend.│Negociación│Venta (2) │
│           │   (8)     │   (4)     │   (3)     │   (2)     │          │
├───────────┼───────────┼───────────┼───────────┼───────────┼──────────┤
│┌─────────┐│┌─────────┐│┌─────────┐│┌─────────┐│           │          │
││Sofía R. │││Juan P.  │││Ana L.   │││Roberto D│           │          │
││FB Ads   │││🔴Llamar │││📅mañana │││📅 hoy   │           │          │
││hace 2h  │││(vencido)│││Depto A  │││Casa B   │           │          │
││ [📞][💬]│││ [📞][💬]│││ [📞][💬]│││ [📞][💬]│           │          │
│└─────────┘│└─────────┘│└─────────┘│└─────────┘│           │          │
│   ...     │   ...     │   ...     │   ...     │   ...     │   ...    │
└───────────┴───────────┴───────────┴───────────┴───────────┴──────────┘
```

**Por qué está así:** cada tarjeta muestra únicamente lo que se necesita para decidir la siguiente acción sin abrir el prospecto: nombre, origen, próxima acción con color de urgencia, y los dos botones de contacto más usados. Todo lo demás (notas, historial completo) vive en el perfil, no en la tarjeta — una tarjeta sobrecargada de información es tan inútil como el Excel que reemplaza.

### 3.3 Prospectos — vista Lista

```
┌──────────────────────────────────────────────────────────────────────┐
│ Prospectos   [🔍 Buscar...] [Filtros ▾] [+ Nuevo]      [☷ Kanban]    │
├──────────────────────────────────────────────────────────────────────┤
│ ☐ │Nombre        │Etapa       │Próx. acción       │Resp. │Acciones   │
│ ☐ │Juan Pérez    │Contactado  │🔴 Llamar (venció) │Ana   │📞 💬 ⋮    │
│ ☐ │Sofía Ramírez │Nuevo       │Contactar hoy      │Ana   │📞 💬 ⋮    │
│ ☐ │Ana López     │Cita agend. │📅 Mañana 10:00    │Pedro │📞 💬 ⋮    │
│ [Acciones en lote: Reasignar ▾] [Cambiar etapa ▾]    Página 1 de 6  │
└──────────────────────────────────────────────────────────────────────┘
```

**Por qué está así:** reutiliza el patrón de `BatchActionBar` ya existente en la pantalla de Leads — misma mecánica de selección múltiple que el equipo ya conoce, sin curva de aprendizaje nueva. Es la vista para tareas masivas (reasignar 10 prospectos) que el Kanban no resuelve bien.

### 3.4 Perfil del Prospecto

```
┌──────────────────────────────────────────────────────────────────────┐
│ ← Volver    Juan Pérez                [📞][💬][📅][⋮ Más acciones]   │
├────────────────────────────────┬──────────────────────────────────── ┤
│ 📌 PRÓXIMA ACCIÓN (fijo arriba) │  Información general                │
│ 🔴 Llamar — venció ayer         │  📱 55 1234 5678                    │
│ Responsable: Ana                │  Origen: Facebook / "Remate Polanco"│
│ [Completar]  [Reprogramar]      │  Etapa: ● Contactado                │
├────────────────────────────────┤  Responsable: Ana  [Reasignar]      │
│ Propiedades de interés (2)      ├──────────────────────────────────── ┤
│ • Depto Polanco A     [Ver]     │  Timeline                           │
│ • Casa Satélite B     [Ver]     │  🔧 Hoy 09:00   Etapa → Contactado  │
│ [+ Agregar propiedad]           │  📞 Ayer 17:30  Llamada: "Interesado│
├────────────────────────────────┤          pide fotos" — Ana          │
│ Citas (1 próxima)               │  📅 Ayer 15:00  Cita agendada 12/07 │
│ 📅 12/07 10:00 — Depto A        │  🆕 Hace 3 días Prospecto creado    │
│ [Reagendar] [Cancelar]          │  [Ver historial completo →]         │
├────────────────────────────────┤                                      │
│ Notas                           │                                      │
│ [+ Agregar nota]                │                                      │
└────────────────────────────────┴──────────────────────────────────── ┘
```

**Por qué está así:** dos columnas con propósitos distintos. La izquierda es "qué tengo que hacer con este prospecto" (próxima acción fija arriba, luego lo demás accionable — citas, propiedades — y notas al final, por ser lo menos urgente). La derecha es "contexto e historia" (datos + timeline). Las acciones de contacto rápido están en el encabezado, siempre visibles, para no tener que bajar a buscarlas.

### 3.5 Calendario

```
┌──────────────────────────────────────────────────────────────────────┐
│ Calendario      [Hoy] [◀ Julio 2026 ▶]           [+ Nueva cita]      │
├───────────────────────────────────────┬──────────────────────────────┤
│  Dom Lun Mar Mié Jue Vie Sáb          │  Próximas citas               │
│                1   2   3   4          │  Hoy                          │
│   5   6   7   8   9  10  11           │  10:00 Ana López — Depto A     │
│                   [●2]                │  16:30 Roberto Díaz — Casa B   │
│  12  13  14  15  16  17  18           │  Mañana                        │
│      [●1]                             │  09:00 Sofía Ramírez           │
│  ...                                   │  [Ver todas →]                 │
└───────────────────────────────────────┴──────────────────────────────┘
```

**Por qué está así:** conserva el layout de la pantalla actual (mes + panel lateral de próximas citas) porque ya es un patrón conocido por el equipo — el cambio es interno (lee de `Appointment`, no de `Lead.appointmentDate`), no visual.

### 3.6 Campañas

```
┌──────────────────────────────────────────────────────────────────────┐
│ Campañas                                    [+ Nueva campaña]        │
├──────────────────────────────────────────────────────────────────────┤
│ Nombre              Plataforma  Prospectos  Ventas  Conversión Estado│
│ Remate Polanco Jul   Facebook      34          5      14.7%   ●Activa│
│ WhatsApp directo     WhatsApp      21          2       9.5%   ●Activa│
│ Google Ads Junio     Google        18          1       5.6%   ○Cerrada│
│  (click en fila → detalle: prospectos y ventas de esa campaña)       │
└──────────────────────────────────────────────────────────────────────┘
```

### 3.7 Reportes

```
┌──────────────────────────────────────────────────────────────────────┐
│ Reportes            [Este mes ▾]      [Todos los asesores ▾]         │
├──────────────────────────────────────┬───────────────────────────────┤
│ Embudo comercial                     │  Motivos de cierre (perdidos) │
│ Nuevo        ████████████ 45         │  Sin presupuesto     ████ 12  │
│ Contactado   ████████ 32             │  No respondió        ███  9   │
│ Interesado   █████ 18                │  Compró competencia  ██   5   │
│ Cita agend.  ███ 12                  │  Perdió interés      █    3   │
│ Venta        ██ 8                    │                                │
├───────────────────────────────────────┼───────────────────────────────┤
│ Desempeño por asesor                  │  Citas: completadas vs no-show│
│ Ana:   22 prospectos · 5 ventas 22%   │  ████████████░░░ 82% complet. │
│ Pedro: 18 prospectos · 3 ventas 16%   │                                │
└──────────────────────────────────────┴───────────────────────────────┘
```

**Por qué está así (3.6 y 3.7):** máximo 4-6 visualizaciones simples, nada de tablas configurables — el objetivo es decisión rápida, no un generador de reportes (ver crítica §10.f).

---

## 4. Diseño Mobile First

No es la versión de escritorio encogida — parte de premisas distintas: el asesor usa el celular en campo, con una mano, entre visitas, y necesita capturar información en segundos.

- **Navegación:** barra inferior fija (no sidebar) con 4-5 iconos: Inicio (Dashboard) · Prospectos · Calendario · Más (Campañas/Reportes). El sidebar de escritorio no se "colapsa a hamburguesa" — se reemplaza por completo por un patrón táctil nativo.
- **Botón principal (`+ Nuevo prospecto`):** FAB flotante inferior derecho, alcanzable con el pulgar sin cambiar el agarre del teléfono.
- **Kanban en mobile: NO se porta el drag & drop.** Arrastrar tarjetas con el dedo en una pantalla pequeña es impreciso y frustrante — es un patrón que funciona en desktop con mouse, no en touch. En su lugar: la tarjeta se toca → se abre un *bottom sheet* con las etapas como opciones grandes de una sola columna (1 tap = cambio de etapa). Mismo resultado funcional, interacción apropiada al dispositivo.
- **Tamaño de elementos:** objetivos táctiles mínimo 44×44px, tarjetas con jerarquía clara (nombre grande, próxima acción con color, acciones de contacto como iconos grandes en la parte inferior de la tarjeta — no arriba, para quedar más cerca del pulgar al sostener el teléfono con una mano).
- **Uso a una mano:** las acciones más frecuentes (llamar, WhatsApp, completar tarea) se ubican en el tercio inferior de la pantalla siempre que sea posible; los elementos informativos (no accionables) pueden ir arriba, donde cuesta más llegar con el pulgar.
- **Velocidad de captura:** minimizar teclado. "Próxima acción" se resuelve con chips predefinidos (Llamar mañana / Confirmar cita / Enviar info), fecha sugerida automática con un tap para aceptar. Gestos de swipe en las listas: swipe derecha = completar tarea, swipe izquierda = llamar — evita entrar al detalle para acciones triviales.

---

## 5. Acciones rápidas (1-2 clics)

| Acción | Clics | Justificación |
|---|---|---|
| Llamar | 1 (`tel:` directo) | Es la acción más repetida del día; cualquier fricción adicional empuja de vuelta al hábito de "marcar desde el celular sin pasar por el sistema". |
| Abrir WhatsApp | 1 (`wa.me` con plantilla precargada, reutiliza el endpoint ya existente de WhatsApp en `leadController`) | Mismo argumento — es el canal de contacto real del negocio, no un extra. |
| Agendar cita | 1 para abrir el mini-formulario, 1 para confirmar | Si agendar cuesta más que completar un formulario largo, se sigue agendando por fuera del sistema. |
| Cambiar etapa | 1 (drag desktop) / 2 (tap + selección mobile) | Es la acción que alimenta todo el pipeline; debe costar lo mismo que mover una nota física de columna. |
| Completar tarea | 1 (checkbox directo en la lista de "acción inmediata" del dashboard, sin entrar al perfil) | Si hay que abrir el prospecto para marcar una tarea hecha, la lista de pendientes deja de usarse a diario. |
| Registrar venta | 2 (drag a la columna + modal mínimo) | Es una acción de bajo volumen (pocas al mes) que sí justifica un modal, pero el modal debe ser mínimo (monto + propiedad), no un formulario largo. |

---

## 6. Componentes reutilizables

Priorizando extender lo que ya existe en `client/src/components/ui/` en vez de crear un sistema visual paralelo:

- **`ProspectoCard`** (nuevo) — usada en Kanban y en la vista Lista (mobile). Compone `Badge` (etapa/campaña) + el widget de próxima acción + acciones rápidas.
- **`Timeline`** — generalizar el patrón ya existente en `PriceHistoryTimeline.jsx` (hoy usado para historial de precios de propiedad) para aceptar entradas tipadas con ícono, en vez de construir un timeline nuevo desde cero.
- **`StatusBadge`** — extensión de `Badge.jsx` + el patrón `STATUS_VARIANTS` de `constants.js`, con las variantes nuevas de etapa/urgencia.
- **`NextActionWidget`** ("Próxima acción") — un solo componente usado en 3 lugares: encabezado del perfil, pie de la tarjeta Kanban, y fila del dashboard — para que cambiarlo una vez lo cambie en todos lados.
- **`CampaignCard`** — para la vista de Campañas, reutilizando `MiniChart` para un sparkline pequeño de conversión.
- **`MetricTile`** — tile de KPI clicable, mismo componente en Dashboard y Reportes (evita que ambas pantallas dibujen el mismo número con estilos distintos).
- **`QuickActionButtons`** (llamar/WhatsApp) — un componente, tres lugares de uso (tarjeta, fila de lista, encabezado de perfil).
- **`OverflowMenu`** (ya existe) — se reutiliza tal cual para "⋮ más acciones".
- **`BatchActionBar`** (ya existe) — se reutiliza tal cual para selección múltiple en la vista Lista.
- **Modal de confirmación con campos obligatorios** (patrón ya unificado en 13 pantallas del admin) — se reutiliza para los modales de cierre de venta y motivo de pérdida, no se inventa un modal nuevo.
- **`TagChip`** — reservado para cuando se implemente Etiquetas en Fase 2 (ver crítica §10.d sobre si vale la pena).

---

## 7. Experiencia del Dashboard (a fondo)

El orden de arriba hacia abajo sigue una sola regla: **urgencia antes que información, acción antes que gráfica.**

1. Saludo + fecha — ancla temporal, personaliza.
2. Franja de 4 KPIs clicables (vencidos / nuevos / citas hoy / ventas semana) — el resumen de 3 segundos.
3. Lista "Requiere acción inmediata" — es la única sección con botones de acción reales (llamar, confirmar, enviar), ordenada por urgencia real (vencido ayer antes que vence en 2h), no por fecha de creación.
4. Citas de hoy + Actividad reciente, en paralelo — informativos, no accionables de inmediato, pero refuerzan la sensación de que el sistema "está vivo" y capturando todo automáticamente (esto es clave para que el equipo confíe en el timeline automático del punto 3 del análisis anterior).
5. Campaña con mejor rendimiento — la única pieza puramente analítica del dashboard, y deliberadamente al final y como una sola tarjeta (no un mini-reporte) — el detalle completo vive en Reportes/Campañas.

Ningún gráfico debe aparecer antes que un ítem accionable — si algún día se agrega una gráfica nueva, debe entrar en Reportes, no en el Dashboard, para no repetir el error de que el dashboard "solo almacene y muestre" en vez de invitar a actuar.

---

## 8. Experiencia del Prospecto (a fondo)

Dos columnas con propósitos distintos, no una lista plana de campos:

- **Columna izquierda — "qué hacer":** próxima acción (fija/sticky arriba, visible incluso al hacer scroll), propiedades de interés, citas, notas al final. El orden es intencional: lo más urgente y accionable arriba, lo menos urgente (notas de texto libre) al final.
- **Columna derecha — "contexto":** datos generales arriba, timeline debajo. El timeline muestra solo las últimas ~5 entradas por defecto con un "ver historial completo" — no todo el histórico de una vez, para no saturar (ver crítica §10.h sobre ruido de eventos automáticos).
- **Acciones rápidas de contacto** (llamar/WhatsApp/agendar) fijas en el encabezado superior, visibles sin scroll, porque son las que más se usan y no deberían depender de en qué columna esté mirando el usuario.
- **En mobile:** una sola columna, mismo orden de prioridad (próxima acción primero, notas al final) — no se reorganiza el contenido por dispositivo, solo se apila.

---

## 9. Principios de UX

1. **Minimizar clics** — ninguna acción cotidiana (llamar, cambiar etapa, completar tarea) debería costar más de 2 clics/taps.
2. **Minimizar escritura manual** — preferir selects, chips y fechas sugeridas sobre texto libre; el texto libre se reserva para notas, donde de verdad aporta.
3. **Mostrar primero lo urgente, no lo bonito** — el orden de la pantalla es por prioridad de acción, nunca por fecha de creación ni alfabético.
4. **Próxima acción siempre visible** — en toda tarjeta, fila y perfil; nunca debe existir un prospecto activo sin una.
5. **Acciones rápidas siempre a la vista** — llamar y WhatsApp nunca deben esconderse detrás de un menú "⋮" si son las dos acciones más usadas del día.
6. **Consistencia visual** — mismos componentes que el resto del admin (`Badge`, modal unificado, `OverflowMenu`); el CRM no es un sub-producto visualmente distinto.
7. **Feedback inmediato** — toda acción confirma al instante (reutilizar el patrón de `LeadToast`), UI optimista donde aplique.
8. **Evitar pantallas saturadas** — colapsar por defecto lo histórico/completado, revelar bajo demanda ("ver más", no "mostrar todo siempre").
9. **Ningún campo obligatorio que no se justifique** — cada requisito de captura debe tener una razón de negocio clara (ver crítica §10.a sobre el email obligatorio actual).
10. **Reversible antes que perfecto** — permitir deshacer un cierre equivocado (reabrir un "No interesado") en vez de bloquear con validaciones rígidas que generan miedo a usar el sistema.
11. **Diseño para el celular primero, no adaptado después** — dado que buena parte del uso real ocurre en campo, con una mano, entre visitas.

---

## 10. Crítica y recomendaciones

**a) El modelo `Lead` actual exige `email` (`allowNull: false`), lo cual choca con la realidad de WhatsApp/Facebook**, donde frecuentemente solo hay teléfono. Esto va a forzar a los asesores a inventar correos falsos para poder guardar un prospecto — exactamente el tipo de fricción que empuja de vuelta al Excel. **Recomendación:** hacer `email` opcional y `phone` el identificador primario; además, buscar por teléfono antes de crear un prospecto nuevo y, si ya existe, preguntar "¿es el mismo prospecto?" en vez de duplicarlo silenciosamente — el Excel actual no resuelve esto y es una causa real de dispersión de información.

**b) Drag & drop de Kanban en mobile es una mala idea si se porta tal cual de escritorio.** Ya cubierto en §4 — la solución es un patrón táctil distinto (tap + bottom sheet), no el mismo gesto adaptado.

**c) Los modales obligatorios en transiciones terminales (venta/cierre) son un riesgo de fricción si se diseñan pesados.** Si un asesor mueve una tarjeta por error a "Venta realizada", un modal largo se siente como castigo. **Recomendación:** modal de 2-3 campos máximo, con un botón claro de "cancelar / deshacer movimiento" y no solo "guardar".

**d) Etiquetas libres (Fase 2) corren el riesgo de terminar sin usarse, como suele pasar en muchos CRMs.** Sin un caso de uso concreto ("quiero filtrar inversionistas"), es un campo que se llena una vez y nunca se vuelve a consultar — el mismo síntoma que el Excel disperso que se busca eliminar. **Recomendación:** no implementarlas hasta que surja una necesidad real de segmentación que los campos estructurados (campaña, etapa, motivo de cierre) no resuelvan ya.

**e) Una pantalla de "Configuración" para 2-3 constantes es sobre-construir.** El umbral de "prospecto olvidado" o la lista de motivos de cierre no justifican una sección completa de administración en el MVP. **Recomendación:** que vivan como configuración de código hasta que el equipo pida explícitamente poder cambiarlas sin depender de un deploy.

**f) Reportes puede degenerar en "otro Excel" si se llena de tablas densas y filtros configurables.** **Recomendación:** límite estricto de 4-6 visualizaciones simples (embudo, motivos de cierre, desempeño por asesor, citas completadas/no-show) — el objetivo es decisión rápida, no un generador de reportes exhaustivo.

**g) La captura obligatoria de "próxima acción" puede volverse burocrática y perder su valor si cuesta trabajo.** Si el asesor tiene que escribir cada vez, va a poner lo mismo sin pensar ("dar seguimiento, mañana") solo para poder continuar. **Recomendación:** 3-4 chips predefinidos con fecha sugerida automática (Llamar mañana / Confirmar cita / Enviar info / Esperar respuesta), reduciendo el caso común a 1 tap, con opción de personalizar solo cuando haga falta.

**h) El historial 100% automático puede saturar el timeline de ruido** (cambios de responsable, de etapa, reprogramaciones mezclados con conversaciones reales). **Recomendación:** diferenciar visualmente eventos del sistema (tono gris/sutil) de interacciones humanas (color), y permitir colapsar los eventos automáticos para leer rápido "qué se ha hablado realmente con este cliente".

**i) No vale la pena construir un motor de filtros avanzado en el MVP.** Con el volumen actual (cientos, no miles de prospectos), una barra de búsqueda rápida por nombre/teléfono cubre el 90% de los casos diarios; filtros compuestos (rango de fechas, múltiples campañas a la vez) pueden esperar a que el volumen lo justifique.

**j) Fusionar "Pipeline" y "Prospectos" en una sola sección de navegación con toggle** (ya aplicado en §1) evita el error común de que el usuario tenga que decidir en qué "modo" está parado cuando en realidad quiere ver lo mismo de dos formas.

**k) Evitar que Dashboard, Campañas y Reportes calculen el mismo número (ej. "campaña top") de tres formas distintas** — deben consultar una sola fuente de verdad para esa métrica, aunque se muestre en distintos lugares, para que nunca haya dos pantallas del mismo CRM contradiciéndose entre sí (el mismo problema de integridad que tenían los Excels dispersos, ahora a nivel de UI en vez de archivo).
