import { act, renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { describe, expect, it, vi } from 'vitest';

import { booklistsApi } from '@/features/booklists/api/booklistsApi';
import { booklistKeys } from '@/features/booklists/lib/queryKeys';
import { useUpdateBooklistItem } from './useBooklistsData';

vi.mock('@/features/booklists/api/booklistsApi', () => ({ booklistsApi: { updateItem: vi.fn() } }));
vi.mock('@/features/mascot/lib/notify', () => ({ notifySuccess: vi.fn(), notifyError: vi.fn() }));

describe('书单在途请求的资源归属', () => {
  it('hook 切换资源后仍刷新提交时的 A，并调用 A 的完成回调', async () => {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: Infinity } } });
    for (const id of ['1', '2']) {
      client.setQueryData(booklistKeys.detail(id), { title: id });
      client.setQueryData(booklistKeys.items(id), { pages: [] });
    }
    let complete!: () => void;
    vi.mocked(booklistsApi.updateItem).mockReturnValue(new Promise((resolve) => {
      complete = () => resolve({
        booklist_item_id: 1, thread_id: '101', channel_id: '201', title: '帖子',
        author: { id: 'owner', name: '作者', global_name: null, display_name: '作者', avatar_url: null },
        created_at: '2026-10-01T00:00:00Z', added_at: '2026-10-01T00:00:00Z',
        reaction_count: 0, reply_count: 0, display_count: 0, collection_count: 0,
        thumbnail_urls: [], display_order: 0, collected_flag: false,
      });
    }));
    const onA = vi.fn();
    const onB = vi.fn();
    const { result, rerender, unmount } = renderHook(
      ({ id, onSuccess }) => useUpdateBooklistItem(id, onSuccess),
      {
        initialProps: { id: '1', onSuccess: onA },
        wrapper: ({ children }: { children: ReactNode }) => <QueryClientProvider client={client}>{children}</QueryClientProvider>,
      },
    );
    act(() => result.current.mutate({ threadId: '101', payload: { comment: 'A 的修改' } }));
    await waitFor(() => expect(booklistsApi.updateItem).toHaveBeenCalledWith('1', '101', { comment: 'A 的修改' }));
    rerender({ id: '2', onSuccess: onB });
    await act(async () => complete());
    await waitFor(() => expect(onA).toHaveBeenCalledTimes(1));
    expect(onB).not.toHaveBeenCalled();
    expect(client.getQueryState(booklistKeys.detail('1'))?.isInvalidated).toBe(true);
    expect(client.getQueryState(booklistKeys.items('1'))?.isInvalidated).toBe(true);
    expect(client.getQueryState(booklistKeys.detail('2'))?.isInvalidated).toBe(false);
    expect(client.getQueryState(booklistKeys.items('2'))?.isInvalidated).toBe(false);
    unmount();
    client.clear();
  });
});
