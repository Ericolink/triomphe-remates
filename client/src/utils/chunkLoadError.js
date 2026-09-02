// Heurística de mejor esfuerzo para distinguir un chunk/import dinámico que no cargó (un
// deploy reciente cambió los hashes de archivo, o hubo un blip de red al pedir el chunk) de
// un bug real de renderizado. Los mensajes de "Failed to fetch dynamically imported
// module"/"error loading dynamically imported module"/"Importing a module script failed" no
// están estandarizados entre navegadores, así que esto SOLO afina qué se registra en
// consola (ver ErrorBoundary.jsx) — nunca cambia el comportamiento visible: en ambos casos
// el fallback y el botón de recarga son iguales, porque recargar es la respuesta correcta
// para los dos casos.
export function isChunkLoadError(error) {
  if (!error) return false;
  const message = String(error.message ?? error);
  return /failed to fetch dynamically imported module|error loading dynamically imported module|importing a module script failed|loading chunk .* failed/i.test(
    message
  );
}
