import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import type { ReactNode } from 'react';
import { describe, expect, it, vi } from 'vitest';

import type { Thread } from '@/entities/thread/types';
import { ThreadPreviewOverlay } from './ThreadPreviewOverlay';

vi.mock('@/features/auth/hooks/useAuth', () => ({ useAuth: () => ({ isAuthenticated: false }) }));
vi.mock('@/features/booklists/api/booklistsApi', () => ({
  booklistsApi: { listMine: vi.fn(async () => ({ results: [] })) },
}));
vi.mock('@/features/notifications/hooks/useNotificationsData', () => ({
  useMarkThreadNotificationsRead: () => ({ mutate: vi.fn() }),
}));
vi.mock('@/features/search/hooks/useSearchParams', () => ({
  useSearchURLParams: () => ({ params: { query: '' }, setParams: vi.fn() }),
}));
vi.mock('@/shared/hooks/useSettings', () => ({ useFontSizeSetting: () => 'medium' }));
vi.mock('@/features/authors/components/AuthorIdentityLink', () => ({ AuthorIdentityLink: () => null }));
vi.mock('@/entities/thread/ThreadStatusBadges', () => ({ ThreadStatusBadges: () => null }));
vi.mock('@/entities/thread/ThreadTournamentBadges', () => ({ ThreadTournamentBadges: () => null }));
vi.mock('@/features/tags/components/TargetTagSection', () => ({ TargetTagSection: () => null }));
vi.mock('@/features/threads/components/ThreadActions', () => ({ ThreadActions: () => null }));
vi.mock('@/features/threads/components/AuthorRecommendations', () => ({ AuthorRecommendations: () => null }));
vi.mock('@/features/threads/components/SimilarRecommendations', () => ({ SimilarRecommendations: () => null }));
vi.mock('@/features/threads/components/ThreadMoreMenuContent', () => ({
  ThreadMoreMenuContent: ({ onAddToBooklist }: { onAddToBooklist: () => void }) =>
    <button onClick={onAddToBooklist}>打开快捷收藏</button>,
}));
vi.mock('@/shared/ui/ContextMenu', () => {
  const Container = ({ children }: { children: ReactNode }) => <div>{children}</div>;
  return { ContextMenu: Container, ContextMenuButton: Container, ContextMenuContent: Container };
});

describe('帖子预览叠层键盘边界', () => {
  it('Escape 只关闭上层快捷收藏，再次 Escape 才关闭帖子预览', async () => {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: Infinity } } });
    const onClose = vi.fn();
    const { unmount } = render(<QueryClientProvider client={client}>
      <MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <ThreadPreviewOverlay onClose={onClose} thread={{
          thread_id: '101', channel_id: '201', title: '帖子预览',
          created_at: '2026-10-01T00:00:00Z', tags: [], thumbnail_urls: [],
          reaction_count: 0, reply_count: 0,
          display_count: 0, collected_flag: false,
        } as Thread} />
      </MemoryRouter>
    </QueryClientProvider>);
    fireEvent.click(screen.getByRole('button', { name: '打开快捷收藏' }));
    await screen.findByText('快捷收藏到书单');
    fireEvent.keyDown(window, { key: 'Escape' });
    await waitFor(() => expect(screen.queryByText('快捷收藏到书单')).not.toBeInTheDocument());
    await new Promise((resolve) => setTimeout(resolve, 350));
    expect(onClose).not.toHaveBeenCalled();
    expect(screen.getByRole('dialog', { name: '帖子预览' })).toBeInTheDocument();
    fireEvent.keyDown(window, { key: 'Escape' });
    await waitFor(() => expect(onClose).toHaveBeenCalledTimes(1));
    unmount();
    client.clear();
  });
});
