import { QueryClient } from '@tanstack/react-query';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { fetchImagesApi } from '@/features/threads/api/fetchImagesApi';
import {
  bindThumbnailRepairQueryClient,
  reportBrokenThreadThumbnail,
} from '@/features/threads/lib/thumbnailRepairQueue';

vi.mock('@/features/threads/api/fetchImagesApi', () => ({
  fetchImagesApi: { refresh: vi.fn() },
}));

describe('缩略图修复缓存更新', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('只扫描可能持有 Thread 的缓存根键', async () => {
    const queryClient = new QueryClient();
    const threadCache = {
      results: [{ thread_id: '101', thumbnail_urls: ['old.webp'] }],
    };
    const unrelatedCache = {
      nested: { thread_id: '101', thumbnail_urls: ['unrelated.webp'] },
    };
    queryClient.setQueryData(['search', 'results'], threadCache);
    queryClient.setQueryData(['auth'], unrelatedCache);
    bindThumbnailRepairQueryClient(queryClient);

    vi.mocked(fetchImagesApi.refresh).mockResolvedValue({
      results: [
        { thread_id: '101', thumbnail_urls: ['repaired.webp'], updated: true },
      ],
    });

    reportBrokenThreadThumbnail({ threadId: '101', channelId: '202' });
    await vi.advanceTimersByTimeAsync(800);

    expect(queryClient.getQueryData(['search', 'results'])).toEqual({
      results: [{ thread_id: '101', thumbnail_urls: ['repaired.webp'] }],
    });
    expect(queryClient.getQueryData(['auth'])).toBe(unrelatedCache);
  });

  it('同 ID 在途上报不重复派发，不同 ID 可进入后续批次', async () => {
    let finish!: (value: { results: [] }) => void;
    vi.mocked(fetchImagesApi.refresh).mockReturnValueOnce(new Promise((resolve) => { finish = resolve; }))
      .mockResolvedValue({ results: [] });
    reportBrokenThreadThumbnail({ threadId: '301' });
    await vi.advanceTimersByTimeAsync(800);
    reportBrokenThreadThumbnail({ threadId: '301' });
    reportBrokenThreadThumbnail({ threadId: '302' });
    await vi.advanceTimersByTimeAsync(800);
    expect(fetchImagesApi.refresh).toHaveBeenCalledTimes(2);
    expect(vi.mocked(fetchImagesApi.refresh).mock.calls.map(([items]) => items.map((item) => item.thread_id))).toEqual([['301'], ['302']]);
    finish({ results: [] });
    await vi.advanceTimersByTimeAsync(0);
    reportBrokenThreadThumbnail({ threadId: '301' });
    await vi.advanceTimersByTimeAsync(800);
    expect(fetchImagesApi.refresh).toHaveBeenCalledTimes(3);
  });

  it('失败后保留既有冷却期，期满仍可重新修复', async () => {
    vi.mocked(fetchImagesApi.refresh).mockRejectedValueOnce(new Error('修复失败'))
      .mockResolvedValue({ results: [] });
    reportBrokenThreadThumbnail({ threadId: '401' });
    await vi.advanceTimersByTimeAsync(800);
    reportBrokenThreadThumbnail({ threadId: '401' });
    await vi.advanceTimersByTimeAsync(800);
    expect(fetchImagesApi.refresh).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(30_000);
    reportBrokenThreadThumbnail({ threadId: '401' });
    await vi.advanceTimersByTimeAsync(800);
    expect(fetchImagesApi.refresh).toHaveBeenCalledTimes(2);
  });
});
