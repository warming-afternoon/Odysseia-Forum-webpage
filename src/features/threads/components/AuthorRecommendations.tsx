import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { motion } from 'motion/react';
import { searchApi } from '@/features/search/api/searchApi';
import { searchKeys } from '@/features/search/lib/queryKeys';
import { ThreadCard } from '@/entities/thread/ThreadCard';
import { ThreadCardSkeleton } from '@/entities/thread/ThreadCardSkeleton';
import { usePreviewStore } from '@/features/search/store/previewStore';
import type { Thread } from '@/entities/thread/types';
import { BookOpenText, ChevronRight } from 'lucide-react';
import { Link } from 'react-router-dom';

interface AuthorRecommendationsProps {
  authorId: string;
  authorName: string;
  currentThreadId: string;
}

/**
 * 同作者作品推荐组件
 * 自动应用用户偏好并排除当前帖子
 */
export function AuthorRecommendations({
  authorId,
  authorName,
  currentThreadId,
}: AuthorRecommendationsProps) {
  const setPreviewThreadId = usePreviewStore((state) => state.setPreviewThreadId);

  const { data, isLoading } = useQuery({
    queryKey: [...searchKeys.all, 'author-recommendations', authorId, currentThreadId],
    queryFn: () =>
      searchApi.search({
        include_authors: [authorId],
        author_name: authorId,
        exclude_thread_ids: [currentThreadId],
        apply_preferences: true,
        limit: 6,
        sort_method: 'created_desc',
      }),
    enabled: !!authorId,
    staleTime: 5 * 60 * 1000,
  });

  const threads = useMemo(
    () => ((data?.results || []) as Thread[]),
    [data?.results],
  );

  // 加载中 → 骨架屏
  if (isLoading) {
    return (
      <div className="mt-12 border-t border-(--od-shell-line) pt-8">
        <div className="mb-6 flex items-center gap-2">
          <BookOpenText className="h-5 w-5 text-(--od-accent)" />
          <h3 className="text-lg font-bold text-(--od-text-primary)">
            {authorName} 的其他作品
          </h3>
        </div>
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <ThreadCardSkeleton key={i} />
          ))}
        </div>
      </div>
    );
  }

  // 无结果 → 空状态提示
  if (threads.length === 0) {
    return (
      <div className="mt-12 border-t border-(--od-shell-line) pt-8">
        <div className="mb-4 flex items-center gap-2">
          <BookOpenText className="h-5 w-5 text-(--od-accent)" />
          <h3 className="text-lg font-bold text-(--od-text-primary)">
            {authorName} 的其他作品
          </h3>
        </div>
        <p className="text-sm text-(--od-text-tertiary)">
          暂未收录该作者的其他作品，或已被偏好设置过滤。
        </p>
      </div>
    );
  }

  // 正常渲染
  return (
    <div className="mt-12 border-t border-(--od-shell-line) pt-8">
      <div className="mb-6 flex items-center justify-between">
        <h3 className="flex items-center gap-2 text-lg font-bold text-(--od-text-primary)">
          <BookOpenText className="h-5 w-5 text-(--od-accent)" />
          {authorName} 的其他作品
        </h3>
        <Link
          to={`/u/${authorId}`}
          onClick={() => setPreviewThreadId(null)}
          className="flex items-center gap-1 text-sm font-medium text-(--od-accent) transition-colors hover:text-(--od-accent-hover)"
        >
          更多作品
          <ChevronRight className="h-4 w-4" />
        </Link>
      </div>

      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {threads.map((thread, index) => (
          <motion.div
            key={thread.thread_id}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.05 }}
          >
            <ThreadCard
              thread={thread}
              onPreview={(t) => setPreviewThreadId(t.thread_id)}
              index={index}
            />
          </motion.div>
        ))}
      </div>
    </div>
  );
}
