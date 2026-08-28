import { AnimatePresence, motion } from 'framer-motion';
import LeadDetailPanel from '../LeadDetailPanel';
import LeadDetailModals from './LeadDetailModals';
import useLeadDetailActions from './useLeadDetailActions';
import useModalA11y from '../../../hooks/useModalA11y';

// Muestra la misma tarjeta de detalle de prospecto que usa Prospectos (mismo componente,
// mismas acciones), como hoja deslizante flotante — para pantallas (como Calendario) que no
// tienen una columna dedicada al detalle junto a una lista, a diferencia de
// DetailPanelSlot (usado en ProspectosSection), cuya variante de escritorio asume esa
// columna. Internamente usa exactamente el mismo hook de lógica (useLeadDetailActions) y los
// mismos modales (LeadDetailModals) que ProspectosSection — nada de esto se reimplementa.
export default function LeadDetailWithActions({ selected, setSelected, users }) {
  const actions = useLeadDetailActions({ selected, setSelected });
  const onDeselect = () => setSelected(null);
  const panelRef = useModalA11y(Boolean(selected), onDeselect);

  return (
    <>
      <AnimatePresence>
        {selected && (
          <motion.div
            key="lead-detail-overlay"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onDeselect}
            // Sin fondo oscuro/blur a propósito: cuando se abre desde una cita del
            // calendario, esa tarjeta debe seguir viéndose con claridad al lado — las dos
            // "tablas" (cita + prospecto) visibles al mismo tiempo, no una tapando a la otra.
            className="fixed inset-0 z-[70] flex justify-end"
          >
            <motion.div
              ref={panelRef}
              role="dialog"
              aria-modal="true"
              aria-label={selected?.name || 'Detalle de prospecto'}
              tabIndex={-1}
              onClick={(e) => e.stopPropagation()}
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={{ type: 'spring', stiffness: 320, damping: 32 }}
              className="w-full max-w-md h-full overflow-y-auto bg-white dark:bg-[#242938] shadow-2xl border-l border-gray-200 dark:border-[#2e3650]"
            >
              <LeadDetailPanel
                selected={selected}
                onDeselect={onDeselect}
                updateMutation={actions.updateMutation}
                users={users}
                onOpenStagePicker={(lead) => actions.setSheetLead(lead)}
                onChangeStage={actions.attemptStageChange}
                onDelete={actions.handleDelete}
              />
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <LeadDetailModals actions={actions} />
    </>
  );
}
