const { MAX_BATCH_IDS, validateBatchIds } = require('../batchValidation');

describe('validateBatchIds', () => {
  test('acepta un arreglo válido de enteros positivos', () => {
    const result = validateBatchIds([1, 2, 3]);
    expect(result.error).toBeUndefined();
    expect(result.ids).toEqual([1, 2, 3]);
  });

  test('normaliza IDs recibidos como strings numéricos', () => {
    const result = validateBatchIds(['1', '2']);
    expect(result.ids).toEqual([1, 2]);
  });

  test('rechaza cuando ids no es un arreglo', () => {
    expect(validateBatchIds('1,2,3').error).toMatch(/arreglo/i);
    expect(validateBatchIds(undefined).error).toMatch(/arreglo/i);
    expect(validateBatchIds({ 0: 1 }).error).toMatch(/arreglo/i);
  });

  test('rechaza un arreglo vacío', () => {
    expect(validateBatchIds([]).error).toMatch(/requeridos/i);
  });

  test('rechaza un arreglo que excede el límite por defecto', () => {
    const tooMany = Array.from({ length: MAX_BATCH_IDS + 1 }, (_, i) => i + 1);
    const result = validateBatchIds(tooMany);
    expect(result.error).toContain(String(MAX_BATCH_IDS));
  });

  test('acepta exactamente el límite', () => {
    const exact = Array.from({ length: MAX_BATCH_IDS }, (_, i) => i + 1);
    const result = validateBatchIds(exact);
    expect(result.error).toBeUndefined();
    expect(result.ids).toHaveLength(MAX_BATCH_IDS);
  });

  test('respeta un límite personalizado', () => {
    const result = validateBatchIds([1, 2, 3], { maxIds: 2 });
    expect(result.error).toMatch(/2/);
  });

  test('rechaza elementos no enteros o no positivos', () => {
    expect(validateBatchIds([1, 'abc']).error).toMatch(/inválido/i);
    expect(validateBatchIds([1, null]).error).toMatch(/inválido/i);
    expect(validateBatchIds([1, 2.5]).error).toMatch(/inválido/i);
    expect(validateBatchIds([1, -1]).error).toMatch(/inválido/i);
    expect(validateBatchIds([1, 0]).error).toMatch(/inválido/i);
  });
});
