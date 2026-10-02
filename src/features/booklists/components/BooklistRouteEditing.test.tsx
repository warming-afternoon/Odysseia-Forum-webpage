import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Route, Routes, useNavigate } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { BooklistDetailPage } from '@/pages/BooklistDetailPage';
import { TournamentManagePage } from '@/pages/TournamentManagePage';
import { booklistsApi } from '@/features/booklists/api/booklistsApi';
import { booklistKeys } from '@/features/booklists/lib/queryKeys';
import type { BooklistItem } from '@/entities/booklist/types';

vi.mock('@/features/auth/hooks/useAuth', () => ({ useAuth: () => ({ user: { id: 'owner' } }) }));
vi.mock('@/features/search/hooks/usePreviewThread', () => ({ usePreviewThread: () => ({ openPreview: vi.fn() }) }));
vi.mock('@/shared/hooks/useSettings', () => ({
  useSettings: () => ({ settings: { layoutMode: 'list' } }),
  useOpenModeSetting: () => 'web', useCardGridClass: () => '',
}));
vi.mock('@/shared/hooks/useLayoutPreference', () => ({ useLayoutPreference: () => ['list', vi.fn()] }));
vi.mock('@/shared/hooks/useListEntranceAnimation', () => ({ useListEntranceAnimation: () => false }));
vi.mock('@/shared/hooks/useInfiniteScrollTrigger', () => ({ useInfiniteScrollTrigger: () => null }));
vi.mock('@/features/tags/components/TargetTagSection', () => ({ TargetTagSection: () => null }));
vi.mock('@/features/booklists/components/AddThreadsToBooklistModal', () => ({ AddThreadsToBooklistModal: () => null }));
vi.mock('@/features/booklists/components/BooklistPublishModal', () => ({ BooklistPublishModal: () => null }));
vi.mock('@/features/threads/components/ThreadCard', () => ({ ThreadCard: () => null }));
vi.mock('@/features/threads/components/ThreadListItem', () => ({
  ThreadListItem: ({ managementActions }: { managementActions?: { onEdit: () => void } }) =>
    managementActions ? <button onClick={managementActions.onEdit}>编辑条目</button> : null,
}));
vi.mock('@/features/mascot/lib/notify', () => ({ notifySuccess: vi.fn(), notifyError: vi.fn() }));
vi.mock('@/features/booklists/api/booklistsApi', () => ({
  booklistsApi: { getDetail: vi.fn(), listItems: vi.fn(), updateItem: vi.fn() },
}));

function Back() {
  const navigate = useNavigate();
  return <button onClick={() => navigate(-1)}>历史后退</button>;
}

describe('详情页编辑归属', () => {
  let client: QueryClient;
  beforeEach(() => {
    vi.clearAllMocks();
    client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: Infinity } } });
    for (const id of ['1', '2']) {
      client.setQueryData(booklistKeys.detail(id), {
        id: Number(id), title: `资源 ${id}`, owner_id: 'owner', is_public: true,
        is_tournament: true, default_sort_method: 'join_time', default_sort_order: 'desc',
        publish_status: 0,
      });
      client.setQueryData(booklistKeys.items(id), {
        pageParams: [0],
        pages: [{ total: 1, limit: 24, offset: 0, results: [{
          booklist_item_id: Number(id), thread_id: '101', title: '共同帖子',
          comment: `备注 ${id}`, display_order: 0, tags: [], thumbnail_urls: [],
          channel_id: '201',
          author: { id: 'owner', name: '作者', global_name: null, display_name: '作者', avatar_url: null },
          created_at: '2026-10-01T00:00:00Z', added_at: '2026-10-01T00:00:00Z',
          reaction_count: 0, reply_count: 0, display_count: 0, collection_count: 0,
          collected_flag: false,
        }] }],
      });
    }
    vi.mocked(booklistsApi.getDetail).mockImplementation(async (id) =>
      client.getQueryData(booklistKeys.detail(id)) as never,
    );
    vi.mocked(booklistsApi.listItems).mockImplementation(async (id) =>
      (client.getQueryData(booklistKeys.items(id)) as { pages: never[] }).pages[0],
    );
  });
  afterEach(() => client.clear());

  function mount(tournament: boolean) {
    const path = tournament ? '/tournaments/manage' : '/booklists';
    render(<QueryClientProvider client={client}>
      <MemoryRouter initialEntries={[`${path}/2`, `${path}/1`]} initialIndex={1}
        future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <Back />
        <Routes><Route path={`${path}/:${tournament ? 'booklistId' : 'id'}`}
          element={tournament ? <TournamentManagePage /> : <BooklistDetailPage />} /></Routes>
      </MemoryRouter>
    </QueryClientProvider>);
  }

  it.each([false, true])('历史后退不把 A 的草稿带到 B（赛事=%s）', async (tournament) => {
    mount(tournament);
    fireEvent.click(screen.getByRole('button', { name: tournament ? '编辑参赛信息' : '编辑条目' }));
    fireEvent.change(screen.getAllByRole('textbox')[0], { target: { value: 'A 未提交草稿' } });
    fireEvent.click(screen.getByRole('button', { name: '历史后退' }));
    await screen.findByRole('heading', { name: '资源 2', level: 1 });
    expect(screen.queryByDisplayValue('A 未提交草稿')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '保存' })).not.toBeInTheDocument();
    expect(booklistsApi.updateItem).not.toHaveBeenCalled();
  });

  it.each([false, true])('A 完成不关闭 B 的新草稿（赛事=%s）', async (tournament) => {
    let complete!: () => void;
    vi.mocked(booklistsApi.updateItem).mockReturnValue(new Promise((resolve) => {
      complete = () => resolve(client.getQueryData<{ pages: { results: BooklistItem[] }[] }>(
        booklistKeys.items('1'),
      )!.pages[0].results[0]);
    }));
    mount(tournament);
    const name = tournament ? '编辑参赛信息' : '编辑条目';
    fireEvent.click(screen.getByRole('button', { name }));
    fireEvent.click(screen.getByRole('button', { name: '保存' }));
    await waitFor(() => expect(booklistsApi.updateItem).toHaveBeenCalledWith('1', '101', expect.anything()));
    fireEvent.click(screen.getByRole('button', { name: '历史后退' }));
    await screen.findByRole('heading', { name: '资源 2', level: 1 });
    fireEvent.click(screen.getByRole('button', { name }));
    fireEvent.change(screen.getAllByRole('textbox')[0], { target: { value: 'B 未提交草稿' } });
    await act(async () => complete());
    await waitFor(() => expect(client.getQueryState(booklistKeys.items('1'))?.isInvalidated).toBe(true));
    expect(screen.getByDisplayValue('B 未提交草稿')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '保存' })).toBeEnabled();
  });
});
