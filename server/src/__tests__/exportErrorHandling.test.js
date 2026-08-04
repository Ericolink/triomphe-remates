// Cubre la matriz de handleExportError (services/exportHelpers.js) — la utilidad compartida
// por los 5 endpoints de exportación (exportExcel, exportPDF, exportFeedbackExcel,
// exportLeadsExcel, exportPropertyQuotePDF) para decidir cómo responder un error según si el
// streaming del archivo ya arrancó o no. Usa apps Express reales (no un `res` simulado a mano)
// para que res.headersSent refleje el comportamiento real de Node — ver
// exportStreamFailure.integration.test.js para la reproducción end-to-end contra un endpoint
// real con ExcelJS mockeado.
const express = require('express');
const request = require('supertest');
const { handleExportError } = require('../services/exportHelpers');
const { ApiError } = require('../middleware/errorHandler');

// Los 5 mensajes de fallback exactos que usaban los controllers antes del fix — deben
// preservarse sin cambios (mismo contrato de error para el frontend).
const EXPORT_FALLBACK_MESSAGES = [
  'Error al generar Excel',
  'Error al generar PDF',
  'Error al generar Excel del buzón',
  'Error al generar Excel de leads',
  'Error al generar la cotización',
];

function buildApp(routeHandler) {
  const app = express();
  app.get('/test', routeHandler);
  return app;
}

describe('handleExportError — error ANTES de enviar headers', () => {
  test('ApiError: responde con su propio status/mensaje (mismo formato que errorHandler central)', async () => {
    const app = buildApp((req, res) => {
      handleExportError(req, res, new ApiError(404, 'Propiedad no encontrada'), 'fallback');
    });

    const res = await request(app).get('/test');
    expect(res.status).toBe(404);
    expect(res.body).toEqual({ error: 'Propiedad no encontrada' });
  });

  test.each(EXPORT_FALLBACK_MESSAGES)(
    'Error genérico (no-ApiError): responde 500 con el mensaje de fallback "%s" — mismo contrato en los 5 endpoints',
    async (fallbackMessage) => {
      const app = buildApp((req, res) => {
        handleExportError(req, res, new Error('boom interno'), fallbackMessage);
      });

      const res = await request(app).get('/test');
      expect(res.status).toBe(500);
      expect(res.body).toEqual({ error: fallbackMessage });
    }
  );
});

describe('handleExportError — error DESPUÉS de enviar headers (streaming ya iniciado)', () => {
  test('nunca lanza (ni deja que Express reintente responder); corta la conexión en vez de tumbarse', async () => {
    let handlerThrew = false;
    const app = buildApp((req, res) => {
      res.setHeader('Content-Type', 'application/pdf');
      res.write('bytes-ya-enviados-del-archivo'); // flipea res.headersSent de verdad
      try {
        handleExportError(req, res, new Error('boom mid-stream'), 'fallback');
      } catch {
        handlerThrew = true;
      }
    });

    // El cliente ve la conexión cortada abruptamente (res.destroy()) — un "socket hang up"
    // es el resultado ESPERADO aquí: ya salieron bytes del archivo, la única alternativa
    // seria (un segundo cuerpo JSON pegado al archivo) sería peor. Lo que este test prueba
    // es que la función nunca lanza y por lo tanto Express nunca reintenta responder.
    await expect(request(app).get('/test')).rejects.toThrow();
    expect(handlerThrew).toBe(false);
  });

  test('no intenta fijar un status/header nuevo una vez que la conexión ya está en streaming', async () => {
    let handlerThrew = false;
    const app = buildApp((req, res) => {
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.write('partial-xlsx-bytes');
      try {
        handleExportError(req, res, new Error('boom'), 'fallback');
      } catch {
        handlerThrew = true;
      }
    });

    await expect(request(app).get('/test')).rejects.toThrow();
    expect(handlerThrew).toBe(false);
  });
});
