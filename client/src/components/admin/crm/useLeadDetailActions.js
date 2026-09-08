import { useEffect, useRef, useState } from 'react';
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
// reusarla exacta, sin reimplementarla.
export default function useLeadDetailActions({ selected, setSelected }) {
  const queryClient = useQueryClient();
  const [confirm, setConfirm] = useState(null);
  const [closeTarget, setCloseTarget] = useState(null); // { lead, targetStage }
  const [reopenTarget, setReopenTarget] = useState(null); // { lead, targetStage }
  const [waitingListTarget, setWaitingListTarget] = useState(null); // lead
  const [sheetLead, setSheetLead] = useState(null);
  // Campos editados en LeadDetailPanel sin guardar todavía — una entrada por clave de
  // campo ({ data, label, before, after }), acumuladas mientras el usuario sigue en el
  // mismo prospecto (ver queueChange/onFieldChange en LeadDetailPanel.jsx). `pendingNav`
  // guarda qué hacer si el usuario confirma/descarta al intentar salir: cerrar el detalle
  // o abrir otro prospecto de la lista.
  const [pendingChanges, setPendingChanges] = useState({});
  const [pendingNav, setPendingNav] = useState(null); // null | { type: 'deselect' } | { type: 'select', lead }
  // A qué prospecto pertenecen los `pendingChanges` actuales — normalmente coincide con
  // `selected?.id`, salvo por una vía que no pasa por requestSelectLead/requestDeselect
  // (ej. Calendario abre un prospecto distinto directo con su propio setSelected mientras
  // este panel ya tenía cambios sin guardar de otro). El efecto de abajo es la salvaguarda
  // contra ESA vía: sin ella, esos campos podrían terminar guardándose sobre el id
  // equivocado en vez de simplemente perderse (que es lo que ya pasaba antes de este
  // cambio con cualquier edición sin confirmar).
  const pendingChangesLeadIdRef = useRef(null);

  const { data: closeLeadDetail } = useQuery({
    queryKey: ['lead-detail-for-close', closeTarget?.lead?.id],
    queryFn: () => getLeadById(closeTarget.lead.id),
    enabled: !!closeTarget?.lead?.id,
  });

  // Sin toast global de éxito: cada campo editado desde LeadDetailPanel confirma junto al
  // propio campo (ver FieldStatus ahí), y un movimiento de etapa por la hoja de selección
  // ya es visible por sí mismo (la etapa del encabezado cambia).
  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => updateLead(id, data),
    onSuccess: (res, { data: updated }) => {
      queryClient.invalidateQueries(['leads']);
      queryClient.invalidateQueries(['lead-detail']);
      queryClient.invalidateQueries(['appointments-month']);
      queryClient.invalidateQueries(['appointments-agenda']);
      const affectsColumns = updated.pipelineStage !== undefined;
      if (affectsColumns) queryClient.invalidateQueries(['leads-column']);
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

  // Único punto de entrada para cambiar de etapa (bottom sheet o botón del detalle):
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

  // Único punto de entrada para que LeadDetailPanel registre (o borre, con entry=null) un
  // campo editado sin guardar — ver queueChange ahí. No dispara ningún PUT por sí mismo.
  const stageFieldChange = (key, entry) => {
    setPendingChanges((prev) => {
      const wasEmpty = Object.keys(prev).length === 0;
      let next;
      if (!entry) {
        if (!(key in prev)) return prev;
        next = { ...prev };
        delete next[key];
      } else {
        next = { ...prev, [key]: entry };
      }
      const isEmpty = Object.keys(next).length === 0;
      if (wasEmpty && !isEmpty) pendingChangesLeadIdRef.current = selected?.id ?? null;
      if (isEmpty) pendingChangesLeadIdRef.current = null;
      return next;
    });
  };

  // Salvaguarda descrita arriba: si `selected` cambia de prospecto por una vía que no pasó
  // por requestSelectLead/requestDeselect, los cambios pendientes que quedaron huérfanos se
  // descartan en vez de arriesgar que se guarden sobre el id equivocado.
  useEffect(() => {
    if (pendingChangesLeadIdRef.current != null && selected?.id !== pendingChangesLeadIdRef.current) {
      setPendingChanges({});
      setPendingNav(null);
      pendingChangesLeadIdRef.current = null;
    }
  }, [selected?.id]);

  const hasPendingChanges = Object.keys(pendingChanges).length > 0;
  const pendingChangesList = Object.entries(pendingChanges).map(([key, entry]) => ({
    key,
    ...entry,
  }));

  // Reemplazan a los `setSelected(null)`/`setSelected(lead)` directos de siempre —
  // interceptan la salida del prospecto actual si quedan campos sin guardar (ver
  // PendingChangesModal) en vez de descartarlos en silencio. Elegir el mismo prospecto que
  // ya está abierto no cuenta como "salir".
  const requestDeselect = () => {
    if (!hasPendingChanges) {
      setSelected(null);
      return;
    }
    setPendingNav({ type: 'deselect' });
  };

  const requestSelectLead = (lead) => {
    if (!hasPendingChanges || selected?.id === lead.id) {
      setSelected(lead);
      return;
    }
    setPendingNav({ type: 'select', lead });
  };

  const resolvePendingNav = (nav) => {
    if (!nav) return;
    if (nav.type === 'deselect') setSelected(null);
    else setSelected(nav.lead);
  };

  const confirmPendingChanges = async () => {
    const id = selected.id;
    const data = Object.assign({}, ...Object.values(pendingChanges).map((c) => c.data));
    try {
      await updateMutation.mutateAsync({ id, data });
      toast.success('Cambios guardados');
      setPendingChanges({});
      resolvePendingNav(pendingNav);
      setPendingNav(null);
    } catch (e) {
      // Se deja el modal abierto con los cambios intactos (ni se navega ni se pierden)
      // para que el usuario pueda corregir y reintentar.
      toast.error(e?.response?.data?.error || 'No se pudo guardar');
    }
  };

  const discardPendingChanges = () => {
    setPendingChanges({});
    resolvePendingNav(pendingNav);
    setPendingNav(null);
  };

  const cancelPendingNav = () => setPendingNav(null);

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
    pendingChanges,
    pendingChangesList,
    hasPendingChanges,
    pendingNav,
    stageFieldChange,
    requestDeselect,
    requestSelectLead,
    confirmPendingChanges,
    discardPendingChanges,
    cancelPendingNav,
  };
}
