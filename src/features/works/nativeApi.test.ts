import { beforeEach, describe, expect, it, vi } from 'vitest';
import { nativeClient, nativeMessagesApi } from './nativeApi';
import { getForumAuthConfig } from '@/features/auth/api/fluxerAuthApi';
import { getStoredAuthToken } from '@/shared/lib/authSession';
vi.mock('@/features/auth/api/fluxerAuthApi', () => ({ getForumAuthConfig: vi.fn() }));
vi.mock('@/shared/lib/authSession', () => ({ getStoredAuthToken: vi.fn(), invalidateAuthSession: vi.fn(), isUsingAuthHeader: vi.fn() }));

describe('direct Fluxer message transport', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.mocked(getStoredAuthToken).mockReturnValue('flx_native');
    vi.mocked(getForumAuthConfig).mockResolvedValue({ mode: 'fluxer', fluxer_api_url: 'https://chat.example/api/v1/' });
  });
  it('uses the configured native prefix and raw Fluxer token without Forum cookies', async () => {
    let captured: { base?: string; authorization?: unknown; credentials?: boolean } = {};
    await nativeClient.get('/channels/123/messages', { adapter: async config => {
      captured = { base: config.baseURL, authorization: config.headers.Authorization, credentials: config.withCredentials };
      return { data: [], status: 200, statusText: 'OK', headers: {}, config };
    } });
    expect(captured).toEqual({ base: 'https://chat.example/api/v1', authorization: 'flx_native', credentials: false });
  });
  it('rejects native reads in legacy mode instead of sending a token to an arbitrary URL', async () => {
    vi.mocked(getForumAuthConfig).mockResolvedValue({ mode: 'legacy', fluxer_api_url: null });
    const adapter = vi.fn();
    await expect(nativeClient.get('/channels/123/messages', { adapter })).rejects.toThrow('未启用');
    expect(adapter).not.toHaveBeenCalled();
  });
  it('sends a reply to the referenced native channel with an idempotency nonce', async () => {
    const post = vi.spyOn(nativeClient, 'post').mockResolvedValue({ data: { id: '222' } });
    await nativeMessagesApi.send('9876543210987654321', '新的回复', 'once');
    expect(post).toHaveBeenCalledExactlyOnceWith('/channels/9876543210987654321/messages', { content: '新的回复', nonce: 'once', enforce_nonce: true });
  });
});
