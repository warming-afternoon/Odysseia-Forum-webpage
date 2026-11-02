import { beforeEach, describe, expect, it, vi } from "vitest";

import { getForumAuthConfig } from "./fluxerAuthApi";

import { authApi } from "./authApi";
import { apiClient } from "@/shared/api/client";
import {
  getStoredAuthToken,
  invalidateAuthSession,
  setUseAuthHeader,
} from "@/shared/lib/authSession";

vi.mock("@/shared/api/client", () => ({
  apiClient: { get: vi.fn(), post: vi.fn() },
}));

vi.mock("@/shared/lib/authSession", () => {
  const read = vi.fn();
  return {
    getStoredAuthToken: read,
    captureAuthSession: vi.fn(() => ({ token: read(), generation: 0 })),
    isAuthSessionCurrent: vi.fn((session: { token: string | null }) => session.token === read()),
    invalidateAuthSession: vi.fn(),
    setUseAuthHeader: vi.fn(),
  };
});

vi.mock("./fluxerAuthApi", () => ({ getForumAuthConfig: vi.fn() }));

const mockedGet = vi.mocked(apiClient.get);
const mockedGetToken = vi.mocked(getStoredAuthToken);

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(getForumAuthConfig).mockResolvedValue({ mode: "legacy", fluxer_api_url: null });
});

describe("authApi.checkAuth", () => {
  it("cookie 会话有效时直接返回，并关闭 Bearer 模式", async () => {
    mockedGet.mockResolvedValueOnce({
      data: { loggedIn: true, user: { id: "1", username: "snake" } },
    });

    const result = await authApi.checkAuth();

    expect(result.loggedIn).toBe(true);
    expect(result.user?.id).toBe("1");
    expect(setUseAuthHeader).toHaveBeenCalledWith(false);
    expect(mockedGet).toHaveBeenCalledTimes(1);
  });

  it("cookie 无效且本地无 token 时返回未登录", async () => {
    mockedGet.mockResolvedValueOnce({ data: { loggedIn: false } });
    mockedGetToken.mockReturnValueOnce(null);

    const result = await authApi.checkAuth();

    expect(result).toEqual({ loggedIn: false });
    expect(setUseAuthHeader).not.toHaveBeenCalled();
  });

  it("cookie 无效但本地 token 有效时回退到 Bearer 模式", async () => {
    mockedGet
      .mockResolvedValueOnce({ data: { loggedIn: false } })
      .mockResolvedValueOnce({
        data: { loggedIn: true, user: { id: "2", username: "fallback" } },
      });
    mockedGetToken.mockReturnValueOnce("stored-token");

    const result = await authApi.checkAuth();

    expect(result.loggedIn).toBe(true);
    expect(setUseAuthHeader).toHaveBeenCalledWith(true);
    expect(mockedGet).toHaveBeenLastCalledWith("/auth/checkauth", {
      headers: { Authorization: "Bearer stored-token" },
      skipAuthHeader: true,
    });
  });

  it("cookie 请求抛错时同样走 Bearer 回退", async () => {
    mockedGet
      .mockRejectedValueOnce(new Error("network down"))
      .mockResolvedValueOnce({
        data: { loggedIn: true, user: { id: "3", username: "recovered" } },
      });
    mockedGetToken.mockReturnValueOnce("stored-token");

    const result = await authApi.checkAuth();

    expect(result.loggedIn).toBe(true);
    expect(setUseAuthHeader).toHaveBeenCalledWith(true);
  });

  it("cookie 请求失败且没有本地 token 时保留网络错误", async () => {
    mockedGet.mockRejectedValueOnce(new Error("network down"));
    mockedGetToken.mockReturnValueOnce(null);

    await expect(authApi.checkAuth()).rejects.toThrow("network down");
  });

  it("cookie 与 Bearer 双双失败时保留真实错误", async () => {
    mockedGet
      .mockRejectedValueOnce(new Error("network down"))
      .mockRejectedValueOnce(new Error("token expired"));
    mockedGetToken.mockReturnValueOnce("stale-token");

    await expect(authApi.checkAuth()).rejects.toThrow("token expired");
    expect(setUseAuthHeader).not.toHaveBeenCalled();
  });
});

describe("authApi.logout", () => {
  it("调用现有 GET 登出接口，绕过全局 JSON 解析并清理本地会话状态", async () => {
    mockedGet.mockResolvedValueOnce({ data: "<html></html>" });

    await authApi.logout();

    expect(mockedGet).toHaveBeenCalledWith(
      "/auth/logout",
      expect.objectContaining({ transformResponse: expect.any(Function) }),
    );
    expect(invalidateAuthSession).toHaveBeenCalledTimes(1);
  });

  it("后端登出失败时仍清理本地会话状态", async () => {
    mockedGet.mockRejectedValueOnce(new Error("network down"));

    await expect(authApi.logout()).rejects.toThrow("network down");

    expect(invalidateAuthSession).toHaveBeenCalledTimes(1);
  });
});


describe("Fluxer 统一鉴权", () => {
  it("直接使用 Bearer，不先尝试旧 cookie", async () => {
    vi.mocked(getForumAuthConfig).mockResolvedValue({
      mode: "fluxer",
      fluxer_api_url: "https://fluxer.example/api/v1",
    });
    mockedGetToken.mockReturnValue("flx_" + "a".repeat(36));
    mockedGet.mockResolvedValueOnce({ data: { loggedIn: true, user: { id: "123" } } });
    expect((await authApi.checkAuth()).loggedIn).toBe(true);
    expect(mockedGet).toHaveBeenCalledTimes(1);
    expect(mockedGet).toHaveBeenCalledWith("/auth/checkauth", {
      headers: { Authorization: "Bearer flx_" + "a".repeat(36) },
      skipAuthHeader: true,
    });
  });

  it("撤销请求失败仍清理浏览器会话", async () => {
    vi.mocked(getForumAuthConfig).mockResolvedValue({
      mode: "fluxer",
      fluxer_api_url: "https://fluxer.example/api/v1",
    });
    mockedGetToken.mockReturnValue("flx_" + "b".repeat(36));
    vi.mocked(apiClient.post).mockRejectedValueOnce(new Error("unavailable"));
    await expect(authApi.logout()).rejects.toThrow("unavailable");
    expect(invalidateAuthSession).toHaveBeenCalled();
    expect(apiClient.post).toHaveBeenCalledWith(
      "/auth/logout",
      {},
      expect.objectContaining({
        headers: { Authorization: "Bearer flx_" + "b".repeat(36) },
      }),
    );
  });

  it("旧账号登出完成后不清除刚切换的新账号", async () => {
    vi.mocked(getForumAuthConfig).mockResolvedValue({
      mode: "fluxer",
      fluxer_api_url: "https://fluxer.example/api/v1",
    });
    let finish!: () => void;
    mockedGetToken.mockReturnValue("old-token");
    vi.mocked(apiClient.post).mockImplementationOnce(() => new Promise((resolve) => {
      finish = () => resolve({ data: {} });
    }));
    const pending = authApi.logout();
    await Promise.resolve();
    mockedGetToken.mockReturnValue("new-token");
    finish();
    await pending;
    expect(invalidateAuthSession).not.toHaveBeenCalled();
    expect(apiClient.post).toHaveBeenCalledWith(
      "/auth/logout",
      {},
      expect.objectContaining({ headers: { Authorization: "Bearer old-token" } }),
    );
  });
});
