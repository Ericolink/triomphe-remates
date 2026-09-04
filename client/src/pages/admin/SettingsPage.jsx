import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Settings as SettingsIcon, FileDown, Globe } from 'lucide-react';
import { motion } from 'framer-motion';
import toast from 'react-hot-toast';
import {
  getInventoryDownloadSetting,
  updateInventoryDownloadSetting,
  getPublicPropertiesSetting,
  updatePublicPropertiesSetting,
} from '../../services/settingsService';
import Switch from '../../components/ui/Switch';
import Spinner from '../../components/ui/Spinner';
import { fadeIn, fadeInUp } from '../../utils/animations';

// Una tarjeta por flag de configuración global — cada una es dueña de su propio
// query/mutation (queryKey distinto por flag), así que activar/desactivar una nunca
// pisa el estado de la otra ni dispara un refetch cruzado. Sin caché local propia:
// react-query ya invalida/refetchea tras cada mutación exitosa, así que el estado
// mostrado siempre refleja lo que el backend acaba de confirmar, nunca un valor
// optimista que pudiera divergir si la escritura fallara.
function SettingCard({
  queryKey,
  queryFn,
  mutationFn,
  icon,
  title,
  description,
  toggleLabel,
  enabledText,
  disabledText,
  successText,
}) {
  const queryClient = useQueryClient();

  const { data, isLoading, isError } = useQuery({ queryKey, queryFn });

  const mutation = useMutation({
    mutationFn,
    onSuccess: (result) => {
      queryClient.setQueryData(queryKey, result);
      toast.success(successText(result.enabled));
    },
    onError: () => {
      toast.error('No se pudo guardar el cambio. Intenta de nuevo.');
    },
  });

  const enabled = data?.enabled ?? true;

  if (isLoading) {
    return (
      <div className="bg-white dark:bg-[#242938] rounded-2xl shadow-sm border border-gray-100 dark:border-[#2e3650] p-6 max-w-2xl flex justify-center">
        <Spinner />
      </div>
    );
  }

  if (isError) {
    return (
      <div className="bg-white dark:bg-[#242938] rounded-2xl shadow-sm border border-gray-100 dark:border-[#2e3650] p-6 max-w-2xl text-sm text-red-600 dark:text-red-400">
        No se pudo cargar la configuración. Recarga la página para intentar de nuevo.
      </div>
    );
  }

  return (
    <motion.div
      variants={fadeInUp}
      initial="hidden"
      animate="visible"
      className="bg-white dark:bg-[#242938] rounded-2xl shadow-sm border border-gray-100 dark:border-[#2e3650] p-6 max-w-2xl"
    >
      <div className="flex items-start gap-3 mb-4">
        <div className="w-10 h-10 bg-primary-900 rounded-xl flex items-center justify-center text-white shrink-0">
          {icon}
        </div>
        <div>
          <h2 className="font-semibold text-gray-800 dark:text-gray-100">{title}</h2>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">{description}</p>
        </div>
      </div>

      <div className="flex items-center justify-between gap-4 py-3 border-t border-gray-100 dark:border-[#2e3650]">
        <div>
          <p className="text-sm font-medium text-gray-800 dark:text-gray-100">{toggleLabel}</p>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 max-w-md">
            {enabled ? enabledText : disabledText}
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
            label={toggleLabel}
          />
        </div>
      </div>
    </motion.div>
  );
}

// Panel admin-only (RoleRoute allow={isAdmin} en App.jsx) para flags de configuración
// global. Cada flag vive en su propia tarjeta (SettingCard) — ver ahí el detalle de por
// qué no comparten query/mutation.
export default function SettingsPage() {
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

      <div className="space-y-6">
        <SettingCard
          queryKey={['settings', 'public-properties']}
          queryFn={getPublicPropertiesSetting}
          mutationFn={updatePublicPropertiesSetting}
          icon={<Globe size={18} />}
          title="Propiedades públicas"
          description="Controla si las propiedades están visibles para los visitantes de la página."
          toggleLabel="Mostrar propiedades al público"
          enabledText="Las propiedades se muestran normalmente en la sección pública (listado, detalle y búsqueda)."
          disabledText="Las propiedades están ocultas para el público — la sección muestra un aviso de no disponibilidad. El inventario sigue completo en el panel admin/CRM."
          successText={(enabled) =>
            enabled ? 'Propiedades públicas activadas' : 'Propiedades públicas desactivadas'
          }
        />

        <SettingCard
          queryKey={['settings', 'inventory-download']}
          queryFn={getInventoryDownloadSetting}
          mutationFn={updateInventoryDownloadSetting}
          icon={<FileDown size={18} />}
          title="Inventario de propiedades"
          description="Controla si el sitio público entrega el PDF del catálogo automáticamente."
          toggleLabel="Permitir descarga del inventario"
          enabledText="Un visitante que llena el formulario recibe el PDF de inmediato y queda registrado como prospecto en el CRM."
          disabledText="Un visitante que llena el formulario queda registrado como prospecto en el CRM, pero NO recibe el PDF automáticamente — se le informa que el equipo de Triomphe se pondrá en contacto."
          successText={(enabled) =>
            enabled ? 'Descarga de inventario activada' : 'Descarga de inventario desactivada'
          }
        />
      </div>
    </motion.div>
  );
}
