import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  ArrowLeft,
  BookOpen,
  Edit3,
  LayoutGrid,
  Plus,
  RefreshCw,
  Rows3,
  Share2,
  Star,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";

import { ThreadCard } from "@/entities/thread/ThreadCard";
import { ThreadListItem } from "@/entities/thread/ThreadListItem";
import { useAuth } from "@/features/auth/hooks/useAuth";
import type { Thread } from "@/entities/thread/types";
import {
  useAddBooklistItems,
  useBooklistDetail,
  useBooklistItems,
  useDeleteBooklist,
  useRemoveBooklistItems,
  useToggleBooklistCollection,
  useUpdateBooklist,
  useUpdateBooklistItem,
} from "@/features/booklists/hooks/useBooklistsData";
import type { BooklistItem } from "@/entities/booklist/types";
import { BooklistFormModal } from "@/features/booklists/components/BooklistFormModal";
import { AddThreadsToBooklistModal } from "@/features/booklists/components/AddThreadsToBooklistModal";
import { BooklistItemEditorModal } from "@/features/booklists/components/BooklistItemEditorModal";
import { usePreviewThread } from "@/features/search/hooks/usePreviewThread";
import {
  buildBooklistShareText,
  copyTextToClipboard,
} from "@/shared/lib/shareText";
import { ShareTextDialog } from "@/shared/ui/ShareTextDialog";
import { useCardGridClass, useSettings } from "@/shared/hooks/useSettings";

function toThread(item: BooklistItem): Thread {
  return {
    thread_id: item.thread_id,
    guild_id: item.guild_id,
    channel_id: item.channel_id,
    title: item.title,
    author: item.author,
    created_at: item.created_at,
    last_active_at: item.last_active_at || item.created_at,
    reaction_count: item.reaction_count,
    reply_count: item.reply_count,
    display_count: item.display_count || 0,
    first_message_excerpt: item.first_message_excerpt || null,
    tags: item.tags || [],
    virtual_tags: item.virtual_tags || [],
    thumbnail_urls: item.thumbnail_urls || [],
    collected_flag: item.collected_flag,
    collection_count: item.collection_count || 0,
  };
}

export function BooklistDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { openPreview } = usePreviewThread();
  const { settings, updateSettings } = useSettings();
  const layoutMode = settings.layoutMode;
  const gridClass = useCardGridClass();

  const booklistId = String(id || "").trim();
  const [showEdit, setShowEdit] = useState(false);
  const [showAdd, setShowAdd] = useState(false);
  const [editingItem, setEditingItem] = useState<BooklistItem | null>(null);
  const [shareText, setShareText] = useState<string | null>(null);

  const detailQuery = useBooklistDetail(booklistId);
  const itemsQuery = useBooklistItems(booklistId);

  const isOwner = useMemo(
    () => String(detailQuery.data?.owner_id ?? "") === String(user?.id ?? ""),
    [detailQuery.data?.owner_id, user?.id],
  );

  const items = useMemo(() => {
    return itemsQuery.data?.pages.flatMap((page) => page.results || []) ?? [];
  }, [itemsQuery.data]);

  const updateMutation = useUpdateBooklist(Number(booklistId), () =>
    setShowEdit(false),
  );
  const deleteMutation = useDeleteBooklist(() => navigate("/booklists"));
  const collectMutation = useToggleBooklistCollection();
  const addItemsMutation = useAddBooklistItems(booklistId, () =>
    setShowAdd(false),
  );
  const removeItemMutation = useRemoveBooklistItems(booklistId);
  const updateItemMutation = useUpdateBooklistItem(booklistId, () =>
    setEditingItem(null),
  );

  // ─── 无限滚动触发器 ──────────────────────────────────────
  // 必须放在提前返回之前，遵循 Hooks 规则
  const loadMoreRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    const target = loadMoreRef.current;
    if (!target || !itemsQuery.hasNextPage) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (
          entry.isIntersecting &&
          itemsQuery.hasNextPage &&
          !itemsQuery.isFetchingNextPage
        ) {
          itemsQuery.fetchNextPage();
        }
      },
      { rootMargin: "200px" },
    );

    observer.observe(target);
    return () => observer.disconnect();
  }, [
    itemsQuery.hasNextPage,
    itemsQuery.isFetchingNextPage,
    itemsQuery.fetchNextPage,
  ]);

  if (!booklistId) {
    return <div className="p-8 text-sm text-(--od-error)">无效书单 ID</div>;
  }

  if (detailQuery.isLoading || itemsQuery.isLoading) {
    return (
      <div className="p-8 text-sm text-(--od-text-secondary)">
        正在帮你加载书单...
      </div>
    );
  }

  if (detailQuery.isError || !detailQuery.data) {
    return (
      <div className="p-8 text-sm text-(--od-error)">
        书单加载出错了，可能不存在或已经被删除了
      </div>
    );
  }

  const booklist = detailQuery.data;

  const handleCopyShareText = async () => {
    if (!shareText) return;
    const copied = await copyTextToClipboard(shareText);
    if (copied) {
      toast.success("分享文案已复制");
      return;
    }
    toast.warning("自动复制失败，可以手动选中文案复制");
  };

  return (
    <>
      <div className="animate-in fade-in slide-in-from-bottom-4 duration-500 p-4 sm:p-6 lg:p-8">
        <div className="mx-auto flex w-full max-w-6xl min-w-0 flex-col gap-6">
          <div className="min-w-0 flex flex-col gap-4 border-b border-(--od-border) pb-4">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-start gap-3">
                <button
                  type="button"
                  onClick={() => navigate(-1)}
                  className="mt-1 inline-flex h-9 w-9 items-center justify-center rounded-full text-(--od-text-secondary) transition-colors hover:text-(--od-text-primary)"
                  aria-label="返回"
                >
                  <ArrowLeft className="h-4 w-4" />
                </button>

                <div>
                  <h1 className="text-2xl font-bold tracking-tight text-(--od-text-primary)">
                    {booklist.title}
                  </h1>
                  <p className="mt-1 whitespace-pre-line text-sm text-(--od-text-secondary)">
                    {booklist.description || "暂无简介"}
                  </p>
                  <div className="mt-2 flex flex-wrap items-center gap-3 text-xs text-(--od-text-tertiary)">
                    <span className="inline-flex items-center gap-1">
                      <BookOpen className="h-3.5 w-3.5" />
                      {booklist.item_count}
                    </span>
                    <span className="inline-flex items-center gap-1">
                      <Star className="h-3.5 w-3.5" />
                      {booklist.collection_count}
                    </span>
                    <span>{booklist.is_public ? "公开书单" : "私有书单"}</span>
                  </div>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <div className="inline-flex items-center gap-1 rounded-full border border-(--od-shell-line) bg-[color-mix(in_srgb,var(--od-surface-input)_76%,transparent)] p-1">
                  <button
                    type="button"
                    onClick={() => updateSettings({ layoutMode: "list" })}
                    className={`inline-flex items-center gap-1 rounded-full px-3 py-1.5 text-xs font-medium transition-colors ${
                      layoutMode === "list"
                        ? "bg-(--od-accent) text-white"
                        : "text-(--od-text-secondary) hover:text-(--od-text-primary)"
                    }`}
                    aria-label="切换到列表展示"
                    title="列表展示"
                  >
                    <Rows3 className="h-3.5 w-3.5" />
                    列表
                  </button>
                  <button
                    type="button"
                    onClick={() => updateSettings({ layoutMode: "grid" })}
                    className={`inline-flex items-center gap-1 rounded-full px-3 py-1.5 text-xs font-medium transition-colors ${
                      layoutMode === "grid"
                        ? "bg-(--od-accent) text-white"
                        : "text-(--od-text-secondary) hover:text-(--od-text-primary)"
                    }`}
                    aria-label="切换到网格展示"
                    title="网格展示"
                  >
                    <LayoutGrid className="h-3.5 w-3.5" />
                    网格
                  </button>
                </div>

                <button
                  type="button"
                  onClick={() => detailQuery.refetch()}
                  className="inline-flex items-center gap-1 rounded-full px-2 py-1.5 text-xs text-(--od-text-secondary) transition-colors hover:text-(--od-accent)"
                >
                  <RefreshCw className="h-3.5 w-3.5" />
                  刷新
                </button>

                <button
                  type="button"
                  onClick={() => setShareText(buildBooklistShareText(booklist))}
                  className="inline-flex items-center gap-1 rounded-full px-2 py-1.5 text-xs text-(--od-text-secondary) transition-colors hover:text-(--od-accent)"
                >
                  <Share2 className="h-3.5 w-3.5" />
                  分享
                </button>

                <button
                  type="button"
                  onClick={() =>
                    collectMutation.mutate({
                      id: Number(booklistId),
                      collected: Boolean(booklist.collected_flag),
                    })
                  }
                  className={`inline-flex items-center gap-1 rounded-full px-2 py-1.5 text-xs font-semibold transition-colors hover:text-(--od-accent) ${
                    booklist.collected_flag
                      ? "text-(--od-accent)"
                      : "text-(--od-text-secondary)"
                  }`}
                >
                  <Star
                    className={`h-3.5 w-3.5 ${booklist.collected_flag ? "fill-current" : ""}`}
                  />
                  {booklist.collected_flag ? "已收藏" : "收藏书单"}
                </button>

                {isOwner && (
                  <>
                    <button
                      type="button"
                      onClick={() => setShowEdit(true)}
                      className="inline-flex items-center gap-1 rounded-full px-2 py-1.5 text-xs text-(--od-text-secondary) transition-colors hover:text-(--od-accent)"
                    >
                      <Edit3 className="h-3.5 w-3.5" />
                      编辑
                    </button>
                    <button
                      type="button"
                      onClick={() => setShowAdd(true)}
                      className="inline-flex items-center gap-1 rounded-full px-2 py-1.5 text-xs font-semibold text-(--od-accent) transition-colors hover:text-(--od-accent-hover)"
                    >
                      <Plus className="h-3.5 w-3.5" />
                      添加帖子
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        if (
                          !window.confirm(`确认删除书单「${booklist.title}」？`)
                        )
                          return;
                        deleteMutation.mutate(Number(booklistId));
                      }}
                      className="inline-flex items-center gap-1 rounded-full px-2 py-1.5 text-xs text-(--od-error) transition-colors hover:text-(--od-error)"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                      删除
                    </button>
                  </>
                )}
              </div>
            </div>
          </div>

          {items.length === 0 ? (
            <div className="rounded-xl border border-(--od-border) bg-(--od-card) p-10 text-center">
              <p className="text-base font-semibold text-(--od-text-primary)">
                书单里还没有帖子
              </p>
              <p className="mt-1 text-sm text-(--od-text-secondary)">
                {isOwner
                  ? "可以点右上角添加帖子，开始充实你的书单吧。"
                  : "作者还在准备中，再等等看。"}
              </p>
            </div>
          ) : (
            <div
              className={
                layoutMode === "list"
                  ? "min-w-0 flex flex-col space-y-od-list-gap"
                  : `${gridClass} min-w-0`
              }
            >
              {items.map((item) => (
                <div
                  key={`${item.booklist_item_id}-${item.thread_id}`}
                  className={
                    layoutMode === "list" ? "min-w-0" : "flex min-w-0 flex-col"
                  }
                >
                  {layoutMode === "list" ? (
                    <ThreadListItem
                      thread={toThread(item)}
                      onPreview={openPreview}
                      booklistComment={item.comment || ""}
                    />
                  ) : (
                    <ThreadCard
                      thread={toThread(item)}
                      onPreview={openPreview}
                      booklistComment={item.comment || ""}
                    />
                  )}
                  {isOwner && (
                    <div className="mt-2 flex flex-wrap items-center justify-end gap-1 text-xs">
                      <button
                        type="button"
                        onClick={() => setEditingItem(item)}
                        className="inline-flex items-center gap-1 rounded-full px-2 py-1 text-(--od-text-secondary) transition-colors hover:text-(--od-accent)"
                      >
                        <Edit3 className="h-3.5 w-3.5" />
                        编辑
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          removeItemMutation.mutate(String(item.thread_id));
                        }}
                        className="inline-flex items-center gap-1 rounded-full px-2 py-1 text-(--od-error) transition-colors hover:text-(--od-error)"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                        移除
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* 无限滚动探测器 */}
          {itemsQuery.hasNextPage && (
            <div ref={loadMoreRef} className="flex justify-center py-8">
              <RefreshCw className="h-6 w-6 animate-spin text-(--od-text-tertiary)" />
            </div>
          )}
        </div>
      </div>

      <BooklistFormModal
        isOpen={showEdit}
        initialValue={booklist}
        submitting={updateMutation.isPending}
        onClose={() => setShowEdit(false)}
        onSubmit={(payload) => updateMutation.mutate({ payload })}
      />

      <AddThreadsToBooklistModal
        isOpen={showAdd}
        submitting={addItemsMutation.isPending}
        onClose={() => setShowAdd(false)}
        onSubmit={(items) => addItemsMutation.mutate(items)}
      />

      <BooklistItemEditorModal
        isOpen={Boolean(editingItem)}
        item={editingItem}
        submitting={updateItemMutation.isPending}
        onClose={() => setEditingItem(null)}
        onSubmit={(payload) => {
          if (!editingItem) return;
          updateItemMutation.mutate({
            threadId: String(editingItem.thread_id),
            payload,
          });
        }}
      />

      {shareText && (
        <ShareTextDialog
          title="分享这个书单"
          text={shareText}
          onClose={() => setShareText(null)}
          onCopy={handleCopyShareText}
        />
      )}
    </>
  );
}
