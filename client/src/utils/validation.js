// Regla compartida por los formularios de creación/edición de leads (CreateLeadModal,
// ProspectosSection): el presupuesto (budgetAmount) es opcional, pero si se captura un
// valor debe ser un número válido y no negativo.
export function isInvalidOptionalAmount(value) {
  return value.trim() !== '' && (Number.isNaN(Number(value)) || Number(value) < 0);
}
