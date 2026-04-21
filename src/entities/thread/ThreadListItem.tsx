import { MessageCircle, ThumbsUp, Eye, Clock3, Images, BookOpen } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { zhCN } from 'date-fns/locale';
import { memo, useState } from 'react';
import { useNavigate } from 'react-router-dom';

import { LazyImage } from '@/shared/ui/LazyImage';
import { HighlightText } from '@/shared/ui/HighlightText';
import { MarkdownText } from '@/shared/ui/MarkdownText';
import type { Thread } from '@/entities/thread/types';
import { useFontSizeSetting, useImageModeSetting } from '@/shared/hooks/useSettings';
import { fontSizeMap } from '@/shared/lib/settings';
import { ThreadActions } from '@/features/threads/components/ThreadActions';
import { AuthorAvatar } from '@/entities/user/AuthorAvatar';
import { ThreadStatusBadges } from '@/entities/thread/ThreadStatusBadges';
import { usePretextClampText } from '@/shared/hooks/usePretextClampText';
import { QuickAddToBooklistModal } from '@/features/booklists/components/QuickAddToBooklistModal';

interface ThreadListItemProps {
  thread: Thread;
  onTagClick?: (tag: string) => void;
  searchQuery?: string;
  onAuthorClick?: (author: { id: string; name: string }) => void;
  onPreview?: (thread: Thread) => void;
  index?: number;
}

function ThreadListItemImpl({ thread, onTagClick, searchQuery, onAuthorClick, onPreview, index = 0 }: ThreadListItemProps) {
  const navigate = useNavigate();
  const fontSize = useFontSizeSetting();
  const imageMode = useImageModeSetting();
  const fontSizes = fontSizeMap[fontSize];
  const [quickAddOpen, setQuickAddOpen] = useState(false);

  const createdTime = formatDistanceToNow(new Date(thread.created_at), {
    addSuffix: true,
    locale: zhCN,
  });
  const lastActiveTime = thread.last_active_at
    ? formatDistanceToNow(new Date(thread.last_active_at), {
        addSuffix: true,
        locale: zhCN,
      })
    : null;
  const virtualOnlyTags = (thread.virtual_tags || []).filter((tag) => !thread.tags.includes(tag));

  const authorName =
    thread.author?.display_name ??
    thread.author?.global_name ??
    thread.author?.name ??
    '未知用户';
  const authorId = thread.author?.id || '';
  const hasExcerpt = !!thread.first_message_excerpt && thread.first_message_excerpt.trim() !== '...';
  const thumbnails = imageMode === 'off' ? [] : (thread.thumbnail_urls || []).filter(Boolean).slice(0, 4);

  const { measureRef: titleMeasureRef, clampedText: clampedTitle } = usePretextClampText<HTMLHeadingElement>(
    thread.title,
    { maxLines: 2 },
  );

  const handleAuthorClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!authorId) return;
    if (onAuthorClick) {
      onAuthorClick({ id: authorId, name: authorName });
      return;
    }
    navigate(`/u/${authorId}`);
  };

  return (
    <article
      className="group relative w-full cursor-pointer py-3 text-(--od-text-primary) transition-colors duration-200 animate-in fade-in slide-in-from-bottom-2 duration-700 fill-mode-both"
      style={{
        animationDelay: `${(index % 24) * 40}ms`,
      }}
      onClick={() => onPreview?.(thread)}
    >
      <div className="absolute inset-x-0 bottom-0 h-px bg-[linear-gradient(90deg,transparent,color-mix(in_srgb,var(--od-divider-strong)_60%,transparent),transparent)]" />

      <div className="flex flex-col gap-4 md:flex-row md:items-start md:gap-5">
        {thumbnails.length > 0 && (
          <div className="shrink-0 md:w-54 lg:w-58">
            <div className="grid h-38 grid-cols-2 gap-1.5 md:h-43">
              {thumbnails.length === 1 && (
                <div className="relative col-span-2 overflow-hidden rounded-2xl bg-(--od-surface-shell)">
                  <LazyImage
                    src={thumbnails[0]}
                    alt={`${thread.title} 缩略图 1`}
                    className="h-full w-full object-cover"
                    threadId={thread.thread_id}
                    channelId={thread.channel_id}
                  />
                </div>
              )}

              {thumbnails.length === 2 && (
                <>
                  {thumbnails.map((src, idx) => (
                    <div
                      key={`${thread.thread_id}-${src}-${idx}`}
                      className="relative overflow-hidden rounded-2xl bg-(--od-surface-shell)"
                    >
                      <LazyImage
                        src={src}
                        alt={`${thread.title} 缩略图 ${idx + 1}`}
                        className="h-full w-full object-cover"
                        threadId={thread.thread_id}
                        channelId={thread.channel_id}
                        index={index}
                      />
                    </div>
                  ))}
                </>
              )}

              {thumbnails.length === 3 && (
                <>
                  <div className="relative row-span-2 overflow-hidden rounded-2xl bg-(--od-surface-shell)">
                    <LazyImage
                      src={thumbnails[0]}
                      alt={`${thread.title} 缩略图 1`}
                      className="h-full w-full object-cover"
                      threadId={thread.thread_id}
                      channelId={thread.channel_id}
                    />
                  </div>
                  <div className="relative overflow-hidden rounded-2xl bg-(--od-surface-shell)">
                    <LazyImage
                      src={thumbnails[1]}
                      alt={`${thread.title} 缩略图 2`}
                      className="h-full w-full object-cover"
                      threadId={thread.thread_id}
                      channelId={thread.channel_id}
                      index={index}
                    />
                  </div>
                  <div className="relative overflow-hidden rounded-2xl bg-(--od-surface-shell)">
                    <LazyImage
                      src={thumbnails[2]}
                      alt={`${thread.title} 缩略图 3`}
                      className="h-full w-full object-cover"
                      threadId={thread.thread_id}
                      channelId={thread.channel_id}
                    />
                  </div>
                </>
              )}

              {thumbnails.length === 4 && (
                <>
                  {thumbnails.map((src, idx) => (
                    <div
                      key={`${thread.thread_id}-${src}-${idx}`}
                      className="relative overflow-hidden rounded-2xl bg-(--od-surface-shell)"
                    >
                      <LazyImage
                        src={src}
                        alt={`${thread.title} 缩略图 ${idx + 1}`}
                        className="h-full w-full object-cover"
                        threadId={thread.thread_id}
                        channelId={thread.channel_id}
                        index={index}
                      />
                      {idx === 3 && (thread.thumbnail_urls?.length || 0) > thumbnails.length && (
                        <div className="absolute inset-0 flex items-end justify-end bg-[linear-gradient(180deg,transparent,rgba(0,0,0,0.42))] p-2 text-white">
                          <span className="inline-flex items-center gap-1 text-[10px] font-medium tracking-[0.08em]">
                            <Images className="h-3 w-3" />
                            +{(thread.thumbnail_urls?.length || 0) - thumbnails.length}
                          </span>
                        </div>
                      )}
                    </div>
                  ))}
                </>
              )}
            </div>
          </div>
        )}

        <div className="min-w-0 flex-1">
          <div className={`mb-2 flex flex-wrap items-center gap-x-2 gap-y-1 ${fontSizes.meta} text-(--od-text-tertiary)`}>
            <button type="button" onClick={handleAuthorClick} className="shrink-0 rounded-full">
              <AuthorAvatar author={thread.author} className="h-6 w-6 md:h-7 md:w-7" />
            </button>
            <button
              type="button"
              onClick={handleAuthorClick}
              className="max-w-36 truncate font-medium text-(--od-text-secondary) transition-colors hover:text-(--od-text-primary)"
            >
              {authorName}
            </button>
            <span className="text-(--od-divider-strong)/75">/</span>
            <span className="whitespace-nowrap">{createdTime}</span>
            {lastActiveTime && (
              <span className="inline-flex items-center gap-1 whitespace-nowrap">
                <Clock3 className="h-3 w-3" />
                活跃 {lastActiveTime}
              </span>
            )}
          </div>

          <div className="mb-3 flex items-start gap-2.5">
            <h3
              ref={titleMeasureRef}
              className={`min-w-0 flex-1 font-semibold leading-snug tracking-[-0.02em] text-(--od-text-primary) transition-colors duration-200 group-hover:text-(--od-text-heading) ${fontSizes.title}`}
            >
              <HighlightText text={clampedTitle} highlight={searchQuery} />
            </h3>
            <ThreadStatusBadges
              isFollowing={thread.collected_flag}
              hasUpdate={thread.has_update}
              variant="list"
              className="mt-0.5 shrink-0"
            />
          </div>

          {hasExcerpt && (
            <div
              className={`mb-3 od-md line-clamp-2 break-all leading-relaxed text-(--od-text-secondary) md:max-w-[72ch] ${fontSizes.content}`}
            >
              <MarkdownText text={thread.first_message_excerpt!} />
            </div>
          )}

          <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
            <div className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-(--od-text-tertiary) md:text-xs">
              {thread.tags?.slice(0, 4).map((tag) => (
                <button
                  key={tag}
                  onClick={(e) => {
                    e.stopPropagation();
                    onTagClick?.(tag);
                  }}
                  className="truncate transition-colors hover:text-(--od-text-primary)"
                >
                  #{tag}
                </button>
              ))}
              {thread.tags && thread.tags.length > 4 && <span>+{thread.tags.length - 4}</span>}
              {virtualOnlyTags.slice(0, 2).map((tag) => (
                <span key={`vt-${tag}`} className="text-(--od-text-emphasis)">
                  ~{tag}
                </span>
              ))}
            </div>

            <div className="flex items-center gap-3 text-[11px] text-(--od-text-tertiary) md:text-xs">
              <span className="inline-flex items-center gap-1 transition-colors group-hover:text-(--od-text-secondary)">
                <MessageCircle className="h-3.5 w-3.5" />
                <span className="tabular-nums">{thread.reply_count}</span>
              </span>
              <span className="inline-flex items-center gap-1 transition-colors group-hover:text-(--od-text-secondary)">
                <ThumbsUp className="h-3.5 w-3.5" />
                <span className="tabular-nums">{thread.reaction_count}</span>
              </span>
              <span className="inline-flex items-center gap-1 transition-colors group-hover:text-(--od-text-secondary)">
                <Eye className="h-3.5 w-3.5" />
                <span className="tabular-nums">{thread.display_count}</span>
              </span>
            </div>

            <div className="ml-auto flex shrink-0 items-center gap-2 text-(--od-text-tertiary) transition-colors group-hover:text-(--od-text-primary) md:hidden">
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setQuickAddOpen(true);
                }}
                className="inline-flex h-8 w-8 items-center justify-center rounded-md text-sm font-semibold transition-all duration-200 hover:bg-(--od-bg-tertiary) hover:text-(--od-text-primary)"
                aria-label="加入书单"
                title="加入书单"
              >
                <BookOpen className="h-4 w-4" />
              </button>
              <ThreadActions
                threadId={thread.thread_id}
                channelId={thread.channel_id}
                guildId={thread.guild_id}
                size="md"
              />
            </div>
          </div>
        </div>
      </div>

      <div className="absolute right-0 top-3 hidden items-center gap-2 md:flex">
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            setQuickAddOpen(true);
          }}
          className="inline-flex h-8 w-8 items-center justify-center rounded-md text-sm font-semibold text-(--od-text-tertiary) transition-all duration-200 md:translate-y-1 md:opacity-0 md:group-hover:translate-y-0 md:group-hover:opacity-100 hover:bg-(--od-bg-tertiary) hover:text-(--od-text-primary)"
          aria-label="加入书单"
          title="加入书单"
        >
          <BookOpen className="h-4 w-4" />
        </button>
        <div className="text-(--od-text-tertiary) transition-colors group-hover:text-(--od-text-primary)">
          <ThreadActions
            threadId={thread.thread_id}
            channelId={thread.channel_id}
            guildId={thread.guild_id}
            size="md"
          />
        </div>
      </div>

      <QuickAddToBooklistModal
        isOpen={quickAddOpen}
        threadId={thread.thread_id}
        threadTitle={thread.title}
        onClose={() => setQuickAddOpen(false)}
      />
    </article>
  );
}

export const ThreadListItem = memo(ThreadListItemImpl);
