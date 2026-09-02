import { describe, it, expect } from 'vitest';
import { isChunkLoadError } from '../chunkLoadError';

describe('isChunkLoadError', () => {
  it('reconoce el mensaje típico de Chrome/Edge para un import() fallido', () => {
    expect(isChunkLoadError(new Error('Failed to fetch dynamically imported module: https://x/y.js'))).toBe(
      true
    );
  });

  it('reconoce el mensaje típico de Firefox', () => {
    expect(isChunkLoadError(new Error('error loading dynamically imported module'))).toBe(true);
  });

  it('reconoce el patrón "Loading chunk N failed" de otros bundlers', () => {
    expect(isChunkLoadError(new Error('Loading chunk 4 failed'))).toBe(true);
  });

  it('no confunde un TypeError normal de renderizado con un chunk fallido', () => {
    expect(isChunkLoadError(new TypeError("Cannot read properties of undefined (reading 'map')"))).toBe(
      false
    );
  });

  it('maneja error/undefined sin lanzar', () => {
    expect(isChunkLoadError(null)).toBe(false);
    expect(isChunkLoadError(undefined)).toBe(false);
  });
});
