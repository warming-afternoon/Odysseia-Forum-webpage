// @vitest-environment jsdom
// Real React/Vitest regression SOURCE; only syntax checked in cloud.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { WorkMePage } from './member';
import { WorkBooklistsPage, WorkBooklistPicker } from './booklists';
import { worksApi } from './api';
import type { WorkMember, WorkBooklist } from './types';

vi.mock('./authors', () => ({ WorkAuthorFollows: () => null }));
vi.mock('./bannerApplications', () => ({ WorkBannerApplications: () => null }));

const member: WorkMember = {
  id: '9007199254740993123', discord_user_id: '9007199254740993124',
  username: 'FAKE-PROFILE', display_name: 'CACHED PRIVATE PROFILE', avatar_url: null,
  is_admin: false, can_create_work: true, can_view_abyss: true,
  can_speak: true, show_nsfw: true,
};
const booklist: WorkBooklist = {
  id: '9007199254740993125', title: 'CACHED PRIVATE BOOKLIST',
  description: 'FAKE description', is_public: false, is_default: false, item_count: 1,
};
const errorFor = (status: number) => Object.assign(new Error('FAKE permission denied'), { response: { status, data: {} } });
function mount(node: React.ReactNode, key: readonly unknown[], data: unknown) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, staleTime: Infinity, gcTime: Infinity }, mutations: { retry: false } } });
  client.setQueryData(key, data);
  render(<MemoryRouter><QueryClientProvider client={client}>{node}</QueryClientProvider></MemoryRouter>);
  return client;
}
async function deny(client: QueryClient, key: readonly unknown[]) {
  await act(async () => { await client.invalidateQueries({ queryKey: key }); });
  await waitFor(() => expect(client.getQueryState(key)?.status).toBe('error'));
}
beforeEach(() => vi.restoreAllMocks());
afterEach(cleanup);

for (const status of [401, 403, 404]) describe(`private cached UI after HTTP ${status}`, () => {
  it('removes the old profile and preferences after the current-member request is denied', async () => {
    let rejectPending: (error: Error) => void = () => { throw new Error('member request did not start'); };
    vi.spyOn(worksApi, 'me').mockImplementation(() => new Promise<WorkMember>((_, reject) => { rejectPending = reject; }));
    const key = ['works-v2', 'me'] as const;
    const client = mount(<WorkMePage />, key, member);
    expect(screen.getByText('CACHED PRIVATE PROFILE')).toBeInTheDocument();
    expect(screen.queryByRole('checkbox', { name: /显示 NSFW 作品/ })).not.toBeInTheDocument();
    await waitFor(() => expect(worksApi.me).toHaveBeenCalled());
    await act(async () => { rejectPending(errorFor(status)); });
    await waitFor(() => expect(client.getQueryState(key)?.status).toBe('error'));
    expect(screen.queryByText('CACHED PRIVATE PROFILE')).not.toBeInTheDocument();
    expect(screen.queryByRole('checkbox', { name: /显示 NSFW 作品/ })).not.toBeInTheDocument();
  });
  it('removes the private booklist title after list access is denied', async () => {
    vi.spyOn(worksApi, 'booklists').mockRejectedValue(errorFor(status));
    const key = ['works-v2', 'booklists'] as const;
    const client = mount(<WorkBooklistsPage />, key, { items: [booklist] });
    expect(screen.getByText('CACHED PRIVATE BOOKLIST')).toBeInTheDocument();
    await deny(client, key);
    expect(screen.queryByText('CACHED PRIVATE BOOKLIST')).not.toBeInTheDocument();
  });
  it('removes private options and stale selected add action after access is denied', async () => {
    vi.spyOn(worksApi, 'booklists').mockRejectedValue(errorFor(status));
    const key = ['works-v2', 'booklists'] as const;
    const client = mount(<WorkBooklistPicker workId="1" />, key, { items: [booklist] });
    fireEvent.change(screen.getByRole('combobox', { name: '选择作品书单' }), { target: { value: booklist.id } });
    expect(screen.getByRole('button', { name: '加入书单' })).toBeEnabled();
    await deny(client, key);
    expect(screen.queryByRole('option', { name: 'CACHED PRIVATE BOOKLIST' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '加入书单' })).not.toBeInTheDocument();
  });
});
