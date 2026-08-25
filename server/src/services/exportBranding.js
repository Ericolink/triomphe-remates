// AUDIT-017: paleta de marca extraída de exportController.js — antes vivía mezclada con
// queries, helpers de imagen y la lógica de generación de Excel/PDF en un solo archivo
// de 838 líneas.
const PRIMARY = '#22273A';
const ACCENT = '#D2A057';
const BG_ALT = '#f0f4f8';
const TEXT = '#374151';
const ST_GREEN = '#10b981';
const ST_YELLOW = '#f59e0b';
const ST_RED = '#ef4444';
const ST_GRAY = '#9ca3af';

const PRIMARY_ARGB = 'FF22273A';
const ACCENT_ARGB = 'FFD2A057';
const BG_ALT_ARGB = 'FFf0f4f8';
const WHITE_ARGB = 'FFFFFFFF';
const TEXT_ARGB = 'FF374151';
const ST_GREEN_ARGB = 'FF10b981';
const ST_YELLOW_ARGB = 'FFf59e0b';
const ST_RED_ARGB = 'FFef4444';
const ST_GRAY_ARGB = 'FF9ca3af';

// 5 estados de propiedad (ver server/src/models/Property.js) — mismo criterio de color que
// client/src/utils/constants.js STATUS_*: apartado usa el dorado de marca (ACCENT) porque
// en_revision le tomó el amarillo al agregarse como estado nuevo y distinto.
const statusArgb = {
  disponible: ST_GREEN_ARGB,
  en_revision: ST_YELLOW_ARGB,
  apartado: ACCENT_ARGB,
  vendido: ST_RED_ARGB,
  de_vuelta: ST_GRAY_ARGB,
};
const statusHex = {
  disponible: ST_GREEN,
  en_revision: ST_YELLOW,
  apartado: ACCENT,
  vendido: ST_RED,
  de_vuelta: ST_GRAY,
};

module.exports = {
  PRIMARY,
  ACCENT,
  BG_ALT,
  TEXT,
  ST_GREEN,
  ST_YELLOW,
  PRIMARY_ARGB,
  ACCENT_ARGB,
  BG_ALT_ARGB,
  WHITE_ARGB,
  TEXT_ARGB,
  ST_GREEN_ARGB,
  ST_YELLOW_ARGB,
  ST_GRAY_ARGB,
  statusArgb,
  statusHex,
};
