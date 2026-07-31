// AUDIT-013: el patrón page/limit → offset → findAndCountAll → {data, pagination} estaba
// copiado literalmente en 6 controllers — cualquier cambio al contrato de paginación
// exigía tocar los 6 a la vez.
// MAX_LIMIT evita que un caller pida limit=999999 y descargue la colección completa en
// "una sola página" — maxLimit es la única forma de subir ese tope, para el caso
// legítimo (Appointments) que necesita un techo más alto.
const MAX_LIMIT = 100;

const paginate = async (Model, { page = 1, limit = 10, maxLimit = MAX_LIMIT, ...queryOptions }) => {
  const pageNum = parseInt(page, 10) || 1;
  const limitNum = Math.min(parseInt(limit, 10) || 10, maxLimit);
  const offset = (pageNum - 1) * limitNum;

  const { count, rows } = await Model.findAndCountAll({
    ...queryOptions,
    offset,
    limit: limitNum,
  });

  const totalPages = Math.ceil(count / limitNum);

  return {
    data: rows,
    pagination: {
      total: count,
      page: pageNum,
      limit: limitNum,
      totalPages,
      hasNext: pageNum < totalPages,
      hasPrevious: pageNum > 1,
    },
  };
};

module.exports = { paginate, MAX_LIMIT };
