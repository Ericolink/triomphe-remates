import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import PropertiesPage from '../PropertiesPage';
import { getPublicProperties } from '../../../services/propertyService';

vi.mock('../../../services/propertyService', () => ({
  getPublicProperties: vi.fn(),
}));
vi.mock('../../../components/ui/SEO', () => ({ default: () => null }));

const AVAILABLE_RESPONSE = {
  data: [
    { id: 1, title: 'Casa en Juárez', city: 'juarez', type: 'casa', price: 900000, images: [] },
  ],
  pagination: { total: 1, page: 1, limit: 12, totalPages: 1, hasNext: false, hasPrevious: false },
};

const UNAVAILABLE_RESPONSE = {
  propertiesAvailable: false,
  message: 'Las propiedades no están disponibles actualmente. Por favor, vuelve a consultar más tarde.',
  data: [],
  pagination: { total: 0, page: 1, limit: 12, totalPages: 0, hasNext: false, hasPrevious: false },
};

function renderPage() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={['/propiedades']}>
        <Routes>
          <Route path="/propiedades" element={<PropertiesPage />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>
  );
}

describe('PropertiesPage — respuesta propertiesAvailable', () => {
  beforeEach(() => vi.clearAllMocks());

  it('con propiedades disponibles, muestra el listado normalmente', async () => {
    getPublicProperties.mockResolvedValue(AVAILABLE_RESPONSE);
    renderPage();

    expect(await screen.findByText('Casa en Juárez')).toBeInTheDocument();
    expect(screen.queryByText('Propiedades no disponibles')).not.toBeInTheDocument();
  });

  it('con propertiesAvailable:false, muestra el aviso de no disponibilidad y no las cards', async () => {
    getPublicProperties.mockResolvedValue(UNAVAILABLE_RESPONSE);
    renderPage();

    expect(
      await screen.findByText(
        'Actualmente el listado no está disponible en línea, pero cuéntanos qué buscas y un asesor te contacta directamente.'
      )
    ).toBeInTheDocument();
    // El encabezado también refleja el estado, en vez de "0 propiedades disponibles"
    expect(screen.getAllByText('Propiedades no disponibles').length).toBeGreaterThan(0);
    expect(screen.queryByText('No se encontraron propiedades')).not.toBeInTheDocument();
    // El aviso viene acompañado del formulario de contacto, no solo un mensaje sin salida.
    expect(screen.getByPlaceholderText('Tu nombre *')).toBeInTheDocument();
  });

  it('con propertiesAvailable:false, no se queda cargando indefinidamente (sale del skeleton)', async () => {
    getPublicProperties.mockResolvedValue(UNAVAILABLE_RESPONSE);
    renderPage();

    await waitFor(() =>
      expect(screen.getAllByText('Propiedades no disponibles').length).toBeGreaterThan(0)
    );
  });

  it('sin resultados por filtros (propertiesAvailable ausente, data vacía), muestra el mensaje de "sin resultados", no el de no-disponibilidad', async () => {
    getPublicProperties.mockResolvedValue({
      data: [],
      pagination: { total: 0, page: 1, limit: 12, totalPages: 0, hasNext: false, hasPrevious: false },
    });
    renderPage();

    expect(await screen.findByText('No se encontraron propiedades')).toBeInTheDocument();
    expect(screen.queryByText('Propiedades no disponibles')).not.toBeInTheDocument();
  });
});

describe('PropertiesPage — filtros siempre visibles', () => {
  beforeEach(() => vi.clearAllMocks());

  it('el panel de filtros se ve sin necesidad de abrir nada (ya no hay botón toggle)', async () => {
    getPublicProperties.mockResolvedValue(AVAILABLE_RESPONSE);
    renderPage();

    await screen.findByText('Casa en Juárez');
    // El campo "Ciudad" (uno de los filtros) está en el DOM desde el primer render, no
    // detrás de un botón "Filtros" que haya que presionar primero.
    expect(screen.getByText('Ciudad')).toBeInTheDocument();
    expect(screen.getByText('Categoría de propiedad')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /^filtros$/i })).not.toBeInTheDocument();
  });
});
