import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import {
  getLeadById,
  updateLead,
  deleteLead,
  closeLeadAsWon,
  closeLeadAsLost,
  sendLeadToWaitingList,
  reopenLead,
} from '../../../services/leadService';
import { TERMINAL_STAGES } from '../../../utils/constants';

// Toda la lógica de "editar/cerrar/reabrir/eliminar un prospecto" en un solo lugar —
// extraído de ProspectosSection para que Calendario (vía LeadDetailWithActions) pueda
// reusarla exacta, sin reimplementarla. ProspectosSection sigue usando este hook
// directamente (no el wrapper) porque `attemptStageChange`/`updateMutation` también los
// necesita KanbanBoard para el drag & drop, no solo el panel de detalle.
export default function useLeadDetailActions({ selected, setSelected }) {
  const queryClient = useQueryClient();
  const [confirm, setConfirm] = useState(null);
  const [closeTarget, setCloseTarget] = useState(null); // { lead, targetStage }
  const [reopenTarget, setReopenTarget] = useState(null); // { lead, targetStage }
  const [waitingListTarget, setWaitingListTarget] = useState(null); // lead
  const [sheetLead, setSheetLead] = useState(null);

  const { data: closeLeadDetail } = useQuery({
    queryKey: ['lead-detail-for-close', closeTarget?.lead?.id],
    queryFn: () => getLeadById(closeTarget.lead.id),
    enabled: !!closeTarget?.lead?.id,
  });

  // Sin toast global de éxito: cada campo editado desde LeadDetailPanel confirma junto al
  // propio campo (ver FieldStatus ahí), y un movimiento de etapa por drag/hoja ya es
  // visible por sí mismo (la tarjeta cambia de columna / la etapa del encabezado cambia).
  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => updateLead(id, data),
    onSuccess: (res, { data: updated }) => {
      queryClient.invalidateQueries(['leads']);
      queryClient.invalidateQueries(['lead-detail']);
      queryClient.invalidateQueries(['appointments-month']);
      queryClient.invalidateQueries(['appointments-agenda']);
      const affectsColumns = updated.pipelineStage !== undefined;
      const affectsTasks = affectsColumns || updated.assignedToUserId !== undefined;
      if (affectsColumns) queryClient.invalidateQueries(['leads-column']);
      if (affectsTasks) {
        queryClient.invalidateQueries(['open-tasks']);
        queryClient.invalidateQueries(['open-tasks-column']);
      }
      if (updated.pipelineStage)
        setSelected((s) => (s ? { ...s, pipelineStage: updated.pipelineStage } : s));
    },
  });

  const closeWonMutation = useMutation({
    mutationFn: ({ id, data }) => closeLeadAsWon(id, data),
    onSuccess: () => {
      toast.success('Venta registrada exitosamente');
      setCloseTarget(null);
      setSelected(null);
      queryClient.invalidateQueries(['leads']);
      queryClient.invalidateQueries(['leads-column']);
      queryClient.invalidateQueries(['open-tasks']);
      queryClient.invalidateQueries(['open-tasks-column']);
    },
    onError: (e) => toast.error(e?.response?.data?.error || 'Error al registrar la venta'),
  });

  const closeLostMutation = useMutation({
    mutationFn: ({ id, data }) => closeLeadAsLost(id, data),
    onSuccess: () => {
      toast.success('Prospecto cerrado');
      setCloseTarget(null);
      setSelected(null);
      queryClient.invalidateQueries(['leads']);
      queryClient.invalidateQueries(['leads-column']);
      queryClient.invalidateQueries(['open-tasks']);
      queryClient.invalidateQueries(['open-tasks-column']);
    },
    onError: (e) => toast.error(e?.response?.data?.error || 'Error al cerrar el prospecto'),
  });

  const sendToWaitingListMutation = useMutation({
    mutationFn: ({ id, data }) => sendLeadToWaitingList(id, data),
    onSuccess: () => {
      toast.success('Prospecto enviado a lista de espera');
      setWaitingListTarget(null);
      setSelected(null);
      queryClient.invalidateQueries(['leads']);
      queryClient.invalidateQueries(['leads-column']);
      queryClient.invalidateQueries(['open-tasks']);
      queryClient.invalidateQueries(['open-tasks-column']);
    },
    onError: (e) => toast.error(e?.response?.data?.error || 'Error al enviar a lista de espera'),
  });

  const reopenMutation = useMutation({
    mutationFn: ({ id, pipelineStage }) => reopenLead(id, { pipelineStage }),
    onSuccess: (res) => {
      toast.success('Prospecto reabierto');
      setReopenTarget(null);
      queryClient.invalidateQueries(['leads']);
      queryClient.invalidateQueries(['leads-column']);
      queryClient.invalidateQueries(['lead-detail']);
      queryClient.invalidateQueries(['open-tasks']);
      queryClient.invalidateQueries(['open-tasks-column']);
      // A diferencia de close-won/close-lost (que deseleccionan al cerrar), aquí conviene
      // dejar el panel abierto: reabrir es el punto de partida para seguir trabajando el
      // prospecto, no el final de su ciclo de vida.
      setSelected((s) => (s ? { ...s, pipelineStage: res.data.pipelineStage } : s));
    },
    onError: (e) => toast.error(e?.response?.data?.error || 'Error al reabrir el prospecto'),
  });

  const deleteMutation = useMutation({
    mutationFn: deleteLead,
    onSuccess: () => {
      toast.success('Prospecto eliminado');
      setSelected(null);
      queryClient.invalidateQueries(['leads']);
      queryClient.invalidateQueries(['leads-column']);
    },
  });

  // Único punto de entrada para cambiar de etapa (drag, bottom sheet o botón del detalle):
  // las etapas terminales siempre pasan por el modal de cierre, y sacar un prospecto YA
  // cerrado de su etapa terminal siempre pasa por el modal de reapertura — el PUT genérico
  // (updateMutation) rechaza ese caso en el backend, así que nunca debe intentarse directo.
  const attemptStageChange = (lead, newStage) => {
    if (newStage === lead.pipelineStage) return;
    if (newStage === 'lista_espera') {
      setWaitingListTarget(lead);
      setSheetLead(null);
    } else if (TERMINAL_STAGES.includes(newStage)) {
      setCloseTarget({ lead, targetStage: newStage });
      setSheetLead(null);
    } else if (TERMINAL_STAGES.includes(lead.pipelineStage)) {
      setReopenTarget({ lead, targetStage: newStage });
      setSheetLead(null);
    } else {
      updateMutation.mutate(
        { id: lead.id, data: { pipelineStage: newStage } },
        { onError: (e) => toast.error(e?.response?.data?.error || 'Error al cambiar de etapa') }
      );
      setSheetLead(null);
    }
  };

  const handleDelete = () =>
    setConfirm({
      title: '¿Eliminar este prospecto?',
      message: `Se eliminará el contacto de ${selected.name} permanentemente.`,
      onConfirm: () => {
        deleteMutation.mutate(selected.id);
        setConfirm(null);
      },
    });

  return {
    confirm,
    setConfirm,
    closeTarget,
    setCloseTarget,
    reopenTarget,
    setReopenTarget,
    waitingListTarget,
    setWaitingListTarget,
    sheetLead,
    setSheetLead,
    updateMutation,
    closeWonMutation,
    closeLostMutation,
    sendToWaitingListMutation,
    reopenMutation,
    deleteMutation,
    attemptStageChange,
    handleDelete,
    closeLeadForModal: closeLeadDetail?.data || closeTarget?.lead,
  };
}
