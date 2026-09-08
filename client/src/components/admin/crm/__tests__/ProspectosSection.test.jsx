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
import { getLeads } from '../../../../services/leadService';
import { getUsers } from '../../../../services/usersService';

vi.mock('../../../../services/leadService', () => ({
  getLeads: vi.fn(),
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
vi.mock('../../../../store/authStore', () => ({
  default: (selector) => selector({ user: { id: 1, role: 'admin' } }),
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
  });

  // El label de línea de negocio ("Remates Bancarios") también aparece como <option> del
  // select de filtro — se escopa la búsqueda a la tarjeta del prospecto (role="button" de
  // GradientListCard) para no confundirla con esa opción del filtro.
  const findCard = async (name) => (await screen.findByText(name)).closest('[role="button"]');

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
