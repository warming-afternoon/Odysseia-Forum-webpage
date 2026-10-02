import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import type { ComponentProps } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { Thread } from '@/entities/thread/types';
import { discoveryApi } from '@/features/discovery/api/discoveryApi';
import { DrawRevealOverlay } from '@/features/draw/components/DrawRevealOverlay';
import { DrawPage } from './index';

vi.mock('@/features/preferences/hooks/useUserPreferences', () => ({ useUserPreferences: () => ({ preferences: null }) }));
vi.mock('@/shared/hooks/useChannels', () => ({ useChannels: () => ({ data: { channels: [], apiData: [] } }) }));
vi.mock('@/features/search/hooks/usePreviewThread', () => ({ usePreviewThread: () => ({ openPreview: vi.fn() }) }));
vi.mock('@/features/discovery/api/discoveryApi', () => ({ discoveryApi: { getRandomThreads: vi.fn() } }));
vi.mock('@/features/discovery/components/DiscoveryThreadCarousel', () => ({ DiscoveryThreadCarousel: () => null }));
vi.mock('./DrawSettingsPanel', () => ({
  DrawSettingsPanel: ({ onScopeModeChange }: { onScopeModeChange: (mode: string) => void }) =>
    <button onClick={() => onScopeModeChange('custom')}>设置空自选范围</button>,
}));
vi.mock('@/features/draw/components/DrawRevealOverlay', () => ({
  DrawRevealOverlay: vi.fn(({ isOpen, phase, isDrawing, onRetry }: ComponentProps<typeof DrawRevealOverlay>) =>
    isOpen && phase === 'error' ? <button disabled={isDrawing} onClick={onRetry}>揭晓重试</button> : null,
  ),
}));

describe('抽卡请求入口', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    localStorage.setItem('odysseia_draw_reveal_enabled', 'false');
    localStorage.setItem('odysseia_draw_history', JSON.stringify([{ thread_id: '101', title: '上次发现' }]));
  });
  afterEach(() => vi.restoreAllMocks());

  it('请求在途时历史再抽也禁用，完成后恢复', async () => {
    let finish!: (threads: Thread[]) => void;
    vi.mocked(discoveryApi.getRandomThreads).mockReturnValue(new Promise((resolve) => { finish = resolve; }));
    render(<DrawPage />);
    fireEvent.click(screen.getByRole('button', { name: '来一抽' }));
    expect(screen.getByRole('button', { name: '再来一次' })).toBeDisabled();
    fireEvent.click(screen.getByRole('button', { name: '再来一次' }));
    expect(discoveryApi.getRandomThreads).toHaveBeenCalledTimes(1);
    await act(async () => finish([]));
    await waitFor(() => expect(screen.getByRole('button', { name: '再来一次' })).toBeEnabled());
  });

  it('空自选范围同时阻止主入口、历史入口和揭晓回调', async () => {
    render(<DrawPage />);
    fireEvent.click(screen.getByRole('button', { name: '设置空自选范围' }));
    expect(screen.getByRole('button', { name: '来一抽' })).toBeDisabled();
    expect(screen.getByRole('button', { name: '再来一次' })).toBeDisabled();
    fireEvent.click(screen.getByRole('button', { name: '再来一次' }));
    const calls = vi.mocked(DrawRevealOverlay).mock.calls;
    const props = calls[calls.length - 1][0];
    await act(async () => props.onDrawAgain(10));
    expect(discoveryApi.getRandomThreads).not.toHaveBeenCalled();
  });

  it.each([false, true])('失败的十连重试仍发送十连（揭晓=%s）', async (reveal) => {
    localStorage.setItem('odysseia_draw_reveal_enabled', String(reveal));
    vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.mocked(discoveryApi.getRandomThreads).mockRejectedValueOnce(new Error('网络失败'))
      .mockResolvedValue([]);
    render(<DrawPage />);
    fireEvent.click(screen.getByRole('button', { name: '十连发现' }));
    fireEvent.click(await screen.findByRole('button', { name: reveal ? '揭晓重试' : '重试一下' }));
    await waitFor(() => expect(discoveryApi.getRandomThreads).toHaveBeenCalledTimes(2));
    expect(vi.mocked(discoveryApi.getRandomThreads).mock.calls.map(([params]) => params?.limit)).toEqual([10, 10]);
    await waitFor(() => expect(screen.getByRole('button', { name: '来一抽' })).toBeEnabled());
  });
});
