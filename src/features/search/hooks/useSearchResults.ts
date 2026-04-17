import { useEffect, useMemo, useRef, useState } from 'react';

import { useInfiniteQuery } from '@tanstack/react-query';

import type { Thread } from '@/entities/thread/types';
import { searchApi } from '@/features/search/api/searchApi';
import {
  getDiscoveryPreferenceContext,
  resolveDiscoveryPreferencePatch,
} from '@/features/preferences/lib/discoveryPreferences';
import type { UserPreferencesResponse } from '@/features/preferences/api/preferencesApi';
import type { SearchParams } from '@/features/search/hooks/useSearchParams';
import { searchKeys } from '@/features/search/lib/queryKeys';

interface UseSearchResultsOptions {
  params: SearchParams;
  preferences: UserPreferencesResponse | null | undefined;
}

export function useSearchResults({ params, preferences }: UseSearchResultsOptions) {
  const {
    query,
    channel: selectedChannel,
    includeTags,
    excludeTags,
    includeAuthors,
    excludeAuthors,
    tagLogic,
    sortMethod,
    timeFrom,
    timeTo,
  } = params;

  const perPage = 24;
  const loadMoreRef = useRef<HTMLDivElement | null>(null);
  const [ignoreDiscoveryPreferences, setIgnoreDiscoveryPreferences] = useState(false);

  const hasExplicitFilters =
    includeTags.length > 0 ||
    excludeTags.length > 0 ||
    includeAuthors.length > 0 ||
    excludeAuthors.length > 0 ||
    !!timeFrom ||
    !!timeTo ||
    (sortMethod && sortMethod !== 'last_active_desc') ||
    (tagLogic && tagLogic !== 'and');

  const discoveryPreferenceContext = useMemo(
    () => getDiscoveryPreferenceContext(preferences),
    [preferences],
  );

  const discoveryPreferencePatch = useMemo(
    () =>
      ignoreDiscoveryPreferences
        ? null
        : resolveDiscoveryPreferencePatch({
            preferences,
            mode: 'browse-empty',
            query,
            selectedChannel,
            hasExplicitFilters,
          }),
    [preferences, query, selectedChannel, hasExplicitFilters, ignoreDiscoveryPreferences],
  );

  const effectiveSortMethod = discoveryPreferencePatch?.sort_method || sortMethod;
  
  const effectivePerPage = discoveryPreferencePatch?.limit || perPage;
  const effectiveChannelIds = selectedChannel ? [selectedChannel] : discoveryPreferencePatch?.channel_ids;
  const effectiveIncludeTags = includeTags.length > 0 ? includeTags : discoveryPreferencePatch?.include_tags || [];
  const effectiveExcludeTags = excludeTags.length > 0 ? excludeTags : discoveryPreferencePatch?.exclude_tags || [];

  useEffect(() => {
    if (query.trim() || selectedChannel || hasExplicitFilters) {
      setIgnoreDiscoveryPreferences(false);
    }
  }, [query, selectedChannel, hasExplicitFilters]);

  const queryState = useInfiniteQuery<any, Error, any, any, any>({
    queryKey: searchKeys.results({
      ...params,
      effectiveChannelIds,
      effectiveIncludeTags,
      effectiveExcludeTags,
      effectiveSortMethod,
      effectivePerPage,
      preferenceSignature: discoveryPreferenceContext?.signature,
    }),
    initialPageParam: 0,
    queryFn: ({ pageParam }) =>
      searchApi.search({
        query: query || undefined,
        channel_ids: effectiveChannelIds,
        include_tags: effectiveIncludeTags,
        exclude_tags: effectiveExcludeTags,
        tag_logic: tagLogic,
        sort_method: effectiveSortMethod,
        limit: effectivePerPage,
        // 当使用 exclude_thread_ids 时，必须将 offset 设为 0，
        // 否则会导致后端在排除后的集合基础上再次进行偏移，产生跳页 Bug。
        offset: 0,
        exclude_thread_ids: typeof pageParam === 'object' ? (pageParam as any).exclude_thread_ids : [],
        created_after: timeFrom || undefined,
        created_before: timeTo || undefined,
      }),
    getNextPageParam: (lastPage, allPages) => {
      const excludeIds = allPages.flatMap((page: any) => 
        (page.results || []).map((t: any) => t.thread_id)
      ).filter(Boolean);

      // 【注意】适配后端特有的“余量总计”逻辑：
      // 这里的 total 是指排除掉已加载项后，数据库里还剩下多少。
      // 只要余量 > 0，就说明还没到底，可以继续“拉黑”翻页。
      return (lastPage.total || 0) > 0 
        ? { offset: 0, exclude_thread_ids: excludeIds } 
        : undefined;
    },
    staleTime: 30 * 1000,
  });

  const results = useMemo<Thread[]>(() => {
    const pages = queryState.data?.pages || [];
    const mergedResults = pages.flatMap(
      (page: any) => page.results || [],
    ) as Thread[];

    const uniqueResults = new Map<string, Thread>();
    for (const thread of mergedResults) {
      if (!thread?.thread_id) continue;
      // 强制转 String，防止 Map 键值类型不匹配导致合并失败
      const key = String(thread.thread_id);
      if (!uniqueResults.has(key)) {
        uniqueResults.set(key, thread);
      }
    }

    const finalResults = Array.from(uniqueResults.values());
    
    // --- 调试埋点 ---
    if (finalResults.length > 0) {
      console.log(`%c[React状态] 当前已合成了 ${finalResults.length} 个唯一帖子 (总回包数据: ${mergedResults.length})`, "color: #ec4899; font-weight: bold;");
    }
    
    return finalResults;
  }, [queryState.data]);

  const totalResults = Number(queryState.data?.pages?.[0]?.total || 0);

  const lastFetchTimeRef = useRef<number>(0);
  useEffect(() => {
    const target = loadMoreRef.current;
    if (!target || !queryState.hasNextPage) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && queryState.hasNextPage && !queryState.isFetchingNextPage) {
          const now = Date.now();
          // 强力节流：1秒钟内只准发起一次翻页请求，给 UI 渲染和去重留足时间
          if (now - lastFetchTimeRef.current > 1000) {
            lastFetchTimeRef.current = now;
            queryState.fetchNextPage();
          }
        }
      },
      { rootMargin: '200px 0px' },
    );

    observer.observe(target);
    return () => observer.disconnect();
  }, [queryState.fetchNextPage, queryState.hasNextPage, queryState.isFetchingNextPage]);

  const hasSearchFilters = !!query || hasExplicitFilters;
  const isPreferenceFilteredBrowse =
    !query.trim() && !selectedChannel && !hasExplicitFilters && Boolean(discoveryPreferencePatch);

  return {
    discoveryPreferenceContext,
    hasExplicitFilters,
    hasSearchFilters,
    ignoreDiscoveryPreferences,
    isPreferenceFilteredBrowse,
    loadMoreRef,
    queryState,
    results,
    setIgnoreDiscoveryPreferences,
    totalResults,
  };
}
