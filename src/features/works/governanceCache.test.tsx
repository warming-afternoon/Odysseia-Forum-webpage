// @vitest-environment jsdom
// Candidate regression source. Not executed here; real React/Vitest + Luna required.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { WorkTagPicker } from './tags';
import { WorkTasks } from './tasks';
import { WorkBannerApply, WorkBannerApplications } from './bannerApplications';
import { worksApi } from './api';
import { workBannerApi, type WorkBannerApplication } from './bannerApi';

vi.mock('./member', () => ({
  useWorkMember: () => ({ data: { id: 'FAKE-ACTOR', is_admin: true } }),
}));

function mount(node: React.ReactNode, seed: [readonly unknown[], unknown][]) {
  const client = new QueryClient({ defaultOptions: {
    queries: { retry: false, staleTime: Infinity, gcTime: Infinity },
    mutations: { retry: false },
  } });
  for (const [key, value] of seed) client.setQueryData(key, value);
  const view = render(<MemoryRouter><QueryClientProvider client={client}>{node}</QueryClientProvider></MemoryRouter>);
  return { client, ...view };
}
async function deny(client: QueryClient, key: readonly unknown[]) {
  await act(async () => { await client.invalidateQueries({ queryKey: key }); });
  await waitFor(() => expect(client.getQueryState(key)?.status).toBe('error'));
}
const denyError = (status: number) => Object.assign(new Error('FAKE permission denied'), { response: { status, data: {} } });
const application: WorkBannerApplication = {
  id: '9007199254740993123', work_id: '9007199254740993124', thread_id: null,
  target_type: 3, target_scope: 'global', cover_image_url: null, status: 'pending',
  applied_at: '2026-11-02T00:00:00Z', reviewed_at: null, reject_reason: null,
  placement: null, applicant_id: 'FAKE-ACTOR', reviewer_id: null,
};

beforeEach(() => vi.restoreAllMocks());
afterEach(cleanup);

for (const status of [401, 403, 404]) {
  describe(`cached governance UI after HTTP ${status}`, () => {
    it('removes tag candidates after a previously successful query is denied', async () => {
      const key = ['works-v2', 'tags', ''] as const;
      vi.spyOn(worksApi, 'tags').mockRejectedValue(denyError(status));
      const { client } = mount(<WorkTagPicker add={() => {}} pending={false} />, [[key, { items: [{ id: '22', name: 'CACHED TAG' }] }]]);
      expect(screen.getByRole('button', { name: '＋ CACHED TAG' })).toBeInTheDocument();
      await deny(client, key);
      expect(screen.queryByText('＋ CACHED TAG')).not.toBeInTheDocument();
    });
    it('removes cached task details, not just adding an error label above them', async () => {
      const key = ['works-v2', 'tasks', '1'] as const;
      vi.spyOn(worksApi, 'tasks').mockRejectedValue(denyError(status));
      const { client } = mount(<WorkTasks workId="1" />, [[key, { items: [{ id: '2', kind: 'create_main', status: 'failed', attempts: 1, error: 'CACHED TASK DETAIL' }] }]]);
      expect(screen.getByText(/CACHED TASK DETAIL/)).toBeInTheDocument();
      await deny(client, key);
      expect(screen.queryByText(/CACHED TASK DETAIL/)).not.toBeInTheDocument();
    });
    it('removes personal/admin application rows and stale review controls', async () => {
      const personal = ['works-v2', 'banner-applications', false, 0] as const;
      const admin = ['works-v2', 'banner-applications', true, 0] as const;
      const data = { items: [application], total: 1, offset: 0, limit: 20 };
      vi.spyOn(workBannerApi, 'list').mockRejectedValue(denyError(status));
      const { client } = mount(<WorkBannerApplications />, [[personal, data], [admin, data]]);
      expect(screen.getByRole('button', { name: '批准推荐' })).toBeInTheDocument();
      await deny(client, personal);
      await deny(client, admin);
      expect(screen.queryByText('查看申请作品')).not.toBeInTheDocument();
      expect(screen.queryByRole('button', { name: '批准推荐' })).not.toBeInTheDocument();
    });
    it('removes stale scope options and cannot submit the old application form', async () => {
      const key = ['works-v2', 'banner-scopes', '1'] as const;
      vi.spyOn(workBannerApi, 'scopes').mockRejectedValue(denyError(status));
      const { client } = mount(<WorkBannerApply workId="1" />, [[key, { items: [{ id: 'global', name: 'CACHED SCOPE' }] }]]);
      expect(screen.getByRole('button', { name: '提交推荐申请' })).toBeInTheDocument();
      await deny(client, key);
      expect(screen.queryByRole('button', { name: '提交推荐申请' })).not.toBeInTheDocument();
      expect(screen.queryByRole('option', { name: 'CACHED SCOPE' })).not.toBeInTheDocument();
    });
  });
}
