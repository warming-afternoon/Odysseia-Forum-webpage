import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';

const client = vi.hoisted(() => ({ get: vi.fn(), post: vi.fn() }));
vi.mock('@/shared/api/client', () => ({ apiClient: client }));

beforeEach(() => {
  vi.resetModules();
  vi.clearAllMocks();
  localStorage.clear();
  history.replaceState(null, '', '/');
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('Fluxer 登录凭证', () => {
  it('并发只领取一次并清除 URL，凭证需要后端浏览器绑定校验', async () => {
    const token = 'flx_' + 'a'.repeat(36);
    history.replaceState(null, '', '/?keep=yes#login_code=single-use');
    client.post.mockResolvedValue({ data: { token, user: { id: '1' } } });
    const api = await import('./fluxerAuthApi');
    await Promise.all([api.claimLoginCode(), api.claimLoginCode()]);
    expect(client.post).toHaveBeenCalledTimes(1);
    expect(client.post).toHaveBeenCalledWith(
      '/auth/session/claim',
      { login_code: 'single-use' },
      { skipAuthHeader: true },
    );
    expect(location.hash).toBe('');
    expect(location.search).toBe('?keep=yes');
    expect(localStorage.getItem('auth_token')).toBe(token);
    expect(localStorage.getItem('use_auth_header')).toBe('true');
  });

  it('领取失败不存储会话或回退到 URL token', async () => {
    history.replaceState(null, '', '/#login_code=invalid');
    client.post.mockRejectedValue(new Error('invalid code'));
    const api = await import('./fluxerAuthApi');
    await expect(api.claimLoginCode()).rejects.toThrow('invalid code');
    expect(localStorage.getItem('auth_token')).toBeNull();
    expect(location.hash).toBe('');
  });

  it('配置服务故障不能退回旧鉴权', async () => {
    client.get.mockRejectedValue({ response: { status: 503 } });
    const api = await import('./fluxerAuthApi');
    await expect(api.getForumAuthConfig()).rejects.toMatchObject({ response: { status: 503 } });
  });

  it('拒绝不安全的远程登录地址', async () => {
    client.get.mockResolvedValue({
      data: { mode: 'fluxer', fluxer_api_url: 'http://remote.example/api' },
    });
    const api = await import('./fluxerAuthApi');
    await expect(api.getForumAuthConfig()).rejects.toThrow('登录服务地址无效');
  });

  it('直接向配置的 Fluxer 发送密码，不携带 cookie 或跟随重定向', async () => {
    client.get.mockResolvedValue({
      data: { mode: 'fluxer', fluxer_api_url: 'https://fluxer.example/api/v1' },
    });
    const fetcher = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ token: 'value' }),
    });
    vi.stubGlobal('fetch', fetcher);
    const api = await import('./fluxerAuthApi');
    await api.fluxerRequest('/auth/login', { login: 'user', password: 'secret' });
    expect(fetcher).toHaveBeenCalledWith(
      'https://fluxer.example/api/v1/auth/login',
      expect.objectContaining({ credentials: 'omit', redirect: 'error', method: 'POST' }),
    );
    expect(client.post).not.toHaveBeenCalled();
  });

  it('登出时清除短期首次密码证明', async () => {
    history.replaceState(null, '', '/#login_code=one');
    client.post.mockResolvedValue({
      data: {
        token: 'flx_' + 'a'.repeat(36),
        user: { id: '1' },
        password_setup_proof: 'proof',
      },
    });
    const api = await import('./fluxerAuthApi');
    await api.claimLoginCode();
    expect(api.getPasswordSetupProof()).toBe('proof');
    const session = await import('@/shared/lib/authSession');
    session.invalidateAuthSession();
    expect(api.getPasswordSetupProof()).toBeNull();
  });

  it('浏览器拒绝存储时不报告登录成功', async () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    const api = await import('./fluxerAuthApi');
    expect(() => api.acceptFluxerToken('flx_' + 'a'.repeat(36))).toThrow('无法保存登录会话');
    vi.restoreAllMocks();
  });

  it('异步领取期间账号变更时不覆盖新会话', async () => {
    history.replaceState(null, '', '/#login_code=one');
    let complete!: (value: unknown) => void;
    client.post.mockImplementation(() => new Promise((resolve) => {
      complete = resolve;
    }));
    const api = await import('./fluxerAuthApi');
    const session = await import('@/shared/lib/authSession');
    const pending = api.claimLoginCode();
    session.invalidateAuthSession();
    session.setStoredAuthToken('flx_' + 'b'.repeat(36));
    complete({
      data: {
        token: 'flx_' + 'a'.repeat(36),
        user: { id: '1' },
        password_setup_proof: 'proof',
      },
    });
    await expect(pending).rejects.toThrow('账号已切换');
    expect(session.getStoredAuthToken()).toBe('flx_' + 'b'.repeat(36));
    expect(api.getPasswordSetupProof()).toBeNull();
  });

  it('会话被更换后即使旧 token 再次出现也不能接受过期响应', async () => {
    const api = await import('./fluxerAuthApi');
    const session = await import('@/shared/lib/authSession');
    const original = 'flx_' + 'a'.repeat(36);
    session.setStoredAuthToken(original);
    const snapshot = session.captureAuthSession();
    session.invalidateAuthSession();
    session.setStoredAuthToken(original);
    expect(() => api.acceptFluxerToken('flx_' + 'c'.repeat(36), snapshot)).toThrow('账号已切换');
    expect(session.getStoredAuthToken()).toBe(original);
  });

  it('凭证绑定原始会话，令牌变更后即使事件尚未送达也不可使用', async () => {
    history.replaceState(null, '', '/#login_code=one');
    client.post.mockResolvedValue({
      data: {
        token: 'flx_' + 'a'.repeat(36),
        user: { id: '1' },
        password_setup_proof: 'proof',
      },
    });
    const api = await import('./fluxerAuthApi');
    await api.claimLoginCode();
    expect(api.getPasswordSetupProof()).toBe('proof');
    localStorage.setItem('auth_token', 'flx_' + 'b'.repeat(36));
    expect(api.getPasswordSetupProof()).toBeNull();
  });
});
