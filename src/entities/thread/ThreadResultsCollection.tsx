import { ThreadCard } from '@/entities/thread/ThreadCard';
import { ThreadListItem } from '@/entities/thread/ThreadListItem';
import type { Thread } from '@/entities/thread/types';
import { useLayoutMode } from '@/shared/hooks/useSettings';
import type { LayoutMode } from '@/shared/hooks/useLayoutPreference';
import { memo } from 'react';

interface ThreadResultsCollectionProps {
  threads: Thread[];
  onPreview?: (thread: Thread) => void;
  onTagClick?: (tagName: string) => void;
  onAuthorClick?: (author: { id: string; name: string }) => void;
  searchQuery?: string;
  gridClassName?: string;
  listClassName?: string;
  layoutMode?: LayoutMode;
}

const DEFAULT_GRID_CLASS = 'grid auto-rows-fr grid-cols-2 gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4';
const DEFAULT_LIST_CLASS = 'flex flex-col space-y-od-list-gap';

function ThreadResultsCollectionImpl({
  threads,
  onPreview,
  onTagClick,
  onAuthorClick,
  searchQuery,
  gridClassName = DEFAULT_GRID_CLASS,
  listClassName = DEFAULT_LIST_CLASS,
  layoutMode: controlledLayoutMode,
}: ThreadResultsCollectionProps) {
  const fallbackLayoutMode = useLayoutMode();
  const layoutMode = controlledLayoutMode ?? fallbackLayoutMode;

  return (
    <div className={layoutMode === 'list' ? listClassName : gridClassName}>
      {threads.map((thread, index) =>
        layoutMode === 'list' ? (
          <ThreadListItem
            key={thread.thread_id}
            thread={thread}
            index={index}
            onTagClick={onTagClick}
            searchQuery={searchQuery}
            onAuthorClick={onAuthorClick}
            onPreview={onPreview}
          />
        ) : (
          <ThreadCard
            key={thread.thread_id}
            thread={thread}
            index={index}
            onTagClick={onTagClick}
            searchQuery={searchQuery}
            onAuthorClick={onAuthorClick}
            onPreview={onPreview}
          />
        ),
      )}
    </div>
  );
}

export const ThreadResultsCollection = memo(ThreadResultsCollectionImpl);
