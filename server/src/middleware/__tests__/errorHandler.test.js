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
});
