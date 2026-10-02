import { fireEvent, screen, waitFor } from "@testing-library/react";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import { render } from "@/tests/test-utils";
import { booklistsApi } from "@/features/booklists/api/booklistsApi";
import { useMyBooklistsList } from "@/features/booklists/hooks/useBooklistsData";
import { QuickAddToBooklistModal } from "./QuickAddToBooklistModal";
import { invalidateBooklistQueries } from "@/features/booklists/lib/invalidateBooklistQueries";

vi.mock("@/features/booklists/lib/invalidateBooklistQueries", () => ({
  invalidateBooklistQueries: vi.fn(),
}));

vi.mock("@/features/booklists/hooks/useBooklistsData", () => ({
  useMyBooklistsList: vi.fn(),
}));
vi.mock("@/features/booklists/api/booklistsApi", () => ({
  booklistsApi: { syncItems: vi.fn() },
}));
vi.mock("@/features/mascot/lib/notify", () => ({
  extractErrorMessage: (_error: unknown, fallback: string) => fallback,
  notifyError: vi.fn(),
  notifySuccess: vi.fn(),
}));

const results = [
  {
    id: 1,
    title: "已加入",
    item_count: 2,
    collection_count: 3,
    is_marked: true,
  },
  {
    id: 2,
    title: "未加入",
    item_count: 4,
    collection_count: 5,
    is_marked: false,
  },
];

describe("QuickAddToBooklistModal", () => {
  beforeAll(() => {
    HTMLDialogElement.prototype.showModal = vi.fn(function (
      this: HTMLDialogElement,
    ) {
      this.setAttribute("open", "");
    });
    HTMLDialogElement.prototype.close = vi.fn(function (
      this: HTMLDialogElement,
    ) {
      this.removeAttribute("open");
    });
  });

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(useMyBooklistsList).mockReturnValue({
      data: { results },
      isLoading: false,
      isError: false,
      isSuccess: true,
      refetch: vi.fn(),
    } as never);
    vi.mocked(booklistsApi.syncItems).mockResolvedValue({
      thread_id: "1234567890123456789",
      added_to_booklist_ids: [2],
      removed_from_booklist_ids: [1],
    });
  });

  it("preselects marked booklists and syncs additions and removals together", async () => {
    render(
      <QuickAddToBooklistModal
        isOpen
        threadId="1234567890123456789"
        onClose={vi.fn()}
      />,
    );

    const marked = await screen.findByRole("checkbox", { name: /已加入/ });
    const unmarked = screen.getByRole("checkbox", { name: /未加入/ });
    expect(useMyBooklistsList).toHaveBeenCalledWith({
      markThreadId: "1234567890123456789",
      enabled: true,
    });
    expect(marked).toBeChecked();
    expect(unmarked).not.toBeChecked();

    fireEvent.click(marked);
    fireEvent.click(unmarked);
    fireEvent.change(screen.getByPlaceholderText(/所有勾选/), {
      target: { value: "  推荐语  " },
    });
    fireEvent.click(screen.getByRole("button", { name: "保存书单" }));

    await waitFor(() =>
      expect(booklistsApi.syncItems).toHaveBeenCalledWith({
        thread_id: "1234567890123456789",
        scope_booklist_ids: [1, 2],
        target_booklist_ids: [2],
        comment: "推荐语",
      }),
    );
  });

  it("can remove the thread from every displayed booklist without sending a comment", async () => {
    render(<QuickAddToBooklistModal isOpen threadId="99" onClose={vi.fn()} />);

    fireEvent.click(await screen.findByRole("checkbox", { name: /已加入/ }));
    fireEvent.click(screen.getByRole("button", { name: "保存书单" }));

    await waitFor(() =>
      expect(booklistsApi.syncItems).toHaveBeenCalledWith({
        thread_id: "99",
        scope_booklist_ids: [1, 2],
        target_booklist_ids: [],
        comment: undefined,
      }),
    );
  });

  it("只改推荐语也刷新 unchanged 书单的条目", async () => {
    vi.mocked(booklistsApi.syncItems).mockResolvedValue({
      thread_id: "99", unchanged_booklist_ids: [1],
      added_to_booklist_ids: [], removed_from_booklist_ids: [],
    });
    render(<QuickAddToBooklistModal isOpen threadId="99" onClose={vi.fn()} />);
    fireEvent.change(screen.getByPlaceholderText(/所有勾选/), { target: { value: "新推荐语" } });
    fireEvent.click(screen.getByRole("button", { name: "保存书单" }));
    await waitFor(() => expect(invalidateBooklistQueries).toHaveBeenCalledWith(
      expect.anything(), { booklistIds: [1], includeItems: true },
    ));
  });

  it("后台读取保留勾选和推荐语，重新打开才建立新草稿", () => {
    const props = { isOpen: true, threadId: "99", onClose: vi.fn() };
    const { rerender } = render(<QuickAddToBooklistModal {...props} />);
    fireEvent.click(screen.getByRole("checkbox", { name: /未加入/ }));
    fireEvent.change(screen.getByPlaceholderText(/所有勾选/), { target: { value: "未提交推荐语" } });
    vi.mocked(useMyBooklistsList).mockReturnValue({
      data: { results: results.map((item) => ({ ...item, item_count: 99 })) },
      dataUpdatedAt: 2, isSuccess: true, refetch: vi.fn(),
    } as never);
    rerender(<QuickAddToBooklistModal {...props} />);
    expect(screen.getByRole("checkbox", { name: /未加入/ })).toBeChecked();
    expect(screen.getByPlaceholderText(/所有勾选/)).toHaveValue("未提交推荐语");
    rerender(<QuickAddToBooklistModal {...props} isOpen={false} />);
    rerender(<QuickAddToBooklistModal {...props} />);
    expect(screen.getByRole("checkbox", { name: /未加入/ })).not.toBeChecked();
    expect(screen.getByRole("textbox")).toHaveValue("");
  });

  it("首次慢加载完成后才建立 membership 基线", async () => {
    vi.mocked(useMyBooklistsList).mockReturnValue({ isSuccess: false, isLoading: true } as never);
    const props = { isOpen: true, threadId: "99", onClose: vi.fn() };
    const { rerender } = render(<QuickAddToBooklistModal {...props} />);
    vi.mocked(useMyBooklistsList).mockReturnValue({ data: { results }, isSuccess: true } as never);
    rerender(<QuickAddToBooklistModal {...props} />);
    await waitFor(() => expect(screen.getByRole("checkbox", { name: /已加入/ })).toBeChecked());
    expect(screen.getByRole("button", { name: "保存书单" })).toBeDisabled();
  });
});
