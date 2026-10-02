import { beforeEach, describe, expect, it, vi } from "vitest";
import { apiClient } from "@/shared/api/client";
import { customTagsApi } from "./customTagsApi";

vi.mock("@/shared/api/client", () => ({
  apiClient: { get: vi.fn() },
}));

const params = { q: "", selectable: false, include_deleted: false };

describe("完整标签池契约", () => {
  beforeEach(() => vi.clearAllMocks());

  it("读取 results，超过旧分页大小也只请求一次，并保留筛选与取消信号", async () => {
    const results = Array.from({ length: 200 }, (_, index) => ({ id: String(index), name: `标签${index}` }));
    vi.mocked(apiClient.get).mockResolvedValue({ data: { results, total: results.length } });
    const controller = new AbortController();
    const filters = { ...params, q: "幻想", category: 6, source: "discord" as const };
    expect(await customTagsApi.poolAll(filters, controller.signal)).toEqual(results);
    expect(apiClient.get).toHaveBeenCalledExactlyOnceWith("/tags", {
      params: filters, signal: controller.signal,
    });
  });

  it("候选读取同样解包 results，允许空标签池", async () => {
    vi.mocked(apiClient.get).mockResolvedValue({ data: { results: [], total: 0 } });
    expect(await customTagsApi.pool(params)).toEqual([]);
  });

  it.each([null, [], { results: {} }, { detail: "无效响应" }])(
    "契约错误明确失败，不伪装为空标签池：%j", async (data) => {
      vi.mocked(apiClient.get).mockResolvedValue({ data });
      await expect(customTagsApi.poolAll(params)).rejects.toThrow("标签池接口返回格式错误");
      expect(apiClient.get).toHaveBeenCalledTimes(1);
    },
  );

  it("请求失败原样传递，不返回部分或空结果", async () => {
    const failure = new Error("请求取消");
    vi.mocked(apiClient.get).mockRejectedValue(failure);
    await expect(customTagsApi.poolAll(params)).rejects.toBe(failure);
  });
});
