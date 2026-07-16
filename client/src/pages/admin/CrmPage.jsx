import { useSearchParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Users, CalendarDays, Megaphone, Trophy } from 'lucide-react';
import TabBar from '../../components/ui/TabBar';
import ProspectosSection from '../../components/admin/crm/ProspectosSection';
import CalendarioSection from '../../components/admin/crm/CalendarioSection';
import CampanasSection from '../../components/admin/crm/CampanasSection';
import CasosExitoSection from '../../components/admin/crm/CasosExitoSection';
import { fadeIn } from '../../utils/animations';

const TABS = [
  { key: 'prospectos', label: 'Prospectos', icon: <Users size={15} /> },
  { key: 'calendario', label: 'Calendario', icon: <CalendarDays size={15} /> },
  { key: 'campanas', label: 'Campañas', icon: <Megaphone size={15} /> },
  { key: 'casos-exito', label: 'Casos de éxito', icon: <Trophy size={15} /> },
];
const TAB_KEYS = TABS.map((t) => t.key);

// Prospectos, Calendario, Campañas y Casos de éxito vivían en 4 páginas/rutas separadas.
// Se unifican aquí con pestañas (montaje condicional, no solo oculto con CSS) para que
// nunca haya más de una herramienta pesada en pantalla a la vez — ver plan de reorganización
// de navegación admin. El tab vive en la URL (?tab=) en vez de useState para que sea
// enlazable y sobreviva un refresh, a diferencia del location.state que usaba antes Prospectos.
export default function CrmPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const tab = TAB_KEYS.includes(searchParams.get('tab')) ? searchParams.get('tab') : 'prospectos';

  const setTab = (key) => {
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      next.set('tab', key);
      return next;
    });
  };

  return (
    <motion.div variants={fadeIn} initial="hidden" animate="visible">
      <h1 className="text-2xl font-bold text-gray-800 dark:text-gray-100 mb-4">CRM Comercial</h1>
      <TabBar tabs={TABS} active={tab} onChange={setTab} />
      {tab === 'prospectos' && <ProspectosSection />}
      {tab === 'calendario' && <CalendarioSection />}
      {tab === 'campanas' && <CampanasSection />}
      {tab === 'casos-exito' && <CasosExitoSection />}
    </motion.div>
  );
}
