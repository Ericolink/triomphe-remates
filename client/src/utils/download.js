// Dispara la descarga de un blob de respuesta (Excel/PDF) en el navegador.
export const downloadBlob = (data, filename) => {
  const url = window.URL.createObjectURL(new Blob([data]));
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  window.URL.revokeObjectURL(url);
};

// AAAA-MM-DD_HH-mm-ss en hora local — usado para nombrar los archivos de Excel/PDF
// descargados (antes usaban Date.now(), un timestamp en ms ilegible para el usuario).
// Sin ":" ni espacios para que el nombre sea válido en cualquier SO.
export const fileTimestamp = (date = new Date()) => {
  const pad = (n) => String(n).padStart(2, '0');
  return (
    `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}` +
    `_${pad(date.getHours())}-${pad(date.getMinutes())}-${pad(date.getSeconds())}`
  );
};
