import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fakeV2Preferences } from '@/features/preferences/testFixtures';
import { worksApi, worksClient, workApiBaseUrl } from './api';
import { captureAuthSession, invalidateAuthSession, setStoredAuthToken } from '@/shared/lib/authSession';


describe('V2 work transport', () => {
  beforeEach(() => { vi.restoreAllMocks(); invalidateAuthSession(); });
  it('keeps V2 URLs alongside relative and absolute V1 deployment URLs', () => {
    expect(workApiBaseUrl('/api/v1')).toBe('/api/v2');
    expect(workApiBaseUrl('https://forum.example/v1/')).toBe('https://forum.example/v2');
  });
  it('always attaches the current Fluxer bearer, independent of legacy cookie fallback', async () => {
    setStoredAuthToken('flx_current');
    let authorization: unknown;
    await worksClient.get('/works', { adapter: async config => {
      authorization = config.headers.Authorization;
      return { config, data: {}, status: 200, statusText: 'OK', headers: {} };
    } });
    expect(authorization).toBe('Bearer flx_current');
  });
  it('does not reinterpret a hidden-work 404 as a V1 request', async () => {
    const failure = Object.assign(new Error('hidden'), { response: { status: 404 } });
    const get = vi.spyOn(worksClient, 'get').mockRejectedValue(failure);
    await expect(worksApi.get('9876543210987654321')).rejects.toBe(failure);
    expect(get).toHaveBeenCalledExactlyOnceWith('/works/9876543210987654321', { signal: undefined });
  });
  it('writes collections to the V2 default booklist with string work IDs', async () => {
    const post = vi.spyOn(worksClient, 'post').mockResolvedValue({ data: { collected: true } });
    await expect(worksApi.collect('9876543210987654321', true)).resolves.toEqual({ collected: true });
    expect(post).toHaveBeenCalledWith('/works/9876543210987654321/collection');
  });
});

it('keeps boolean NSFW compatibility while supporting a separate expected-version update', async () => {
  vi.spyOn(worksClient, 'get').mockResolvedValue({ data: fakeV2Preferences });
  const patch = vi.spyOn(worksClient, 'patch').mockResolvedValue({ data: { ...fakeV2Preferences, show_nsfw: true, nsfw_preference_version: 4 } });
  await worksApi.preferences(true);
  expect(patch).toHaveBeenCalledWith('/me/preferences', { show_nsfw: true, expected_version: 3 }, expect.anything());
  patch.mockResolvedValue({ data: { ...fakeV2Preferences, show_nsfw: false, nsfw_preference_version: 5 } });
  await worksApi.preferences({ show_nsfw: false, expected_version: 4 });
  expect(patch).toHaveBeenCalledWith('/me/preferences', { show_nsfw: false, expected_version: 4 }, expect.anything());
});


it('rejects a queued V2 write if its captured authentication session has changed', async () => {
  vi.restoreAllMocks();
  setStoredAuthToken('synthetic-A'); const session = captureAuthSession();
  invalidateAuthSession(); setStoredAuthToken('synthetic-B');
  const adapter = vi.fn();
  await expect(worksClient.patch('/me/preferences', { include_keywords: 'old draft' }, { expectedAuthSession: session, adapter })).rejects.toThrow('登录状态已变化');
  expect(adapter).not.toHaveBeenCalled();
});

it.each([
  { show_nsfw: 'true' }, { nsfw_preference_version: 3 }, { nsfw_preference_version: 5 },
  { user_id: 'another-user' }, { nsfw_guild_id: 'another-guild' }, { nsfw_eligible: undefined },
])('rejects malformed or mismatched NSFW authority response: %j', async invalid => {
  vi.restoreAllMocks();
  vi.spyOn(worksClient, 'patch').mockResolvedValue({ data: { ...fakeV2Preferences, show_nsfw: true, nsfw_preference_version: 4, ...invalid } });
  await expect(worksApi.preferences({ show_nsfw: true, expected_version: 3 }, captureAuthSession(), { user_id: String(fakeV2Preferences.user_id), nsfw_guild_id: fakeV2Preferences.nsfw_guild_id! })).rejects.toThrow();
});
