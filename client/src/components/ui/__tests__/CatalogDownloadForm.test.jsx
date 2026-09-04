import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import CatalogDownloadForm from '../CatalogDownloadForm';
import { requestCatalogPDF } from '../../../services/catalogService';
import { downloadBlob } from '../../../utils/download';

vi.mock('../../../services/catalogService', () => ({
  requestCatalogPDF: vi.fn(),
}));
vi.mock('../../../utils/download', () => ({
  downloadBlob: vi.fn(),
}));
vi.mock('react-hot-toast', () => ({
  default: { success: vi.fn(), error: vi.fn() },
}));
const toast = (await import('react-hot-toast')).default;

const fillRequired = async (user) => {
  await user.type(screen.getByLabelText('Nombre *'), 'Juan Pérez');
  await user.type(screen.getByLabelText('Teléfono *'), '6561234567');
  await user.selectOptions(screen.getByLabelText('Interés *'), ['comprar_propiedad']);
};

describe('CatalogDownloadForm — modo descarga (inventoryDownloadEnabled: true)', () => {
  beforeEach(() => vi.clearAllMocks());

  it('no permite enviar sin nombre/teléfono', async () => {
    const user = userEvent.setup();
    render(<CatalogDownloadForm filters={{}} />);

    await user.click(screen.getByRole('button', { name: /solicitar inventario/i }));
    expect(toast.error).toHaveBeenCalledWith('Nombre y teléfono son requeridos');
    expect(requestCatalogPDF).not.toHaveBeenCalled();
  });

  it('no permite enviar sin elegir un interés', async () => {
    const user = userEvent.setup();
    render(<CatalogDownloadForm filters={{}} />);

    await user.type(screen.getByLabelText('Nombre *'), 'Juan Pérez');
    await user.type(screen.getByLabelText('Teléfono *'), '6561234567');
    await user.click(screen.getByRole('button', { name: /solicitar inventario/i }));

    expect(toast.error).toHaveBeenCalledWith('Selecciona tu interés');
    expect(requestCatalogPDF).not.toHaveBeenCalled();
  });

  it('con el PDF habilitado, la respuesta es el binario y se descarga', async () => {
    const user = userEvent.setup();
    const pdfBlob = new Blob(['%PDF-1.4 contenido falso'], { type: 'application/pdf' });
    requestCatalogPDF.mockResolvedValue({
      data: pdfBlob,
      headers: { 'content-type': 'application/pdf' },
    });
    render(<CatalogDownloadForm filters={{ city: 'juarez' }} />);

    await fillRequired(user);
    await user.click(screen.getByRole('button', { name: /solicitar inventario/i }));

    await waitFor(() => expect(downloadBlob).toHaveBeenCalledWith(pdfBlob, expect.stringContaining('.pdf')));
    expect(await screen.findByText('¡Catálogo descargado!')).toBeInTheDocument();

    const payload = requestCatalogPDF.mock.calls[0][0];
    expect(payload.name).toBe('Juan Pérez');
    expect(payload.phone).toBe('6561234567');
    expect(payload.interest).toBe('comprar_propiedad');
    expect(payload.city).toBe('juarez');
  });
});

describe('CatalogDownloadForm — modo solicitud (inventoryDownloadEnabled: false)', () => {
  beforeEach(() => vi.clearAllMocks());

  it('crea el prospecto pero no descarga nada, y muestra el mensaje del backend', async () => {
    const user = userEvent.setup();
    const jsonBlob = new Blob(
      [JSON.stringify({ downloadAvailable: false, message: 'Mensaje personalizado del backend.' })],
      { type: 'application/json' }
    );
    requestCatalogPDF.mockResolvedValue({
      data: jsonBlob,
      headers: { 'content-type': 'application/json; charset=utf-8' },
    });
    render(<CatalogDownloadForm filters={{}} />);

    await fillRequired(user);
    await user.click(screen.getByRole('button', { name: /solicitar inventario/i }));

    expect(await screen.findByText('¡Solicitud recibida!')).toBeInTheDocument();
    expect(screen.getByText('Mensaje personalizado del backend.')).toBeInTheDocument();
    expect(downloadBlob).not.toHaveBeenCalled();
  });

  it('si el JSON no trae message, usa un mensaje default razonable', async () => {
    const user = userEvent.setup();
    const jsonBlob = new Blob([JSON.stringify({ downloadAvailable: false })], {
      type: 'application/json',
    });
    requestCatalogPDF.mockResolvedValue({
      data: jsonBlob,
      headers: { 'content-type': 'application/json' },
    });
    render(<CatalogDownloadForm filters={{}} />);

    await fillRequired(user);
    await user.click(screen.getByRole('button', { name: /solicitar inventario/i }));

    expect(await screen.findByText('¡Solicitud recibida!')).toBeInTheDocument();
    expect(downloadBlob).not.toHaveBeenCalled();
  });
});

describe('CatalogDownloadForm — manejo de errores', () => {
  beforeEach(() => vi.clearAllMocks());

  it('si la petición falla, muestra un toast de error y no descarga nada', async () => {
    const user = userEvent.setup();
    requestCatalogPDF.mockRejectedValue(new Error('network error'));
    render(<CatalogDownloadForm filters={{}} />);

    await fillRequired(user);
    await user.click(screen.getByRole('button', { name: /solicitar inventario/i }));

    await waitFor(() => expect(toast.error).toHaveBeenCalled());
    expect(downloadBlob).not.toHaveBeenCalled();
  });
});
