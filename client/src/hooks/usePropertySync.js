import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { syncProperties } from '../services/propertyService';

// Reconcilia una lista de propiedades guardadas localmente (Favoritos,
// Comparador) contra el servidor en un solo request, en segundo plano
// (stale-while-revalidate): el snapshot local se pinta de inmediato y este
// hook solo corrige lo que cambió — precio, status, o si la propiedad ya
// no existe — sin bloquear el render ni provocar parpadeos.
//
// Compartido por useFavorites/useComparator vía FavoritesPage/ComparatorPage
// para no duplicar la lógica de sincronización entre ambos módulos.
export default function usePropertySync(storedItems, { onUpdate } = {}) {
  const [syncMap, setSyncMap] = useState({});
  const [syncState, setSyncState] = useState('idle'); // idle | syncing | error
  const idsKey = useMemo(
    () => [...new Set(storedItems.map((i) => i.id))].sort((a, b) => a - b).join(','),
    [storedItems]
  );
  const lastSyncedKeyRef = useRef(null);

  const runSync = useCallback(
    async (key) => {
      const ids = key ? key.split(',').map(Number) : [];
      if (!ids.length) {
        setSyncMap({});
        setSyncState('idle');
        return;
      }

      setSyncState('syncing');
      try {
        const fresh = await syncProperties(ids);
        const freshById = new Map(fresh.map((p) => [p.id, p]));
        const nextMap = {};
        ids.forEach((id) => {
          nextMap[id] = freshById.has(id)
            ? { ...freshById.get(id), missing: false }
            : { missing: true };
        });
        setSyncMap(nextMap);
        setSyncState('idle');
        lastSyncedKeyRef.current = key;
        onUpdate?.(fresh);
      } catch {
        setSyncState('error');
      }
    },
    [onUpdate]
  );

  useEffect(() => {
    if (idsKey === lastSyncedKeyRef.current) return;
    runSync(idsKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [idsKey]);

  const items = useMemo(
    () =>
      storedItems.map((item) => {
        const sync = syncMap[item.id];
        if (!sync) return item;
        if (sync.missing) return { ...item, unavailable: true };
        return { ...item, price: sync.price, status: sync.status, unavailable: false };
      }),
    [storedItems, syncMap]
  );

  const retry = useCallback(() => {
    lastSyncedKeyRef.current = null;
    runSync(idsKey);
  }, [idsKey, runSync]);

  return { items, syncState, retry };
}
