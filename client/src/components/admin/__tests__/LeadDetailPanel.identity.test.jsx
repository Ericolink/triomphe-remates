// CRM-001 — LeadDetailPanel guardaba sus campos editables en useState inicializado UNA
// SOLA VEZ desde `selected` al montar. Dos de los tres puntos donde se renderiza
// <LeadDetailPanel> no le pasaban un `key` atado a `selected.id` (solo la columna de
// escritorio de DetailPanelSlot lo hacía) — sin ese `key`, si `selected` cambia de un lead
// a otro MIENTRAS el componente sigue montado (ej. dos "Ver prospecto" resolviendo fuera
// de orden desde el Calendario — ver AUDITORIA_TECNICA_COMPLETA_2026_08_31.md, CRM-001),
// React reutiliza la misma instancia: los inputs conservan el texto del prospecto
// ANTERIOR, y un blur posterior guarda ese texto obsoleto sobre el `id` del prospecto
// NUEVO. Este test reproduce exactamente ese escenario (abrir A, editar sin confirmar,
// cambiar a B, verificar que el estado mostrado y cualquier guardado posterior
// corresponden solo a B) contra los dos puntos de montaje reales que carecían del `key`:
// LeadDetailWithActions.jsx (Calendario) y el overlay móvil de DetailPanelSlot
// (Prospectos, xl:hidden).
import { useState } from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, within, waitFor, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider, useMutation } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import LeadDetailWithActions from '../crm/LeadDetailWithActions';
import { DetailPanelSlot } from '../LeadDetailPanel';
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
const leadB = {
  ...leadA,
  id: 202,
  name: 'María López',
  phone: '6562222222',
  email: 'maria@test.com',
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

beforeEach(() => {
  vi.clearAllMocks();
  getLeadById.mockImplementation((id) =>
    Promise.resolve({ data: id === leadA.id ? leadA : leadB })
  );
  updateLead.mockResolvedValue({ data: {} });
});

describe('LeadDetailPanel — identidad ligada al leadId (CRM-001)', () => {
  describe('vía LeadDetailWithActions (Calendario — "Ver prospecto")', () => {
    function Harness() {
      const [selected, setSelected] = useState(leadA);
      return (
        <>
          <button onClick={() => setSelected(leadB)}>ir a B</button>
          <LeadDetailWithActions selected={selected} setSelected={setSelected} users={[]} />
        </>
      );
    }

    it('al cambiar de A a B sin cerrar el panel, descarta la edición sin confirmar de A y nunca guarda datos de A sobre el id de B', async () => {
      const user = userEvent.setup();
      renderWithClient(<Harness />);

      const dialog = await screen.findByRole('dialog');
      const nameInput = within(dialog).getByLabelText('Nombre');
      await waitFor(() => expect(nameInput).toHaveValue('Juan Pérez'));

      // 1) Abrir A, 2) modificar información SIN confirmar (sin blur/Enter todavía).
      await user.clear(nameInput);
      await user.type(nameInput, 'Juan EDITADO SIN GUARDAR');
      expect(within(dialog).getByLabelText('Nombre')).toHaveValue('Juan EDITADO SIN GUARDAR');

      // 3) Cambiar rápidamente al prospecto B, sin pasar por deseleccionar. Se usa
      // fireEvent (no userEvent) a propósito: en producción este cambio lo dispara un
      // `.then()` de red resolviendo (dos "Ver prospecto" fuera de orden), NO un clic del
      // usuario cerca del input — userEvent.click primero simularía un blur real del
      // input enfocado (guardando legítimamente la edición de A sobre A antes de
      // cambiar), que es un escenario distinto y no el que se está reproduciendo aquí.
      fireEvent.click(screen.getByRole('button', { name: 'ir a B' }));

      // 4) El estado mostrado debe corresponder a B — nunca al texto sin guardar de A.
      const nameInputAfterSwitch = await within(await screen.findByRole('dialog')).findByLabelText(
        'Nombre'
      );
      await waitFor(() => expect(nameInputAfterSwitch).toHaveValue('María López'));
      expect(nameInputAfterSwitch).not.toHaveValue('Juan EDITADO SIN GUARDAR');

      // La sola transición A→B no debe haber disparado ningún guardado por sí misma.
      expect(updateLead).not.toHaveBeenCalled();

      // 5)/6) Cualquier guardado posterior afecta EXCLUSIVAMENTE a B, nunca lleva el texto
      // obsoleto de A ni se asocia al id de A.
      await user.clear(nameInputAfterSwitch);
      await user.type(nameInputAfterSwitch, 'María Actualizada');
      nameInputAfterSwitch.blur();

      await waitFor(() =>
        expect(updateLead).toHaveBeenCalledWith(leadB.id, { name: 'María Actualizada' })
      );
      expect(updateLead).not.toHaveBeenCalledWith(leadA.id, expect.anything());
      expect(updateLead).not.toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({ name: 'Juan EDITADO SIN GUARDAR' })
      );
    });

    it('repite el escenario en sentido inverso (B → A) para descartar que el fix dependa del orden', async () => {
      function ReverseHarness() {
        const [selected, setSelected] = useState(leadB);
        return (
          <>
            <button onClick={() => setSelected(leadA)}>ir a A</button>
            <LeadDetailWithActions selected={selected} setSelected={setSelected} users={[]} />
          </>
        );
      }
      const user = userEvent.setup();
      renderWithClient(<ReverseHarness />);

      const dialog = await screen.findByRole('dialog');
      const nameInput = within(dialog).getByLabelText('Nombre');
      await waitFor(() => expect(nameInput).toHaveValue('María López'));

      await user.clear(nameInput);
      await user.type(nameInput, 'María EDITADO SIN GUARDAR');

      fireEvent.click(screen.getByRole('button', { name: 'ir a A' }));

      const nameInputAfterSwitch = await within(await screen.findByRole('dialog')).findByLabelText(
        'Nombre'
      );
      await waitFor(() => expect(nameInputAfterSwitch).toHaveValue('Juan Pérez'));
      expect(nameInputAfterSwitch).not.toHaveValue('María EDITADO SIN GUARDAR');
      expect(updateLead).not.toHaveBeenCalled();
    });
  });

  describe('vía DetailPanelSlot — overlay móvil (Prospectos)', () => {
    function MobileHarness() {
      const [selected, setSelected] = useState(leadA);
      const updateMutation = useMutation({ mutationFn: ({ id, data }) => updateLead(id, data) });
      return (
        <>
          <button onClick={() => setSelected(leadB)}>ir a B</button>
          <DetailPanelSlot
            selected={selected}
            updateMutation={updateMutation}
            users={[]}
            onOpenStagePicker={() => {}}
            onChangeStage={() => {}}
            onDeselect={() => setSelected(null)}
            emptyText="Selecciona un prospecto"
            onDelete={() => {}}
          />
        </>
      );
    }

    it('el overlay móvil también descarta la edición sin confirmar de A al cambiar a B', async () => {
      const user = userEvent.setup();
      renderWithClient(<MobileHarness />);

      // DetailPanelSlot renderiza a la vez la rama móvil (role="dialog", xl:hidden) y la de
      // escritorio (sin wrapper de diálogo) — jsdom no aplica @media queries, así que ambas
      // conviven en el DOM. Solo la rama móvil carecía del `key`, así que se acota
      // explícitamente a ella vía su rol de diálogo.
      const dialog = await screen.findByRole('dialog');
      const nameInput = within(dialog).getByLabelText('Nombre');
      await waitFor(() => expect(nameInput).toHaveValue('Juan Pérez'));

      await user.clear(nameInput);
      await user.type(nameInput, 'Juan EDITADO SIN GUARDAR');

      fireEvent.click(screen.getByRole('button', { name: 'ir a B' }));

      const nameInputAfterSwitch = await within(await screen.findByRole('dialog')).findByLabelText(
        'Nombre'
      );
      await waitFor(() => expect(nameInputAfterSwitch).toHaveValue('María López'));
      expect(nameInputAfterSwitch).not.toHaveValue('Juan EDITADO SIN GUARDAR');
      expect(updateLead).not.toHaveBeenCalled();

      await user.clear(nameInputAfterSwitch);
      await user.type(nameInputAfterSwitch, 'María Actualizada');
      nameInputAfterSwitch.blur();

      await waitFor(() =>
        expect(updateLead).toHaveBeenCalledWith(leadB.id, { name: 'María Actualizada' })
      );
      expect(updateLead).not.toHaveBeenCalledWith(leadA.id, expect.anything());
    });
  });
});
