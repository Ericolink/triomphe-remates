// Gestiona el ciclo de vida de Object URLs para un conjunto de File que cambia con el tiempo:
// reutiliza la URL de un archivo que sigue presente, crea una nueva solo para archivos nuevos,
// y revoca exactamente una vez la URL de cualquier archivo que deje de estar en el conjunto.
export const createObjectUrlCache = () => {
  const cache = new Map(); // File -> object URL

  const sync = (files) => {
    const currentFiles = new Set(files);
    for (const [file, url] of cache) {
      if (!currentFiles.has(file)) {
        URL.revokeObjectURL(url);
        cache.delete(file);
      }
    }

    return files.map((file) => {
      let url = cache.get(file);
      if (!url) {
        url = URL.createObjectURL(file);
        cache.set(file, url);
      }
      return { file, url };
    });
  };

  const clear = () => {
    for (const url of cache.values()) {
      URL.revokeObjectURL(url);
    }
    cache.clear();
  };

  return { sync, clear };
};
