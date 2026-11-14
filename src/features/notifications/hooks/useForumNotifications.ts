import { useEffect, useState, useSyncExternalStore } from 'react';
import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { notificationsV2Api, type ForumNotificationParams } from '../api/notificationsV2Api';
import { SharedNotificationSocket } from '../realtime/sharedNotificationSocket';
import type { NotificationSocketState } from '../realtime/notificationSocket';
import { captureAuthSession, isAuthSessionCurrent, subscribeAuthInvalidation } from '@/shared/lib/authSession';

export function safeForumSocketUrl(value: string | undefined): string | null {
  if (!value) return null;
  try {
    const url = new URL(value);
    const local = url.hostname === '127.0.0.1' || url.hostname === '[::1]';
    if (url.username || url.password || url.search || url.hash ||
        (url.protocol !== 'wss:' && !(url.protocol === 'ws:' && local))) return null;
    return url.toString();
  } catch { return null; }
}

export const forumNotificationKeys = {
  all: ['forum-notifications-v2'] as const,
  list: (params: ForumNotificationParams) => ['forum-notifications-v2', 'list', params] as const,
  count: ['forum-notifications-v2', 'count'] as const,
};

export function useForumAuthorFollows(enabled: boolean) {
  return useInfiniteQuery({
    queryKey: ['forum-author-follows-v2'],
    queryFn: ({ pageParam, signal }) => notificationsV2Api.authorFollows(pageParam, signal),
    initialPageParam: 0,
    getNextPageParam: (page) => page.offset + page.items.length < page.total ? page.offset + page.items.length : undefined,
    enabled, staleTime: 30_000,
  });
}

export function useForumNotificationList(params: ForumNotificationParams, enabled: boolean) {
  return useInfiniteQuery({
    queryKey: forumNotificationKeys.list(params),
    queryFn: ({ pageParam, signal }) => notificationsV2Api.list({ ...params, cursor: pageParam ?? undefined }, signal),
    initialPageParam: null as string | null,
    getNextPageParam: (page) => page.next_cursor ?? undefined,
    enabled,
    staleTime: 30_000,
  });
}

export function useForumNotificationPreview(enabled: boolean) {
  return useQuery({ queryKey: forumNotificationKeys.list({ limit: 5 }),
    queryFn: ({ signal }) => notificationsV2Api.list({ limit: 5, offset: 0 }, signal),
    enabled, staleTime: 30_000 });
}

export function useForumUnreadCount(enabled: boolean) {
  // 低频校准采用客户端错峰；后台标签页默认不轮询。
  const [interval] = useState(() => 270_000 + Math.floor(Math.random() * 60_000));
  return useQuery({ queryKey: forumNotificationKeys.count, queryFn: ({ signal }) => notificationsV2Api.unread(signal),
    enabled, staleTime: 30_000, refetchInterval: interval, refetchOnWindowFocus: true });
}

export function useForumReadAll() {
  const client = useQueryClient();
  return useMutation({ mutationFn: notificationsV2Api.readAll,
    onSuccess: () => client.invalidateQueries({ queryKey: forumNotificationKeys.all }) });
}

const getSessionGeneration = () => captureAuthSession().generation;

/** 顶部入口挂载一次；通知列表打开时才读取，变更事件合并后校准。 */
export function useForumRealtime(enabled: boolean): NotificationSocketState {
  const client = useQueryClient();
  const generation = useSyncExternalStore(subscribeAuthInvalidation, getSessionGeneration);
  const [status, setStatus] = useState<NotificationSocketState>('disconnected');
  useEffect(() => {
    if (!enabled) { setStatus('disconnected'); return; }
    const session = captureAuthSession();
    const configured = safeForumSocketUrl(import.meta.env.VITE_NOTIFICATION_WS_URL);
    if (!configured || !session.token) { setStatus('disconnected'); return; }
    setStatus('connecting');
    let refresh: ReturnType<typeof setTimeout> | null = null;
    const invalidate = () => {
      if (!isAuthSessionCurrent(session) || refresh !== null) return;
      refresh = setTimeout(() => {
        refresh = null;
        if (isAuthSessionCurrent(session)) {
          // 中止事件前开始的查询，避免旧快照在新状态之后覆盖角标。
          void client.cancelQueries({ queryKey: forumNotificationKeys.all }).then(() => {
            if (isAuthSessionCurrent(session)) return client.invalidateQueries({ queryKey: forumNotificationKeys.all });
          });
        }
      }, 300 + Math.random() * 700);
    };
    const socket = new SharedNotificationSocket({
      url: configured,
      getTicket: async (signal) => {
        if (!isAuthSessionCurrent(session)) throw new Error('登录状态已变化');
        const ticket = await notificationsV2Api.ticket(signal);
        if (!isAuthSessionCurrent(session)) throw new Error('登录状态已变化');
        return ticket;
      },
      onChange: invalidate,
      onState: setStatus,
    }, session.token);
    const unsubscribe = subscribeAuthInvalidation(() => {
      socket.stop();
      setStatus('disconnected');
      client.removeQueries({ queryKey: forumNotificationKeys.all });
    });
    socket.start();
    return () => { unsubscribe(); socket.stop(); if (refresh !== null) clearTimeout(refresh); };
  }, [client, enabled, generation]);
  return status;
}
