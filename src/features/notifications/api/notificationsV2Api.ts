import { worksClient } from '@/features/works/api';
import type { Work } from '@/entities/work/types';

export interface ForumNotification {
  id: string;
  type: 'thread_update' | 'author_new_thread' | 'tag_review' | 'work_announcement';
  work_id: string | null;
  work_title: string | null;
  work: Work | null;
  author: { id: string; username: string; display_name: string | null; avatar_url: string | null } | null;
  announcement_id: string | null;
  title: string | null;
  body: string;
  withdrawn: boolean;
  target_type: string | null;
  target_id: string | null;
  proposal_id: string | null;
  read_at: string | null;
  created_at: string;
}
export interface ForumNotificationPage {
  items: ForumNotification[];
  total: number;
  unread_count: number;
  offset: number;
  limit: number;
  next_cursor: string | null;
}
export interface ForumAuthorFollowPage {
  items: { id: string; username: string; display_name: string | null; avatar_url: string | null }[];
  total: number;
  offset: number;
  limit: number;
}
export interface ForumNotificationParams {
  limit?: number;
  offset?: number;
  cursor?: string;
  unreadOnly?: boolean;
  authorId?: string;
}
const safeId = (value: string) => {
  if (!/^\d{1,19}$/.test(value)) throw new Error('无效通知编号');
  return encodeURIComponent(value);
};
export const notificationsV2Api = {
  async authorFollows(offset: number, signal?: AbortSignal) {
    return (await worksClient.get<ForumAuthorFollowPage>('/me/author-follows', { params: { offset, limit: 50 }, signal })).data;
  },
  async list(params: ForumNotificationParams = {}, signal?: AbortSignal) {
    return (await worksClient.get<ForumNotificationPage>('/me/notifications', {
      params: { limit: params.limit, offset: params.offset, cursor: params.cursor, unread_only: params.unreadOnly, author_id: params.authorId },
      signal,
    })).data;
  },
  async unread(signal?: AbortSignal) {
    return (await worksClient.get<{ unread_count: number }>('/me/notifications/unread-count', { signal })).data;
  },
  async read(id: string) { await worksClient.post(`/me/notifications/${safeId(id)}/read`); },
  async readAll() { return (await worksClient.post<{ read: boolean; marked_read: number }>('/me/notifications/read-all')).data; },
  async ticket(signal: AbortSignal) {
    return (await worksClient.post<{ ticket: string }>('/me/notifications/socket-ticket', null, { signal })).data.ticket;
  },
};
