import axios from 'axios';
import { checkedV2Preferences } from '@/features/preferences/api/preferencesContract';
import type { UserPreferencesResponse } from '@/features/preferences/api/preferencesApi';
import { parseWithSafeSnowflakeIds } from '@/shared/api/client';
import {
  captureAuthSession,
  invalidateAuthSession,
  isAuthSessionCurrent,
  type AuthSessionSnapshot,
} from '@/shared/lib/authSession';
import type {
  AnnouncementInput,
  Page,
  ThreadRef,
  Work,
  WorkAnnouncement,
  WorkBanner,
  WorkNotification,
  WorkTask,
  WorkBooklist,
  WorkBooklistDetail,
  WorkInput,
  WorkMember,
  WorkQuery,
} from './types';

declare module 'axios' {
  interface AxiosRequestConfig {
    expectedAuthSession?: AuthSessionSnapshot;
  }
}

export function workApiBaseUrl(v1Url: string): string {
  return v1Url.replace(/\/v1\/?$/, '') + '/v2';
}
export const worksClient = axios.create({
  baseURL:
    import.meta.env.VITE_WORKS_API_URL ||
    workApiBaseUrl(import.meta.env.VITE_API_URL || 'http://localhost:10810/v1'),
  timeout: 15000,
  transformResponse: [parseWithSafeSnowflakeIds],
});
const requestSessions = new WeakMap<object, AuthSessionSnapshot>();
worksClient.interceptors.request.use((config) => {
  const session = config.expectedAuthSession || captureAuthSession();
  if (!isAuthSessionCurrent(session)) throw new axios.CanceledError('登录状态已变化，请重试。');
  requestSessions.set(config, session);
  if (session.token) config.headers.Authorization = `Bearer ${session.token}`;
  return config;
});
worksClient.interceptors.response.use(
  (response) => {
    const session = requestSessions.get(response.config);
    if (session && !isAuthSessionCurrent(session)) throw new axios.CanceledError('登录状态已变化，请重试。');
    return response;
  },
  (error) => {
    const session = error.config && requestSessions.get(error.config);
    if (error.response?.status === 401 && session?.token && isAuthSessionCurrent(session)) {
      invalidateAuthSession();
    }
    return Promise.reject(error);
  },
);
const id = encodeURIComponent;
export const worksApi = {
  uploadTarget: async (is_nsfw: boolean, is_abyss: boolean) =>
    (
      await worksClient.get<{ platform: 'fluxer'; guild_id: string; channel_id: string }>(
        '/works/upload-target',
        { params: { is_nsfw, is_abyss } },
      )
    ).data,
  tags: async (q: string, signal?: AbortSignal) =>
    (
      await worksClient.get<{ items: { id: string; name: string }[] }>('/tags', {
        params: { q },
        signal,
      })
    ).data,
  create: async (body: WorkInput) =>
    (await worksClient.post<{ work: Work; task_id: string; status: string }>('/works', body)).data,
  follow: async (workId: string, following: boolean) =>
    following
      ? worksClient.put(`/works/${id(workId)}/follow`)
      : worksClient.delete(`/works/${id(workId)}/follow`),
  follows: async (offset = 0, signal?: AbortSignal) =>
    (await worksClient.get<Page<Work>>('/me/follows', { params: { offset, limit: 20 }, signal }))
      .data,
  notifications: async (offset = 0, signal?: AbortSignal) =>
    (
      await worksClient.get<Page<WorkNotification>>('/me/notifications', {
        params: { offset, limit: 20 },
        signal,
      })
    ).data,
  readNotification: async (notificationId: string) =>
    worksClient.post(`/me/notifications/${id(notificationId)}/read`),
  tasks: async (workId: string, signal?: AbortSignal) =>
    (await worksClient.get<{ items: WorkTask[] }>(`/works/${id(workId)}/tasks`, { signal })).data,
  me: async (signal?: AbortSignal) => (await worksClient.get<WorkMember>('/me', { signal })).data,
  preferences: async (
    input: boolean | { show_nsfw: boolean; expected_version?: number },
    session: AuthSessionSnapshot = captureAuthSession(),
    expectedScope?: { user_id: string; nsfw_guild_id: string },
  ) => {
    if (!isAuthSessionCurrent(session)) throw new axios.CanceledError('登录状态已变化，请重试。');
    const body =
      typeof input === 'boolean'
        ? { show_nsfw: input, expected_version: undefined as number | undefined }
        : { ...input };
    let scope = expectedScope;
    if (!scope || body.expected_version === undefined) {
      // Boolean callers remain supported, but obtain a concrete authority snapshot before writing.
      const response = (
        await worksClient.get<UserPreferencesResponse>('/me/preferences', {
          expectedAuthSession: session,
        })
      ).data;
      const snapshot = checkedV2Preferences(response, scope?.user_id || response?.user_id);
      if (scope && snapshot.nsfw_guild_id !== scope.nsfw_guild_id)
        throw new Error('成人内容偏好服务器已变化，请重新加载。');
      scope = { user_id: snapshot.user_id, nsfw_guild_id: snapshot.nsfw_guild_id };
      body.expected_version ??= snapshot.nsfw_preference_version;
    }
    if (
      !Number.isSafeInteger(body.expected_version) ||
      body.expected_version! < 0 ||
      body.expected_version! >= Number.MAX_SAFE_INTEGER
    )
      throw new Error('成人内容偏好版本无效，请重新加载。');
    const response = (
      await worksClient.patch<UserPreferencesResponse>('/me/preferences', body, {
        expectedAuthSession: session,
      })
    ).data;
    if (!isAuthSessionCurrent(session)) throw new axios.CanceledError('登录状态已变化，请重试。');
    const data = checkedV2Preferences(response, scope.user_id);
    if (
      data.nsfw_guild_id !== scope.nsfw_guild_id ||
      data.show_nsfw !== body.show_nsfw ||
      data.nsfw_preference_version !== body.expected_version! + 1
    )
      throw new Error('成人内容偏好更新响应无效，请重新加载后检查。');
    return data;
  },
  discovery: async (signal?: AbortSignal) =>
    (await worksClient.get<Page<Work>>('/discovery', { signal })).data,
  booklists: async (signal?: AbortSignal) =>
    (await worksClient.get<{ items: WorkBooklist[] }>('/booklists', { signal })).data,
  createBooklist: async (body: { title: string; description?: string; is_public: boolean }) =>
    (await worksClient.post<WorkBooklist>('/booklists', body)).data,
  booklist: async (booklistId: string, offset = 0, signal?: AbortSignal) =>
    (
      await worksClient.get<WorkBooklistDetail>(`/booklists/${id(booklistId)}`, {
        params: { offset, limit: 20 },
        signal,
      })
    ).data,
  updateBooklist: async (
    booklistId: string,
    body: { title: string; description: string; is_public: boolean },
  ) => (await worksClient.patch<WorkBooklist>(`/booklists/${id(booklistId)}`, body)).data,
  booklistItem: async (booklistId: string, workId: string, add: boolean) =>
    add
      ? worksClient.put(`/booklists/${id(booklistId)}/works/${id(workId)}`)
      : worksClient.delete(`/booklists/${id(booklistId)}/works/${id(workId)}`),
  announcements: async (workId: string, signal?: AbortSignal, offset = 0) =>
    (
      await worksClient.get<Page<WorkAnnouncement>>(`/works/${id(workId)}/announcements`, {
        signal,
        params: { offset, limit: 20 },
      })
    ).data,
  publishAnnouncement: async (workId: string, body: AnnouncementInput) =>
    (await worksClient.post<WorkAnnouncement>(`/works/${id(workId)}/announcements`, body)).data,
  updateAnnouncement: async (workId: string, announcementId: string, body: AnnouncementInput) =>
    worksClient.patch(`/works/${id(workId)}/announcements/${id(announcementId)}`, body),
  withdrawAnnouncement: async (workId: string, announcementId: string) =>
    worksClient.delete(`/works/${id(workId)}/announcements/${id(announcementId)}`),
  createThread: async (workId: string, body: { title: string; body: string }) =>
    (
      await worksClient.post<{ task_id: string; status: string }>(
        `/works/${id(workId)}/threads`,
        body,
      )
    ).data,
  updateThread: async (
    workId: string,
    threadId: string,
    body: { title?: string; body?: string; locked?: boolean; archived?: boolean },
  ) => worksClient.patch(`/works/${id(workId)}/threads/${id(threadId)}`, body),
  deleteThread: async (workId: string, threadId: string) =>
    worksClient.delete(`/works/${id(workId)}/threads/${id(threadId)}`),
  restoreThread: async (workId: string, threadId: string) =>
    worksClient.post(`/works/${id(workId)}/threads/${id(threadId)}/restore`),
  remove: async (workId: string) => worksClient.delete(`/works/${id(workId)}`),
  list: async (params: WorkQuery, signal?: AbortSignal) =>
    (await worksClient.get<Page<Work>>('/works', { params, signal })).data,
  get: async (workId: string, signal?: AbortSignal) =>
    (await worksClient.get<Work>(`/works/${id(workId)}`, { signal })).data,
  update: async (workId: string, body: Partial<WorkInput>) =>
    (await worksClient.patch<Work>(`/works/${id(workId)}`, body)).data,
  view: async (workId: string) =>
    (await worksClient.post<{ counted: boolean }>(`/works/${id(workId)}/view`)).data,
  collect: async (workId: string, collected: boolean) =>
    collected
      ? (await worksClient.post<{ collected: boolean }>(`/works/${id(workId)}/collection`)).data
      : (await worksClient.delete<{ collected: boolean }>(`/works/${id(workId)}/collection`)).data,
  collection: async (offset = 0, signal?: AbortSignal) =>
    (await worksClient.get<Page<Work>>('/me/collection', { params: { offset, limit: 20 }, signal }))
      .data,
  banners: async (signal?: AbortSignal) =>
    (await worksClient.get<Page<WorkBanner>>('/banner', { signal })).data,
  threads: async (workId: string, signal?: AbortSignal, includeDeleted = false) =>
    (
      await worksClient.get<{ items: ThreadRef[] }>(`/works/${id(workId)}/threads`, {
        signal,
        params: { include_deleted: includeDeleted },
      })
    ).data,
  addTag: async (workId: string, tagId: string) =>
    worksClient.put(`/works/${id(workId)}/tags/${id(tagId)}`),
  removeTag: async (workId: string, tagId: string) =>
    worksClient.delete(`/works/${id(workId)}/tags/${id(tagId)}`),
};
