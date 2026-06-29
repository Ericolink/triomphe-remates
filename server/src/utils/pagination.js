// AUDIT-013: el patrón page/limit → offset → findAndCountAll → {data, pagination} estaba
// copiado literalmente en 6 controllers — cualquier cambio al contrato de paginación
// exigía tocar los 6 a la vez.
const paginate = async (Model, { page = 1, limit = 10, ...queryOptions }) => {
  const pageNum = parseInt(page, 10) || 1;
  const limitNum = parseInt(limit, 10) || 10;
  const offset = (pageNum - 1) * limitNum;

  const { count, rows } = await Model.findAndCountAll({
    ...queryOptions,
    offset,
    limit: limitNum,
  });

  return {
    data: rows,
    pagination: {
      total: count,
      page: pageNum,
      limit: limitNum,
      totalPages: Math.ceil(count / limitNum),
    },
  };
};

module.exports = { paginate };
