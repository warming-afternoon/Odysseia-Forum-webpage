import { useCallback } from 'react';

import { addToken, parseSearchQuery, removeToken } from '@/shared/lib/searchTokenizer';
import type { SearchParams } from '@/features/search/hooks/useSearchParams';

interface UseTopBarFilterStateOptions {
  params: SearchParams;
  updateQueryFromTokenMutation: (mutator: (tokens: ReturnType<typeof parseSearchQuery>) => string) => void;
  virtualTagOriginChannelMap: Map<string, string>;
}

export function useTopBarFilterState({
  params,
  updateQueryFromTokenMutation,
  virtualTagOriginChannelMap,
}: UseTopBarFilterStateOptions) {
  const toggleTagToken = useCallback(
    (tagName: string, mode: 'include' | 'exclude') => {
      updateQueryFromTokenMutation((tokens) => {
        const existing = tokens.find(
          (token) => token.type === 'tag' && token.value === tagName && token.mode === mode,
        );
        const virtualOriginChannelId = !params.channel
          ? virtualTagOriginChannelMap.get(tagName) || null
          : null;

        let nextQuery = params.query || '';
        if (existing) {
          nextQuery = removeToken(nextQuery, existing);
          if (virtualOriginChannelId) {
            const nextTokens = parseSearchQuery(nextQuery);
            const hasOtherVirtualFromSameOrigin = nextTokens.some(
              (token) =>
                token.type === 'tag' &&
                token.mode === 'include' &&
                virtualTagOriginChannelMap.get(token.value) === virtualOriginChannelId,
            );
            if (!hasOtherVirtualFromSameOrigin) {
              const channelToken = nextTokens.find(
                (token) =>
                  token.type === 'channel' &&
                  token.mode === 'include' &&
                  token.value === virtualOriginChannelId,
              );
              if (channelToken) {
                nextQuery = removeToken(nextQuery, channelToken);
              }
            }
          }
        } else {
          const opposite = tokens.find(
            (token) => token.type === 'tag' && token.value === tagName && token.mode !== mode,
          );
          if (opposite) {
            nextQuery = removeToken(nextQuery, opposite);
          }
          nextQuery = addToken(nextQuery, 'tag', tagName, mode);
          if (virtualOriginChannelId) {
            nextQuery = addToken(nextQuery, 'channel', virtualOriginChannelId, 'include');
          }
        }
        return nextQuery.trim();
      });
    },
    [params.channel, params.query, updateQueryFromTokenMutation, virtualTagOriginChannelMap],
  );

  return {
    toggleTagToken,
  };
}
