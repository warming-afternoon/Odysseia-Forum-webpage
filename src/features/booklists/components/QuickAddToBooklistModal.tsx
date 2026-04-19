import { useEffect, useMemo, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { BookmarkPlus, Loader2, X } from "lucide-react";

import { useMyBooklistsList } from "@/features/booklists/hooks/useBooklistsData";
import { booklistsApi } from "@/features/booklists/api/booklistsApi";
import { booklistKeys } from "@/features/booklists/lib/queryKeys";
import {
  extractErrorMessage,
  notifyError,
  notifySuccess,
} from "@/shared/lib/notify";

interface QuickAddToBooklistModalProps {
  isOpen: boolean;
  threadId: string;
  threadTitle?: string;
  onClose: () => void;
}

export function QuickAddToBooklistModal({
  isOpen,
  threadId,
  threadTitle,
  onClose,
}: QuickAddToBooklistModalProps) {
  const queryClient = useQueryClient();
  const myBooklistsQuery = useMyBooklistsList();
  const [selectedBooklistId, setSelectedBooklistId] = useState<number | null>(
    null,
  );

  const myBooklists = myBooklistsQuery.data?.results || [];

  useEffect(() => {
    if (!isOpen) return;
    if (myBooklists.length > 0) {
      setSelectedBooklistId(myBooklists[0].id);
    } else {
      setSelectedBooklistId(null);
    }
  }, [isOpen, myBooklists]);

  const canSubmit = useMemo(() => {
    return /^\d+$/.test(threadId) && typeof selectedBooklistId === "number";
  }, [selectedBooklistId, threadId]);

  const addMutation = useMutation({
    mutationFn: async (booklistId: number) => {
      await booklistsApi.addItems(booklistId, [{ thread_id: threadId }]);
      return booklistId;
    },
    onSuccess: (booklistId) => {
      const target = myBooklists.find((item) => item.id === booklistId);
      notifySuccess(`已加入书单「${target?.title || booklistId}」`);
      queryClient.invalidateQueries({ queryKey: booklistKeys.all });
      onClose();
    },
    onError: (error) => {
      notifyError(extractErrorMessage(error, "添加到书单失败"));
    },
  });

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="od-floating-panel-solid w-full max-w-lg rounded-xl border border-[var(--od-border)] shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-[var(--od-border)] px-5 py-4">
          <div className="min-w-0">
            <h2 className="text-base font-bold text-[var(--od-text-primary)]">
              快捷收藏到书单
            </h2>
            {threadTitle && (
              <p className="mt-1 truncate text-xs text-[var(--od-text-tertiary)]">
                {threadTitle}
              </p>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded p-1 text-[var(--od-text-tertiary)] transition-colors hover:bg-[var(--od-bg-secondary)] hover:text-[var(--od-text-primary)]"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="space-y-3 p-5">
          {!/^\d+$/.test(threadId) ? (
            <p className="text-sm text-[var(--od-error)]">
              当前帖子 ID 无效，暂时无法加入书单。
            </p>
          ) : myBooklistsQuery.isLoading ? (
            <div className="flex items-center gap-2 text-sm text-[var(--od-text-secondary)]">
              <Loader2 className="h-4 w-4 animate-spin" />
              正在加载你的书单...
            </div>
          ) : myBooklists.length === 0 ? (
            <p className="text-sm text-[var(--od-text-secondary)]">
              你还没有创建书单，先去书单页新建一个吧。
            </p>
          ) : (
            <div className="max-h-72 space-y-2 overflow-y-auto pr-1">
              {myBooklists.map((booklist) => (
                <label
                  key={booklist.id}
                  className={`flex cursor-pointer items-start gap-3 rounded-lg border px-3 py-2 transition-colors ${
                    selectedBooklistId === booklist.id
                      ? "border-[var(--od-accent)] bg-[var(--od-accent)]/8"
                      : "border-[var(--od-border)] hover:border-[var(--od-border-strong)]"
                  }`}
                >
                  <input
                    type="radio"
                    name="quick-add-booklist"
                    checked={selectedBooklistId === booklist.id}
                    onChange={() => setSelectedBooklistId(booklist.id)}
                    className="mt-1"
                  />
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-medium text-[var(--od-text-primary)]">
                      {booklist.title}
                    </span>
                    <span className="mt-0.5 block text-xs text-[var(--od-text-tertiary)]">
                      {booklist.item_count} 帖子 · {booklist.collection_count}{" "}
                      收藏
                    </span>
                  </span>
                </label>
              ))}
            </div>
          )}

          <div className="flex justify-end gap-2 border-t border-[var(--od-border)] pt-4">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg px-3 py-2 text-sm text-[var(--od-text-secondary)] transition-colors hover:bg-[var(--od-bg-secondary)] hover:text-[var(--od-text-primary)]"
            >
              取消
            </button>
            <button
              type="button"
              disabled={!canSubmit || addMutation.isPending}
              onClick={() => {
                if (!selectedBooklistId) return;
                addMutation.mutate(selectedBooklistId);
              }}
              className="inline-flex items-center gap-2 rounded-lg bg-[var(--od-accent)] px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-[var(--od-accent-hover)] disabled:opacity-60"
            >
              {addMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <BookmarkPlus className="h-4 w-4" />
              )}
              加入书单
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
