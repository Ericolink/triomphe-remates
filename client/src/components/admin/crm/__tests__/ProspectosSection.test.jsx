// Filtros de búsqueda del CRM (línea de negocio / método de pago) agregados a la lista de
// prospectos — ver server/src/__tests__/leadFilters.integration.test.js para el equivalente
// de backend. Cubre: render de los selects, cambio de cada filtro, "Limpiar filtros", los
// parámetros exactos que se mandan a getLeads, y los estados de loading/sin resultados.
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import ProspectosSection from '../ProspectosSection';
import { getLeads, getLeadsCountByResponsible } from '../../../../services/leadService';
import { getUsers } from '../../../../services/usersService';

vi.mock('../../../../services/leadService', () => ({
  getLeads: vi.fn(),
  getLeadsCountByResponsible: vi.fn(),
  getLeadById: vi.fn(),
  createLead: vi.fn(),
  updateLead: vi.fn(),
  deleteLead: vi.fn(),
  batchUpdateLeads: vi.fn(),
  batchDeleteLeads: vi.fn(),
  closeLeadAsWon: vi.fn(),
  closeLeadAsLost: vi.fn(),
  sendLeadToWaitingList: vi.fn(),
  reopenLead: vi.fn(),
}));
vi.mock('../../../../services/usersService', () => ({
  getUsers: vi.fn(),
}));
// mockUserRole permite que los tests del nuevo bloque "Responsable" (más abajo) simulen
// coordinador_ventas/asesor_ventas sin duplicar el mock completo del store — por defecto
// admin, igual que antes de agregar el filtro de responsable.
let mockUserRole = 'admin';
vi.mock('../../../../store/authStore', () => ({
  default: (selector) => selector({ user: { id: 1, role: mockUserRole } }),
}));
vi.mock('react-hot-toast', () => ({
  default: { success: vi.fn(), error: vi.fn() },
}));

function makePage(overrides = {}) {
  return {
    data: [],
    pagination: { total: 0, page: 1, limit: 20, totalPages: 0, hasNext: false, hasPrevious: false },
    ...overrides,
  };
}

const leadA = {
  id: 1,
  name: 'Juan Pérez',
  phone: '6561111111',
  email: null,
  type: 'contacto',
  source: 'directo',
  pipelineStage: 'nuevo',
  createdAt: new Date().toISOString(),
  businessLine: 'remate',
  paymentMethod: 'contado',
};

function renderSection() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={['/admin/crm?tab=prospectos']}>
        <ProspectosSection />
      </MemoryRouter>
    </QueryClientProvider>
  );
}

describe('ProspectosSection — filtros de línea de negocio / método de pago', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getUsers.mockResolvedValue({ data: [{ id: 1, name: 'Admin Triomphe' }], pagination: {} });
    getLeadsCountByResponsible.mockResolvedValue({ data: [] });
    getLeads.mockResolvedValue(makePage());
  });

  it('muestra un spinner mientras carga', () => {
    getLeads.mockReturnValue(new Promise(() => {}));
    renderSection();
    expect(document.querySelector('.animate-spin')).toBeInTheDocument();
  });

  it('renderiza los tres selects de filtro con su opción "todos"', async () => {
    renderSection();
    await waitFor(() => expect(getLeads).toHaveBeenCalled());

    expect(screen.getByText('Todas las etapas')).toBeInTheDocument();
    expect(screen.getByText('Todas las líneas de negocio')).toBeInTheDocument();
    expect(screen.getByText('Todos los métodos de pago')).toBeInTheDocument();
  });

  it('sin filtros no manda businessLine/paymentMethod en la petición', async () => {
    renderSection();
    await waitFor(() =>
      expect(getLeads).toHaveBeenCalledWith(
        expect.objectContaining({ businessLine: undefined, paymentMethod: undefined })
      )
    );
  });

  it('cambiar el filtro de línea de negocio vuelve a pedir la lista con ese valor', async () => {
    getLeads.mockResolvedValue(makePage({ data: [leadA], pagination: { ...makePage().pagination, total: 1 } }));
    const user = userEvent.setup();
    renderSection();
    await waitFor(() => expect(getLeads).toHaveBeenCalled());
    getLeads.mockClear();

    const businessLineSelect = screen.getByDisplayValue('Todas las líneas de negocio');
    await user.selectOptions(businessLineSelect, 'remate');

    await waitFor(() =>
      expect(getLeads).toHaveBeenCalledWith(expect.objectContaining({ businessLine: 'remate' }))
    );
  });

  it('cambiar el filtro de método de pago vuelve a pedir la lista con ese valor', async () => {
    const user = userEvent.setup();
    renderSection();
    await waitFor(() => expect(getLeads).toHaveBeenCalled());
    getLeads.mockClear();

    const paymentSelect = screen.getByDisplayValue('Todos los métodos de pago');
    await user.selectOptions(paymentSelect, 'contado');

    await waitFor(() =>
      expect(getLeads).toHaveBeenCalledWith(expect.objectContaining({ paymentMethod: 'contado' }))
    );
  });

  it('combina businessLine + paymentMethod en la misma petición', async () => {
    const user = userEvent.setup();
    renderSection();
    await waitFor(() => expect(getLeads).toHaveBeenCalled());

    await user.selectOptions(screen.getByDisplayValue('Todas las líneas de negocio'), 'remate');
    await user.selectOptions(screen.getByDisplayValue('Todos los métodos de pago'), 'contado');

    await waitFor(() =>
      expect(getLeads).toHaveBeenLastCalledWith(
        expect.objectContaining({ businessLine: 'remate', paymentMethod: 'contado' })
      )
    );
  });

  it('"Limpiar filtros" solo aparece con un filtro activo y lo regresa todo a los valores por default', async () => {
    const user = userEvent.setup();
    renderSection();
    await waitFor(() => expect(getLeads).toHaveBeenCalled());

    expect(screen.queryByText('Limpiar filtros')).not.toBeInTheDocument();

    await user.selectOptions(screen.getByDisplayValue('Todas las líneas de negocio'), 'remate');
    const [clearButton] = await screen.findAllByText('Limpiar filtros');
    getLeads.mockClear();

    await user.click(clearButton);

    expect(screen.queryByText('Limpiar filtros')).not.toBeInTheDocument();
    await waitFor(() =>
      expect(getLeads).toHaveBeenLastCalledWith(
        expect.objectContaining({ businessLine: undefined, paymentMethod: undefined, search: undefined })
      )
    );
  });

  it('muestra un estado sin resultados distinto cuando hay filtros activos, con acceso directo a limpiarlos', async () => {
    getLeads.mockResolvedValue(makePage());
    const user = userEvent.setup();
    renderSection();
    await waitFor(() => expect(getLeads).toHaveBeenCalled());

    await user.selectOptions(screen.getByDisplayValue('Todas las líneas de negocio'), 'inversion');

    expect(
      await screen.findByText('Ningún prospecto coincide con los filtros seleccionados.')
    ).toBeInTheDocument();
  });
});

describe('ProspectosSection — tarjeta de prospecto: línea de negocio y responsable asignado', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getUsers.mockResolvedValue({ data: [{ id: 1, name: 'Admin Triomphe' }], pagination: {} });
    getLeadsCountByResponsible.mockResolvedValue({ data: [] });
  });

  // El label de línea de negocio ("Remates Bancarios") también aparece como <option> del
  // select de filtro — se escopa la búsqueda al primer role="button" que envuelve el nombre
  // del prospecto (la tarjeta móvil de GradientListCard; jsdom no evalúa media queries, así
  // que la fila de la tabla desktop con el mismo dato también está en el DOM y hace que
  // findByText/queryByText fallen por ambigüedad — de ahí getAllByText) para no confundirla
  // con esa opción del filtro.
  const findCard = async (name) => {
    const [match] = await screen.findAllByText(name);
    return match.closest('[role="button"]');
  };

  it('muestra la línea de negocio del prospecto en la tarjeta', async () => {
    getLeads.mockResolvedValue(makePage({ data: [leadA], pagination: { ...makePage().pagination, total: 1 } }));
    renderSection();

    const card = await findCard('Juan Pérez');
    expect(within(card).getByText('Remates Bancarios')).toBeInTheDocument();
  });

  it('muestra el nombre del usuario responsable cuando el prospecto está asignado', async () => {
    const assigned = { ...leadA, assignedUser: { id: 2, name: 'Carlos Asesor' } };
    getLeads.mockResolvedValue(makePage({ data: [assigned], pagination: { ...makePage().pagination, total: 1 } }));
    renderSection();

    const card = await findCard('Juan Pérez');
    expect(within(card).getByText('Carlos Asesor')).toBeInTheDocument();
  });

  it('muestra "Sin asignar" cuando el prospecto no tiene responsable', async () => {
    const unassigned = { ...leadA, assignedUser: null };
    getLeads.mockResolvedValue(
      makePage({ data: [unassigned], pagination: { ...makePage().pagination, total: 1 } })
    );
    renderSection();

    const card = await findCard('Juan Pérez');
    expect(within(card).getByText('Sin asignar')).toBeInTheDocument();
  });

  it('no muestra ningún badge de línea de negocio si el prospecto no tiene una asignada', async () => {
    const noLine = { ...leadA, businessLine: null };
    getLeads.mockResolvedValue(makePage({ data: [noLine], pagination: { ...makePage().pagination, total: 1 } }));
    renderSection();

    const card = await findCard('Juan Pérez');
    expect(within(card).queryByText('Remates Bancarios')).not.toBeInTheDocument();
  });
});

// Filtro/resumen "Responsable" — ver server/src/__tests__/leadResponsibleFilter.integration.test.js
// para la cobertura equivalente de backend (autorización/filtro/combinaciones/paginación/
// seguridad). Aquí solo se cubre el cableado de UI: que el selector exista y mande el
// parámetro correcto, que sea mutuamente excluyente con "Mis prospectos", que el resumen por
// responsable pinte y funcione como atajo, y que ambos estén ocultos para roles que no deben
// verlos (el backend es quien realmente hace cumplir esto — canFilterLeadsByResponsible en el
// frontend es solo gating de UI, ver utils/permissions.js).
describe('ProspectosSection — filtro y resumen por Responsable (admin/asistente_administrativo)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUserRole = 'admin';
    getUsers.mockResolvedValue({
      data: [
        { id: 1, name: 'Admin Triomphe', isActive: true },
        { id: 2, name: 'Asesor Uno', isActive: true },
        { id: 3, name: 'Asesor Dos', isActive: true },
      ],
      pagination: {},
    });
    getLeadsCountByResponsible.mockResolvedValue({ data: [] });
    getLeads.mockResolvedValue(makePage());
  });

  it('admin ve el selector de Responsable con "Todos", "Sin asignar" y los usuarios activos', async () => {
    renderSection();
    const select = await screen.findByLabelText('Filtrar por responsable');
    await waitFor(() => expect(within(select).getByText('Asesor Uno')).toBeInTheDocument());

    expect(within(select).getByText('Responsable: todos')).toBeInTheDocument();
    expect(within(select).getByText('Sin asignar')).toBeInTheDocument();
    expect(within(select).getByText('Asesor Dos')).toBeInTheDocument();
  });

  it('seleccionar un usuario en el filtro manda ese id como assignedToUserId', async () => {
    const user = userEvent.setup();
    renderSection();
    const select = await screen.findByLabelText('Filtrar por responsable');
    await waitFor(() => expect(within(select).getByText('Asesor Uno')).toBeInTheDocument());
    await waitFor(() => expect(getLeads).toHaveBeenCalled());
    getLeads.mockClear();

    await user.selectOptions(select, '2');

    await waitFor(() =>
      expect(getLeads).toHaveBeenCalledWith(expect.objectContaining({ assignedToUserId: '2' }))
    );
  });

  it('seleccionar "Sin asignar" manda assignedToUserId=unassigned', async () => {
    const user = userEvent.setup();
    renderSection();
    await waitFor(() => expect(getLeads).toHaveBeenCalled());
    getLeads.mockClear();

    await user.selectOptions(screen.getByLabelText('Filtrar por responsable'), 'unassigned');

    await waitFor(() =>
      expect(getLeads).toHaveBeenCalledWith(
        expect.objectContaining({ assignedToUserId: 'unassigned' })
      )
    );
  });

  it('elegir un responsable y "Mis prospectos" son mutuamente excluyentes', async () => {
    const user = userEvent.setup();
    renderSection();
    const select = await screen.findByLabelText('Filtrar por responsable');
    await waitFor(() => expect(within(select).getByText('Asesor Uno')).toBeInTheDocument());
    await waitFor(() => expect(getLeads).toHaveBeenCalled());

    await user.click(screen.getByText('Mis prospectos'));
    await waitFor(() =>
      expect(getLeads).toHaveBeenLastCalledWith(expect.objectContaining({ assignedToUserId: 1 }))
    );

    await user.selectOptions(select, '2');
    await waitFor(() =>
      expect(getLeads).toHaveBeenLastCalledWith(expect.objectContaining({ assignedToUserId: '2' }))
    );
    expect(screen.getByText('Mis prospectos').closest('button')).not.toHaveClass('bg-primary-600');
  });

  it('muestra el resumen "Prospectos por responsable" con conteos, y un clic filtra la lista', async () => {
    getLeadsCountByResponsible.mockResolvedValue({
      data: [
        { userId: 2, user: { id: 2, name: 'Asesor Uno' }, count: 5 },
        { userId: null, user: null, count: 2 },
      ],
    });
    const user = userEvent.setup();
    renderSection();
    await waitFor(() => expect(getLeadsCountByResponsible).toHaveBeenCalled());

    expect(await screen.findByText('Asesor Uno — 5')).toBeInTheDocument();
    expect(screen.getByText('Sin asignar — 2')).toBeInTheDocument();

    getLeads.mockClear();
    await user.click(screen.getByText('Asesor Uno — 5'));
    await waitFor(() =>
      expect(getLeads).toHaveBeenCalledWith(expect.objectContaining({ assignedToUserId: '2' }))
    );
  });

  it('coordinador_ventas no ve el selector de Responsable ni el resumen', async () => {
    mockUserRole = 'coordinador_ventas';
    renderSection();
    await waitFor(() => expect(getLeads).toHaveBeenCalled());

    expect(screen.queryByLabelText('Filtrar por responsable')).not.toBeInTheDocument();
    expect(screen.queryByText(/Prospectos por responsable/)).not.toBeInTheDocument();
    expect(getLeadsCountByResponsible).not.toHaveBeenCalled();
  });

  it('asesor_ventas no ve el selector de Responsable ni el resumen', async () => {
    mockUserRole = 'asesor_ventas';
    renderSection();
    await waitFor(() => expect(getLeads).toHaveBeenCalled());

    expect(screen.queryByLabelText('Filtrar por responsable')).not.toBeInTheDocument();
    expect(screen.queryByText(/Prospectos por responsable/)).not.toBeInTheDocument();
    expect(getLeadsCountByResponsible).not.toHaveBeenCalled();
  });
});
