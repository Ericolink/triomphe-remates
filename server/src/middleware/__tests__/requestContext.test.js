const requestContext = require('../requestContext');

describe('requestContext', () => {
  test('asigna un req.id único, req.startTime y el header X-Request-Id', () => {
    const req1 = {};
    const req2 = {};
    const res1 = { setHeader: jest.fn() };
    const res2 = { setHeader: jest.fn() };

    requestContext(req1, res1, jest.fn());
    requestContext(req2, res2, jest.fn());

    expect(req1.id).toEqual(expect.any(String));
    expect(req1.id).not.toBe(req2.id);
    expect(typeof req1.startTime).toBe('bigint');
    expect(res1.setHeader).toHaveBeenCalledWith('X-Request-Id', req1.id);
  });

  test('llama a next()', () => {
    const next = jest.fn();
    requestContext({}, { setHeader: jest.fn() }, next);
    expect(next).toHaveBeenCalledTimes(1);
  });
});
