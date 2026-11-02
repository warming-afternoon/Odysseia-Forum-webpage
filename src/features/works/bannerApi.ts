import { worksClient } from './api';
import type { Page } from './types';

export interface WorkBannerApplication {
  id: string; work_id: string | null; thread_id: string | null; target_type: number;
  target_scope: string; cover_image_url: string | null; status: 'pending' | 'approved' | 'rejected';
  applied_at: string; reviewed_at: string | null; reject_reason: string | null;
  placement: 'carousel' | 'waitlist' | null; applicant_id: string | null; reviewer_id: string | null;
}
export const workBannerApi = {
  scopes: async (workId: string, signal?: AbortSignal) => (await worksClient.get<{ items: { id: string; name: string }[] }>(`/works/${encodeURIComponent(workId)}/banner-scopes`, { signal })).data,
  apply: async (workId: string, body: { target_scope: string; cover_image_url?: string }) => (await worksClient.post<WorkBannerApplication>(`/works/${encodeURIComponent(workId)}/banner-applications`, body)).data,
  list: async (admin: boolean, offset: number, signal?: AbortSignal) => (await worksClient.get<Page<WorkBannerApplication>>(admin ? '/admin/banner-applications' : '/me/banner-applications', { params: { offset, limit: 20 }, signal })).data,
  review: async (applicationId: string, body: { approve: boolean; reason?: string }) => (await worksClient.patch<WorkBannerApplication>(`/admin/banner-applications/${encodeURIComponent(applicationId)}`, body)).data,
};
