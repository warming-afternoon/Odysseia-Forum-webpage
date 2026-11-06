import { useSyncExternalStore } from 'react';
import { captureAuthSession, subscribeAuthInvalidation } from '@/shared/lib/authSession';
import { useQuery } from '@tanstack/react-query';
import { worksApi } from './api';

const getSessionGeneration = () => captureAuthSession().generation;

/** Both route and global preview must observe native main-thread completion. */
export function useWorkPresentation(workId: string) {
  const generation = useSyncExternalStore(subscribeAuthInvalidation, getSessionGeneration);
  const result = useQuery({
    queryKey: ['works-v2', 'presentation', workId, generation],
    queryFn: ({ signal }) => worksApi.get(workId, signal),
    enabled: Boolean(workId), retry: false, staleTime: 0,
    refetchInterval: query => {
      const work = query.state.data;
      return work && !query.state.error && (work.sync_status === 'pending' || (work.source_platform === 'fluxer' && !work.source_thread_id)) ? 3000 : false;
    },
  });
  return {
    ...result,
    // Every new observer/opening must revalidate cached permissions. Once it has,
    // background refreshes must not unmount children that can request a refresh.
    isValidating: result.isPending || (!result.isFetchedAfterMount && !result.error),
  };
}
