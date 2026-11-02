import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { WorkTagGovernance } from './tagGovernance';
import { workGovernanceApi } from './governanceApi';
import { worksApi } from './api';

function setup(canManage: boolean) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  return render(<MemoryRouter><QueryClientProvider client={client}><WorkTagGovernance workId="123" canManage={canManage} /></QueryClientProvider></MemoryRouter>);
}
describe('work tag governance', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.spyOn(worksApi, 'tags').mockResolvedValue({ items: [{ id: '99', name: '申请标签' }] });
    vi.spyOn(workGovernanceApi, 'tagSnapshot').mockResolvedValue({ version: 'v1', tags: [{ id: '1', name: '冒险', binding_id: '9007199254740993123', upvotes: 4, downvotes: 1, my_vote: 1, readonly: false }] });
    vi.spyOn(workGovernanceApi, 'proposals').mockResolvedValue({ items: [{ id: '2', tag_id: '99', tag_name: '申请标签', status: 'pending', reason: null, created_at: '2026-11-02T00:00:00Z', due_at: '2026-11-09T00:00:00Z', resolved_at: null }] });
  });
  it('lets members toggle their existing vote without granting direct tag removal or review rights', async () => {
    const vote = vi.spyOn(workGovernanceApi, 'vote').mockResolvedValue({} as never);
    setup(false);
    const button = await screen.findByRole('button', { name: '赞同 4' });
    expect(button).toHaveAttribute('aria-pressed', 'true');
    fireEvent.click(button);
    await waitFor(() => expect(vote).toHaveBeenCalledWith('123', '9007199254740993123', 0));
    expect(screen.queryByRole('button', { name: '通过申请' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '移除标签 冒险' })).not.toBeInTheDocument();
  });
  it('allows the author to review pending proposals using the actual proposal ID', async () => {
    const review = vi.spyOn(workGovernanceApi, 'review').mockResolvedValue({} as never);
    setup(true);
    fireEvent.click(await screen.findByRole('button', { name: '通过申请' }));
    await waitFor(() => expect(review).toHaveBeenCalledWith('123', '2', true));
  });
});
