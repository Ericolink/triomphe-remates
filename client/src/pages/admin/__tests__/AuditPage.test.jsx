import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import AuditPage from '../AuditPage';
import { getAuditLogs, getAuditSummary } from '../../../services/auditService';
import { getUsers } from '../../../services/usersService';

vi.mock('../../../services/auditService', () => ({
  getAuditLogs: vi.fn(),
  getAuditSummary: vi.fn(),
}));
vi.mock('../../../services/usersService', () => ({
  getUsers: vi.fn(),
}));

const baseLog = {
  id: 1,
  action: 'update',
  resource: 'lead',
  resourceId: 581,
  userId: 3,
  userName: 'Admin Triomphe',
  createdAt: new Date().toISOString(),
  result: 'success',
  area: 'CRM',
  subarea: 'Prospectos',
  label: 'Editar prospecto',
  icon: 'users',
  critical: false,
  resourceLabel: 'Prospecto #581',
  detail: {
    changes: [{ field: 'pipelineStage', before: 'contactado', after: 'visita_agendada' }],
  },
};

function makePage(overrides = {}) {
  return {
    data: [baseLog],
    pagination: { total: 1, page: 1, limit: 30, totalPages: 1, hasNext: false, hasPrevious: false },
    ...overrides,
  };
}

function renderPage() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <AuditPage />
    </QueryClientProvider>
  );
}

describe('AuditPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getUsers.mockResolvedValue({ data: [{ id: 3, name: 'Admin Triomphe' }], pagination: {} });
    getAuditSummary.mockResolvedValue({
      data: {
        total: 1,
        today: 1,
        activeUsersToday: 1,
        activeUsersTodayList: [{ id: 3, name: 'Admin Triomphe' }],
        criticalToday: 2,
      },
    });
  });

  it('muestra un spinner mientras carga', () => {
    getAuditLogs.mockReturnValue(new Promise(() => {}));
    renderPage();
    expect(document.querySelector('.animate-spin')).toBeInTheDocument();
  });

  it('muestra el estado vacío cuando no hay eventos', async () => {
    getAuditLogs.mockResolvedValue(makePage({ data: [], pagination: { ...makePage().pagination, total: 0 } }));
    renderPage();
    expect(await screen.findByText('No hay eventos con este filtro')).toBeInTheDocument();
  });

  it('muestra un mensaje de error si la petición falla', async () => {
    getAuditLogs.mockRejectedValue(new Error('network error'));
    renderPage();
    expect(
      await screen.findByText('No se pudo cargar el historial de actividad. Intenta de nuevo.')
    ).toBeInTheDocument();
  });

  it('renderiza un evento agrupado bajo el encabezado "HOY" con su área, etiqueta y usuario', async () => {
    getAuditLogs.mockResolvedValue(makePage());
    renderPage();

    expect(await screen.findByText('HOY')).toBeInTheDocument();
    const card = screen.getByText(/Editar prospecto/).closest('button');
    expect(within(card).getByText('CRM')).toBeInTheDocument();
    expect(within(card).getByText('Prospectos')).toBeInTheDocument();
    expect(within(card).getByText('Admin Triomphe')).toBeInTheDocument();
  });

  it('una fila histórica sin detail.changes se renderiza sin romper', async () => {
    getAuditLogs.mockResolvedValue(
      makePage({
        data: [
          {
            ...baseLog,
            id: 2,
            detail: null,
            label: 'Inicio de sesión',
            area: 'Autenticación',
            subarea: 'Acceso',
            resourceLabel: null,
          },
        ],
      })
    );
    renderPage();

    expect(await screen.findByText('Inicio de sesión')).toBeInTheDocument();
  });

  it('cambiar el filtro de área vuelve a pedir los logs con el área seleccionada', async () => {
    getAuditLogs.mockResolvedValue(makePage());
    const user = userEvent.setup();
    renderPage();

    await screen.findByText('Editar prospecto');
    getAuditLogs.mockClear();
    getAuditLogs.mockResolvedValue(makePage());

    const [areaSelect] = screen.getAllByRole('combobox');
    await user.selectOptions(areaSelect, 'Propiedades');

    await waitFor(() =>
      expect(getAuditLogs).toHaveBeenCalledWith(expect.objectContaining({ area: 'Propiedades' }))
    );
  });

  it('la búsqueda tiene debounce: no dispara una petición por cada tecla', async () => {
    getAuditLogs.mockResolvedValue(makePage());
    const user = userEvent.setup();
    renderPage();

    await screen.findByText('Editar prospecto');
    getAuditLogs.mockClear();

    const searchInput = screen.getByPlaceholderText(/Buscar por usuario/);
    await user.type(searchInput, 'Carlos');

    await waitFor(() => expect(getAuditLogs).toHaveBeenCalledWith(expect.objectContaining({ q: 'Carlos' })));
    // Con debounce, todas las teclas de "Carlos" deberían colapsar en (a lo sumo) una sola
    // petición nueva, no una por letra.
    expect(getAuditLogs.mock.calls.length).toBeLessThanOrEqual(2);
  });

  it('al hacer click en un evento se abre el detalle con la tabla de cambios', async () => {
    getAuditLogs.mockResolvedValue(makePage());
    const user = userEvent.setup();
    renderPage();

    const card = await screen.findByText(/Editar prospecto/);
    await user.click(card);

    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).getByText('pipelineStage')).toBeInTheDocument();
    expect(within(dialog).getByText('contactado')).toBeInTheDocument();
    expect(within(dialog).getByText('visita_agendada')).toBeInTheDocument();
  });

  it('muestra las métricas del resumen (KPIs)', async () => {
    getAuditLogs.mockResolvedValue(makePage());
    renderPage();

    await screen.findByText('Editar prospecto');
    expect(screen.getByText('Eventos registrados')).toBeInTheDocument();
    expect(screen.getByText('Acciones críticas hoy')).toBeInTheDocument();
  });

  it('click en el KPI "Acciones críticas hoy" filtra la lista a hoy+críticos', async () => {
    getAuditLogs.mockResolvedValue(makePage());
    const user = userEvent.setup();
    renderPage();

    await screen.findByText('Editar prospecto');
    getAuditLogs.mockClear();
    getAuditLogs.mockResolvedValue(makePage());

    await user.click(screen.getByText('Acciones críticas hoy'));

    await waitFor(() =>
      expect(getAuditLogs).toHaveBeenCalledWith(
        expect.objectContaining({ range: 'hoy', critical: 'true' })
      )
    );
  });

  it('click en el KPI "Hoy" filtra la lista al día de hoy', async () => {
    getAuditLogs.mockResolvedValue(makePage());
    const user = userEvent.setup();
    renderPage();

    await screen.findByText('Editar prospecto');
    getAuditLogs.mockClear();
    getAuditLogs.mockResolvedValue(makePage());

    await user.click(screen.getByText('Hoy', { selector: 'p' }));

    await waitFor(() => expect(getAuditLogs).toHaveBeenCalledWith(expect.objectContaining({ range: 'hoy' })));
  });

  it('click en "Usuarios activos hoy" muestra quiénes son y permite filtrar por uno', async () => {
    getAuditLogs.mockResolvedValue(makePage());
    const user = userEvent.setup();
    renderPage();

    await screen.findByText('Editar prospecto');
    await user.click(screen.getByText('Usuarios activos hoy'));

    const userButton = await screen.findByRole('button', { name: 'Admin Triomphe' });
    getAuditLogs.mockClear();
    getAuditLogs.mockResolvedValue(makePage());

    await user.click(userButton);

    await waitFor(() =>
      expect(getAuditLogs).toHaveBeenCalledWith(expect.objectContaining({ userId: '3', range: 'hoy' }))
    );
  });

  it('el toggle "Solo críticos" de los filtros también aplica ?critical=true', async () => {
    getAuditLogs.mockResolvedValue(makePage());
    const user = userEvent.setup();
    renderPage();

    await screen.findByText('Editar prospecto');
    getAuditLogs.mockClear();
    getAuditLogs.mockResolvedValue(makePage());

    await user.click(screen.getByRole('button', { name: /Solo críticos/ }));

    await waitFor(() => expect(getAuditLogs).toHaveBeenCalledWith(expect.objectContaining({ critical: 'true' })));
  });
});
