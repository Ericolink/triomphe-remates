// Fase 3 del rediseño del CRM — el asesor debe entender un prospecto en 5-10 segundos sin
// salir de "Resumen": un badge de prioridad CALCULADO (nunca un campo que alguien tenga que
// mantener a mano) a partir de la urgencia declarada y de si la próxima acción ya venció,
// urgencia editable ahí mismo (evita el viaje a "Búsqueda" solo para actualizarla), y un
// atajo que cierra el ciclo "registrar interacción → agendar seguimiento" sin cambiar de
// pestaña por su cuenta.
import { useState } from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, within, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import LeadDetailWithActions from '../crm/LeadDetailWithActions';
import { getLeadById, updateLead, addLeadNote } from '../../../services/leadService';
import { getLeadTasks } from '../../../services/taskService';

vi.mock('../../../services/leadService', () => ({
  getLeadById: vi.fn(),
  updateLead: vi.fn().mockResolvedValue({ data: {} }),
  deleteLead: vi.fn(),
  closeLeadAsWon: vi.fn(),
  closeLeadAsLost: vi.fn(),
  sendLeadToWaitingList: vi.fn(),
  reopenLead: vi.fn(),
  getLeadNotes: vi.fn().mockResolvedValue({ data: [] }),
  addLeadNote: vi.fn(),
  deleteLeadNote: vi.fn(),
  addLeadProperty: vi.fn(),
  removeLeadProperty: vi.fn(),
}));
vi.mock('../../../services/activityService', () => ({
  getLeadActivities: vi.fn().mockResolvedValue({ data: [] }),
}));
vi.mock('../../../services/appointmentService', () => ({
  getLeadAppointments: vi.fn().mockResolvedValue({ data: [] }),
  createAppointment: vi.fn(),
}));
vi.mock('../../../services/taskService', () => ({
  getLeadTasks: vi.fn().mockResolvedValue({ data: [] }),
}));
vi.mock('../../../services/propertyService', () => ({
  getProperties: vi.fn().mockResolvedValue({ data: [] }),
}));
vi.mock('../../../store/authStore', () => ({
  default: (selector) => selector({ user: { id: 1, role: 'admin' } }),
}));
vi.mock('react-hot-toast', () => ({
  default: { success: vi.fn(), error: vi.fn() },
}));

const baseLead = {
  id: 101,
  name: 'Juan Pérez',
  phone: '6561111111',
  email: 'juan@test.com',
  pipelineStage: 'nuevo',
  type: 'contacto',
  source: 'directo',
  assignedToUserId: 1,
  budgetAmount: null,
  budgetNotSpecified: false,
  searchZone: '',
  minBedrooms: null,
  minBathrooms: null,
  desiredFeatures: '',
  urgency: null,
  createdAt: new Date().toISOString(),
};

function renderWithClient(ui) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(<QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>);
}

function Harness({ initial }) {
  const [selected, setSelected] = useState(initial);
  return <LeadDetailWithActions selected={selected} setSelected={setSelected} users={[]} />;
}

beforeEach(() => {
  vi.clearAllMocks();
  updateLead.mockResolvedValue({ data: {} });
});

describe('LeadDetailPanel — badge de prioridad calculado (Fase 3)', () => {
  it('muestra "Alta prioridad" cuando la urgencia declarada es "inmediata"', async () => {
    const lead = { ...baseLead, urgency: 'inmediata' };
    getLeadById.mockResolvedValue({ data: lead });
    renderWithClient(<Harness initial={lead} />);

    expect(await screen.findByText('🔥 Alta prioridad')).toBeInTheDocument();
  });

  it('muestra "Alta prioridad" cuando la próxima acción ya venció, aunque la urgencia no sea inmediata', async () => {
    const lead = { ...baseLead, urgency: '3_6_meses' };
    getLeadById.mockResolvedValue({ data: lead });
    getLeadTasks.mockResolvedValue({
      data: [
        {
          id: 1,
          leadId: lead.id,
          type: 'llamar',
          done: false,
          dueDate: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(), // ayer
        },
      ],
    });
    renderWithClient(<Harness initial={lead} />);

    expect(await screen.findByText('🔥 Alta prioridad')).toBeInTheDocument();
  });

  it('NO muestra el badge si no hay urgencia inmediata ni tarea vencida', async () => {
    const lead = { ...baseLead, urgency: 'mas_6_meses' };
    getLeadById.mockResolvedValue({ data: lead });
    renderWithClient(<Harness initial={lead} />);

    await screen.findByRole('dialog');
    expect(screen.queryByText('🔥 Alta prioridad')).not.toBeInTheDocument();
  });

  it('NO muestra el badge para un lead ya cerrado, aunque tenga urgencia inmediata', async () => {
    const lead = { ...baseLead, urgency: 'inmediata', pipelineStage: 'venta_realizada' };
    getLeadById.mockResolvedValue({ data: lead });
    renderWithClient(<Harness initial={lead} />);

    await screen.findByRole('dialog');
    expect(screen.queryByText('🔥 Alta prioridad')).not.toBeInTheDocument();
  });
});

describe('LeadDetailPanel — urgencia editable desde Resumen (Fase 3)', () => {
  it('cambiar la urgencia en "Qué busca" guarda vía el PUT genérico sin salir de Resumen', async () => {
    const lead = { ...baseLead };
    getLeadById.mockResolvedValue({ data: lead });
    const user = userEvent.setup();
    renderWithClient(<Harness initial={lead} />);

    const dialog = await screen.findByRole('dialog');
    const urgencySelect = within(dialog).getByLabelText('Urgencia');
    await user.selectOptions(urgencySelect, 'inmediata');

    await waitFor(() =>
      expect(updateLead).toHaveBeenCalledWith(lead.id, { urgency: 'inmediata' })
    );
  });
});

describe('LeadDetailPanel — atajo "registrar → agendar" (Fase 3)', () => {
  it('tras agregar una nota, ofrece saltar a Citas; al aceptar, cambia de pestaña sin recargar', async () => {
    const lead = { ...baseLead };
    getLeadById.mockResolvedValue({ data: lead });
    addLeadNote.mockResolvedValue({ data: {} });
    const user = userEvent.setup();
    renderWithClient(<Harness initial={lead} />);

    const dialog = await screen.findByRole('dialog');
    await user.click(within(dialog).getByRole('button', { name: 'Seguimiento' }));

    const composer = within(dialog).getByPlaceholderText(/escribe una nota/i);
    await user.type(composer, 'Confirmó interés en la propiedad');
    await user.click(within(dialog).getByRole('button', { name: 'Agregar' }));

    expect(
      await within(dialog).findByText(/interacción registrada.*agendar la siguiente acción/i)
    ).toBeInTheDocument();

    await user.click(within(dialog).getByRole('button', { name: 'Agendar' }));

    // Cambió a la pestaña Citas — su contenido (el botón de agendar cita) ya es visible.
    expect(within(dialog).getByText('Sin citas registradas.')).toBeInTheDocument();
  });

  it('escribir de nuevo en el compositor descarta el atajo pendiente', async () => {
    const lead = { ...baseLead };
    getLeadById.mockResolvedValue({ data: lead });
    addLeadNote.mockResolvedValue({ data: {} });
    const user = userEvent.setup();
    renderWithClient(<Harness initial={lead} />);

    const dialog = await screen.findByRole('dialog');
    await user.click(within(dialog).getByRole('button', { name: 'Seguimiento' }));
    const composer = within(dialog).getByPlaceholderText(/escribe una nota/i);
    await user.type(composer, 'Primera nota');
    await user.click(within(dialog).getByRole('button', { name: 'Agregar' }));
    await within(dialog).findByText(/interacción registrada/i);

    await user.type(composer, 'Empezando otra nota');

    expect(within(dialog).queryByText(/interacción registrada/i)).not.toBeInTheDocument();
  });
});
