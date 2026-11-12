import { useQuery } from '@tanstack/react-query';
import { tagsApi, type TagStatsRequest } from '@/features/tags/api/tagsApi';
import { tagKeys } from '@/features/tags/lib/queryKeys';

/** 标签使用统计以作品为单位，未传范围表示全部可见作品。 */
export function useTagStats(params: TagStatsRequest = {}) {
  return useQuery({
    queryKey: tagKeys.stats(params),
    queryFn: ({ signal }) => tagsApi.getStats(params, signal),
    staleTime: 5 * 60 * 1000,
  });
}
