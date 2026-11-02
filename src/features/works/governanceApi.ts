import { worksClient } from './api';
import type { Page, Work } from './types';
import type { AdvancedWorkSearch, DeletedWork, WorkAuthor, WorkModlogEntry, WorkMute, WorkTagProposal, WorkTagSnapshot } from './governanceTypes';
const id = encodeURIComponent;

export const workGovernanceApi = {
  mutes: async (workId: string, signal?: AbortSignal) => (await worksClient.get<{ items: WorkMute[] }>(`/works/${id(workId)}/mutes`, { signal })).data,
  mute: async (workId: string, body: { user_id: string; reason: string; expires_at: string | null }) => (await worksClient.post<{ task_ids: string[] }>(`/works/${id(workId)}/mutes`, body)).data,
  unmute: async (workId: string, muteId: string) => worksClient.delete(`/works/${id(workId)}/mutes/${id(muteId)}`),
  modlog: async (workId: string, offset = 0, signal?: AbortSignal) => (await worksClient.get<Page<WorkModlogEntry>>(`/works/${id(workId)}/modlog`, { params: { offset, limit: 20 }, signal })).data,
  deleted: async (offset = 0, signal?: AbortSignal) => (await worksClient.get<Page<DeletedWork>>('/admin/deleted-works', { params: { offset, limit: 20 }, signal })).data,
  restore: async (workId: string) => (await worksClient.post<{ restored: boolean }>(`/works/${id(workId)}/restore`)).data,
  tagSnapshot: async (workId: string, signal?: AbortSignal) => (await worksClient.get<WorkTagSnapshot>(`/works/${id(workId)}/tags`, { signal })).data,
  proposals: async (workId: string, reviewQueue: boolean, signal?: AbortSignal) => (await worksClient.get<{ items: WorkTagProposal[] }>(`/works/${id(workId)}/tag-proposals`, { params: { review_queue: reviewQueue }, signal })).data,
  propose: async (workId: string, tagId: string) => (await worksClient.post<WorkTagProposal>(`/works/${id(workId)}/tag-proposals`, { tag_id: tagId })).data,
  review: async (workId: string, proposalId: string, approve: boolean) => worksClient.patch(`/works/${id(workId)}/tag-proposals/${id(proposalId)}`, { approve }),
  vote: async (workId: string, bindingId: string, vote: -1 | 0 | 1) => worksClient.put(`/works/${id(workId)}/tag-bindings/${id(bindingId)}/vote`, { vote }),
  search: async (body: AdvancedWorkSearch, signal?: AbortSignal) => (await worksClient.post<Page<Work>>('/search', body, { signal })).data,
  author: async (authorId: string, signal?: AbortSignal) => (await worksClient.get<WorkAuthor>(`/authors/${id(authorId)}`, { signal })).data,
  authorFollows: async (signal?: AbortSignal) => (await worksClient.get<{ items: Pick<WorkAuthor, 'id' | 'username' | 'display_name' | 'avatar_url'>[] }>('/me/author-follows', { signal })).data,
  followAuthor: async (authorId: string, followed: boolean) => followed ? worksClient.put(`/authors/${id(authorId)}/follow`) : worksClient.delete(`/authors/${id(authorId)}/follow`),
};
