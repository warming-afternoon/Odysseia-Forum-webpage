import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import type { Thread } from '@/entities/thread/types';
import { workToThread } from '@/features/works/workPresentation';
import { notificationsV2Api, type ForumNotification } from '../api/notificationsV2Api';
import { forumNotificationKeys } from '../hooks/useForumNotifications';
import { ThreadNotificationView } from './DynamicNotificationCard';

export function ForumNotificationCard({ notification, compact = false, onNavigate, onPreview }: {
  notification: ForumNotification; compact?: boolean; onNavigate?: () => void;
  onPreview: (thread: Thread) => void;
}) {
  const navigate = useNavigate();
  const client = useQueryClient();
  const markRead = useMutation({
    mutationFn: () => notificationsV2Api.read(notification.id),
    onSuccess: () => client.invalidateQueries({ queryKey: forumNotificationKeys.all }),
  });
  if (notification.type === 'tag_review' || !notification.work) {
    const target = notification.work_id ? `/works/${encodeURIComponent(notification.work_id)}`
      : notification.target_type === 'booklist' && notification.target_id
        ? `/booklists/${encodeURIComponent(notification.target_id)}` : null;
    return <article className="space-y-2 border-b border-(--od-border) p-3 text-sm">
      <p className="font-semibold">{notification.read_at === null && '未读 · '}{notification.title || '标签审核'}</p>
      <p className="text-xs text-(--od-text-secondary)">{notification.body}</p>
      <div className="flex gap-3 text-xs">
        {target && <button type="button" className="min-h-10 text-(--od-accent)" onClick={() => {
          if (notification.read_at === null) markRead.mutate();
          navigate(target); onNavigate?.();
        }}>查看内容</button>}
        {notification.read_at === null && <button type="button" disabled={markRead.isPending} onClick={() => markRead.mutate()}>标为已读</button>}
      </div>
      {markRead.isError && <p role="alert">标记失败，请重试</p>}
    </article>;
  }
  const thread = workToThread(notification.work);
  return <ThreadNotificationView
    notification={{ type: notification.type, thread, created_at: notification.created_at,
      read_at: notification.read_at, update: { description: notification.body, version: notification.title } }}
    variant={compact ? 'compact' : 'feed'}
    onOpen={() => {
      if (notification.read_at === null) markRead.mutate();
      onPreview(thread); onNavigate?.();
    }}
    onAuthorOpen={() => {
      if (notification.work?.author_id) navigate(`/works/users/${encodeURIComponent(notification.work.author_id)}`);
      onNavigate?.();
    }}
  />;
}
