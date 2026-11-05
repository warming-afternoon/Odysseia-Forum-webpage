import { describe, expect, it } from "vitest";

import { searchKeys } from "./queryKeys";

describe("searchKeys.suggestions", () => {
  it("只使用实际请求参数区分搜索建议缓存", () => {
    expect(
      searchKeys.suggestions({
        query: "作者",
        applyPreferences: true,
      }),
    ).toEqual(["search", "work-suggestions-v2", {
      query: "作者",
      applyPreferences: true,
    }]);
  });
});


it("原生作品和旧帖子不复用结果缓存", () => {
  const params = { query: "作品" } as Parameters<typeof searchKeys.results>[0];
  expect(searchKeys.results(params)).toEqual(searchKeys.results({ ...params, resultSource: "legacy" }));
  expect(searchKeys.results({ ...params, resultSource: "native" })).not.toEqual(searchKeys.results(params));
});


it("标签名称筛选不复用另一组结果缓存", () => {
  const params = { query: "作品" } as Parameters<typeof searchKeys.results>[0];
  expect(searchKeys.results({ ...params, includeTags: ["猫"] })).not.toEqual(searchKeys.results({ ...params, includeTags: ["狗"] }));
  expect(searchKeys.results({ ...params, excludeTags: ["猫"] })).not.toEqual(searchKeys.results(params));
});
