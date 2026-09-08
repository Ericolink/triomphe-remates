// El autoguardado por campo (saveField, CRM-006) se reemplazó por un guardado diferido:
// editar un campo lo deja "en cola" (ver queueChange en LeadDetailPanel.jsx) sin mandar
// ningún PUT, y solo al intentar salir del prospecto (cerrar el detalle o abrir otro)
// aparece PendingChangesModal resumiendo qué cambió, con Guardar/Descartar/Seguir editando.
// Reemplaza a LeadDetailPanel.autosave.test.jsx, cuyo escenario (respuestas de red fuera de
// orden entre dos guardados por-campo) ya no puede ocurrir: ahora hay un solo PUT, mandado
// una sola vez, con todos los campos acumulados.
import { useState } from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, within, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import LeadDetailPanel from '../LeadDetailPanel';
import LeadDetailModals from '../crm/LeadDetailModals';
import useLeadDetailActions from '../crm/useLeadDetailActions';
import { getLeadById, updateLead } from '../../../services/leadService';

vi.mock('../../../services/leadService', () => ({
  getLeadById: vi.fn(),
  updateLead: vi.fn(),
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
const toast = (await import('react-hot-toast')).default;

const leadA = {
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
  createdAt: new Date().toISOString(),
};
const leadB = { ...leadA, id: 202, name: 'María López' };

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

// Monta LeadDetailPanel + LeadDetailModals + el hook real (sin pasar por
// ProspectosSection/CalendarioSection) — el botón "ir a B" ejercita exactamente
// `requestSelectLead`, el mismo camino que un clic en la lista de Prospectos.
function Harness({ initial }) {
  const [selected, setSelected] = useState(initial);
  const actions = useLeadDetailActions({ selected, setSelected });
  return (
    <>
      <button onClick={() => actions.requestSelectLead(leadB)}>ir a B</button>
      {selected && (
        <LeadDetailPanel
          key={selected.id}
          selected={selected}
          onDeselect={actions.requestDeselect}
          onDelete={actions.handleDelete}
          pendingChanges={actions.pendingChanges}
          onFieldChange={actions.stageFieldChange}
          users={[]}
          onOpenStagePicker={() => {}}
          onChangeStage={actions.attemptStageChange}
        />
      )}
      <LeadDetailModals actions={actions} />
    </>
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  getLeadById.mockImplementation((id) =>
    Promise.resolve({ data: id === leadA.id ? leadA : leadB })
  );
  updateLead.mockResolvedValue({ data: {} });
});

describe('LeadDetailPanel — guardado diferido con confirmación al salir', () => {
  it('editar un campo no manda ningún PUT — solo lo deja en cola', async () => {
    const user = userEvent.setup();
    renderWithClient(<Harness initial={leadA} />);

    const nameInput = await screen.findByLabelText('Nombre');
    await waitFor(() => expect(nameInput).toHaveValue('Juan Pérez'));

    await user.clear(nameInput);
    await user.type(nameInput, 'Juan Editado');
    nameInput.blur();

    expect(await screen.findByText('Cambio sin guardar')).toBeInTheDocument();
    expect(updateLead).not.toHaveBeenCalled();
  });

  it('cerrar el detalle con cambios pendientes abre el modal resumiendo qué cambió', async () => {
    const user = userEvent.setup();
    renderWithClient(<Harness initial={leadA} />);

    const nameInput = await screen.findByLabelText('Nombre');
    const phoneInput = screen.getByLabelText('Teléfono');
    await waitFor(() => expect(nameInput).toHaveValue('Juan Pérez'));

    await user.clear(nameInput);
    await user.type(nameInput, 'Juan Editado');
    nameInput.blur();
    await user.clear(phoneInput);
    await user.type(phoneInput, '6569998888');
    phoneInput.blur();

    await user.click(screen.getByTitle('Cerrar detalle'));

    const dialog = await screen.findByRole('dialog', { name: 'Cambios sin guardar' });
    expect(within(dialog).getByText('Nombre')).toBeInTheDocument();
    expect(within(dialog).getByText('Juan Pérez')).toBeInTheDocument();
    expect(within(dialog).getByText('Juan Editado')).toBeInTheDocument();
    expect(within(dialog).getByText('Teléfono')).toBeInTheDocument();
    expect(updateLead).not.toHaveBeenCalled();
  });

  it('"Guardar cambios" manda un solo PUT con todos los campos acumulados y cierra el detalle', async () => {
    const user = userEvent.setup();
    renderWithClient(<Harness initial={leadA} />);

    const nameInput = await screen.findByLabelText('Nombre');
    const phoneInput = screen.getByLabelText('Teléfono');
    await waitFor(() => expect(nameInput).toHaveValue('Juan Pérez'));

    await user.clear(nameInput);
    await user.type(nameInput, 'Juan Editado');
    nameInput.blur();
    await user.clear(phoneInput);
    await user.type(phoneInput, '6569998888');
    phoneInput.blur();

    await user.click(screen.getByTitle('Cerrar detalle'));
    await user.click(await screen.findByRole('button', { name: 'Guardar cambios' }));

    await waitFor(() =>
      expect(updateLead).toHaveBeenCalledWith(leadA.id, {
        name: 'Juan Editado',
        phone: '6569998888',
      })
    );
    expect(updateLead).toHaveBeenCalledTimes(1);
    expect(toast.success).toHaveBeenCalledWith('Cambios guardados');
    await waitFor(() => expect(screen.queryByLabelText('Nombre')).not.toBeInTheDocument());
  });

  it('"Descartar" cierra el detalle sin mandar ningún PUT', async () => {
    const user = userEvent.setup();
    renderWithClient(<Harness initial={leadA} />);

    const nameInput = await screen.findByLabelText('Nombre');
    await waitFor(() => expect(nameInput).toHaveValue('Juan Pérez'));
    await user.clear(nameInput);
    await user.type(nameInput, 'Juan Editado');
    nameInput.blur();

    await user.click(screen.getByTitle('Cerrar detalle'));
    await user.click(await screen.findByRole('button', { name: 'Descartar' }));

    await waitFor(() => expect(screen.queryByLabelText('Nombre')).not.toBeInTheDocument());
    expect(updateLead).not.toHaveBeenCalled();
  });

  it('"Seguir editando" cierra el modal sin descartar — el prospecto sigue abierto con el cambio intacto', async () => {
    const user = userEvent.setup();
    renderWithClient(<Harness initial={leadA} />);

    const nameInput = await screen.findByLabelText('Nombre');
    await waitFor(() => expect(nameInput).toHaveValue('Juan Pérez'));
    await user.clear(nameInput);
    await user.type(nameInput, 'Juan Editado');
    nameInput.blur();

    await user.click(screen.getByTitle('Cerrar detalle'));
    await user.click(await screen.findByRole('button', { name: 'Seguir editando' }));

    // AnimatePresence anima la salida del modal antes de desmontarlo.
    await waitFor(() =>
      expect(screen.queryByRole('dialog', { name: 'Cambios sin guardar' })).not.toBeInTheDocument()
    );
    expect(screen.getByLabelText('Nombre')).toHaveValue('Juan Editado');
    expect(screen.getByText('Cambio sin guardar')).toBeInTheDocument();
    expect(updateLead).not.toHaveBeenCalled();
  });

  it('si el guardado falla, el modal se queda abierto (con los cambios intactos) y avisa por toast', async () => {
    updateLead.mockRejectedValueOnce({ response: { data: { error: 'Error de red' } } });
    const user = userEvent.setup();
    renderWithClient(<Harness initial={leadA} />);

    const nameInput = await screen.findByLabelText('Nombre');
    await waitFor(() => expect(nameInput).toHaveValue('Juan Pérez'));
    await user.clear(nameInput);
    await user.type(nameInput, 'Juan Editado');
    nameInput.blur();

    await user.click(screen.getByTitle('Cerrar detalle'));
    await user.click(await screen.findByRole('button', { name: 'Guardar cambios' }));

    await waitFor(() => expect(toast.error).toHaveBeenCalledWith('Error de red'));
    expect(await screen.findByRole('dialog', { name: 'Cambios sin guardar' })).toBeInTheDocument();
    expect(screen.getByLabelText('Nombre')).toBeInTheDocument();
  });

  it('elegir otro prospecto de la lista con cambios pendientes también abre el modal (no solo cerrar)', async () => {
    const user = userEvent.setup();
    renderWithClient(<Harness initial={leadA} />);

    const nameInput = await screen.findByLabelText('Nombre');
    await waitFor(() => expect(nameInput).toHaveValue('Juan Pérez'));
    await user.clear(nameInput);
    await user.type(nameInput, 'Juan Editado');
    nameInput.blur();

    await user.click(screen.getByRole('button', { name: 'ir a B' }));

    expect(await screen.findByRole('dialog', { name: 'Cambios sin guardar' })).toBeInTheDocument();
    // Todavía no cambió a B — sigue mostrando A hasta que se resuelva el modal.
    expect(screen.getByLabelText('Nombre')).toHaveValue('Juan Editado');
    expect(updateLead).not.toHaveBeenCalled();

    await user.click(screen.getByRole('button', { name: 'Descartar' }));

    await waitFor(() => expect(screen.getByLabelText('Nombre')).toHaveValue('María López'));
  });

  it('sin cambios pendientes, cerrar el detalle no muestra ningún modal', async () => {
    const user = userEvent.setup();
    renderWithClient(<Harness initial={leadA} />);

    await screen.findByLabelText('Nombre');
    await user.click(screen.getByTitle('Cerrar detalle'));

    expect(screen.queryByRole('dialog', { name: 'Cambios sin guardar' })).not.toBeInTheDocument();
    await waitFor(() => expect(screen.queryByLabelText('Nombre')).not.toBeInTheDocument());
  });
});
