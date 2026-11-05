import { beforeEach, describe, expect, it, vi } from 'vitest';
const config = vi.hoisted(() => ({ worksV2Enabled: false }));
vi.mock('@/shared/config/works', () => config);
vi.mock('@/features/auth/api/fluxerAuthApi', () => ({ getForumAuthConfig: vi.fn() }));
import { getForumAuthConfig } from '@/features/auth/api/fluxerAuthApi';
import { apiClient } from '@/shared/api/client';
import { worksClient } from '@/features/works/api';
import { preferencesApi } from './preferencesApi';
import { fakeV2Preferences } from '../testFixtures';
const document = { ...fakeV2Preferences, user_id: String(fakeV2Preferences.user_id) };
beforeEach(() => {
  vi.restoreAllMocks();
  config.worksV2Enabled = false;
  vi.mocked(getForumAuthConfig).mockResolvedValue({ mode: 'legacy', fluxer_api_url: null });
});
describe('preferences endpoint selection', () => {
  it.each(['flag', 'fluxer', 'forced'] as const)(
    'uses true self GET and partial PATCH in V2 (%s), never a Discord user URL',
    async (mode) => {
      config.worksV2Enabled = mode === 'flag';
      if (mode === 'fluxer')
        vi.mocked(getForumAuthConfig).mockResolvedValue({
          mode: 'fluxer',
          fluxer_api_url: 'https://example.invalid',
        });
      const get = vi.spyOn(worksClient, 'get').mockResolvedValue({ data: document });
      const patch = vi
        .spyOn(worksClient, 'patch')
        .mockResolvedValue({ data: { ...document, include_keywords: 'new' } });
      const legacy = vi.spyOn(apiClient, 'get');
      const options =
        mode === 'forced'
          ? { mode: 'v2' as const, guildId: 'old-guild' }
          : { guildId: 'old-guild' };
      expect(await preferencesApi.getByUserId(document.user_id, options)).toEqual(document);
      await preferencesApi.updateByUserId(document.user_id, { include_keywords: 'new' }, options);
      expect(get).toHaveBeenCalledWith('/me/preferences', expect.anything());
      expect(patch).toHaveBeenCalledWith(
        '/me/preferences',
        { include_keywords: 'new' },
        expect.anything(),
      );
      expect(legacy).not.toHaveBeenCalled();
    },
  );
  it('preserves legacy endpoint, guild scope and string IDs without clearing omitted arrays', async () => {
    const get = vi
      .spyOn(apiClient, 'get')
      .mockResolvedValue({ data: '{"user_id":1,"preferred_channels":[9876543210987654321]}' });
    const put = vi.spyOn(apiClient, 'put').mockResolvedValue({ data: '{"user_id":1}' });
    expect(
      (await preferencesApi.getByUserId('123', { guildId: '456' }))?.preferred_channels,
    ).toEqual(['9876543210987654321']);
    expect(get).toHaveBeenCalledWith(
      '/preferences/users/123',
      expect.objectContaining({ params: { guild_id: '456' } }),
    );
    await preferencesApi.updateByUserId('123', { include_keywords: 'only this' });
    expect(put).toHaveBeenCalledWith(
      '/preferences/users/123',
      { include_keywords: 'only this' },
      expect.anything(),
    );
  });
  it('treats only legacy404 as first time; V2 errors and malformed responses stay errors', async () => {
    const missing = { response: { status: 404 } };
    vi.spyOn(apiClient, 'get').mockRejectedValue(missing);
    expect(await preferencesApi.getByUserId('123')).toBeNull();
    const get = vi.spyOn(worksClient, 'get').mockRejectedValue(missing);
    await expect(preferencesApi.getByUserId('123', { mode: 'v2' })).rejects.toBe(missing);
    get.mockResolvedValue({ data: {} });
    await expect(preferencesApi.getByUserId('123', { mode: 'v2' })).rejects.toThrow('响应无效');
  });
});

it('rejects a self preference response belonging to a different numeric identity', async () => {
  vi.spyOn(worksClient, 'get').mockResolvedValue({ data: document });
  await expect(preferencesApi.getByUserId('different-fluxer-id', { mode: 'v2' })).rejects.toThrow(
    '响应无效',
  );
});

it.each([
  { nsfw_eligible: undefined },
  { nsfw_guild_id: undefined },
  { nsfw_preference_version: -1 },
  { nsfw_preference_version: 9007199254740992 },
  { ui_page_size: '48' },
  { results_per_page: 1.5 },
  { include_authors: [123] },
  { created_after: undefined },
  { include_keywords: null },
])('rejects missing or malformed complete contract fields: %j', async (invalid) => {
  vi.spyOn(worksClient, 'get').mockResolvedValue({ data: { ...document, ...invalid } });
  await expect(preferencesApi.getByUserId(document.user_id, { mode: 'v2' })).rejects.toThrow(
    '响应无效',
  );
});

it('reads historical out-of-range page sizes without silently changing or blocking repair', async () => {
  vi.spyOn(worksClient, 'get').mockResolvedValue({
    data: { ...document, results_per_page: 10, ui_page_size: 0 },
  });
  expect(await preferencesApi.getByUserId(document.user_id, { mode: 'v2' })).toMatchObject({
    results_per_page: 10,
    ui_page_size: 0,
  });
});
