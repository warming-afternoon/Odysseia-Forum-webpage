import axios from 'axios';
import { getForumAuthConfig } from '@/features/auth/api/fluxerAuthApi';
import { captureAuthSession, invalidateAuthSession, isAuthSessionCurrent, type AuthSessionSnapshot } from '@/shared/lib/authSession';
import { parseWithSafeSnowflakeIds } from '@/shared/api/client';

export interface NativeMessage {
  id: string; channel_id: string; content: string; timestamp: string; edited_timestamp: string | null;
  author: { id: string; username: string; global_name?: string | null; avatar?: string | null };
  attachments: { id: string; url: string; filename: string; content_type?: string }[];
  reactions?: { emoji: { id?: string | null; name?: string | null }; count: number }[];
}
export const nativeClient = axios.create({ timeout: 20000, withCredentials: false, transformResponse: [parseWithSafeSnowflakeIds] });
const requestSessions = new WeakMap<object, AuthSessionSnapshot>();
nativeClient.interceptors.request.use(async config => {
  const session = captureAuthSession();
  const auth = await getForumAuthConfig();
  if (!isAuthSessionCurrent(session)) throw new axios.CanceledError('登录会话已变化');
  if (auth.mode !== 'fluxer' || !auth.fluxer_api_url) throw new Error('Fluxer 原生内容服务未启用');
  if (!session.token) throw new Error('需要 Fluxer 登录');
  requestSessions.set(config, session);
  config.baseURL = auth.fluxer_api_url.replace(/\/$/, '');
  config.headers.Authorization = session.token;
  config.headers.set('X-Fluxer-Features', 'channel_threads');
  return config;
});
nativeClient.interceptors.response.use(response => response, error => {
  const session = error.config && requestSessions.get(error.config);
  if (error.response?.status === 401 && session?.token && isAuthSessionCurrent(session)) {
    invalidateAuthSession();
  }
  return Promise.reject(error);
});
export const nativeMessagesApi = {
  get: async (channelId: string, messageId: string, signal?: AbortSignal) => (await nativeClient.get<NativeMessage>(`/channels/${encodeURIComponent(channelId)}/messages/${encodeURIComponent(messageId)}`, { signal })).data,
  updateThread: async (channelId: string, body: { name?: string; archived?: boolean }) => nativeClient.patch(`/channels/${encodeURIComponent(channelId)}`, body),
  list: async (channelId: string, before?: string, signal?: AbortSignal) => (await nativeClient.get<NativeMessage[]>(`/channels/${encodeURIComponent(channelId)}/messages`, { params: { limit: 50, before }, signal })).data,
  send: async (channelId: string, content: string, nonce: string) => (await nativeClient.post<NativeMessage>(`/channels/${encodeURIComponent(channelId)}/messages`, { content, nonce })).data,
  edit: async (channelId: string, messageId: string, content: string) => (await nativeClient.patch<NativeMessage>(`/channels/${encodeURIComponent(channelId)}/messages/${encodeURIComponent(messageId)}`, { content })).data,
  remove: async (channelId: string, messageId: string) => nativeClient.delete(`/channels/${encodeURIComponent(channelId)}/messages/${encodeURIComponent(messageId)}`),
};
