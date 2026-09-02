import { useNavigate } from 'react-router-dom';
import { Target } from 'lucide-react';
import { motion } from 'framer-motion';
import { fadeInUp } from '../../../../utils/animations';
import ProgressRow from '../../../ui/ProgressRow';
import { PIPELINE_STAGE_LABELS, PIPELINE_STAGE_BAR_COLORS } from '../../../../utils/constants';

// Embudo personal — mismas 10 etapas/colores que ReportsSection.jsx (dashboard admin), pero
// ya viene scoped a "mis prospectos" desde el backend. Click en una etapa filtra el CRM por
// esa etapa (el CRM ya muestra solo los prospectos del asesor, sin parámetro extra).
export default function AsesorPipelineCard({ pipeline }) {
  const navigate = useNavigate();
  const max = Math.max(...pipeline.map((p) => p.total), 1);

  return (
    <motion.div
      variants={fadeInUp}
      initial="hidden"
      animate="visible"
      className="bg-white dark:bg-[#242938] rounded-2xl p-6 shadow-sm border border-gray-100 dark:border-[#2e3650]"
    >
      <h2 className="font-semibold text-gray-800 dark:text-gray-100 mb-4 flex items-center gap-2">
        <Target size={16} className="text-primary-700 dark:text-primary-400" /> Tu embudo
      </h2>
      <div className="space-y-3">
        {pipeline.map(({ stage, total }, i) => (
          <button
            key={stage}
            onClick={() => navigate(`/admin/crm?tab=prospectos&stage=${stage}`)}
            className="w-full text-left"
          >
            <ProgressRow
              label={PIPELINE_STAGE_LABELS[stage] || stage}
              total={total}
              max={max}
              index={i}
              color={PIPELINE_STAGE_BAR_COLORS[stage]}
            />
          </button>
        ))}
      </div>
    </motion.div>
  );
}
