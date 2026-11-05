import { useQuery } from '@tanstack/react-query';
import { worksApi } from './api';

/** Both route and global preview must observe native main-thread completion. */
export function useWorkPresentation(workId: string) {
  return useQuery({
    queryKey: ['works-v2', 'presentation', workId],
    queryFn: ({ signal }) => worksApi.get(workId, signal),
    enabled: Boolean(workId), retry: false, staleTime: 0,
    refetchInterval: query => {
      const work = query.state.data;
      return work && !query.state.error && (work.sync_status === 'pending' || (work.source_platform === 'fluxer' && !work.source_thread_id)) ? 3000 : false;
    },
  });
}
