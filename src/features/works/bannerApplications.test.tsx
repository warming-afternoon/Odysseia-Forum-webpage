import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { WorkBannerApply, WorkBannerApplications } from './bannerApplications';
import { workBannerApi, type WorkBannerApplication } from './bannerApi';
import { useWorkMember } from './member';

vi.mock('./member', () => ({ useWorkMember: vi.fn() }));
const application: WorkBannerApplication = { id: '9007199254740993123', work_id: '9007199254740993124', thread_id: null, target_type: 3, target_scope: 'global', cover_image_url: null, status: 'pending', applied_at: '2026-11-02T00:00:00Z', reviewed_at: null, reject_reason: null, placement: null, applicant_id: 'u1', reviewer_id: null };
function setup(node: React.ReactNode) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  return render(<MemoryRouter><QueryClientProvider client={client}>{node}</QueryClientProvider></MemoryRouter>);
}
describe('Work Banner real workflow', () => {
  beforeEach(() => { vi.restoreAllMocks(); vi.mocked(useWorkMember).mockReturnValue({ data: { id: 'u1', is_admin: false } } as ReturnType<typeof useWorkMember>); });
  it('submits a large Work ID without a fabricated Discord ID and keeps first-image cover by default', async () => {
    vi.spyOn(workBannerApi, 'scopes').mockResolvedValue({ items: [{ id: 'global', name: '全站' }, { id: '200', name: '普通论坛' }] });
    const apply = vi.spyOn(workBannerApi, 'apply').mockResolvedValue(application);
    setup(<WorkBannerApply workId={application.work_id!} />);
    await screen.findByRole('option', { name: '普通论坛' });
    fireEvent.change(screen.getByLabelText('展示范围'), { target: { value: '200' } });
    fireEvent.click(screen.getByRole('button', { name: '提交推荐申请' }));
    await waitFor(() => expect(apply).toHaveBeenCalledWith(application.work_id, { target_scope: '200' }));
    expect(await screen.findByRole('status')).toHaveTextContent('申请已提交');
  });
  it('shows personal queue state and never loads management history for an ordinary member', async () => {
    const list = vi.spyOn(workBannerApi, 'list').mockResolvedValue({ items: [{ ...application, status: 'approved', placement: 'waitlist' }], total: 1, offset: 0, limit: 20 });
    setup(<WorkBannerApplications />);
    expect(await screen.findByText('审核通过，候补中')).toBeInTheDocument();
    expect(list.mock.calls.every(([admin]) => !admin)).toBe(true);
    expect(screen.queryByLabelText('推荐审核队列')).not.toBeInTheDocument();
  });
  it('reviews native applications through the real endpoint and leaves Discord review permissions in the existing entry', async () => {
    vi.mocked(useWorkMember).mockReturnValue({ data: { id: 'u2', is_admin: true } } as ReturnType<typeof useWorkMember>);
    vi.spyOn(workBannerApi, 'list').mockImplementation(async admin => ({ items: admin ? [application, { ...application, id: '2', work_id: null, thread_id: '100', target_type: 2 }] : [], total: admin ? 2 : 0, offset: 0, limit: 20 }));
    const review = vi.spyOn(workBannerApi, 'review').mockResolvedValue({ ...application, status: 'rejected', reviewer_id: 'u2' });
    setup(<WorkBannerApplications />);
    await screen.findByRole('button', { name: '拒绝推荐' });
    expect(screen.getAllByRole('button', { name: '批准推荐' })).toHaveLength(1);
    expect(screen.getByText(/现有 Discord 审核入口/)).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText(`申请 ${application.id} 拒绝原因`), { target: { value: '图片不适合' } });
    fireEvent.click(screen.getByRole('button', { name: '拒绝推荐' }));
    await waitFor(() => expect(review).toHaveBeenCalledWith(application.id, { approve: false, reason: '图片不适合' }));
  });
});
