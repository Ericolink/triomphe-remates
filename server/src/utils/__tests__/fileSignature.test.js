const { isValidImageBuffer } = require('../fileSignature');

describe('isValidImageBuffer', () => {
  test('accepts JPEG magic bytes', () => {
    const buf = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10]);
    expect(isValidImageBuffer(buf)).toBe(true);
  });

  test('accepts PNG magic bytes', () => {
    const buf = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a]);
    expect(isValidImageBuffer(buf)).toBe(true);
  });

  test('accepts WEBP (RIFF....WEBP)', () => {
    const buf = Buffer.concat([
      Buffer.from([0x52, 0x49, 0x46, 0x46]), // RIFF
      Buffer.from([0x00, 0x00, 0x00, 0x00]), // size (irrelevante para el test)
      Buffer.from('WEBP', 'ascii'),
    ]);
    expect(isValidImageBuffer(buf)).toBe(true);
  });

  test('rejects RIFF que no es WEBP', () => {
    const buf = Buffer.concat([
      Buffer.from([0x52, 0x49, 0x46, 0x46]),
      Buffer.from([0x00, 0x00, 0x00, 0x00]),
      Buffer.from('AVI ', 'ascii'),
    ]);
    expect(isValidImageBuffer(buf)).toBe(false);
  });

  test('rechaza un archivo HTML disfrazado de imagen', () => {
    const buf = Buffer.from('<html><script>alert(1)</script></html>');
    expect(isValidImageBuffer(buf)).toBe(false);
  });

  test('rechaza buffer vacío/null', () => {
    expect(isValidImageBuffer(Buffer.alloc(0))).toBe(false);
    expect(isValidImageBuffer(null)).toBe(false);
  });
});
