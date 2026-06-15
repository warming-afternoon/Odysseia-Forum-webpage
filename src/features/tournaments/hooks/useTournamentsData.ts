import { useInfiniteQuery, useQuery } from "@tanstack/react-query";

import { tournamentsApi } from "@/features/tournaments/api/tournamentsApi";
import { tournamentKeys } from "@/features/tournaments/lib/queryKeys";

export function useTournamentsList(params: {
  pageIndex: number;
  pageSize: number;
  sortMethod: number;
  sortOrder?: "asc" | "desc";
}) {
  return useQuery({
    queryKey: tournamentKeys.list(params),
    queryFn: () => tournamentsApi.list(params),
    staleTime: 60 * 1000,
    placeholderData: (prev) => prev,
  });
}

export function useTournamentDetail(booklistId: string | number) {
  const enabled = /^\d+$/.test(String(booklistId));

  return useQuery({
    queryKey: tournamentKeys.detail(booklistId),
    queryFn: () => tournamentsApi.getDetail(booklistId),
    enabled,
    staleTime: 60 * 1000,
  });
}

export function useTournamentItems(booklistId: string | number) {
  const enabled = /^\d+$/.test(String(booklistId));

  return useInfiniteQuery({
    queryKey: tournamentKeys.items(booklistId),
    queryFn: ({ pageParam }) =>
      tournamentsApi.listItems(booklistId, {
        limit: 24,
        offset: pageParam as number,
      }),
    initialPageParam: 0,
    getNextPageParam: (lastPage) => {
      if (!lastPage.results || lastPage.results.length === 0) return undefined;
      const nextOffset = lastPage.offset + lastPage.limit;
      return nextOffset < (lastPage.total || 0) ? nextOffset : undefined;
    },
    enabled,
    staleTime: 60 * 1000,
  });
}
