import { act, fireEvent, render, screen } from "@/tests/test-utils";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { Author } from "@/entities/thread/types";
import { authorsApi } from "@/features/authors/api/authorsApi";
import {
  useAuthorFollowState,
  useToggleAuthorFollow,
} from "@/features/authors/hooks/useV2AuthorFollow";
import { useUserPreferences } from "@/features/preferences/hooks/useUserPreferences";
import { searchApi } from "@/features/search/api/searchApi";
import { AuthorWorksHoverCard } from "./AuthorWorksHoverCard";

vi.mock("@/features/search/api/searchApi", () => ({
  searchApi: { search: vi.fn() },
}));

vi.mock("@/features/authors/api/authorsApi", () => ({
  authorsApi: { getAuthorProfile: vi.fn(), resolveLegacyAuthor: vi.fn() },
}));

vi.mock("@/features/preferences/hooks/useUserPreferences", () => ({
  useUserPreferences: vi.fn(() => ({
    user: null,
    preferences: null,
    savePreferences: vi.fn(),
    isSaving: false,
  })),
}));

vi.mock("@/features/authors/hooks/useV2AuthorFollow", () => ({
  useAuthorFollowState: vi.fn(() => ({
    data: false,
    isError: false,
    isLoading: false,
  })),
  useToggleAuthorFollow: vi.fn(() => ({
    mutate: vi.fn(),
    isPending: false,
  })),
}));

const author: Author = {
  id: "123456789",
  name: "author_name",
  global_name: "作者名",
  display_name: "作者名",
  avatar_url: null,
};

describe("AuthorWorksHoverCard", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.mocked(useUserPreferences).mockReturnValue({
      user: null,
      preferences: null,
      savePreferences: vi.fn(),
      isSaving: false,
    } as never);
    vi.mocked(useAuthorFollowState).mockReturnValue({
      data: false,
      isError: false,
      isLoading: false,
    } as never);
    vi.mocked(useToggleAuthorFollow).mockReturnValue({
      mutate: vi.fn(),
      isPending: false,
    } as never);
    vi.mocked(searchApi.search).mockReturnValue(new Promise(() => {}));
    vi.mocked(authorsApi.getAuthorProfile).mockReturnValue(
      new Promise(() => {}),
    );
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.clearAllMocks();
  });

  it("原生近作链接到作品，不显示旧预览按钮", async () => {
    const id = "9007199254740993123";
    vi.mocked(searchApi.search).mockResolvedValue({ total: 1, limit: 3, offset: 0,
      results: [{ thread_id: id, work: { id, title: "原生作品" } }] } as never);
    render(<AuthorWorksHoverCard author={author}><button type="button">作者头像</button></AuthorWorksHoverCard>);
    const trigger = screen.getByRole("button", { name: "作者头像" }).parentElement!;
    fireEvent.pointerEnter(trigger, { pointerType: "mouse" });
    await act(async () => vi.advanceTimersByTime(300));
    await act(async () => vi.advanceTimersByTime(1));
    expect(screen.getByRole("link", { name: "原生作品", hidden: true })).toHaveAttribute("href", `/works/${id}`);
    expect(screen.queryByRole("button", { name: "原生作品", hidden: true })).not.toBeInTheDocument();
  });

  it("停留达到阈值后才打开并查询作者作品", async () => {
    render(
      <AuthorWorksHoverCard author={author} currentThreadId="thread-1">
        <button type="button">作者头像</button>
      </AuthorWorksHoverCard>,
    );

    const trigger = screen.getByRole("button", {
      name: "作者头像",
    }).parentElement!;
    fireEvent.pointerEnter(trigger, { pointerType: "mouse" });

    act(() => vi.advanceTimersByTime(299));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(searchApi.search).not.toHaveBeenCalled();
    expect(useUserPreferences).not.toHaveBeenCalled();

    await act(async () => vi.advanceTimersByTime(1));

    expect(
      screen.getByLabelText("作者名 的其他作品"),
    ).toBeInTheDocument();
    expect(searchApi.search).toHaveBeenCalledWith({
      include_authors: ["123456789"],
      exclude_thread_ids: ["thread-1"],
      apply_preferences: true,
      limit: 3,
      sort_method: "created_desc",
    }, expect.any(AbortSignal));
    expect(useUserPreferences).toHaveBeenCalled();
    expect(authorsApi.getAuthorProfile).toHaveBeenCalledWith("123456789", expect.any(AbortSignal));
    expect(screen.getByLabelText("作者名 的其他作品")).toHaveClass("od-floating-glass");
  });

  it("鼠标从头像移入浮层时保持打开，离开两端后关闭", async () => {
    render(
      <AuthorWorksHoverCard author={author}>
        <button type="button">作者头像</button>
      </AuthorWorksHoverCard>,
    );

    const trigger = screen.getByRole("button", {
      name: "作者头像",
    }).parentElement!;
    fireEvent.pointerEnter(trigger, { pointerType: "mouse" });
    await act(async () => vi.advanceTimersByTime(300));

    const panel = screen.getByRole("dialog", { hidden: true });
    fireEvent.pointerLeave(trigger);
    act(() => vi.advanceTimersByTime(100));
    fireEvent.pointerEnter(panel);
    act(() => vi.advanceTimersByTime(180));
    expect(panel).toBeInTheDocument();

    fireEvent.pointerLeave(panel);
    act(() => vi.advanceTimersByTime(180));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("never submits a legacy Discord author ID as a Fluxer preference ID", async () => {
    const savePreferences = vi.fn();
    vi.mocked(useUserPreferences).mockReturnValue({
      user: { id: "viewer-1" },
      preferences: { is_first_time: false, exclude_authors: [author.id], include_authors: [] },
      savePreferences, isSaving: false,
    } as never);
    render(<AuthorWorksHoverCard author={author}><button type="button">作者头像</button></AuthorWorksHoverCard>);
    fireEvent.pointerEnter(screen.getByRole("button", { name: "作者头像" }).parentElement!, { pointerType: "mouse" });
    await act(async () => vi.advanceTimersByTime(300));
    const block = screen.getByRole("button", { name: "屏蔽作者" });
    expect(block).toBeDisabled(); expect(block).toHaveAttribute("title", expect.stringContaining("Fluxer"));
    fireEvent.click(block); expect(savePreferences).not.toHaveBeenCalled(); expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();
  });

  it("屏蔽确认使用顶层 dialog，确认期间不会被 Hover 延迟关闭", async () => {
    vi.mocked(useUserPreferences).mockReturnValue({
      user: { id: "viewer-1" },
      preferences: { exclude_authors: [], include_authors: [], preferred_channels: [] },
      savePreferences: vi.fn(),
      isSaving: false,
    } as never);

    render(
      <AuthorWorksHoverCard author={author}>
        <button type="button">作者头像</button>
      </AuthorWorksHoverCard>,
    );

    const trigger = screen.getByRole("button", {
      name: "作者头像",
    }).parentElement!;
    fireEvent.pointerEnter(trigger, { pointerType: "mouse" });
    await act(async () => vi.advanceTimersByTime(300));

    const panel = screen.getByLabelText("作者名 的其他作品");
    fireEvent.click(screen.getByRole("button", { name: "屏蔽作者" }));

    const confirmation = screen.getByRole("alertdialog");
    expect(confirmation.tagName).toBe("DIALOG");
    expect(confirmation.parentElement).toBe(document.body);

    fireEvent.pointerLeave(panel);
    act(() => vi.advanceTimersByTime(180));
    expect(confirmation).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "取消" }));
    expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();
    expect(panel).toBeInTheDocument();
  });

  it("登录后可以从 Hover 中关注作者", async () => {
    const mutate = vi.fn();
    vi.mocked(useUserPreferences).mockReturnValue({
      user: { id: "viewer-1" },
      preferences: {
        exclude_authors: [],
        include_authors: [],
        preferred_channels: [],
      },
      savePreferences: vi.fn(),
      isSaving: false,
    } as never);
    vi.mocked(useToggleAuthorFollow).mockReturnValue({
      mutate,
      isPending: false,
    } as never);

    render(
      <AuthorWorksHoverCard author={author} initialFollowed={false}>
        <button type="button">作者头像</button>
      </AuthorWorksHoverCard>,
    );

    const trigger = screen.getByRole("button", {
      name: "作者头像",
    }).parentElement!;
    fireEvent.pointerEnter(trigger, { pointerType: "mouse" });
    await act(async () => vi.advanceTimersByTime(300));

    fireEvent.click(screen.getByRole("button", { name: "关注作者" }));
    expect(mutate).toHaveBeenCalledTimes(1);
  });

  it("关注状态加载失败时可以从 Hover 重试", async () => {
    const refetch = vi.fn();
    vi.mocked(useUserPreferences).mockReturnValue({
      user: { id: "viewer-1" },
      preferences: {
        exclude_authors: [],
        include_authors: [],
        preferred_channels: [],
      },
      savePreferences: vi.fn(),
      isSaving: false,
    } as never);
    vi.mocked(useAuthorFollowState).mockReturnValue({
      data: undefined,
      isError: true,
      isFetching: false,
      isLoading: false,
      refetch,
    } as never);

    render(
      <AuthorWorksHoverCard author={author}>
        <button type="button">作者头像</button>
      </AuthorWorksHoverCard>,
    );

    const trigger = screen.getByRole("button", {
      name: "作者头像",
    }).parentElement!;
    fireEvent.pointerEnter(trigger, { pointerType: "mouse" });
    await act(async () => vi.advanceTimersByTime(300));

    fireEvent.click(screen.getByRole("button", { name: "重试关注状态" }));
    expect(refetch).toHaveBeenCalledTimes(1);
  });
});


it('legacy hover waits for explicit mapping before any V2 author profile request', async () => {
  vi.useFakeTimers();
  vi.mocked(authorsApi.getAuthorProfile).mockClear();
  vi.mocked(authorsApi.resolveLegacyAuthor).mockResolvedValue('canonical-resolved');
  vi.mocked(searchApi.search).mockResolvedValue({ results: [], total: 0 } as never);
  render(<AuthorWorksHoverCard author={author} canonical={false}><button>旧作者</button></AuthorWorksHoverCard>);
  fireEvent.pointerEnter(screen.getByText('旧作者').parentElement!, { pointerType: 'mouse' });
  await act(async () => { await vi.advanceTimersByTimeAsync(400); });
  await act(async () => { await vi.advanceTimersByTimeAsync(50); });
  expect(authorsApi.resolveLegacyAuthor).toHaveBeenCalledWith(author.id, expect.any(AbortSignal));
  expect(authorsApi.getAuthorProfile).toHaveBeenCalledWith('canonical-resolved', expect.any(AbortSignal));
  expect(authorsApi.getAuthorProfile).not.toHaveBeenCalledWith(author.id, expect.anything());
  vi.useRealTimers();
});

it('denied legacy hover never queries a guessed canonical author', async () => {
  vi.useFakeTimers();
  vi.mocked(authorsApi.getAuthorProfile).mockClear();
  vi.mocked(authorsApi.resolveLegacyAuthor).mockRejectedValue(new Error('404'));
  render(<AuthorWorksHoverCard author={author} canonical={false}><button>失效旧作者</button></AuthorWorksHoverCard>);
  fireEvent.pointerEnter(screen.getByText('失效旧作者').parentElement!, { pointerType: 'mouse' });
  await act(async () => { await vi.advanceTimersByTimeAsync(400); });
  await act(async () => { await vi.advanceTimersByTimeAsync(50); });
  expect(screen.getByText('旧作者链接已失效或当前不可访问')).toBeInTheDocument();
  expect(authorsApi.getAuthorProfile).not.toHaveBeenCalled();
  vi.useRealTimers();
});
