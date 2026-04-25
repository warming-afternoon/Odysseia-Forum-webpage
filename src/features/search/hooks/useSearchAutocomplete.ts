import { useMemo } from "react";

import { useQuery } from "@tanstack/react-query";

import { searchApi } from "@/features/search/api/searchApi";
import { booklistsApi } from "@/features/booklists/api/booklistsApi";
import type { UserPreferencesResponse } from "@/features/preferences/api/preferencesApi";
import {
  getDiscoveryPreferenceContext,
} from "@/features/preferences/lib/discoveryPreferences";
import { ALL_VIRTUAL_TAGS } from "@/shared/config/navigation";
import { parseSearchQuery } from "@/shared/lib/searchTokenizer";
import type { SearchParams } from "@/features/search/hooks/useSearchParams";
import { searchKeys } from "@/features/search/lib/queryKeys";

function mergeUnique(values: string[]) {
  return Array.from(
    new Set(values.map((value) => value.trim()).filter(Boolean)),
  );
}

interface UseSearchAutocompleteOptions {
  params: SearchParams;
  preferences: UserPreferencesResponse | null | undefined;
  searchInput: string;
  debouncedQuery: string;
  showSuggestions: boolean;
}

export function useSearchAutocomplete({
  params,
  preferences,
  searchInput,
  debouncedQuery,
  showSuggestions,
}: UseSearchAutocompleteOptions) {
  const activeVirtualTag = useMemo(() => {
    const tokens = parseSearchQuery(searchInput || "");
    const tagToken = tokens.find(
      (token) => token.type === "tag" && token.mode === "include",
    );
    if (!tagToken) return null;
    return (
      ALL_VIRTUAL_TAGS.find(
        (virtualTag) => virtualTag.name === tagToken.value,
      ) ?? null
    );
  }, [searchInput]);

  const { data: filterMeta } = useQuery({
    queryKey: searchKeys.filterMeta(params.channel),
    queryFn: () =>
      searchApi.search({
        channel_ids: params.channel ? [params.channel] : undefined,
        limit: 1,
      }),
    staleTime: 5 * 60 * 1000,
  });

  const { data: channelTagCatalog = [] } = useQuery({
    queryKey: searchKeys.channelTagCatalog(),
    queryFn: () => searchApi.getChannelTagCatalog(),
    enabled: !params.channel,
    staleTime: 5 * 60 * 1000,
    retry: false,
  });

  const globalAvailableTags = useMemo(() => {
    const tagSet = new Set<string>();
    const scopedCatalog = params.channel
      ? channelTagCatalog.filter((channel) => channel.channel_id === params.channel)
      : channelTagCatalog;

    for (const channel of scopedCatalog) {
      for (const tag of channel.available_tags || []) {
        if (tag?.trim()) tagSet.add(tag.trim());
      }
      for (const tag of channel.virtual_tags || []) {
        if (tag?.trim()) tagSet.add(tag.trim());
      }
    }
    return Array.from(tagSet);
  }, [channelTagCatalog, params.channel]);

  const virtualTagOriginChannelMap = useMemo(() => {
    const map = new Map<string, string>();
    for (const channel of channelTagCatalog) {
      for (const tag of channel.virtual_tags || []) {
        if (tag?.trim() && !map.has(tag.trim())) {
          map.set(tag.trim(), channel.channel_id);
        }
      }
    }
    return map;
  }, [channelTagCatalog]);

  const availableTags = useMemo(() => {
    return mergeUnique([
      ...(filterMeta?.virtual_tags || []),
      ...(filterMeta?.available_tags || []),
      ...globalAvailableTags,
      ...params.includeTags,
      ...params.excludeTags,
    ]);
  }, [
    filterMeta?.available_tags,
    filterMeta?.virtual_tags,
    globalAvailableTags,
    params.includeTags,
    params.excludeTags,
  ]);

  const discoveryPreferenceContext = useMemo(
    () => getDiscoveryPreferenceContext(preferences),
    [preferences],
  );

  const { data: suggestionSearchData } = useQuery({
    queryKey: searchKeys.suggestions({
      query: debouncedQuery,
      channel: params.channel,
      preferenceSignature: discoveryPreferenceContext?.signature,
    }),
    queryFn: () =>
      searchApi.search({
        query: debouncedQuery,
        channel_ids: params.channel ? [params.channel] : undefined,
        limit: 5,
        sort_method: "relevance",
        apply_preferences: true,
      }),
    enabled: showSuggestions && debouncedQuery.length > 0,
    staleTime: 30 * 1000,
    retry: false,
  });

  const { data: suggestionBooklistsData } = useQuery({
    queryKey: searchKeys.booklistSuggestions(debouncedQuery),
    queryFn: () =>
      booklistsApi.listPublic({
        keywords: debouncedQuery,
        pageIndex: 0,
        pageSize: 5,
        sortMethod: 3,
      }),
    enabled: showSuggestions && debouncedQuery.length > 0,
    staleTime: 30 * 1000,
    retry: false,
  });

  const suggestionThreads = useMemo(() => {
    return (suggestionSearchData?.results || []).slice(0, 5).map((thread) => ({
      thread_id: thread.thread_id,
      title: thread.title,
      snippet: thread.first_message_excerpt || "",
      thumbnail_url: thread.thumbnail_urls?.[0] || null,
      author_name:
        thread.author?.display_name ||
        thread.author?.global_name ||
        thread.author?.name ||
        "未知用户",
      author_avatar_url: thread.author?.avatar_url || null,
      source_thread: thread,
    }));
  }, [suggestionSearchData?.results]);

  const suggestionAuthors = useMemo(() => {
    const unique = new Map<
      string,
      { id: string; name: string; avatar_url?: string | null }
    >();

    for (const thread of suggestionSearchData?.results || []) {
      if (!thread.author) continue;
      const authorId = String(thread.author.id);
      if (unique.has(authorId)) continue;

      unique.set(authorId, {
        id: authorId,
        name:
          thread.author.display_name ||
          thread.author.global_name ||
          thread.author.name,
        avatar_url: thread.author.avatar_url || null,
      });

      if (unique.size >= 5) break;
    }

    return Array.from(unique.values());
  }, [suggestionSearchData?.results]);

  const suggestionTags = useMemo(() => {
    return mergeUnique([
      ...(suggestionSearchData?.virtual_tags || []),
      ...(suggestionSearchData?.available_tags || []),
    ]).slice(0, 5);
  }, [
    suggestionSearchData?.available_tags,
    suggestionSearchData?.virtual_tags,
  ]);

  const suggestionBooklists = useMemo(() => {
    return (suggestionBooklistsData?.results || [])
      .slice(0, 5)
      .map((booklist) => ({
        id: booklist.id,
        title: booklist.title,
        description: booklist.description || "",
        cover_image_url: booklist.cover_image_url || null,
        item_count: booklist.item_count,
        collection_count: booklist.collection_count,
      }));
  }, [suggestionBooklistsData?.results]);

  return {
    activeVirtualTag,
    availableTags,
    discoveryPreferenceContext,
    suggestionAuthors,
    suggestionTags,
    suggestionThreads,
    suggestionBooklists,
    virtualTagOriginChannelMap,
  };
}
