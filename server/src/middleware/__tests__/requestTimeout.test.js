const { EventEmitter } = require('events');
const { requestTimeout } = require('../requestTimeout');

// Unit test puro (sin supertest/Express real) para poder usar timeouts de milisegundos y
// fake timers sin que interfiera con I/O real de DB/red — ver loginBruteForce.test.js para
// la cobertura end-to-end del timeout ya wireado en la ruta /login.
function buildRes() {
  const res = new EventEmitter();
  res.headersSent = false;
  res.statusCode = null;
  res.body = null;
  res.status = function status(code) {
    this.statusCode = code;
    return this;
  };
  res.json = function json(body) {
    this.body = body;
    this.headersSent = true;
    this.emit('finish');
    return this;
  };
  return res;
}

describe('requestTimeout middleware', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  test('si el siguiente middleware nunca responde, tras el tiempo límite responde 503 genérico', () => {
    const req = {};
    const res = buildRes();
    const next = jest.fn(); // simula un handler colgado: llama a next() pero nunca responde

    requestTimeout(1000)(req, res, next);
    expect(next).toHaveBeenCalledTimes(1);
    expect(res.headersSent).toBe(false);

    jest.advanceTimersByTime(1000);

    expect(res.statusCode).toBe(503);
    expect(res.body).toEqual({ error: 'La solicitud tardó demasiado, intenta de nuevo.' });
  });

  test('si la respuesta ya se envió antes del límite, el timer no dispara una segunda respuesta', () => {
    const req = {};
    const res = buildRes();
    const next = () => {
      res.status(200).json({ ok: true });
    };

    requestTimeout(1000)(req, res, next);
    expect(res.body).toEqual({ ok: true });

    jest.advanceTimersByTime(5000);

    // No debe haber sido sobreescrito por el timeout una vez que la respuesta ya se envió.
    expect(res.statusCode).toBe(200);
    expect(res.body).toEqual({ ok: true });
  });

  test('limpia el timer cuando la conexión se cierra antes de responder (no deja el timer colgado)', () => {
    const req = {};
    const res = buildRes();
    const next = jest.fn();

    requestTimeout(1000)(req, res, next);
    res.emit('close');

    jest.advanceTimersByTime(1000);

    // Sin respuesta enviada: el close no debe haber disparado un 503 por su cuenta, y el
    // timer del timeout debe haber quedado cancelado por el listener de 'close'.
    expect(res.headersSent).toBe(false);
    expect(res.statusCode).toBeNull();
  });
});
