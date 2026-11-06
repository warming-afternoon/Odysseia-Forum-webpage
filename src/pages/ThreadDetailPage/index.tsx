import { useWorkPresentation } from '@/features/works/useWorkPresentation';
import { workToThread } from '@/features/works/workPresentation';
import { useQuery } from '@tanstack/react-query';
import { useNavigate, useParams } from 'react-router-dom';

import { searchApi } from '@/features/search/api/searchApi';
import { searchKeys } from '@/features/search/lib/queryKeys';
import { PageStatusMessage } from '@/shared/ui/PageStatusMessage';
import { ThreadPreviewOverlay } from '@/widgets/thread-preview/ThreadPreviewOverlay';

export function ThreadDetailPage() {
  const { threadId } = useParams();
  const navigate = useNavigate();
  const normalizedThreadId = String(threadId || '').trim();
  const isValidThreadId = /^\d+$/.test(normalizedThreadId);
  const threadQuery = useQuery({
    queryKey: searchKeys.thread(normalizedThreadId),
    queryFn: () => searchApi.getThread(normalizedThreadId),
    enabled: isValidThreadId,
    staleTime: 5 * 60 * 1000,
  });

  if (!isValidThreadId) {
    return <PageStatusMessage tone="error">无效帖子 ID</PageStatusMessage>;
  }

  if (threadQuery.isLoading) {
    return <PageStatusMessage>正在帮你加载帖子...</PageStatusMessage>;
  }

  if (threadQuery.isError || !threadQuery.data) {
    return (
      <PageStatusMessage tone="error">
        帖子加载出错了，可能不存在或已经被删除了
      </PageStatusMessage>
    );
  }

  return (
    <ThreadPreviewOverlay
      thread={threadQuery.data}
      onClose={() => navigate('/')}
    />
  );
}

/** Canonical work route; legacy /threads/:threadId stays a source-thread route. */
export function WorkPresentationPage() {
  const { workId = '' } = useParams();
  const navigate = useNavigate();
  const result = useWorkPresentation(workId);
  if (result.isValidating) return <PageStatusMessage>正在帮你加载作品...</PageStatusMessage>;
  if (result.error || !result.data) return <PageStatusMessage tone="error">作品不存在或当前不可访问</PageStatusMessage>;
  return <ThreadPreviewOverlay thread={workToThread(result.data)} onClose={() => navigate('/')} />;
}
