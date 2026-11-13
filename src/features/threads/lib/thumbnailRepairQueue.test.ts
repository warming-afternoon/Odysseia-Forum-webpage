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

  it('作品补图不会误改数字相同的Discord卡片', async () => {
    const queryClient = new QueryClient();
    const work = { id: '701', source_platform: 'fluxer', images: ['old.webp'] };
    queryClient.setQueryData(['search', 'work-repair'], { results: [
      { thread_id: '701', work, thumbnail_urls: ['old.webp'] },
      { thread_id: '701', thumbnail_urls: ['discord.webp'] },
    ] });
    queryClient.setQueryData(['works-v2', 'detail', '701'], work);
    bindThumbnailRepairQueryClient(queryClient);
    vi.mocked(fetchImagesApi.refresh).mockResolvedValue({ results: [
      { thread_id: 'work:701', thumbnail_urls: ['new.webp'], updated: true },
    ] });
    reportBrokenThreadThumbnail({ threadId: 'work:701' });
    await vi.advanceTimersByTimeAsync(800);
    expect(queryClient.getQueryData(['search', 'work-repair'])).toEqual({ results: [
      { thread_id: '701', work: { ...work, images: ['new.webp'] }, thumbnail_urls: ['new.webp'] },
      { thread_id: '701', thumbnail_urls: ['discord.webp'] },
    ] });
    expect(queryClient.getQueryData(['works-v2', 'detail', '701'])).toEqual({ ...work, images: ['new.webp'] });
  });

  it('单项失败和空结果也冷却，不立即反复补抓', async () => {
    vi.mocked(fetchImagesApi.refresh).mockResolvedValue({ results: [
      { thread_id: 'work:702', thumbnail_urls: [], updated: false, error: 'no_images' },
    ] });
    reportBrokenThreadThumbnail({ threadId: 'work:702' });
    await vi.advanceTimersByTimeAsync(800);
    reportBrokenThreadThumbnail({ threadId: 'work:702' });
    await vi.advanceTimersByTimeAsync(800);
    expect(fetchImagesApi.refresh).toHaveBeenCalledTimes(1);
  });
});
