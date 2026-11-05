import { beforeEach, describe, expect, it, vi } from 'vitest';
import { invalidateAuthSession, setStoredAuthToken } from '@/shared/lib/authSession';

const api = vi.hoisted(() => ({ fluxerRequest: vi.fn(), getForumAuthConfig: vi.fn() }));
vi.mock('./fluxerAuthApi', () => api);
import { getFluxerLoginIdentity } from './fluxerIdentityApi';

const token = 'flx_' + 'a'.repeat(36);

beforeEach(() => {
  invalidateAuthSession();
  vi.clearAllMocks();
  api.getForumAuthConfig.mockResolvedValue({ mode: 'fluxer' });
});

describe('Fluxer 登录身份', () => {
  it('直接读取当前原生会话的用户名，不使用昵称或 Discord 名字', async () => {
    setStoredAuthToken(token);
    api.fluxerRequest.mockResolvedValue({
      username: 'native_alice', discriminator: '0000', global_name: 'Discord 昵称',
    });
    expect(await getFluxerLoginIdentity()).toMatchObject({
      username: 'native_alice', login: 'native_alice',
    });
    expect(api.fluxerRequest).toHaveBeenCalledWith('/users/@me', undefined, token);
  });

  it('旧式账号保留四位编号，避免同名登录歧义', async () => {
    setStoredAuthToken(token);
    api.fluxerRequest.mockResolvedValue({ username: 'alice', discriminator: '0042' });
    expect(await getFluxerLoginIdentity()).toMatchObject({ username: 'alice', login: 'alice#0042' });
  });

  it('保留 Discord 导入账号正式用户名中的句点', async () => {
    setStoredAuthToken(token);
    api.fluxerRequest.mockResolvedValue({ username: 'alice.name', discriminator: '0000' });
    expect(await getFluxerLoginIdentity()).toMatchObject({ username: 'alice.name', login: 'alice.name' });
  });

  it.each([null, 'legacy-token'])('无原生会话时不读取账号资料 (%s)', async (value) => {
    if (value) setStoredAuthToken(value);
    expect(await getFluxerLoginIdentity()).toBeNull();
    expect(api.getForumAuthConfig).not.toHaveBeenCalled();
    expect(api.fluxerRequest).not.toHaveBeenCalled();
  });

  it('旧鉴权部署不读取 Fluxer 身份', async () => {
    setStoredAuthToken(token);
    api.getForumAuthConfig.mockResolvedValue({ mode: 'legacy' });
    expect(await getFluxerLoginIdentity()).toBeNull();
    expect(api.fluxerRequest).not.toHaveBeenCalled();
  });

  it.each([
    null,
    {},
    { username: '', discriminator: '0000' },
    { username: 'display name', discriminator: '0000' },
    { username: 'alice' },
    { username: 'alice', discriminator: '42' },
    { username: 'alice', discriminator: 42 },
  ])('拒绝缺失或畸形的登录字段，不编造用户名 (%j)', async (data) => {
    setStoredAuthToken(token);
    api.fluxerRequest.mockResolvedValue(data);
    await expect(getFluxerLoginIdentity()).rejects.toThrow('未能读取有效的 Fluxer 登录用户名');
  });

  it('配置请求期间切换账号不会继续发送旧 token', async () => {
    setStoredAuthToken(token);
    let finish!: (value: { mode: string }) => void;
    api.getForumAuthConfig.mockImplementation(() => new Promise((resolve) => { finish = resolve; }));
    const pending = getFluxerLoginIdentity();
    invalidateAuthSession();
    setStoredAuthToken('flx_' + 'b'.repeat(36));
    finish({ mode: 'fluxer' });
    await expect(pending).rejects.toMatchObject({ code: 'AUTH_SESSION_CHANGED' });
    expect(api.fluxerRequest).not.toHaveBeenCalled();
  });

  it.each(['different-token', 'same-token'])('丢弃会话失效后回来的旧资料 (%s)', async (kind) => {
    setStoredAuthToken(token);
    let finish!: (value: unknown) => void;
    api.fluxerRequest.mockImplementation(() => new Promise((resolve) => { finish = resolve; }));
    const pending = getFluxerLoginIdentity();
    await vi.waitFor(() => expect(api.fluxerRequest).toHaveBeenCalledOnce());
    invalidateAuthSession();
    setStoredAuthToken(kind === 'same-token' ? token : 'flx_' + 'b'.repeat(36));
    finish({ username: 'old_alice', discriminator: '0000' });
    await expect(pending).rejects.toMatchObject({ code: 'AUTH_SESSION_CHANGED' });
  });
});
