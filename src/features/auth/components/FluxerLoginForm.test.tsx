import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { FluxerLoginForm } from './FluxerLoginForm';
import { invalidateAuthSession, setStoredAuthToken, getStoredAuthToken } from '@/shared/lib/authSession';

const api = vi.hoisted(() => ({ get: vi.fn() }));
vi.mock('@/shared/api/client', () => ({ apiClient: api }));
const token = (letter: string) => 'flx_' + letter.repeat(36);
function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>(complete => { resolve = complete; });
  return { promise, resolve };
}
const response = (body: unknown) => ({ ok: true, json: async () => body });

beforeEach(() => {
  vi.clearAllMocks();
  invalidateAuthSession();
  api.get.mockResolvedValue({ data: { mode: 'fluxer', fluxer_api_url: 'https://auth.invalid/api/v1' } });
});
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

describe('原生登录 attempt 的会话边界', () => {
  it('密码响应不能覆盖请求期间切换的新账号', async () => {
    const pending = deferred<ReturnType<typeof response>>();
    const fetcher = vi.fn().mockReturnValue(pending.promise);
    vi.stubGlobal('fetch', fetcher);
    const success = vi.fn();
    render(<FluxerLoginForm enabled onSuccess={success} />);
    fireEvent.submit(screen.getByRole('button', { name: '登录 Fluxer 账号' }).closest('form')!);
    await waitFor(() => expect(fetcher).toHaveBeenCalledTimes(1));
    invalidateAuthSession(); setStoredAuthToken(token('B'));
    await act(async () => pending.resolve(response({ token: token('A') })));
    expect(getStoredAuthToken()).toBe(token('B'));
    expect(success).not.toHaveBeenCalled();
  });

  it('正常密码登录保留原行为，卸载后迟到响应不重新登录', async () => {
    const pending = deferred<ReturnType<typeof response>>();
    const fetcher = vi.fn().mockReturnValue(pending.promise);
    vi.stubGlobal('fetch', fetcher);
    const success = vi.fn();
    const view = render(<FluxerLoginForm enabled onSuccess={success} />);
    fireEvent.submit(screen.getByRole('button', { name: '登录 Fluxer 账号' }).closest('form')!);
    await waitFor(() => expect(fetcher).toHaveBeenCalledTimes(1));
    view.unmount();
    await act(async () => pending.resolve(response({ token: token('A') })));
    expect(getStoredAuthToken()).toBeNull();
    expect(success).not.toHaveBeenCalled();
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(response({ token: token('C') })));
    render(<FluxerLoginForm enabled onSuccess={success} />);
    fireEvent.submit(screen.getByRole('button', { name: '登录 Fluxer 账号' }).closest('form')!);
    await waitFor(() => expect(getStoredAuthToken()).toBe(token('C')));
    expect(success).toHaveBeenCalledTimes(1);
  });

  it('MFA challenge 仍绑定最初会话，返回账号页会取消待完成 attempt', async () => {
    const pending = deferred<ReturnType<typeof response>>();
    const fetcher = vi.fn()
      .mockResolvedValueOnce(response({ mfa: true, ticket: 'fake-ticket', totp: true }))
      .mockReturnValueOnce(pending.promise);
    vi.stubGlobal('fetch', fetcher);
    const success = vi.fn();
    render(<FluxerLoginForm enabled onSuccess={success} />);
    fireEvent.submit(screen.getByRole('button', { name: '登录 Fluxer 账号' }).closest('form')!);
    const mfa = await screen.findByRole('button', { name: '验证并登录' });
    fireEvent.submit(mfa.closest('form')!);
    await waitFor(() => expect(fetcher).toHaveBeenCalledTimes(2));
    fireEvent.click(screen.getByRole('button', { name: '返回账号登录' }));
    await act(async () => pending.resolve(response({ token: token('A') })));
    expect(getStoredAuthToken()).toBeNull();
    expect(success).not.toHaveBeenCalled();
  });
});
