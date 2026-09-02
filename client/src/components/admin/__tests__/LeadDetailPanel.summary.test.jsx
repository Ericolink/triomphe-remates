// Fase 3 del rediseño del CRM — el asesor debe entender un prospecto en 5-10 segundos sin
// salir de "Resumen": un badge de "no se ha dado seguimiento" CALCULADO (nunca un campo que
// alguien tenga que mantener a mano) a partir de si ya existe alguna interacción humana real
// (llamada/whatsapp/email/visita/nota), urgencia editable ahí mismo (evita el viaje a la
// pestaña "Datos" solo para actualizarla), y un atajo que cierra el ciclo "registrar
// interacción → agendar seguimiento" sin cambiar de pestaña por su cuenta. El sistema de
// tareas ("próxima acción") que antes alimentaba este badge fue eliminado (pedido del dueño
// del negocio); el badge ya no depende de `lead.urgency` tampoco — solo de si alguien ya
// tocó al prospecto.
import { useState } from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, within, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import LeadDetailWithActions from '../crm/LeadDetailWithActions';
import { getLeadById, updateLead, addLeadNote, getLeadNotes } from '../../../services/leadService';
import { getLeadActivities } from '../../../services/activityService';

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
  return render(
    <MemoryRouter>
      <QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>
    </MemoryRouter>
  );
}

function Harness({ initial }) {
  const [selected, setSelected] = useState(initial);
  return <LeadDetailWithActions selected={selected} setSelected={setSelected} users={[]} />;
}

beforeEach(() => {
  vi.clearAllMocks();
  updateLead.mockResolvedValue({ data: {} });
});

describe('LeadDetailPanel — badge "no se ha dado seguimiento" calculado (Fase 3)', () => {
  it('muestra el badge cuando no hay ninguna nota ni actividad humana registrada', async () => {
    const lead = { ...baseLead };
    getLeadById.mockResolvedValue({ data: lead });
    getLeadNotes.mockResolvedValue({ data: [] });
    getLeadActivities.mockResolvedValue({ data: [] });
    renderWithClient(<Harness initial={lead} />);

    expect(await screen.findByText('No se ha dado seguimiento')).toBeInTheDocument();
  });

  it('las actividades autogeneradas (sistema/reasignación) no cuentan como seguimiento', async () => {
    const lead = { ...baseLead };
    getLeadById.mockResolvedValue({ data: lead });
    getLeadNotes.mockResolvedValue({ data: [] });
    getLeadActivities.mockResolvedValue({
      data: [
        { id: 1, type: 'sistema', content: 'Prospecto creado', occurredAt: new Date().toISOString() },
        { id: 2, type: 'reasignacion', content: 'Responsable cambiado', occurredAt: new Date().toISOString() },
      ],
    });
    renderWithClient(<Harness initial={lead} />);

    expect(await screen.findByText('No se ha dado seguimiento')).toBeInTheDocument();
  });

  it('NO muestra el badge si ya existe una nota', async () => {
    const lead = { ...baseLead };
    getLeadById.mockResolvedValue({ data: lead });
    getLeadNotes.mockResolvedValue({
      data: [{ id: 1, content: 'Llamé, quedó de confirmar', createdAt: new Date().toISOString() }],
    });
    getLeadActivities.mockResolvedValue({ data: [] });
    renderWithClient(<Harness initial={lead} />);

    await screen.findByRole('dialog');
    expect(screen.queryByText('No se ha dado seguimiento')).not.toBeInTheDocument();
  });

  it('NO muestra el badge si ya existe una actividad humana (llamada)', async () => {
    const lead = { ...baseLead };
    getLeadById.mockResolvedValue({ data: lead });
    getLeadNotes.mockResolvedValue({ data: [] });
    getLeadActivities.mockResolvedValue({
      data: [{ id: 1, type: 'llamada', content: 'Llamada realizada', occurredAt: new Date().toISOString() }],
    });
    renderWithClient(<Harness initial={lead} />);

    await screen.findByRole('dialog');
    expect(screen.queryByText('No se ha dado seguimiento')).not.toBeInTheDocument();
  });

  it('NO muestra el badge para un lead ya cerrado, aunque no tenga ninguna interacción registrada', async () => {
    const lead = { ...baseLead, pipelineStage: 'venta_realizada' };
    getLeadById.mockResolvedValue({ data: lead });
    getLeadNotes.mockResolvedValue({ data: [] });
    getLeadActivities.mockResolvedValue({ data: [] });
    renderWithClient(<Harness initial={lead} />);

    await screen.findByRole('dialog');
    expect(screen.queryByText('No se ha dado seguimiento')).not.toBeInTheDocument();
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
