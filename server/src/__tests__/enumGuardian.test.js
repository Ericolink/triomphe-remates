// GUARDIÁN DE ENUMs — protección contra drift frontend/backend (2026-09-01).
//
// La auditoría de los 500 recurrentes confirmó que hoy no hay ningún mismatch vivo entre
// los mapas de labels de client/src/utils/constants.js y los ENUM de Sequelize que
// representan — pero también confirmó que YA ha ocurrido drift real varias veces en el
// historial del proyecto (category en 2026-07-23, roles en 2026-08-13, businessLine en
// 2026-08-27). Este test no previene el drift — lo DETECTA automáticamente la próxima vez
// que un ENUM se edite en un lado sin actualizar el otro, en vez de esperar a que alguien
// lo reporte como un 500 en producción.
//
// Diseño: NO se duplica ningún valor a mano en un tercer archivo. Se leen los valores reales
// de cada lado:
//  - Backend: `Model.rawAttributes[campo].values`, que Sequelize expone para toda columna
//    DataTypes.ENUM sin necesitar conexión a la base de datos (es metadata de la definición
//    del modelo, no una query).
//  - Frontend: se importa dinámicamente (import() nativo de Node, sin transpilar) el propio
//    client/src/utils/constants.js — el archivo real que usan los componentes.
//
// Un mapa de labels compartido entre varios modelos (ej. CITY_LABELS, usado por formularios
// de Property, JobApplication, Lead.searchCity, etc.) se compara contra la UNIÓN de todos
// los ENUMs que efectivamente consume — así un valor legítimo en un modelo pero ausente en
// otro (ej. 'otra' solo existe en JobApplication.city, no en Property.city) no genera un
// falso positivo. Cada excepción de este tipo está documentada en su propio `checks()`.
const { Property, Lead, PropertyAlert, Testimonial, JobApplication, Appointment, JobPosition, Campaign, Feedback, User } =
  require('../models/index');

// Extrae los valores válidos de una columna ENUM de Sequelize. Lanza si el campo no es un
// ENUM (protege contra un typo de nombre de campo silenciándose como "0 valores, 0 mismatches").
function enumValues(Model, field) {
  const values = Model.rawAttributes[field]?.values;
  if (!values) {
    throw new Error(
      `${Model.name}.${field} no es una columna ENUM de Sequelize — revisa el nombre del campo en enumGuardian.test.js`
    );
  }
  return values;
}

function union(...valueArrays) {
  return [...new Set(valueArrays.flat())];
}

// Función pura, sin dependencias de Sequelize/fetch — comparada aparte en el describe de
// abajo con datos falsos, para probar el mecanismo del guardián en sí mismo.
function diffEnum(frontendKeys, backendValues) {
  const feSet = new Set(frontendKeys);
  const beSet = new Set(backendValues);
  return {
    // Un valor válido en backend sin label en frontend — el <select> correspondiente no
    // podría mostrarlo (o un registro existente se vería con su clave cruda en vez de un
    // texto legible).
    missingInFrontend: [...beSet].filter((v) => !feSet.has(v)).sort(),
    // Un label en frontend que ya no es un valor válido en NINGÚN backend relacionado — si
    // se ofrece como opción seleccionable en algún <select>, el backend lo rechazaría (o,
    // antes de esta auditoría, podía terminar en un 500 genérico).
    unexpectedInFrontend: [...feSet].filter((v) => !beSet.has(v)).sort(),
  };
}

function formatMismatch(name, { missingInFrontend, unexpectedInFrontend }) {
  const lines = [`✗ ${name}`];
  if (missingInFrontend.length) {
    lines.push(`    falta en frontend (existe en backend, no se podría mostrar): ${missingInFrontend.join(', ')}`);
  }
  if (unexpectedInFrontend.length) {
    lines.push(`    sobra en frontend (ya no es válido en backend): ${unexpectedInFrontend.join(', ')}`);
  }
  return lines.join('\n');
}

describe('diffEnum (mecanismo del guardián, con datos simulados)', () => {
  test('sin diferencias → ambas listas vacías', () => {
    expect(diffEnum(['A', 'B', 'C'], ['A', 'B', 'C'])).toEqual({
      missingInFrontend: [],
      unexpectedInFrontend: [],
    });
  });

  test('backend: A,B,C — frontend: A,B,D → detecta el faltante C y el sobrante D', () => {
    const result = diffEnum(['A', 'B', 'D'], ['A', 'B', 'C']);

    expect(result).toEqual({
      missingInFrontend: ['C'],
      unexpectedInFrontend: ['D'],
    });
  });

  test('un valor con distinto spelling produce un par faltante/sobrante que delata el typo', () => {
    const result = diffEnum(['compraventa'], ['compra_venta']);

    expect(result).toEqual({
      missingInFrontend: ['compra_venta'],
      unexpectedInFrontend: ['compraventa'],
    });
  });
});

describe('ENUM Guardian — frontend (constants.js) vs. backend (Sequelize)', () => {
  let constants;

  beforeAll(async () => {
    constants = await import('../../../client/src/utils/constants.js');
  });

  test('cada mapa de labels compartido coincide exactamente con su(s) ENUM(s) de backend', () => {
    // Tabla explícita de correspondencias — la única fuente de verdad de qué compara contra
    // qué. Agregar un ENUM nuevo en el futuro es agregar una entrada aquí, no crear un
    // archivo de constantes paralelo.
    const checks = [
      {
        name: 'ROLE_LABELS ↔ User.role',
        frontendKeys: Object.keys(constants.ROLE_LABELS),
        backendValues: enumValues(User, 'role'),
      },
      {
        // Excepción documentada: CITY_LABELS es un mapa COMPARTIDO por varios formularios
        // (propiedades, vacantes/postulaciones, búsqueda estructurada de leads, alertas,
        // testimonios) con ENUMs de ciudad ligeramente distintos entre sí — 'otra' solo es
        // válido para JobApplication.city, por eso se compara contra la UNIÓN de los 5, no
        // contra Property.city sola (que produciría un falso positivo por 'otra').
        name: 'CITY_LABELS ↔ Property.city ∪ JobApplication.city ∪ Lead.searchCity ∪ PropertyAlert.city ∪ Testimonial.city',
        frontendKeys: Object.keys(constants.CITY_LABELS),
        backendValues: union(
          enumValues(Property, 'city'),
          enumValues(JobApplication, 'city'),
          enumValues(Lead, 'searchCity'),
          enumValues(PropertyAlert, 'city'),
          enumValues(Testimonial, 'clientCity')
        ),
      },
      {
        // Mismo criterio de unión que CITY_LABELS, aunque aquí los 3 ENUMs relacionados
        // hoy tienen exactamente los mismos 5 valores (casa/departamento/terreno/local/
        // bodega) — se compara como unión de todas formas para no romper si algún día
        // alguno de los 3 diverge legítimamente, igual que ya pasó con las ciudades.
        name: 'TYPE_LABELS ↔ Property.type ∪ Lead.desiredType ∪ PropertyAlert.type',
        frontendKeys: Object.keys(constants.TYPE_LABELS),
        backendValues: union(
          enumValues(Property, 'type'),
          enumValues(Lead, 'desiredType'),
          enumValues(PropertyAlert, 'type')
        ),
      },
      {
        name: 'CATEGORY_LABELS ↔ Property.category',
        frontendKeys: Object.keys(constants.CATEGORY_LABELS),
        backendValues: enumValues(Property, 'category'),
      },
      {
        name: 'LEGAL_PROCESS_TYPE_LABELS ↔ Property.legalProcessType',
        frontendKeys: Object.keys(constants.LEGAL_PROCESS_TYPE_LABELS),
        backendValues: enumValues(Property, 'legalProcessType'),
      },
      {
        name: 'BUSINESS_LINE_LABELS ↔ Property.businessLine ∪ Lead.businessLine ∪ PropertyAlert.businessLine',
        frontendKeys: Object.keys(constants.BUSINESS_LINE_LABELS),
        backendValues: union(
          enumValues(Property, 'businessLine'),
          enumValues(Lead, 'businessLine'),
          enumValues(PropertyAlert, 'businessLine')
        ),
      },
      {
        name: 'STATUS_LABELS ↔ Property.status',
        frontendKeys: Object.keys(constants.STATUS_LABELS),
        backendValues: enumValues(Property, 'status'),
      },
      {
        name: 'ACQUISITION_STAGE_LABELS ↔ Property.acquisitionStage',
        frontendKeys: Object.keys(constants.ACQUISITION_STAGE_LABELS),
        backendValues: enumValues(Property, 'acquisitionStage'),
      },
      {
        name: 'PIPELINE_STAGE_LABELS ↔ Lead.pipelineStage',
        frontendKeys: Object.keys(constants.PIPELINE_STAGE_LABELS),
        backendValues: enumValues(Lead, 'pipelineStage'),
      },
      {
        // LEAD_TYPE_LABELS incluye a propósito 'informacion'/'propiedades_similares' —
        // valores históricos que Lead.type YA conserva en su ENUM solo para no romper leads
        // viejos (ver comentario en models/Lead.js) — por eso se compara contra el ENUM
        // completo del modelo, no contra el whitelist más chico de leads NUEVOS
        // (VALID_LEAD_TYPE en leadController.js, que a propósito excluye esos 2).
        name: 'LEAD_TYPE_LABELS ↔ Lead.type',
        frontendKeys: Object.keys(constants.LEAD_TYPE_LABELS),
        backendValues: enumValues(Lead, 'type'),
      },
      {
        name: 'LEAD_URGENCY_LABELS ↔ Lead.urgency',
        frontendKeys: Object.keys(constants.LEAD_URGENCY_LABELS),
        backendValues: enumValues(Lead, 'urgency'),
      },
      {
        name: 'SOURCE_LABELS ↔ Lead.source',
        frontendKeys: Object.keys(constants.SOURCE_LABELS),
        backendValues: enumValues(Lead, 'source'),
      },
      {
        name: 'PAYMENT_METHOD_LABELS ↔ Lead.paymentMethod',
        frontendKeys: Object.keys(constants.PAYMENT_METHOD_LABELS),
        backendValues: enumValues(Lead, 'paymentMethod'),
      },
      {
        name: 'CLOSE_REASON_LABELS ↔ Lead.closeReason',
        frontendKeys: Object.keys(constants.CLOSE_REASON_LABELS),
        backendValues: enumValues(Lead, 'closeReason'),
      },
      {
        name: 'APPOINTMENT_STATUS_LABELS ↔ Appointment.status',
        frontendKeys: Object.keys(constants.APPOINTMENT_STATUS_LABELS),
        backendValues: enumValues(Appointment, 'status'),
      },
      {
        name: 'JOB_TYPE_LABELS ↔ JobPosition.type',
        frontendKeys: Object.keys(constants.JOB_TYPE_LABELS),
        backendValues: enumValues(JobPosition, 'type'),
      },
      {
        name: 'JOB_STATUS_LABELS ↔ JobPosition.status',
        frontendKeys: Object.keys(constants.JOB_STATUS_LABELS),
        backendValues: enumValues(JobPosition, 'status'),
      },
      {
        name: 'APPLICATION_STATUS_LABELS ↔ JobApplication.status',
        frontendKeys: Object.keys(constants.APPLICATION_STATUS_LABELS),
        backendValues: enumValues(JobApplication, 'status'),
      },
      {
        name: 'TESTIMONIAL_STATUS_LABELS ↔ Testimonial.status',
        frontendKeys: Object.keys(constants.TESTIMONIAL_STATUS_LABELS),
        backendValues: enumValues(Testimonial, 'status'),
      },
      {
        name: 'CAMPAIGN_PLATFORM_LABELS ↔ Campaign.platform',
        frontendKeys: Object.keys(constants.CAMPAIGN_PLATFORM_LABELS),
        backendValues: enumValues(Campaign, 'platform'),
      },
      {
        name: 'FEEDBACK_CATEGORY_LABELS ↔ Feedback.category',
        frontendKeys: Object.keys(constants.FEEDBACK_CATEGORY_LABELS),
        backendValues: enumValues(Feedback, 'category'),
      },
      {
        name: 'FEEDBACK_STATUS_LABELS ↔ Feedback.status',
        frontendKeys: Object.keys(constants.FEEDBACK_STATUS_LABELS),
        backendValues: enumValues(Feedback, 'status'),
      },
    ];

    const failures = checks
      .map(({ name, frontendKeys, backendValues }) => ({ name, diff: diffEnum(frontendKeys, backendValues) }))
      .filter(({ diff }) => diff.missingInFrontend.length > 0 || diff.unexpectedInFrontend.length > 0);

    if (failures.length > 0) {
      const report = failures.map(({ name, diff }) => formatMismatch(name, diff)).join('\n');
      throw new Error(
        `\n${failures.length} ENUM(s) desincronizados entre client/src/utils/constants.js y los modelos de Sequelize:\n\n${report}\n`
      );
    }
  });
});
