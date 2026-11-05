import { setStoredAuthToken, clearStoredAuthToken } from "@/shared/lib/authSession";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { worksClient } from "@/features/works/api";
import type { Work } from "@/features/works/types";
import {
  RateLimitError,
  resetRateLimitStateForTests,
} from "@/shared/api/rateLimit";
import { searchApi } from "./searchApi";

vi.mock("@/features/works/api", () => ({
  worksClient: { post: vi.fn(), get: vi.fn() },
}));

describe("searchApi 作者 Token", () => {
  beforeEach(() => {
    resetRateLimitStateForTests();
    vi.mocked(worksClient.post).mockResolvedValue({
      data: { total: 0, items: [], limit: 24, offset: 0 },
    });
  });

  it("后台预加载 429 会记录冷却时间，后续请求在本地被拦截", async () => {
    vi.mocked(worksClient.post).mockRejectedValueOnce({
      isAxiosError: true,
      config: { url: "/search" },
      response: { status: 429, headers: { "retry-after": "5" } },
    });

    await expect(searchApi.search({}, undefined, "preload")).rejects.toMatchObject({
      name: "RateLimitError",
      rateLimit: { origin: "preload", retryAfterSeconds: 5 },
    });
    await expect(searchApi.search({})).rejects.toBeInstanceOf(RateLimitError);
    expect(worksClient.post).toHaveBeenCalledTimes(1);
  });

  it("把正反作者 ID 放进对应请求字段", async () => {
    await searchApi.search({ query: "$author:123$ -$author:456$" });

    expect(worksClient.post).toHaveBeenCalledWith(
      "/search",
      expect.objectContaining({
        include_authors: ["123"],
        exclude_authors: ["456"],
      }),
    );
  });

  it("自定义标签 ID 与旧名称条件独立传递，不转换大整数", async () => {
    await searchApi.search({
      include_tag_ids: ["90071992547409931"],
      exclude_tag_ids: ["90071992547409932"],
      query: "$tag:同名$",
      tag_logic: "or",
    });
    expect(worksClient.post).toHaveBeenCalledWith("/search", expect.objectContaining({
      include_tag_ids: ["90071992547409931"],
      exclude_tag_ids: ["90071992547409932"],
      include_tags: ["同名"],
      tag_logic: "or",
    }));
  });

  it("自定义 token 的名称不混入关键词或原生标签条件", async () => {
    await searchApi.search({ query: "$tagid:90071992547409931|fox$ -$tagid:7914|wolf$" });
    expect(worksClient.post).toHaveBeenLastCalledWith("/search", expect.objectContaining({
      include_tag_ids: ["90071992547409931"],
      exclude_tag_ids: ["7914"],
    }));
    const body = vi.mocked(worksClient.post).mock.lastCall?.[1];
    expect(body).not.toHaveProperty("include_tags");
    expect(body).not.toHaveProperty("keywords");
  });

  it("把筛选 token 转换成日期和互动范围", async () => {
    await searchApi.search({
      query: "$date:2026-07-01..2026-08-01$ $likes:10000+$ $replies:1000+$",
    });

    expect(worksClient.post).toHaveBeenCalledWith(
      "/search",
      expect.objectContaining({
        created_after: "2026-07-01",
        created_before: "2026-08-01",
        reaction_count_range: "[10000, 10000000)",
        reply_count_range: "[1000, 10000000)",
      }),
    );
  });
});


it("V2 搜索保留 canonical 作者、逻辑 ID 和超过 100 项排除列表", async () => {
  resetRateLimitStateForTests();
  const id = "9007199254740993123";
  const work = {
    id, title: "作品", author_id: "9007199254740993999", source_platform: "fluxer",
    source_channel_id: "22", source_guild_id: "11", source_thread_id: "33", main_ref: null,
    description: "正文", images: [], tags: [], reactions: [], is_nsfw: false, is_abyss: false,
    created_at: "2026-11-05T00:00:00Z", deleted_at: null,
    statistics: { view_count: 0, collection_count: 0, reaction_count: 0, reply_count: 0 },
  } satisfies Work;
  vi.mocked(worksClient.post).mockResolvedValueOnce({ data: { items: [work], total: 200, limit: 24, offset: 24 } });
  const excluded = Array.from({ length: 120 }, (_, index) => String(9007199254740993000n + BigInt(index)));
  const signal = new AbortController().signal;
  const result = await searchApi.search({ include_authors: [work.author_id], exclude_thread_ids: excluded, offset: 24 }, signal);
  expect(worksClient.post).toHaveBeenLastCalledWith("/search", expect.objectContaining({ include_authors: [work.author_id], exclude_work_ids: excluded, offset: 24 }), { signal });
  expect(vi.mocked(worksClient.post).mock.lastCall?.[1]).not.toHaveProperty("exclude_thread_ids");
  expect(result.results[0]).toMatchObject({ thread_id: id, work, author: { id: work.author_id } });
});

it("V2 建议保留作品和书单类型，避免旧详情路由及数字精度丢失", async () => {
  const id = "9007199254740993123";
  vi.mocked(worksClient.get).mockResolvedValueOnce({ data: {
    works: [{ id, title: "作品", source_channel_id: null, source_guild_id: null }],
    authors: [{ id, name: "作者", display_name: "作者" }], tags: [],
    booklists: [{ id, title: "书单", item_count: 1 }],
  } });
  const result = await searchApi.getSuggestions("作品");
  expect(result.threads?.[0]).toMatchObject({ work_id: id, thread_id: id });
  expect(result.authors?.[0].id).toBe(id);
  expect(result.booklists?.[0]).toMatchObject({ id, is_work_booklist: true });
});


it("账号切换后丢弃迟到的搜索响应", async () => {
  resetRateLimitStateForTests();
  setStoredAuthToken("account-a");
  let resolve!: (value: unknown) => void;
  vi.mocked(worksClient.post).mockImplementationOnce(() => new Promise(r => { resolve = r; }));
  const pending = searchApi.search({});
  setStoredAuthToken("account-b");
  resolve({ data: { items: [], total: 0 } });
  await expect(pending).rejects.toMatchObject({ code: "ERR_CANCELED" });
  clearStoredAuthToken();
});

it("账号切换后丢弃迟到的建议响应", async () => {
  setStoredAuthToken("account-a");
  let resolve!: (value: unknown) => void;
  vi.mocked(worksClient.get).mockImplementationOnce(() => new Promise(r => { resolve = r; }));
  const pending = searchApi.getSuggestions("作品");
  setStoredAuthToken("account-b");
  resolve({ data: { works: [], authors: [], tags: [], booklists: [] } });
  await expect(pending).rejects.toMatchObject({ code: "ERR_CANCELED" });
  clearStoredAuthToken();
});
