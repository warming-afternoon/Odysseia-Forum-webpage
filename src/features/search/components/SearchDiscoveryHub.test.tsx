import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useQuery } from '@tanstack/react-query';
import { SearchDiscoveryHub } from './SearchDiscoveryHub';

vi.mock('@tanstack/react-query', () => ({
  useQuery: vi.fn(() => ({ data: {}, isLoading: false })),
  useQueries: () => [],
  useQueryClient: () => ({}),
}));
vi.mock('@/shared/hooks/useChannels', () => ({
  useChannels: () => ({ data: { tagCatalog: [] } }),
}));
vi.mock('@/features/discovery/components/DiscoveryThreadCarousel', () => ({
  DiscoveryThreadCarousel: () => <button>发现作品</button>,
}));

describe('空搜索发现区收展', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
  });

  it('收起同步禁用查询并隐藏交互，重新展开恢复内容和持久状态', async () => {
    render(<SearchDiscoveryHub applyPreferences onOpen={vi.fn()} onTagSelect={vi.fn()} />);
    const oldContent = screen.getByRole('button', { name: '发现作品' });
    fireEvent.click(screen.getByRole('button', { name: '收起发现内容' }));
    expect(screen.queryByRole('button', { name: '发现作品' })).not.toBeInTheDocument();
    expect(useQuery).toHaveBeenLastCalledWith(expect.objectContaining({ enabled: false }));
    expect(localStorage.getItem('odysseia_search_discovery_expanded_v1')).toBe('false');
    await waitFor(() => expect(oldContent).not.toBeInTheDocument());
    fireEvent.click(screen.getByRole('button', { name: '展开发现内容' }));
    expect(screen.getByRole('button', { name: '发现作品' })).toBeInTheDocument();
    expect(useQuery).toHaveBeenLastCalledWith(expect.objectContaining({ enabled: true }));
    expect(localStorage.getItem('odysseia_search_discovery_expanded_v1')).toBe('true');
  });
});
