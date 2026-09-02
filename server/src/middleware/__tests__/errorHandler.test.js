jest.mock('../../utils/logger', () => ({ error: jest.fn() }));

const logger = require('../../utils/logger');
const { ApiError, errorHandler } = require('../errorHandler');

function mockRes() {
  const res = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res;
}

function mockReq() {
  return { method: 'GET', originalUrl: '/api/test', user: { id: 7 } };
}

describe('errorHandler', () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  test('responde con el statusCode y mensaje exactos de un ApiError', () => {
    const req = mockReq();
    const res = mockRes();
    const err = new ApiError(404, 'Lead no encontrado');

    errorHandler(err, req, res, jest.fn());

    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith({ error: 'Lead no encontrado' });
  });

  test('nunca expone el mensaje real de un error inesperado (no ApiError)', () => {
    const req = mockReq();
    const res = mockRes();
    const err = new Error('column "foo" does not exist');

    errorHandler(err, req, res, jest.fn());

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({ error: 'Error interno del servidor' });
  });

  test('registra el error inesperado completo aunque no lo exponga al cliente', () => {
    const req = mockReq();
    const res = mockRes();
    const err = new Error('connection refused');

    errorHandler(err, req, res, jest.fn());

    expect(logger.error).toHaveBeenCalledWith(
      'GET /api/test',
      expect.objectContaining({ statusCode: 500, message: 'connection refused', userId: 7 })
    );
  });

  test('adjunta la causa original solo para logging cuando se pasa a ApiError', () => {
    const req = mockReq();
    const res = mockRes();
    const original = new Error('Validation error: email must be unique');
    const err = new ApiError(500, 'Error interno del servidor', { cause: original });

    errorHandler(err, req, res, jest.fn());

    expect(res.json).toHaveBeenCalledWith({ error: 'Error interno del servidor' });
    expect(logger.error).toHaveBeenCalledWith(
      'GET /api/test',
      expect.objectContaining({ cause: 'Validation error: email must be unique' })
    );
  });

  test('usa "anonymous" cuando no hay usuario autenticado en la request', () => {
    const req = { method: 'POST', originalUrl: '/api/public', user: undefined };
    const res = mockRes();

    errorHandler(new ApiError(400, 'Datos inválidos'), req, res, jest.fn());

    expect(logger.error).toHaveBeenCalledWith(
      'POST /api/public',
      expect.objectContaining({ userId: 'anonymous' })
    );
  });

  test('agrega requestId al body cuando req.id existe (ver requestContext.js)', () => {
    const req = { ...mockReq(), id: 'abcd1234' };
    const res = mockRes();

    errorHandler(new ApiError(404, 'Lead no encontrado'), req, res, jest.fn());

    expect(res.json).toHaveBeenCalledWith({ error: 'Lead no encontrado', requestId: 'abcd1234' });
  });

  // AUDITORÍA 500s: SequelizeValidationError es generado por los validadores del propio
  // modelo — su mensaje es seguro de mostrar (no contiene SQL) y da información específica
  // en vez del 500 genérico que se devolvía antes para cualquier error no-ApiError.
  test('traduce SequelizeValidationError a 400 con el detalle del validador', () => {
    const req = mockReq();
    const res = mockRes();
    const err = new Error('Validation error');
    err.name = 'SequelizeValidationError';
    err.errors = [{ message: 'type must be one of casa, departamento, terreno, local, bodega' }];

    errorHandler(err, req, res, jest.fn());

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        error: 'type must be one of casa, departamento, terreno, local, bodega',
      })
    );
  });

  // Antes de este traductor, una violación de índice único NO capturada explícitamente por
  // el controller (ej. una carrera de slugs duplicados en createProperty) caía al 500
  // genérico. Ahora se traduce a un 409 útil.
  test('traduce SequelizeUniqueConstraintError a 409', () => {
    const req = mockReq();
    const res = mockRes();
    const err = new Error('Duplicate entry');
    err.name = 'SequelizeUniqueConstraintError';

    errorHandler(err, req, res, jest.fn());

    expect(res.status).toHaveBeenCalledWith(409);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ error: 'Ya existe un registro con estos datos.' })
    );
  });

  test('traduce SequelizeForeignKeyConstraintError a 400', () => {
    const req = mockReq();
    const res = mockRes();
    const err = new Error('FK violation');
    err.name = 'SequelizeForeignKeyConstraintError';

    errorHandler(err, req, res, jest.fn());

    expect(res.status).toHaveBeenCalledWith(400);
  });

  // Código real de MySQL para "valor de ENUM (u otro campo) fuera de rango" en modo
  // estricto — el caso concreto que producía el 500 al crear/editar una propiedad con un
  // valor de ENUM que un bundle desactualizado del frontend todavía podía enviar.
  test('traduce SequelizeDatabaseError con código de MySQL seguro (ENUM inválido) a 400', () => {
    const req = mockReq();
    const res = mockRes();
    const err = new Error("Data truncated for column 'category' at row 1");
    err.name = 'SequelizeDatabaseError';
    err.original = { code: 'ER_TRUNCATED_WRONG_VALUE_FOR_FIELD' };

    errorHandler(err, req, res, jest.fn());

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ error: 'Datos inválidos: revisa los valores enviados.' })
    );
  });

  // Un SequelizeDatabaseError SIN un código reconocido como "dato de entrada inválido" (ej.
  // un error de sintaxis SQL real, un bug de código) debe seguir siendo un 500 opaco — no
  // hay nada que el cliente pueda corregir, y no se debe filtrar el mensaje crudo de MySQL.
  test('un SequelizeDatabaseError sin código reconocido sigue siendo 500 genérico', () => {
    const req = mockReq();
    const res = mockRes();
    const err = new Error("Unknown column 'foo' in 'field list'");
    err.name = 'SequelizeDatabaseError';
    err.original = { code: 'ER_BAD_FIELD_ERROR' };

    errorHandler(err, req, res, jest.fn());

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({ error: 'Error interno del servidor' });
  });

  // Caída de conexión a MySQL/pool agotado — antes indistinguible de un bug de código
  // (mismo 500 genérico). Ahora responde 503 para señalar que es un problema transitorio.
  test('traduce errores de conexión de Sequelize a 503', () => {
    const req = mockReq();
    const res = mockRes();
    const err = new Error('Connection timed out');
    err.name = 'SequelizeConnectionTimedOutError';

    errorHandler(err, req, res, jest.fn());

    expect(res.status).toHaveBeenCalledWith(503);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        error: 'Servicio temporalmente no disponible, intenta de nuevo en unos segundos.',
      })
    );
  });

  // Caso concreto que causaba el 500 al subir imágenes de propiedades: multer emite un
  // MulterError propio (tamaño excedido) que no era un ApiError.
  test('traduce MulterError (LIMIT_FILE_SIZE) a 400 con mensaje específico', () => {
    const req = mockReq();
    const res = mockRes();
    const err = new Error('File too large');
    err.name = 'MulterError';
    err.code = 'LIMIT_FILE_SIZE';

    errorHandler(err, req, res, jest.fn());

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ error: 'La imagen excede el tamaño máximo permitido (5MB).' })
    );
  });

  // Sin `this.name = 'ApiError'` en el constructor, `errorClass` en el log quedaba como
  // "Error" tanto para un rechazo de negocio esperado (404 "no encontrado") como para un bug
  // real no capturado — indistinguibles al buscar en logs. Ver ApiError en este archivo.
  test('un ApiError se loguea con errorClass "ApiError", no "Error"', () => {
    const req = mockReq();
    const res = mockRes();

    errorHandler(new ApiError(404, 'Lead no encontrado'), req, res, jest.fn());

    expect(logger.error).toHaveBeenCalledWith(
      'GET /api/test',
      expect.objectContaining({ errorClass: 'ApiError' })
    );
  });

  test('redacta campos sensibles del body en el log de error', () => {
    const req = { ...mockReq(), method: 'PUT', body: { name: 'Juan', password: 'secreto123' } };
    const res = mockRes();

    errorHandler(new ApiError(500, 'Error interno del servidor'), req, res, jest.fn());

    expect(logger.error).toHaveBeenCalledWith(
      'PUT /api/test',
      expect.objectContaining({ body: { name: 'Juan', password: '[redacted]' } })
    );
  });
});
