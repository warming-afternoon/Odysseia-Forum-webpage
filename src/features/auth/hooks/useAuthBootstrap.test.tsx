import { act, renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryObserver } from '@tanstack/react-query';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const api = vi.hoisted(() => ({
  hasLoginCode: vi.fn(), claimLoginCode: vi.fn(), getForumAuthConfig: vi.fn(),
}));
vi.mock('../api/fluxerAuthApi', () => api);
vi.mock('../api/authApi', () => ({ authApi: { checkAuth: vi.fn() } }));
import { authApi } from '../api/authApi';
import { invalidateAuthSession, setStoredAuthToken } from '@/shared/lib/authSession';
import { useAuthBootstrap } from './useAuthBootstrap';

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => { resolve = done; });
  return { promise, resolve };
}

describe('useAuthBootstrap', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    localStorage.clear();
    window.history.replaceState(null, '', '/login');
    api.hasLoginCode.mockReturnValue(true);
    api.claimLoginCode.mockImplementation(async () => { setStoredAuthToken('new-session'); });
    vi.mocked(authApi.checkAuth).mockResolvedValue({ loggedIn: true });
  });

  it('StrictMode 共用领取请求，并等验证完成后才放行路由', async () => {
    const claim = deferred<void>();
    const check = deferred<{ loggedIn: boolean }>();
    api.claimLoginCode.mockReturnValue(claim.promise);
    vi.mocked(authApi.checkAuth).mockReturnValue(check.promise);
    const client = new QueryClient();
    const { result } = renderHook(() => useAuthBootstrap(client), { reactStrictMode: true });
    expect(result.current.pending).toBe(true);
    expect(api.claimLoginCode).toHaveBeenCalledTimes(1);
    await act(async () => { claim.resolve(); });
    expect(result.current.pending).toBe(true);
    expect(authApi.checkAuth).toHaveBeenCalledTimes(1);
    await act(async () => { check.resolve({ loggedIn: true }); });
    await waitFor(() => expect(result.current.pending).toBe(false));
    expect(client.getQueryData(['auth'])).toEqual({ loggedIn: true });
    expect(api.getForumAuthConfig).not.toHaveBeenCalled();
  });

  it('覆盖无活跃订阅的未登录缓存，路由无需刷新即可读取登录状态', async () => {
    const client = new QueryClient();
    client.setQueryData(['auth'], { loggedIn: false });
    await client.invalidateQueries({ queryKey: ['auth'] });
    const { result } = renderHook(() => useAuthBootstrap(client));
    await waitFor(() => expect(result.current.pending).toBe(false));
    const observer = new QueryObserver(client, {
      queryKey: ['auth'], queryFn: authApi.checkAuth, refetchOnMount: false,
    });
    const unsubscribe = observer.subscribe(() => {});
    expect(observer.getCurrentResult().data?.loggedIn).toBe(true);
    expect(authApi.checkAuth).toHaveBeenCalledTimes(1);
    unsubscribe();
    client.clear();
  });

  it('验证失败时保留凭证，重试不重复领取一次性登录码', async () => {
    vi.mocked(authApi.checkAuth).mockRejectedValueOnce({ response: { status: 503 } });
    const { result } = renderHook(() => useAuthBootstrap(new QueryClient()));
    await waitFor(() => expect(result.current.verificationFailed).toBe(true));
    expect(localStorage.getItem('auth_token')).toBe('new-session');
    expect(window.location.search).toBe('');
    act(() => result.current.retry());
    await waitFor(() => expect(result.current.pending).toBe(false));
    expect(result.current.verificationFailed).toBe(false);
    expect(api.claimLoginCode).toHaveBeenCalledTimes(1);
    expect(authApi.checkAuth).toHaveBeenCalledTimes(2);
  });

  it('领取失败时返回登录页，不调用验证接口', async () => {
    api.claimLoginCode.mockRejectedValue(new Error('expired'));
    const { result } = renderHook(() => useAuthBootstrap(new QueryClient()));
    await waitFor(() => expect(result.current.pending).toBe(false));
    expect(new URLSearchParams(window.location.search).get('error')).toContain('凭证已失效');
    expect(authApi.checkAuth).not.toHaveBeenCalled();
  });

  it('明确拒绝并清除会话时允许返回登录页', async () => {
    vi.mocked(authApi.checkAuth).mockImplementation(async () => {
      invalidateAuthSession();
      throw { response: { status: 401 } };
    });
    const { result } = renderHook(() => useAuthBootstrap(new QueryClient()));
    await waitFor(() => expect(result.current.pending).toBe(false));
    expect(result.current.verificationFailed).toBe(false);
  });

  it('验证期间切换账号时不写入旧账号结果', async () => {
    const check = deferred<{ loggedIn: boolean }>();
    vi.mocked(authApi.checkAuth).mockReturnValue(check.promise);
    const client = new QueryClient();
    const { result } = renderHook(() => useAuthBootstrap(client));
    await waitFor(() => expect(authApi.checkAuth).toHaveBeenCalledTimes(1));
    await act(async () => {
      invalidateAuthSession();
      setStoredAuthToken('other-session');
      check.resolve({ loggedIn: true });
    });
    expect(client.getQueryData(['auth'])).toBeUndefined();
    expect(result.current.verificationFailed).toBe(true);
  });

  it('没有回调时不阻塞普通页面', () => {
    api.hasLoginCode.mockReturnValue(false);
    const { result } = renderHook(() => useAuthBootstrap(new QueryClient()));
    expect(result.current.pending).toBe(false);
    expect(api.claimLoginCode).not.toHaveBeenCalled();
    expect(authApi.checkAuth).not.toHaveBeenCalled();
  });
});
