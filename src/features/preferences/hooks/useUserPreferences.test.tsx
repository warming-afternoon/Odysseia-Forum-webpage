import { act, renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { preferencesApi, type UserPreferencesResponse } from '@/features/preferences/api/preferencesApi';
import { useUserPreferences } from './useUserPreferences';

vi.mock('@/features/auth/hooks/useAuth', () => ({ useAuth: () => ({ user: { id: 'user-1' } }) }));
vi.mock('@/features/preferences/api/preferencesApi', () => ({
  preferencesApi: { getByUserId: vi.fn(), updateByUserId: vi.fn() },
}));

const oldPreferences: UserPreferencesResponse = {
  user_id: 1, sort_method: 'last_active', exclude_tags: ['旧屏蔽'],
  include_keywords: '', exclude_keywords: '', exclude_keyword_exemption_markers: [],
  preview_image_mode: 'thumbnail', results_per_page: 5, ui_page_size: 48,
  custom_base_sort: 'comprehensive',
};
const savedPreferences: UserPreferencesResponse = {
  ...oldPreferences, sort_method: 'created_at', exclude_tags: ['新屏蔽'],
};

function harness() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: Infinity } } });
  const wrapper = ({ children }: { children: ReactNode }) => <QueryClientProvider client={client}>{children}</QueryClientProvider>;
  return { client, wrapper };
}

describe('固定主服务器偏好缓存', () => {
  beforeEach(() => vi.resetAllMocks());

  it('旧读取晚于保存返回也不会覆盖保存结果，后续正常刷新可更新', async () => {
    const { client, wrapper } = harness();
    client.setQueryData(['user-preferences', 'user-1'], oldPreferences, { updatedAt: Date.now() - 61_000 });
    let finishRead!: (value: UserPreferencesResponse) => void;
    vi.mocked(preferencesApi.getByUserId).mockReturnValue(new Promise((resolve) => { finishRead = resolve; }));
    vi.mocked(preferencesApi.updateByUserId).mockResolvedValue(savedPreferences);
    const { result, unmount } = renderHook(() => useUserPreferences({ guildId: 'main' }), { wrapper });
    await waitFor(() => expect(result.current.isFetching).toBe(true));
    const readSignal = vi.mocked(preferencesApi.getByUserId).mock.calls[0][2]!;
    await act(async () => result.current.savePreferences({ exclude_tags: ['新屏蔽'] }));
    expect(readSignal.aborted).toBe(true);
    await act(async () => finishRead(oldPreferences));
    expect(result.current.preferences).toEqual(savedPreferences);
    vi.mocked(preferencesApi.getByUserId).mockResolvedValue({ ...savedPreferences, exclude_tags: ['正常刷新'] });
    await act(async () => { await result.current.refetch(); });
    expect(client.getQueryData<UserPreferencesResponse>(['user-preferences', 'user-1'])?.exclude_tags).toEqual(['正常刷新']);
    await waitFor(() => expect(result.current.preferences?.exclude_tags).toEqual(['正常刷新']));
    unmount();
    client.clear();
  });

  it('无 guild 参数与带 guild 参数使用同一份偏好，保存失败不伪装成功', async () => {
    const { client, wrapper } = harness();
    vi.mocked(preferencesApi.getByUserId).mockResolvedValue(oldPreferences);
    vi.mocked(preferencesApi.updateByUserId).mockResolvedValue(savedPreferences);
    const { result, unmount } = renderHook(() => ({
      ai: useUserPreferences(), page: useUserPreferences({ guildId: 'main' }),
    }), { wrapper });
    await waitFor(() => expect(result.current.ai.preferences).toEqual(oldPreferences));
    await act(async () => result.current.page.savePreferences({ exclude_tags: ['新屏蔽'] }));
    expect(client.getQueryData(['user-preferences', 'user-1'])).toEqual(savedPreferences);
    await waitFor(() => expect(result.current.ai.preferences).toEqual(savedPreferences));
    expect(client.getQueryCache().findAll({ queryKey: ['user-preferences'] })).toHaveLength(1);
    const error = new Error('保存失败');
    vi.mocked(preferencesApi.updateByUserId).mockRejectedValue(error);
    await act(async () => {
      await expect(result.current.page.savePreferences({ exclude_tags: ['失败的输入'] })).rejects.toBe(error);
    });
    expect(result.current.ai.preferences).toEqual(savedPreferences);
    unmount();
    client.clear();
  });
});
