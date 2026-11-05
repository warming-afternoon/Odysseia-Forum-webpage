import { act, fireEvent, screen, waitFor } from "@testing-library/react";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import { render } from "@/tests/test-utils";
import { v2BooklistsApi } from "@/features/booklists/api/v2BooklistsApi";
import { booklistsApi } from "@/features/booklists/api/booklistsApi";
import { useMyBooklistsList } from "@/features/booklists/hooks/useBooklistsData";
import { QuickAddToBooklistModal } from "./QuickAddToBooklistModal";

vi.mock("@/features/booklists/hooks/useBooklistsData", () => ({
  useMyBooklistsList: vi.fn(),
}));
vi.mock("@/features/booklists/api/booklistsApi", () => ({
  booklistsApi: { syncItems: vi.fn() },
}));
vi.mock("@/features/booklists/api/v2BooklistsApi", () => ({
  v2BooklistsApi: { syncItems: vi.fn() },
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
    vi.mocked(v2BooklistsApi.syncItems).mockResolvedValue({
      work_id: "9007199254740993123",
      added_to_booklist_ids: [2],
      removed_from_booklist_ids: [1],
      unchanged_booklist_ids: [],
    });
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

    expect(v2BooklistsApi.syncItems).not.toHaveBeenCalled();
    const marked = await screen.findByRole("checkbox", { name: /已加入/ });
    const unmarked = screen.getByRole("checkbox", { name: /未加入/ });
    expect(useMyBooklistsList).toHaveBeenCalledWith({
      markWorkId: undefined,
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
});

describe("canonical Work quick add", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(useMyBooklistsList).mockReturnValue({
      data: { results }, dataUpdatedAt: 1,
      isLoading: false, isError: false, isSuccess: true, refetch: vi.fn(),
    } as never);
    vi.mocked(v2BooklistsApi.syncItems).mockResolvedValue({
      work_id: "9007199254740993123", added_to_booklist_ids: [2],
      removed_from_booklist_ids: [1], unchanged_booklist_ids: [],
    });
  });

  it("syncs the canonical 64-bit Work ID, selected lists and comment without a legacy write", async () => {
    const onClose = vi.fn();
    render(<QuickAddToBooklistModal isOpen workId="9007199254740993123" threadId="123" onClose={onClose} />);
    expect(useMyBooklistsList).toHaveBeenCalledWith({ markWorkId: "9007199254740993123", markThreadId: undefined, enabled: true });
    expect(screen.getByRole("button", { name: "保存书单" })).toBeDisabled();
    fireEvent.click(screen.getByRole("checkbox", { name: "已加入" }));
    fireEvent.click(screen.getByRole("checkbox", { name: "未加入" }));
    fireEvent.change(screen.getByPlaceholderText(/所有勾选/), { target: { value: "  推荐作品  " } });
    fireEvent.click(screen.getByRole("button", { name: "保存书单" }));
    await waitFor(() => expect(onClose).toHaveBeenCalledTimes(1));
    expect(v2BooklistsApi.syncItems).toHaveBeenCalledExactlyOnceWith({ work_id: "9007199254740993123", scope_booklist_ids: [1, 2], target_booklist_ids: [2], comment: "推荐作品" });
    expect(booklistsApi.syncItems).not.toHaveBeenCalled();
  });

  it("can remove a Work from all displayed lists", async () => {
    render(<QuickAddToBooklistModal isOpen workId="9007199254740993123" threadId="" onClose={vi.fn()} />);
    fireEvent.click(screen.getByRole("checkbox", { name: "已加入" }));
    fireEvent.click(screen.getByRole("button", { name: "保存书单" }));
    await waitFor(() => expect(v2BooklistsApi.syncItems).toHaveBeenCalledWith({ work_id: "9007199254740993123", scope_booklist_ids: [1, 2], target_booklist_ids: [], comment: undefined }));
    expect(booklistsApi.syncItems).not.toHaveBeenCalled();
  });

  it.each(["", "invalid"])("does not fall back to a valid legacy ID for invalid Work ID %j", (workId) => {
    render(<QuickAddToBooklistModal isOpen workId={workId} threadId="123" onClose={vi.fn()} />);
    expect(useMyBooklistsList).toHaveBeenCalledWith({ markWorkId: workId, markThreadId: undefined, enabled: false });
    expect(screen.getByText(/当前作品 ID 无效/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "保存书单" })).toBeDisabled();
    expect(booklistsApi.syncItems).not.toHaveBeenCalled();
    expect(v2BooklistsApi.syncItems).not.toHaveBeenCalled();
  });

  it("dismisses without writing and resets selection on reopen", () => {
    const onClose = vi.fn();
    const props = { workId: "9007199254740993123", threadId: "", onClose };
    const { rerender } = render(<QuickAddToBooklistModal {...props} isOpen />);
    fireEvent.click(screen.getByRole("checkbox", { name: "未加入" }));
    fireEvent.keyDown(window, { key: "Escape" });
    expect(onClose).toHaveBeenCalledTimes(1);
    rerender(<QuickAddToBooklistModal {...props} isOpen={false} />);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    rerender(<QuickAddToBooklistModal {...props} isOpen />);
    expect(screen.getByRole("checkbox", { name: "未加入" })).not.toBeChecked();
    expect(screen.getByRole("checkbox", { name: "已加入" })).toBeChecked();
    expect(v2BooklistsApi.syncItems).not.toHaveBeenCalled();
    expect(booklistsApi.syncItems).not.toHaveBeenCalled();
  });

  it("keeps the selection after a failed sync so the user can retry", async () => {
    const onClose = vi.fn();
    vi.mocked(v2BooklistsApi.syncItems).mockRejectedValueOnce(new Error("Temporary failure"));
    render(<QuickAddToBooklistModal isOpen workId="9007199254740993123" threadId="" onClose={onClose} />);
    fireEvent.click(screen.getByRole("checkbox", { name: "未加入" }));
    fireEvent.click(screen.getByRole("button", { name: "保存书单" }));
    await waitFor(() => expect(v2BooklistsApi.syncItems).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(screen.getByRole("button", { name: "保存书单" })).toBeEnabled());
    expect(onClose).not.toHaveBeenCalled();
    expect(screen.getByRole("checkbox", { name: "未加入" })).toBeChecked();
    fireEvent.click(screen.getByRole("button", { name: "保存书单" }));
    await waitFor(() => expect(onClose).toHaveBeenCalledTimes(1));
    expect(v2BooklistsApi.syncItems).toHaveBeenCalledTimes(2);
    expect(booklistsApi.syncItems).not.toHaveBeenCalled();
  });


  it("does not let a pending save close a reopened modal", async () => {
    let finishSave!: (value: Awaited<ReturnType<typeof v2BooklistsApi.syncItems>>) => void;
    vi.mocked(v2BooklistsApi.syncItems).mockReturnValueOnce(new Promise((resolve) => { finishSave = resolve; }));
    const onClose = vi.fn();
    const props = { workId: "9007199254740993123", threadId: "", onClose };
    const { rerender } = render(<QuickAddToBooklistModal {...props} isOpen />);
    fireEvent.click(screen.getByRole("checkbox", { name: "未加入" }));
    fireEvent.click(screen.getByRole("button", { name: "保存书单" }));
    await waitFor(() => expect(v2BooklistsApi.syncItems).toHaveBeenCalledTimes(1));
    expect(screen.getByRole("button", { name: "保存书单" })).toBeDisabled();
    fireEvent.click(screen.getByRole("button", { name: "取消" }));
    expect(onClose).toHaveBeenCalledTimes(1);
    rerender(<QuickAddToBooklistModal {...props} isOpen={false} />);
    rerender(<QuickAddToBooklistModal {...props} isOpen />);
    await act(async () => {
      finishSave({ work_id: props.workId, added_to_booklist_ids: [2], removed_from_booklist_ids: [], unchanged_booklist_ids: [1] });
    });
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(booklistsApi.syncItems).not.toHaveBeenCalled();
  });

});
it('preserves unsaved selection and comment across a background data refresh', async () => {
  const query = (dataUpdatedAt: number) => ({ data: { results }, isLoading: false, isError: false, isSuccess: true, dataUpdatedAt, refetch: vi.fn() });
  vi.mocked(useMyBooklistsList).mockReturnValue(query(1) as never);
  vi.mocked(v2BooklistsApi.syncItems).mockResolvedValue({ work_id: '42' });
  const props = { isOpen: true, workId: '42', threadId: '', onClose: vi.fn() };
  const { rerender } = render(<QuickAddToBooklistModal {...props} />);
  fireEvent.click(screen.getByRole('checkbox', { name: /已加入/ }));
  fireEvent.click(screen.getByRole('checkbox', { name: /未加入/ }));
  fireEvent.change(screen.getByPlaceholderText(/所有勾选/), { target: { value: 'unsaved' } });
  vi.mocked(useMyBooklistsList).mockReturnValue(query(2) as never);
  rerender(<QuickAddToBooklistModal {...props} />);
  expect(screen.getByRole('checkbox', { name: /已加入/ })).not.toBeChecked();
  expect(screen.getByRole('checkbox', { name: /未加入/ })).toBeChecked();
  expect(screen.getByPlaceholderText(/所有勾选/)).toHaveValue('unsaved');
  fireEvent.click(screen.getByRole('button', { name: /保存书单/ }));
  await waitFor(() => expect(v2BooklistsApi.syncItems).toHaveBeenCalledWith({ work_id: '42', scope_booklist_ids: [1, 2], target_booklist_ids: [2], comment: 'unsaved' }));
});
it('initializes marked membership when the first asynchronous response arrives', () => {
  vi.mocked(useMyBooklistsList).mockReturnValue({ data: undefined, isLoading: true, isSuccess: false } as never);
  const props = { isOpen: true, workId: '42', threadId: '', onClose: vi.fn() };
  const { rerender } = render(<QuickAddToBooklistModal {...props} />);
  vi.mocked(useMyBooklistsList).mockReturnValue({ data: { results }, isLoading: false, isSuccess: true } as never);
  rerender(<QuickAddToBooklistModal {...props} />);
  expect(screen.getByRole('checkbox', { name: /已加入/ })).toBeChecked();
  expect(screen.getByRole('checkbox', { name: /未加入/ })).not.toBeChecked();
});
