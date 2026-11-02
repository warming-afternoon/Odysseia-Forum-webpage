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

describe('受保护原生 fetch 的会话失效边界', () => {
  const token = (letter: string) => 'flx_' + letter.repeat(36);
  const configuration = { data: { mode: 'fluxer', fluxer_api_url: 'https://native.invalid/api/v1' } };
  it.each([false, true])('当前带token请求401清理会话，非JSON=%s也不遗漏', async (invalidJson) => {
    client.get.mockResolvedValue(configuration);
    const session = await import('@/shared/lib/authSession');
    session.setStoredAuthToken(token('A'));
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ status: 401, ok: false, json: async () => {
      if (invalidJson) throw new SyntaxError('fake non-JSON');
      return { message: 'fake unauthorized' };
    } }));
    const api = await import('./fluxerAuthApi');
    await expect(api.fluxerRequest('/users/@me/discord-password', {}, token('A'))).rejects.toThrow();
    expect(session.getStoredAuthToken()).toBeNull();
  });
  it('无token密码/MFA或显式其它token的401不能清掉B', async () => {
    client.get.mockResolvedValue(configuration);
    const session = await import('@/shared/lib/authSession');
    session.setStoredAuthToken(token('B'));
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ status: 401, ok: false, json: async () => ({ message: 'fake unauthorized' }) }));
    const api = await import('./fluxerAuthApi');
    for (const [path, credential] of [['/auth/login', undefined], ['/auth/login/mfa/totp', undefined], ['/users/@me/sudo/webauthn/authentication-options', token('X')]] as const) {
      await expect(api.fluxerRequest(path, {}, credential)).rejects.toThrow();
      expect(session.getStoredAuthToken()).toBe(token('B'));
    }
  });
  it('旧A的401不会清掉B或同token的新generation', async () => {
    client.get.mockResolvedValue(configuration);
    const session = await import('@/shared/lib/authSession');
    const api = await import('./fluxerAuthApi');
    for (const replacement of ['B', 'A']) {
      session.invalidateAuthSession(); session.setStoredAuthToken(token('A'));
      let complete!: (value: unknown) => void;
      const fetcher = vi.fn().mockImplementation(() => new Promise(resolve => { complete = resolve; }));
      vi.stubGlobal('fetch', fetcher);
      const pending = api.fluxerRequest('/users/@me/discord-password', {}, token('A'));
      await vi.waitFor(() => expect(fetcher).toHaveBeenCalledTimes(1));
      session.invalidateAuthSession(); session.setStoredAuthToken(token(replacement));
      complete({ status: 401, ok: false, json: async () => ({ message: 'fake unauthorized' }) });
      await expect(pending).rejects.toThrow();
      expect(session.getStoredAuthToken()).toBe(token(replacement));
    }
  });
  it('等待配置期间切换账号则不发受保护请求', async () => {
    let complete!: (value: unknown) => void;
    client.get.mockImplementation(() => new Promise(resolve => { complete = resolve; }));
    const session = await import('@/shared/lib/authSession');
    session.setStoredAuthToken(token('A'));
    const fetcher = vi.fn(); vi.stubGlobal('fetch', fetcher);
    const api = await import('./fluxerAuthApi');
    const pending = api.fluxerRequest('/users/@me/discord-password', {}, token('A'));
    session.invalidateAuthSession(); session.setStoredAuthToken(token('B')); complete(configuration);
    await expect(pending).rejects.toMatchObject({ code: 'AUTH_SESSION_CHANGED' });
    expect(fetcher).not.toHaveBeenCalled();
    expect(session.getStoredAuthToken()).toBe(token('B'));
  });
  it('403或服务故障不误清当前会话', async () => {
    client.get.mockResolvedValue(configuration);
    const session = await import('@/shared/lib/authSession'); session.setStoredAuthToken(token('A'));
    const api = await import('./fluxerAuthApi');
    for (const status of [403, 500]) {
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ status, ok: false, json: async () => ({ message: 'fake error' }) }));
      await expect(api.fluxerRequest('/users/@me/discord-password', {}, token('A'))).rejects.toThrow();
      expect(session.getStoredAuthToken()).toBe(token('A'));
    }
  });
});
