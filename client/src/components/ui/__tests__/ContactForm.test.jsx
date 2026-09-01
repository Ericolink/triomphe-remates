// Fase 3b del rediseño del CRM: el formulario público ya no exige forma de pago/
// presupuesto para motivos que no implican comprar/rentar ("solo información", "quiero
// vender", "otro"), agrega `urgency` (opcional) y revela `searchZone` solo después de
// elegir una ciudad. Fase 3a: captura UTM automáticamente desde la URL. Estos tests
// verifican ambos comportamientos contra el formulario real, no solo la lógica aislada.
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import ContactForm from '../ContactForm';
import { createLead } from '../../../services/leadService';

vi.mock('../../../services/leadService', () => ({
  createLead: vi.fn().mockResolvedValue({ data: { id: 1 } }),
}));
vi.mock('react-hot-toast', () => ({
  default: { success: vi.fn(), error: vi.fn() },
}));
const toast = (await import('react-hot-toast')).default;

function renderForm({ route = '/', props = {} } = {}) {
  const queryClient = new QueryClient({ defaultOptions: { mutations: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[route]}>
        <ContactForm {...props} />
      </MemoryRouter>
    </QueryClientProvider>
  );
}

const fillRequired = async (user) => {
  await user.type(screen.getByPlaceholderText('Tu nombre *'), 'Juan Pérez');
  await user.type(screen.getByPlaceholderText('Tu teléfono *'), '6561234567');
};

describe('ContactForm — motivo condiciona forma de pago/presupuesto (Fase 3b)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('con el motivo por defecto ("solicitar información") no muestra forma de pago ni presupuesto', () => {
    renderForm();
    expect(screen.queryByText('¿Cómo planeas pagar? *')).not.toBeInTheDocument();
    expect(screen.queryByText('Presupuesto aproximado *')).not.toBeInTheDocument();
  });

  it('envía el lead sin pedir forma de pago/presupuesto cuando el motivo no los necesita', async () => {
    const user = userEvent.setup();
    renderForm();
    await fillRequired(user);

    await user.click(screen.getByRole('button', { name: /enviar mensaje/i }));

    await waitFor(() => expect(createLead).toHaveBeenCalled());
    const payload = createLead.mock.calls[0][0];
    expect(payload.paymentMethod).toBeUndefined();
    expect(payload.budgetAmount).toBeUndefined();
    expect(toast.error).not.toHaveBeenCalled();
  });

  it('al elegir un motivo transaccional ("quiero comprar"), muestra forma de pago/presupuesto y los exige', async () => {
    const user = userEvent.setup();
    renderForm();
    await fillRequired(user);

    await user.selectOptions(screen.getByDisplayValue('Solicitar información de una propiedad'), [
      'comprar_propiedad',
    ]);
    expect(screen.getByText('¿Cómo planeas pagar? *')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /enviar mensaje/i }));
    expect(toast.error).toHaveBeenCalledWith('Elige cómo planeas pagar');
    expect(createLead).not.toHaveBeenCalled();
  });

  it('con un motivo transaccional, completar forma de pago y presupuesto sí permite enviar', async () => {
    const user = userEvent.setup();
    renderForm();
    await fillRequired(user);
    await user.selectOptions(screen.getByDisplayValue('Solicitar información de una propiedad'), [
      'comprar_propiedad',
    ]);

    await user.click(screen.getByRole('button', { name: /contado/i }));
    await user.selectOptions(screen.getByText('Presupuesto aproximado *').closest('select'), [
      '750000',
    ]);
    await user.click(screen.getByRole('button', { name: /enviar mensaje/i }));

    await waitFor(() => expect(createLead).toHaveBeenCalled());
    const payload = createLead.mock.calls[0][0];
    expect(payload.paymentMethod).toBe('contado');
    expect(payload.budgetAmount).toBe(750000);
  });
});

describe('ContactForm — campos progresivos de necesidad (Fase 3b)', () => {
  beforeEach(() => vi.clearAllMocks());

  it('no muestra "zona o colonia" hasta que se elige una ciudad', async () => {
    const user = userEvent.setup();
    renderForm();
    expect(screen.queryByPlaceholderText(/zona o colonia/i)).not.toBeInTheDocument();

    await user.selectOptions(screen.getByDisplayValue('Ciudad de interés'), ['juarez']);
    expect(screen.getByPlaceholderText(/zona o colonia/i)).toBeInTheDocument();
  });

  it('incluye urgency y searchZone en el envío cuando se completan', async () => {
    const user = userEvent.setup();
    renderForm();
    await fillRequired(user);
    await user.selectOptions(screen.getByDisplayValue('Ciudad de interés'), ['juarez']);
    await user.type(screen.getByPlaceholderText(/zona o colonia/i), 'Campestre');
    await user.selectOptions(screen.getByDisplayValue('¿Qué tan pronto quieres concretar? (opcional)'), [
      'inmediata',
    ]);

    await user.click(screen.getByRole('button', { name: /enviar mensaje/i }));

    await waitFor(() => expect(createLead).toHaveBeenCalled());
    const payload = createLead.mock.calls[0][0];
    expect(payload.searchCity).toBe('juarez');
    expect(payload.searchZone).toBe('Campestre');
    expect(payload.urgency).toBe('inmediata');
  });
});

describe('ContactForm — captura automática de atribución UTM (Fase 3a)', () => {
  beforeEach(() => vi.clearAllMocks());

  it('captura utm_medium/utm_campaign/utm_content de la URL sin preguntarle nada al prospecto', async () => {
    const user = userEvent.setup();
    renderForm({ route: '/?utm_medium=cpc&utm_campaign=remate-polanco-julio&utm_content=variante-b' });
    await fillRequired(user);

    await user.click(screen.getByRole('button', { name: /enviar mensaje/i }));

    await waitFor(() => expect(createLead).toHaveBeenCalled());
    const payload = createLead.mock.calls[0][0];
    expect(payload.utmMedium).toBe('cpc');
    expect(payload.utmCampaign).toBe('remate-polanco-julio');
    expect(payload.utmContent).toBe('variante-b');
  });

  it('sin parámetros UTM en la URL, no manda esos campos (undefined, no strings vacíos)', async () => {
    const user = userEvent.setup();
    renderForm();
    await fillRequired(user);

    await user.click(screen.getByRole('button', { name: /enviar mensaje/i }));

    await waitFor(() => expect(createLead).toHaveBeenCalled());
    const payload = createLead.mock.calls[0][0];
    expect(payload.utmMedium).toBeUndefined();
    expect(payload.utmCampaign).toBeUndefined();
    expect(payload.utmContent).toBeUndefined();
  });
});
