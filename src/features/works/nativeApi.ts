import axios from 'axios';
import { getForumAuthConfig } from '@/features/auth/api/fluxerAuthApi';
import { getStoredAuthToken } from '@/shared/lib/authSession';
import { parseWithSafeSnowflakeIds } from '@/shared/api/client';

export interface NativeMessage {
  id: string; channel_id: string; content: string; timestamp: string; edited_timestamp: string | null;
  author: { id: string; username: string; global_name?: string | null; avatar?: string | null };
  attachments: { id: string; url: string; filename: string; content_type?: string }[];
  reactions?: { emoji: { id?: string | null; name?: string | null }; count: number }[];
}
export const nativeClient = axios.create({ timeout: 20000, withCredentials: false, transformResponse: [parseWithSafeSnowflakeIds] });
nativeClient.interceptors.request.use(async config => {
  const auth = await getForumAuthConfig();
  if (auth.mode !== 'fluxer' || !auth.fluxer_api_url) throw new Error('Fluxer 原生内容服务未启用');
  const token = getStoredAuthToken();
  if (!token) throw new Error('需要 Fluxer 登录');
  config.baseURL = auth.fluxer_api_url.replace(/\/$/, '');
  config.headers.Authorization = token;
  return config;
});
export const nativeMessagesApi = {
  get: async (channelId: string, messageId: string, signal?: AbortSignal) => (await nativeClient.get<NativeMessage>(`/channels/${encodeURIComponent(channelId)}/messages/${encodeURIComponent(messageId)}`, { signal })).data,
  updateThread: async (channelId: string, body: { name?: string; archived?: boolean }) => nativeClient.patch(`/channels/${encodeURIComponent(channelId)}`, body),
  list: async (channelId: string, before?: string, signal?: AbortSignal) => (await nativeClient.get<NativeMessage[]>(`/channels/${encodeURIComponent(channelId)}/messages`, { params: { limit: 50, before }, signal })).data,
  send: async (channelId: string, content: string, nonce: string) => (await nativeClient.post<NativeMessage>(`/channels/${encodeURIComponent(channelId)}/messages`, { content, nonce, enforce_nonce: true })).data,
  edit: async (channelId: string, messageId: string, content: string) => (await nativeClient.patch<NativeMessage>(`/channels/${encodeURIComponent(channelId)}/messages/${encodeURIComponent(messageId)}`, { content })).data,
  remove: async (channelId: string, messageId: string) => nativeClient.delete(`/channels/${encodeURIComponent(channelId)}/messages/${encodeURIComponent(messageId)}`),
};
