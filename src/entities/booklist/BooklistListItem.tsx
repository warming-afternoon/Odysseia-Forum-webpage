import { BookOpen, Eye, Globe, Lock, Star } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { zhCN } from "date-fns/locale";

import type { Booklist } from "@/entities/booklist/types";
import { LazyImage } from "@/shared/ui/LazyImage";

interface BooklistListItemProps {
  booklist: Booklist;
  canManage: boolean;
  coverImageUrl?: string | null;
  ownerName?: string;
  ownerAvatarUrl?: string | null;
  onOpen: (booklistId: number) => void;
  onToggleCollect: (booklist: Booklist) => void;
  onEdit: (booklist: Booklist) => void;
  onDelete: (booklist: Booklist) => void;
  collectLoading?: boolean;
}

export function BooklistListItem({
  booklist,
  canManage,
  coverImageUrl,
  ownerName,
  ownerAvatarUrl,
  onOpen,
  onToggleCollect,
  onEdit,
  onDelete,
  collectLoading,
}: BooklistListItemProps) {
  const updatedText = formatDistanceToNow(new Date(booklist.updated_at), {
    addSuffix: true,
    locale: zhCN,
  });

  const ownerFallbackName = ownerName || `用户 ${booklist.owner_id}`;

  return (
    <article
      className="group relative w-full cursor-pointer py-3 text-[var(--od-text-primary)] transition-colors duration-200"
      onClick={() => onOpen(booklist.id)}
    >
      <div className="absolute inset-x-0 bottom-0 h-px bg-[linear-gradient(90deg,transparent,color-mix(in_srgb,var(--od-divider-strong)_60%,transparent),transparent)]" />

      <div className="flex flex-col gap-4 md:flex-row md:items-start md:gap-5">
        <div className="min-w-0 flex-1">
          <div className="mb-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-[var(--od-text-tertiary)]">
            <span className="relative h-6 w-6 shrink-0 overflow-hidden rounded-full bg-[var(--od-bg-tertiary)]">
              <LazyImage
                src={
                  ownerAvatarUrl ||
                  "https://cdn.discordapp.com/embed/avatars/0.png"
                }
                alt={ownerFallbackName}
                className="h-full w-full object-cover"
              />
            </span>
            <span className="max-w-[10rem] truncate text-[var(--od-text-secondary)]">
              {ownerFallbackName}
            </span>
            <span className="text-[var(--od-divider-strong)]/75">/</span>
            <span className="inline-flex items-center gap-1">
              {booklist.is_public ? (
                <Globe className="h-3.5 w-3.5" />
              ) : (
                <Lock className="h-3.5 w-3.5" />
              )}
              {booklist.is_public ? "公开" : "私有"}
            </span>
            <span className="text-[var(--od-divider-strong)]/75">/</span>
            <span>更新于 {updatedText}</span>
          </div>

          <div className="mb-3 flex items-start gap-2.5">
            <h3 className="min-w-0 flex-1 text-lg font-semibold leading-snug tracking-[-0.02em] text-[var(--od-text-primary)] transition-colors duration-200 group-hover:text-[var(--od-text-heading)]">
              {booklist.title}
            </h3>
            <button
              type="button"
              disabled={collectLoading}
              onClick={(e) => {
                e.stopPropagation();
                onToggleCollect(booklist);
              }}
              className={`od-inline-action ${
                booklist.collected_flag
                  ? "bg-[var(--od-accent)]/12 text-[var(--od-accent)] hover:bg-[var(--od-accent)]/16"
                  : "od-inline-action-ghost text-[var(--od-text-secondary)] hover:text-[var(--od-text-primary)]"
              }`}
            >
              {booklist.collected_flag ? "已收藏" : "收藏"}
            </button>
          </div>

          <p className="mb-3 line-clamp-2 break-all text-sm leading-relaxed text-[var(--od-text-secondary)] md:max-w-[72ch]">
            {booklist.description || "暂无简介"}
          </p>

          <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-[var(--od-text-secondary)]">
            <span className="inline-flex items-center gap-1.5">
              <BookOpen className="h-3.5 w-3.5 text-[var(--od-text-tertiary)]" />
              <span className="tabular-nums">{booklist.item_count}</span>
              <span>帖子</span>
            </span>
            <span className="inline-flex items-center gap-1.5">
              <Star className="h-3.5 w-3.5 text-[var(--od-text-tertiary)]" />
              <span className="tabular-nums">{booklist.collection_count}</span>
              <span>收藏</span>
            </span>
            <span className="inline-flex items-center gap-1.5">
              <Eye className="h-3.5 w-3.5 text-[var(--od-text-tertiary)]" />
              <span className="tabular-nums">{booklist.view_count}</span>
              <span>浏览</span>
            </span>

            <span className="ml-auto text-[var(--od-text-tertiary)]">
              ID: {booklist.id}
            </span>
          </div>

          {canManage && (
            <div className="mt-3 flex items-center gap-2">
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onEdit(booklist);
                }}
                className="od-inline-action od-inline-action-ghost px-2.5 text-[var(--od-text-tertiary)] hover:text-[var(--od-text-primary)]"
              >
                编辑
              </button>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onDelete(booklist);
                }}
                className="od-inline-action od-inline-action-ghost px-2.5 text-[var(--od-text-tertiary)] hover:text-[var(--od-error)]"
              >
                删除
              </button>
            </div>
          )}
        </div>

        <div className="shrink-0 md:w-[13.5rem] lg:w-[14.5rem]">
          <div className="relative h-[9.5rem] overflow-hidden rounded-[1rem] bg-[var(--od-surface-shell)] md:h-[10.75rem]">
            {coverImageUrl ? (
              <LazyImage
                src={coverImageUrl}
                alt={booklist.title}
                className="h-full w-full object-cover"
              />
            ) : (
              <div className="flex h-full w-full items-center justify-center text-[var(--od-text-tertiary)]">
                <BookOpen className="h-10 w-10" />
              </div>
            )}
          </div>
        </div>
      </div>
    </article>
  );
}
