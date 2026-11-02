import axios from 'axios';
import { parseWithSafeSnowflakeIds } from '@/shared/api/client';
import { getStoredAuthToken } from '@/shared/lib/authSession';
import type { AnnouncementInput, Page, ThreadRef, Work, WorkAnnouncement, WorkBanner, WorkNotification, WorkTask, WorkBooklist, WorkBooklistDetail, WorkInput, WorkMember, WorkQuery } from './types';

export function workApiBaseUrl(v1Url: string): string {
  return v1Url.replace(/\/v1\/?$/, '') + '/v2';
}
export const worksClient = axios.create({
  baseURL: import.meta.env.VITE_WORKS_API_URL || workApiBaseUrl(import.meta.env.VITE_API_URL || 'http://localhost:10810/v1'),
  timeout: 15000,
  transformResponse: [parseWithSafeSnowflakeIds],
});
worksClient.interceptors.request.use((config) => {
  const token = getStoredAuthToken();
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});
const id = encodeURIComponent;
export const worksApi = {
  uploadTarget: async (is_nsfw: boolean, is_abyss: boolean) => (await worksClient.get<{platform: 'fluxer'; guild_id: string; channel_id: string}>('/works/upload-target', { params: { is_nsfw, is_abyss } })).data,
  tags: async (q: string, signal?: AbortSignal) => (await worksClient.get<{ items: { id: string; name: string }[] }>("/tags", { params: { q }, signal })).data,
  create: async (body: WorkInput) => (await worksClient.post<{ work: Work; task_id: string; status: string }>('/works', body)).data,
  follow: async (workId: string, following: boolean) => following ? worksClient.put(`/works/${id(workId)}/follow`) : worksClient.delete(`/works/${id(workId)}/follow`),
  follows: async (offset = 0, signal?: AbortSignal) => (await worksClient.get<Page<Work>>('/me/follows', { params: { offset, limit: 20 }, signal })).data,
  notifications: async (offset = 0, signal?: AbortSignal) => (await worksClient.get<Page<WorkNotification>>('/me/notifications', { params: { offset, limit: 20 }, signal })).data,
  readNotification: async (notificationId: string) => worksClient.post(`/me/notifications/${id(notificationId)}/read`),
  tasks: async (workId: string, signal?: AbortSignal) => (await worksClient.get<{ items: WorkTask[] }>(`/works/${id(workId)}/tasks`, { signal })).data,
  me: async (signal?: AbortSignal) => (await worksClient.get<WorkMember>('/me', { signal })).data,
  preferences: async (show_nsfw: boolean) => (await worksClient.patch<{ show_nsfw: boolean }>('/me/preferences', { show_nsfw })).data,
  discovery: async (signal?: AbortSignal) => (await worksClient.get<Page<Work>>('/discovery', { signal })).data,
  booklists: async (signal?: AbortSignal) => (await worksClient.get<{ items: WorkBooklist[] }>('/booklists', { signal })).data,
  createBooklist: async (body: { title: string; description?: string; is_public: boolean }) => (await worksClient.post<WorkBooklist>('/booklists', body)).data,
  booklist: async (booklistId: string, offset = 0, signal?: AbortSignal) => (await worksClient.get<WorkBooklistDetail>(`/booklists/${id(booklistId)}`, { params: { offset, limit: 20 }, signal })).data,
  updateBooklist: async (booklistId: string, body: { title: string; description: string; is_public: boolean }) => (await worksClient.patch<WorkBooklist>(`/booklists/${id(booklistId)}`, body)).data,
  booklistItem: async (booklistId: string, workId: string, add: boolean) => add ? worksClient.put(`/booklists/${id(booklistId)}/works/${id(workId)}`) : worksClient.delete(`/booklists/${id(booklistId)}/works/${id(workId)}`),
  announcements: async (workId: string, signal?: AbortSignal, offset = 0) => (await worksClient.get<Page<WorkAnnouncement>>(`/works/${id(workId)}/announcements`, { signal, params: { offset, limit: 20 } })).data,
  publishAnnouncement: async (workId: string, body: AnnouncementInput) => (await worksClient.post<WorkAnnouncement>(`/works/${id(workId)}/announcements`, body)).data,
  updateAnnouncement: async (workId: string, announcementId: string, body: AnnouncementInput) => worksClient.patch(`/works/${id(workId)}/announcements/${id(announcementId)}`, body),
  withdrawAnnouncement: async (workId: string, announcementId: string) => worksClient.delete(`/works/${id(workId)}/announcements/${id(announcementId)}`),
  createThread: async (workId: string, body: { title: string; body: string }) => (await worksClient.post<{ task_id: string; status: string }>(`/works/${id(workId)}/threads`, body)).data,
  updateThread: async (workId: string, threadId: string, body: { title?: string; body?: string; locked?: boolean; archived?: boolean }) => worksClient.patch(`/works/${id(workId)}/threads/${id(threadId)}`, body),
  deleteThread: async (workId: string, threadId: string) => worksClient.delete(`/works/${id(workId)}/threads/${id(threadId)}`),
  restoreThread: async (workId: string, threadId: string) => worksClient.post(`/works/${id(workId)}/threads/${id(threadId)}/restore`),
  remove: async (workId: string) => worksClient.delete(`/works/${id(workId)}`),
  list: async (params: WorkQuery, signal?: AbortSignal) => (await worksClient.get<Page<Work>>('/works', { params, signal })).data,
  get: async (workId: string, signal?: AbortSignal) => (await worksClient.get<Work>(`/works/${id(workId)}`, { signal })).data,
  update: async (workId: string, body: Partial<WorkInput>) => (await worksClient.patch<Work>(`/works/${id(workId)}`, body)).data,
  view: async (workId: string) => (await worksClient.post<{ counted: boolean }>(`/works/${id(workId)}/view`)).data,
  collect: async (workId: string, collected: boolean) => collected
    ? (await worksClient.post<{ collected: boolean }>(`/works/${id(workId)}/collection`)).data
    : (await worksClient.delete<{ collected: boolean }>(`/works/${id(workId)}/collection`)).data,
  collection: async (offset = 0, signal?: AbortSignal) => (await worksClient.get<Page<Work>>('/me/collection', { params: { offset, limit: 20 }, signal })).data,
  banners: async (signal?: AbortSignal) => (await worksClient.get<Page<WorkBanner>>('/banner', { signal })).data,
  threads: async (workId: string, signal?: AbortSignal, includeDeleted = false) => (await worksClient.get<{ items: ThreadRef[] }>(`/works/${id(workId)}/threads`, { signal, params: { include_deleted: includeDeleted } })).data,
  addTag: async (workId: string, tagId: string) => worksClient.put(`/works/${id(workId)}/tags/${id(tagId)}`),
  removeTag: async (workId: string, tagId: string) => worksClient.delete(`/works/${id(workId)}/tags/${id(tagId)}`),
};
