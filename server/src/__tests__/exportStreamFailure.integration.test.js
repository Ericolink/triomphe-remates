// Reproduce, con librerías reales de Node/Express y solo ExcelJS mockeado, el escenario que
// motivó la unificación: un error ocurre DESPUÉS de que el streaming del archivo ya arrancó
// (res.headersSent === true). Antes de este fix, exportExcel/exportPDF/exportFeedbackExcel/
// exportLeadsExcel volvían a llamar res.status().json() en ese punto, lo que Node revienta con
// ERR_HTTP_HEADERS_SENT. Se mockea 'exceljs' porque no hay forma determinista de forzar que la
// librería real falle a mitad de un write() ya en curso (ver exportErrorHandling.test.js para
// el resto de la matriz de casos, probada de forma unitaria contra handleExportError).
jest.mock('exceljs', () => ({
  Workbook: jest.fn().mockImplementation(() => {
    const fakeCell = () => ({});
    const fakeRow = () => ({ height: 0, values: [], eachCell: jest.fn(), getCell: fakeCell });
    const sheet = {
      columns: [],
      addRow: jest.fn(fakeRow),
      getCell: jest.fn(fakeCell),
      getRow: jest.fn(fakeRow),
      mergeCells: jest.fn(),
      addImage: jest.fn(),
    };
    return {
      creator: '',
      created: null,
      addWorksheet: jest.fn(() => sheet),
      addImage: jest.fn(),
      xlsx: {
        // Simula lo que hace ExcelJS realmente: escribe chunks a `res` según va serializando
        // el zip (esto flushea headers de verdad, vía el mecanismo real de Node) y luego se
        // rompe a medias — p.ej. el cliente cortó la conexión, o un error de memoria.
        write: jest.fn((res) => {
          res.write('PK-simulated-partial-zip-bytes');
          return Promise.reject(new Error('Simulated failure mid zip stream'));
        }),
      },
    };
  }),
}));

const request = require('supertest');
const app = require('../../app');
const { sequelize, User } = require('../models/index');
const { createUser, authToken } = require('./helpers/factories');
const logger = require('../utils/logger');

describe('Exportación — error real después de headersSent (ExcelJS mockeado)', () => {
  let admin, token;

  beforeAll(async () => {
    await sequelize.sync({ alter: false });
    admin = await createUser({ role: 'admin' });
    token = authToken(admin);
  });

  afterAll(async () => {
    await User.destroy({ where: { id: admin.id }, force: true });
    await sequelize.close();
  });

  test('no lanza ERR_HTTP_HEADERS_SENT ni deja la conexión colgada; el error queda logueado una sola vez', async () => {
    const errorSpy = jest.spyOn(logger, 'error').mockImplementation(() => {});
    const uncaught = [];
    const onUncaught = (e) => uncaught.push(e);
    process.on('uncaughtException', onUncaught);

    try {
      // La conexión se corta a medias (res.destroy()) — el cliente ve un error de red, no
      // una respuesta JSON de error. Es exactamente lo esperado: ya se enviaron bytes del
      // archivo, no hay forma válida de "corregir" la respuesta con un segundo cuerpo.
      //
      // El timeout acotado es la parte importante del caso: con el patrón viejo (volver a
      // llamar res.status().json() con headers ya enviados) Express 5 reenvía el
      // ERR_HTTP_HEADERS_SENT al errorHandler central, que intenta responder OTRA vez y
      // también truena — como esa segunda falla ocurre ya dentro del error-handling
      // middleware, Express no tiene a dónde reenviarla y la conexión se queda colgada para
      // siempre (comprobado a mano: sin este fix, la misma request nunca emite 'end').
      await expect(
        request(app)
          .get('/api/export/excel')
          .set('Authorization', `Bearer ${token}`)
          .timeout({ response: 3000, deadline: 5000 })
      ).rejects.toThrow();
    } finally {
      process.off('uncaughtException', onUncaught);
    }

    expect(uncaught).toEqual([]); // el proceso sigue vivo — nada se le escapó a Node

    // El error real se logueó exactamente una vez, con su mensaje original — no dos veces
    // (una desde el controller, otra desde errorHandler.js reaccionando al
    // ERR_HTTP_HEADERS_SENT) ni disfrazado por ese error secundario.
    expect(errorSpy).toHaveBeenCalledTimes(1);
    const [, meta] = errorSpy.mock.calls[0];
    expect(meta.message).toBe('Simulated failure mid zip stream');
    expect(errorSpy.mock.calls.some(([, m]) => /headers after they are sent/i.test(m?.message))).toBe(
      false
    );

    errorSpy.mockRestore();
  });

  test('el servidor sigue sano: una exportación PDF real (sin mockear) funciona justo después', async () => {
    // pdfkit no está mockeado en este archivo — si el fallo de Excel hubiera dejado el
    // proceso o el router en mal estado, esta request real lo expondría.
    const res = await request(app)
      .get('/api/export/pdf')
      .set('Authorization', `Bearer ${token}`)
      .buffer(true)
      .parse((r, cb) => {
        r.setEncoding('binary');
        let data = '';
        r.on('data', (chunk) => (data += chunk));
        r.on('end', () => cb(null, Buffer.from(data, 'binary')));
      });

    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toBe('application/pdf');
    expect(res.body.length).toBeGreaterThan(0);
  });
});
