import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { followsApi, type FollowsQueryParams } from '@/features/follows/api/followsApi';
import { followsKeys } from '@/features/follows/lib/queryKeys';

export function useFollowedThreads(params: FollowsQueryParams = {}) {
  return useQuery({
    queryKey: followsKeys.list(params),
    queryFn: () => followsApi.getFollowsRaw(params),
    staleTime: 60 * 1000,
  });
}

export function useUnreadFollowCount() {
  return useQuery({
    queryKey: followsKeys.unreadCount(),
    queryFn: followsApi.getUnreadCount,
    staleTime: 60 * 1000,
    refetchInterval: 30 * 1000,
    refetchOnWindowFocus: true,
  });
}

export function useFollowsFeed(params: FollowsQueryParams = {}) {
  const followsQuery = useFollowedThreads(params);
  const unreadQuery = useUnreadFollowCount();

  return {
    data: {
      results: followsQuery.data?.threads ?? [],
      total: followsQuery.data?.total ?? 0,
      unread_count: unreadQuery.data?.unread_count ?? 0,
    },
    isLoading: followsQuery.isLoading || unreadQuery.isLoading,
    isError: followsQuery.isError || unreadQuery.isError,
    refetch: async () => {
      await Promise.all([followsQuery.refetch(), unreadQuery.refetch()]);
    },
  };
}

export function useMarkAllFollowsViewed() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: followsApi.markAllViewed,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: followsKeys.all });
    },
  });
}
