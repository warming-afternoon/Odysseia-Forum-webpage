import type { QueryClient } from '@tanstack/react-query';
import { usePreviewStore } from '@/features/search/store/previewStore';

/** Every surface holding visible work/author projections must revalidate permission changes. */
export async function resetVisibleContent(client: QueryClient) {
  const filter = { predicate: (query: { queryKey: readonly unknown[] }) =>
    (query.queryKey[0] === 'works-v2' && query.queryKey[1] !== 'me') ||
    ['search', 'authors', 'search-discovery', 'booklists'].includes(String(query.queryKey[0])) };
  window.dispatchEvent(new Event("works-visible-content-reset"));
  await client.cancelQueries(filter);
  usePreviewStore.getState().setPreviewThreadId(null);
  // reset, rather than invalidate: old restricted titles/images must disappear now.
  await client.resetQueries(filter);
}
