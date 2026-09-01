// Forma de pago/presupuesto son siempre obligatorias en el formulario público, sin
// importar el motivo de contacto elegido (se revirtió la gating por motivo de Fase 3b).
// Fase 3a: sigue capturando UTM automáticamente desde la URL. `searchZone` sigue
// revelándose solo después de elegir una ciudad.
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
  await user.click(screen.getByRole('button', { name: /contado/i }));
  await user.selectOptions(screen.getByText('Presupuesto aproximado *').closest('select'), [
    '750000',
  ]);
};

describe('ContactForm — forma de pago/presupuesto siempre visibles y obligatorias', () => {
  beforeEach(() => vi.clearAllMocks());

  it('muestra forma de pago y presupuesto sin importar el motivo por defecto', () => {
    renderForm();
    expect(screen.getByText('¿Cómo planeas pagar? *')).toBeInTheDocument();
    expect(screen.getByText('Presupuesto aproximado *')).toBeInTheDocument();
  });

  it('no permite enviar sin elegir forma de pago', async () => {
    const user = userEvent.setup();
    renderForm();
    await user.type(screen.getByPlaceholderText('Tu nombre *'), 'Juan Pérez');
    await user.type(screen.getByPlaceholderText('Tu teléfono *'), '6561234567');

    await user.click(screen.getByRole('button', { name: /enviar mensaje/i }));
    expect(toast.error).toHaveBeenCalledWith('Elige cómo planeas pagar');
    expect(createLead).not.toHaveBeenCalled();
  });

  it('con forma de pago y presupuesto completos, envía el lead', async () => {
    const user = userEvent.setup();
    renderForm();
    await fillRequired(user);

    await user.click(screen.getByRole('button', { name: /enviar mensaje/i }));

    await waitFor(() => expect(createLead).toHaveBeenCalled());
    const payload = createLead.mock.calls[0][0];
    expect(payload.paymentMethod).toBe('contado');
    expect(payload.budgetAmount).toBe(750000);
  });
});

describe('ContactForm — campos progresivos de necesidad', () => {
  beforeEach(() => vi.clearAllMocks());

  it('no muestra "zona o colonia" hasta que se elige una ciudad', async () => {
    const user = userEvent.setup();
    renderForm();
    expect(screen.queryByPlaceholderText(/zona o colonia/i)).not.toBeInTheDocument();

    await user.selectOptions(screen.getByDisplayValue('Ciudad de interés'), ['juarez']);
    expect(screen.getByPlaceholderText(/zona o colonia/i)).toBeInTheDocument();
  });

  it('incluye searchZone en el envío cuando se completa', async () => {
    const user = userEvent.setup();
    renderForm();
    await fillRequired(user);
    await user.selectOptions(screen.getByDisplayValue('Ciudad de interés'), ['juarez']);
    await user.type(screen.getByPlaceholderText(/zona o colonia/i), 'Campestre');

    await user.click(screen.getByRole('button', { name: /enviar mensaje/i }));

    await waitFor(() => expect(createLead).toHaveBeenCalled());
    const payload = createLead.mock.calls[0][0];
    expect(payload.searchCity).toBe('juarez');
    expect(payload.searchZone).toBe('Campestre');
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
