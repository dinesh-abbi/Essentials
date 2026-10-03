import { useFocusEffect } from 'expo-router';
import { useCallback, useRef } from 'react';

import * as SyncManager from '@/utils/SyncManager';

/**
 * Re-runs `reload` while the screen is focused whenever background sync or a
 * cache revalidation reports new data for one of `scopes`. Pair with the
 * screen's normal focus load: that paints from cache instantly, this picks up
 * whatever Firestore had that the cache didn't.
 */
export function useDataRefresh(scopes: SyncManager.DataScope[], reload: () => void) {
  const reloadRef = useRef(reload);
  const scopesKey = scopes.join(',');

  useFocusEffect(
    useCallback(() => {
      reloadRef.current = reload;
    }, [reload]),
  );

  useFocusEffect(
    useCallback(() => {
      let timer: ReturnType<typeof setTimeout> | null = null;
      const wanted = new Set(scopesKey.split(','));
      const unsubscribe = SyncManager.subscribe((scope) => {
        if (scope !== 'all' && !wanted.has(scope)) return;
        // Coalesce bursts (several collections landing together) into one reload.
        if (timer) clearTimeout(timer);
        timer = setTimeout(() => reloadRef.current(), 250);
      });
      return () => {
        if (timer) clearTimeout(timer);
        unsubscribe();
      };
    }, [scopesKey]),
  );
}
