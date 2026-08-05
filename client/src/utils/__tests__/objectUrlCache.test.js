import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createObjectUrlCache } from '../objectUrlCache';

const makeFile = (name) => ({ name }); // stand-in: solo la identidad del objeto importa

describe('createObjectUrlCache', () => {
  let createObjectURL;
  let revokeObjectURL;

  beforeEach(() => {
    let counter = 0;
    createObjectURL = vi.fn(() => `blob:mock-${++counter}`);
    revokeObjectURL = vi.fn();
    globalThis.URL.createObjectURL = createObjectURL;
    globalThis.URL.revokeObjectURL = revokeObjectURL;
  });

  it('no crea URLs cuando el arreglo está vacío', () => {
    const cache = createObjectUrlCache();
    expect(cache.sync([])).toEqual([]);
    expect(createObjectURL).not.toHaveBeenCalled();
  });

  it('crea una URL por cada archivo nuevo', () => {
    const cache = createObjectUrlCache();
    const a = makeFile('a');
    const b = makeFile('b');
    const previews = cache.sync([a, b]);
    expect(createObjectURL).toHaveBeenCalledTimes(2);
    expect(previews).toEqual([
      { file: a, url: 'blob:mock-1' },
      { file: b, url: 'blob:mock-2' },
    ]);
  });

  it('reutiliza la URL de un archivo que sigue presente en lugar de recrearla', () => {
    const cache = createObjectUrlCache();
    const a = makeFile('a');
    const b = makeFile('b');
    cache.sync([a]);
    const previews = cache.sync([a, b]);
    expect(createObjectURL).toHaveBeenCalledTimes(2); // una para "a", una para "b"
    expect(previews[0]).toEqual({ file: a, url: 'blob:mock-1' });
    expect(revokeObjectURL).not.toHaveBeenCalled();
  });

  it('revoca exactamente una vez la URL de un archivo eliminado', () => {
    const cache = createObjectUrlCache();
    const a = makeFile('a');
    const b = makeFile('b');
    cache.sync([a, b]);
    cache.sync([b]);
    expect(revokeObjectURL).toHaveBeenCalledTimes(1);
    expect(revokeObjectURL).toHaveBeenCalledWith('blob:mock-1');
  });

  it('revoca todas las URLs cuando el arreglo se vacía por completo', () => {
    const cache = createObjectUrlCache();
    const a = makeFile('a');
    const b = makeFile('b');
    cache.sync([a, b]);
    cache.sync([]);
    expect(revokeObjectURL).toHaveBeenCalledTimes(2);
  });

  it('al reemplazar un archivo por otro, revoca el anterior y crea uno nuevo', () => {
    const cache = createObjectUrlCache();
    const a = makeFile('a');
    const c = makeFile('c');
    cache.sync([a]);
    const previews = cache.sync([c]);
    expect(revokeObjectURL).toHaveBeenCalledWith('blob:mock-1');
    expect(previews).toEqual([{ file: c, url: 'blob:mock-2' }]);
  });

  it('clear() revoca todo lo que quedaba vivo y deja el cache listo para empezar de nuevo', () => {
    const cache = createObjectUrlCache();
    const a = makeFile('a');
    cache.sync([a]);
    cache.clear();
    expect(revokeObjectURL).toHaveBeenCalledWith('blob:mock-1');

    const previews = cache.sync([a]);
    expect(createObjectURL).toHaveBeenCalledTimes(2); // se creó una nueva tras el clear
    expect(previews).toEqual([{ file: a, url: 'blob:mock-2' }]);
  });

  it('llamar sync repetidamente con el mismo arreglo no crea ni revoca nada extra', () => {
    const cache = createObjectUrlCache();
    const a = makeFile('a');
    const files = [a];
    cache.sync(files);
    cache.sync(files);
    cache.sync(files);
    expect(createObjectURL).toHaveBeenCalledTimes(1);
    expect(revokeObjectURL).not.toHaveBeenCalled();
  });
});
