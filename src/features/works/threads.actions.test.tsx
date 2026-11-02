import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { WorkThreads } from './threads';
import { worksApi } from './api';
import { nativeMessagesApi } from './nativeApi';

vi.mock('./member', () => ({ useWorkMember: () => ({ data: { id: 'work-owner', is_admin: false, can_speak: true } }) }));
const child = { id: '9007199254740993123', platform: 'fluxer', thread_id: '9007199254740993222', guild_id: '22', channel_id: '33', role: 'child' as const, title: '其他作者的讨论', author_id: 'child-owner', locked: false, own_locked: false, archived: true, own_archived: true };
function setup() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  return render(<QueryClientProvider client={client}><WorkThreads workId="work" authorId="work-owner" /></QueryClientProvider>);
}
describe('Forum discussion policy operations', () => {
  beforeEach(() => vi.restoreAllMocks());
  it('releases only the own archive source through Forum rather than bypassing it with the raw native endpoint', async () => {
    vi.spyOn(worksApi, 'threads').mockResolvedValue({ items: [child] });
    const update = vi.spyOn(worksApi, 'updateThread').mockResolvedValue({} as never);
    const native = vi.spyOn(nativeMessagesApi, 'updateThread');
    setup();
    fireEvent.click(await screen.findByRole('button', { name: '撤销我的归档' }));
    await waitFor(() => expect(update).toHaveBeenCalledWith('work', child.id, { archived: false }));
    expect(native).not.toHaveBeenCalled();
    expect(screen.queryByRole('button', { name: '删除' })).not.toBeInTheDocument();
  });
  it('shows initialization progress without letting the work author edit, hide or release a child before synchronization', async () => {
    vi.spyOn(worksApi, 'threads').mockResolvedValue({ items: [{ ...child, initializing: true }] });
    setup();
    expect(await screen.findByText('正在同步权限，暂未开放')).toHaveAttribute('role', 'status');
    expect(screen.queryByRole('button', { name: '撤销我的归档' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '删除' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '编辑' })).not.toBeInTheDocument();
  });
});
