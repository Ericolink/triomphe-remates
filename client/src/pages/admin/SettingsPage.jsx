import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Settings as SettingsIcon, FileDown } from 'lucide-react';
import { motion } from 'framer-motion';
import toast from 'react-hot-toast';
import {
  getInventoryDownloadSetting,
  updateInventoryDownloadSetting,
} from '../../services/settingsService';
import Switch from '../../components/ui/Switch';
import Spinner from '../../components/ui/Spinner';
import { fadeIn, fadeInUp } from '../../utils/animations';

const INVENTORY_DOWNLOAD_QUERY_KEY = ['settings', 'inventory-download'];

// Panel admin-only (RoleRoute allow={isAdmin} en App.jsx) para flags de configuración
// global — primer flag: si el público puede descargar el PDF del inventario o solo
// solicitarlo (ver exportController.exportCatalogPDF / settingsService). Sin caché local
// propia: react-query ya invalida/refetchea tras cada mutación exitosa, así que el estado
// mostrado siempre refleja lo que el backend acaba de confirmar, nunca un valor optimista
// que pudiera divergir si la escritura fallara.
export default function SettingsPage() {
  const queryClient = useQueryClient();

  const { data, isLoading, isError } = useQuery({
    queryKey: INVENTORY_DOWNLOAD_QUERY_KEY,
    queryFn: getInventoryDownloadSetting,
  });

  const mutation = useMutation({
    mutationFn: updateInventoryDownloadSetting,
    onSuccess: (result) => {
      queryClient.setQueryData(INVENTORY_DOWNLOAD_QUERY_KEY, result);
      toast.success(
        result.enabled
          ? 'Descarga de inventario activada'
          : 'Descarga de inventario desactivada'
      );
    },
    onError: () => {
      toast.error('No se pudo guardar el cambio. Intenta de nuevo.');
    },
  });

  const enabled = data?.enabled ?? true;

  return (
    <motion.div variants={fadeIn} initial="hidden" animate="visible">
      <motion.div variants={fadeInUp} initial="hidden" animate="visible" className="mb-6">
        <h1 className="text-2xl font-bold text-gray-800 dark:text-gray-100 flex items-center gap-2">
          <SettingsIcon size={22} /> Configuración
        </h1>
        <p className="text-gray-500 dark:text-gray-400 text-sm mt-1">
          Ajustes globales del sitio público.
        </p>
      </motion.div>

      {isLoading ? (
        <div className="flex justify-center py-12">
          <Spinner />
        </div>
      ) : isError ? (
        <div className="bg-white dark:bg-[#242938] rounded-2xl shadow-sm border border-gray-100 dark:border-[#2e3650] p-6 text-sm text-red-600 dark:text-red-400">
          No se pudo cargar la configuración. Recarga la página para intentar de nuevo.
        </div>
      ) : (
        <motion.div
          variants={fadeInUp}
          initial="hidden"
          animate="visible"
          className="bg-white dark:bg-[#242938] rounded-2xl shadow-sm border border-gray-100 dark:border-[#2e3650] p-6 max-w-2xl"
        >
          <div className="flex items-start gap-3 mb-4">
            <div className="w-10 h-10 bg-primary-900 rounded-xl flex items-center justify-center text-white shrink-0">
              <FileDown size={18} />
            </div>
            <div>
              <h2 className="font-semibold text-gray-800 dark:text-gray-100">
                Inventario de propiedades
              </h2>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
                Controla si el sitio público entrega el PDF del catálogo automáticamente.
              </p>
            </div>
          </div>

          <div className="flex items-center justify-between gap-4 py-3 border-t border-gray-100 dark:border-[#2e3650]">
            <div>
              <p className="text-sm font-medium text-gray-800 dark:text-gray-100">
                Permitir descarga del inventario
              </p>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 max-w-md">
                {enabled
                  ? 'Un visitante que llena el formulario recibe el PDF de inmediato y queda registrado como prospecto en el CRM.'
                  : 'Un visitante que llena el formulario queda registrado como prospecto en el CRM, pero NO recibe el PDF automáticamente — se le informa que el equipo de Triomphe se pondrá en contacto.'}
              </p>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <span
                className={`text-xs font-semibold px-2 py-1 rounded-full ${
                  enabled
                    ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                    : 'bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400'
                }`}
              >
                {enabled ? 'ACTIVADO' : 'DESACTIVADO'}
              </span>
              <Switch
                checked={enabled}
                disabled={mutation.isPending}
                onChange={(next) => mutation.mutate(next)}
                label="Permitir descarga del inventario"
              />
            </div>
          </div>
        </motion.div>
      )}
    </motion.div>
  );
}
