import ConfirmDialog from '../../ui/ConfirmDialog';
import CloseLeadModal from '../CloseLeadModal';
import ReopenLeadModal from '../ReopenLeadModal';
import StageBottomSheet from '../StageBottomSheet';

// Los 4 modales/hojas que acompañan a la tarjeta de detalle de un prospecto — puramente
// presentacional, toma el estado/mutaciones de useLeadDetailActions. Compartido entre
// ProspectosSection y LeadDetailWithActions (Calendario) para no duplicar este marcado.
export default function LeadDetailModals({ actions }) {
  const {
    confirm,
    setConfirm,
    closeTarget,
    setCloseTarget,
    reopenTarget,
    setReopenTarget,
    sheetLead,
    setSheetLead,
    closeWonMutation,
    closeLostMutation,
    reopenMutation,
    attemptStageChange,
    closeLeadForModal,
  } = actions;

  return (
    <>
      <ConfirmDialog
        open={!!confirm}
        title={confirm?.title}
        message={confirm?.message}
        confirmLabel="Eliminar"
        onConfirm={confirm?.onConfirm}
        onCancel={() => setConfirm(null)}
      />

      <CloseLeadModal
        key={closeTarget ? `${closeTarget.lead.id}:${closeTarget.targetStage}` : 'close-empty'}
        open={!!closeTarget}
        lead={closeLeadForModal}
        targetStage={closeTarget?.targetStage}
        isPending={closeWonMutation.isPending || closeLostMutation.isPending}
        onClose={() => setCloseTarget(null)}
        onConfirmWon={(payload) =>
          closeWonMutation.mutate({ id: closeTarget.lead.id, data: payload })
        }
        onConfirmLost={(payload) =>
          closeLostMutation.mutate({ id: closeTarget.lead.id, data: payload })
        }
      />

      <ReopenLeadModal
        key={reopenTarget ? `${reopenTarget.lead.id}:${reopenTarget.targetStage}` : 'reopen-empty'}
        open={!!reopenTarget}
        lead={reopenTarget?.lead}
        targetStage={reopenTarget?.targetStage}
        isPending={reopenMutation.isPending}
        onClose={() => setReopenTarget(null)}
        onConfirm={(pipelineStage) =>
          reopenMutation.mutate({ id: reopenTarget.lead.id, pipelineStage })
        }
      />

      <StageBottomSheet
        open={!!sheetLead}
        lead={sheetLead}
        onClose={() => setSheetLead(null)}
        onSelectStage={(newStage) => attemptStageChange(sheetLead, newStage)}
      />
    </>
  );
}
