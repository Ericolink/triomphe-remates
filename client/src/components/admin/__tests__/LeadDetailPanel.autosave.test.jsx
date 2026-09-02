// CRM-006 — el autoguardado por campo (saveField en LeadDetailPanel.jsx) tenía dos
// vacíos: (1) si el usuario editaba y confirmaba (blur) el MISMO campo dos veces antes de
// que la primera petición resolviera, la que respondiera más tarde podía pisar el
// indicador de la más reciente — incluyendo revertir un "Guardado" real a "Error al
// guardar" si la petición VIEJA fallaba después de que la NUEVA ya hubiera tenido éxito;
// (2) un error de guardado solo se mostraba de forma inline, dentro de la pestaña/
// prospecto donde ocurrió — si el usuario ya había cambiado de pestaña o de prospecto
// antes de que la respuesta llegara, el error se perdía sin que nadie se enterara. Estos
// tests reproducen ambos escenarios.
import { useState } from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, within, waitFor, fireEvent, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

// `waitFor` solo espera hasta que su callback pase por PRIMERA vez — no sirve para
// comprobar que algo NO cambia después de un rato, porque si la aserción ya es cierta en
// el primer intento, no vuelve a revisar. Para las aserciones de "no debería revertirse"
// de este archivo hace falta primero dejar correr la cadena de microtareas de la promesa
// rechazada/resuelta (y los efectos de React que dispare) ANTES de afirmar el estado
// final — de lo contrario un test podría "pasar" solo porque no le dio tiempo al bug a
// manifestarse, no porque el bug esté realmente corregido.
const flushMicrotasks = () =>
  act(async () => {
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();
  });
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import LeadDetailWithActions from '../crm/LeadDetailWithActions';
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

function Harness({ initial }) {
  const [selected, setSelected] = useState(initial);
  return (
    <>
      <button onClick={() => setSelected(leadB)}>ir a B</button>
      <LeadDetailWithActions selected={selected} setSelected={setSelected} users={[]} />
    </>
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  getLeadById.mockImplementation((id) =>
    Promise.resolve({ data: id === leadA.id ? leadA : leadB })
  );
});

describe('LeadDetailPanel — autoguardado seguro ante respuestas fuera de orden (CRM-006)', () => {
  it('si un guardado viejo falla DESPUÉS de que uno más nuevo del mismo campo ya tuvo éxito, el indicador se queda en "Guardado" (no retrocede a error)', async () => {
    let rejectFirst, resolveSecond;
    updateLead
      .mockImplementationOnce(() => new Promise((_resolve, reject) => (rejectFirst = reject)))
      .mockImplementationOnce(() => new Promise((resolve) => (resolveSecond = resolve)));

    const user = userEvent.setup();
    renderWithClient(<Harness initial={leadA} />);

    const dialog = await screen.findByRole('dialog');
    const nameInput = within(dialog).getByLabelText('Nombre');
    await waitFor(() => expect(nameInput).toHaveValue('Juan Pérez'));

    // Primer guardado (quedará pendiente, luego fallará).
    await user.clear(nameInput);
    await user.type(nameInput, 'Nombre Uno');
    fireEvent.blur(nameInput);
    await waitFor(() => expect(updateLead).toHaveBeenCalledTimes(1));
    expect(within(dialog).getByText('Guardando…')).toBeInTheDocument();

    // Antes de que resuelva, el usuario edita el MISMO campo otra vez y confirma de nuevo
    // (segundo guardado, más reciente — este SÍ tendrá éxito y resolverá primero).
    await user.clear(nameInput);
    await user.type(nameInput, 'Nombre Dos');
    fireEvent.blur(nameInput);
    await waitFor(() => expect(updateLead).toHaveBeenCalledTimes(2));

    // El más reciente responde primero: éxito.
    resolveSecond({ data: {} });
    await waitFor(() => expect(within(dialog).getByText('Guardado')).toBeInTheDocument());

    // El más viejo responde después: falla. No debe pisar el "Guardado" ya confirmado del
    // guardado más reciente ni mostrar un toast de error (esa falla ya está obsoleta).
    rejectFirst({ response: { data: { error: 'timeout' } } });
    await flushMicrotasks();
    expect(toast.error).not.toHaveBeenCalled();
    expect(within(dialog).getByText('Guardado')).toBeInTheDocument();
    expect(within(dialog).queryByText(/no se pudo guardar|timeout/i)).not.toBeInTheDocument();
  });

  it('guardar un campo mientras OTRO campo del mismo lead sigue pendiente no deja a ninguno de los dos atascado en "Guardando…"', async () => {
    // `updateMutation` es una única mutation compartida por TODOS los campos del panel
    // (useLeadDetailActions.js) — react-query guarda los callbacks por-llamada en un
    // único campo de su observer, que se sobreescribe en cada `.mutate()`. Antes del fix,
    // confirmar el campo Teléfono mientras el guardado de Nombre seguía en vuelo dejaba a
    // Nombre sin ningún observador: su callback nunca se invocaba y su indicador se
    // quedaba en "Guardando…" para siempre, sin importar si el PUT de Nombre terminó bien
    // o mal en el servidor.
    let resolveName, resolvePhone;
    updateLead
      .mockImplementationOnce(() => new Promise((resolve) => (resolveName = resolve)))
      .mockImplementationOnce(() => new Promise((resolve) => (resolvePhone = resolve)));

    const user = userEvent.setup();
    renderWithClient(<Harness initial={leadA} />);

    const dialog = await screen.findByRole('dialog');
    const nameInput = within(dialog).getByLabelText('Nombre');
    const phoneInput = within(dialog).getByLabelText('Teléfono');
    await waitFor(() => expect(nameInput).toHaveValue('Juan Pérez'));

    // Confirma Nombre (queda pendiente)...
    await user.clear(nameInput);
    await user.type(nameInput, 'Nombre Nuevo');
    fireEvent.blur(nameInput);
    await waitFor(() => expect(updateLead).toHaveBeenCalledTimes(1));
    expect(within(dialog).getByText('Guardando…')).toBeInTheDocument();

    // ...y ANTES de que resuelva, confirma un campo DISTINTO (Teléfono).
    await user.clear(phoneInput);
    await user.type(phoneInput, '6569998888');
    fireEvent.blur(phoneInput);
    await waitFor(() => expect(updateLead).toHaveBeenCalledTimes(2));

    // Resuelve el de Teléfono primero.
    resolvePhone({ data: {} });
    await waitFor(() => expect(within(dialog).getAllByText('Guardado').length).toBeGreaterThanOrEqual(1));

    // El de Nombre, iniciado antes, finalmente también resuelve — debe reflejarse en su
    // propio indicador (no quedarse atascado en "Guardando…" para siempre).
    resolveName({ data: {} });
    await waitFor(() =>
      expect(within(dialog).queryAllByText('Guardando…')).toHaveLength(0)
    );
    expect(within(dialog).getAllByText('Guardado').length).toBeGreaterThanOrEqual(1);
  });

  it('un guardado que falla después de cambiar de prospecto sigue avisando por toast (no desaparece silenciosamente)', async () => {
    let rejectSave;
    updateLead.mockImplementationOnce(() => new Promise((_resolve, reject) => (rejectSave = reject)));

    const user = userEvent.setup();
    renderWithClient(<Harness initial={leadA} />);

    const dialog = await screen.findByRole('dialog');
    const nameInput = within(dialog).getByLabelText('Nombre');
    await waitFor(() => expect(nameInput).toHaveValue('Juan Pérez'));

    await user.clear(nameInput);
    await user.type(nameInput, 'Nombre editado para A');
    fireEvent.blur(nameInput);
    await waitFor(() => expect(updateLead).toHaveBeenCalledTimes(1));

    // El usuario cambia de prospecto ANTES de que la petición anterior resuelva — con el
    // fix de CRM-001, esto desmonta por completo la instancia que mostraba A.
    fireEvent.click(screen.getByRole('button', { name: 'ir a B' }));
    await waitFor(() =>
      expect(within(screen.getByRole('dialog')).getByLabelText('Nombre')).toHaveValue(
        'María López'
      )
    );

    // La petición de A (ya sin ningún componente que la esté mostrando) finalmente falla.
    rejectSave({ response: { data: { error: 'Error de red' } } });

    await waitFor(() => expect(toast.error).toHaveBeenCalledWith('Error de red'));
  });
});
