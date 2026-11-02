import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { DeletedWorksAdminPage, WorkModerationPanel } from './moderation';
import { workGovernanceApi } from './governanceApi';
import { useWorkMember } from './member';
import type { DeletedWork } from './governanceTypes';

vi.mock('./member', () => ({ useWorkMember: vi.fn() }));
function setup(node: React.ReactNode) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  return render(<QueryClientProvider client={client}>{node}</QueryClientProvider>);
}
const deleted = (id: string, reason: string): DeletedWork => ({ id, title: reason === 'source_deleted' ? '原生已删除' : '管理隐藏作品', description: '', images: [], author_id: '1', source_platform: 'fluxer', source_guild_id: '2', source_channel_id: '3', source_thread_id: '4', main_ref: '4', is_nsfw: false, is_abyss: false, created_at: '2026-11-02T00:00:00Z', deleted_at: '2026-11-02T00:00:00Z', deletion_reason: reason, can_restore: true, statistics: { view_count: 0, collection_count: 0, reaction_count: 0, reply_count: 0 }, reactions: [], tags: [] });

describe('work moderation boundaries', () => {
  beforeEach(() => { vi.restoreAllMocks(); vi.mocked(useWorkMember).mockReturnValue({ data: { is_admin: true } } as ReturnType<typeof useWorkMember>); });
  it('does not fetch hidden work listings for ordinary members or bypass the normal detail 404', async () => {
    vi.mocked(useWorkMember).mockReturnValue({ data: { is_admin: false } } as ReturnType<typeof useWorkMember>);
    const list = vi.spyOn(workGovernanceApi, 'deleted').mockResolvedValue({ items: [], total: 0, offset: 0, limit: 20 });
    setup(<DeletedWorksAdminPage />);
    expect(screen.getByRole('alert')).toHaveTextContent('仅管理组');
    expect(list).not.toHaveBeenCalled();
  });
  it('offers management restoration for soft hiding but never for native source deletion, even if a stale can_restore flag is true', async () => {
    vi.spyOn(workGovernanceApi, 'deleted').mockResolvedValue({ items: [deleted('9007199254740993123', 'moderation'), deleted('9007199254740993124', 'source_deleted')], total: 2, offset: 0, limit: 20 });
    const restore = vi.spyOn(workGovernanceApi, 'restore').mockResolvedValue({ restored: true });
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    setup(<DeletedWorksAdminPage />);
    await screen.findByText('原生主帖已删除，无法恢复');
    expect(screen.getAllByRole('button', { name: '恢复作品' })).toHaveLength(1);
    fireEvent.click(screen.getByRole('button', { name: '恢复作品' }));
    await waitFor(() => expect(restore).toHaveBeenCalledWith('9007199254740993123', expect.anything()));
  });
  it('only releases the current operators active source and permits DC work policies confined to Forum and Fluxer children', async () => {
    const common = { work_id: '1', user_id: '22', actor_id: '33', reason: '重复刷屏', created_at: '2026-11-02T00:00:00Z', expires_at: null, revoked_at: null };
    vi.spyOn(workGovernanceApi, 'mutes').mockResolvedValue({ items: [{ ...common, id: '10', own_source: true }, { ...common, id: '11', own_source: false }, { ...common, id: '12', own_source: true, expires_at: '2000-01-01T00:00:00Z' }] });
    const release = vi.spyOn(workGovernanceApi, 'unmute').mockResolvedValue({} as never);
    setup(<WorkModerationPanel workId="1" sourcePlatform="discord" />);
    expect(screen.getByText(/不改变 Discord 主帖权限/)).toBeInTheDocument();
    await waitFor(() => expect(screen.getAllByRole('button', { name: '解除我的这项处罚' })).toHaveLength(1));
    fireEvent.click(screen.getByRole('button', { name: '解除我的这项处罚' }));
    await waitFor(() => expect(release).toHaveBeenCalledWith('1', '10'));
  });
});
