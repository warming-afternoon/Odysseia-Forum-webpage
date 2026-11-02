import { beforeEach, describe, expect, it, vi } from 'vitest';
import { worksApi, worksClient, workApiBaseUrl } from './api';
import { getStoredAuthToken } from '@/shared/lib/authSession';

vi.mock('@/shared/lib/authSession', () => ({ getStoredAuthToken: vi.fn(), invalidateAuthSession: vi.fn(), isUsingAuthHeader: vi.fn() }));

describe('V2 work transport', () => {
  beforeEach(() => vi.restoreAllMocks());
  it('keeps V2 URLs alongside relative and absolute V1 deployment URLs', () => {
    expect(workApiBaseUrl('/api/v1')).toBe('/api/v2');
    expect(workApiBaseUrl('https://forum.example/v1/')).toBe('https://forum.example/v2');
  });
  it('always attaches the current Fluxer bearer, independent of legacy cookie fallback', async () => {
    vi.mocked(getStoredAuthToken).mockReturnValue('flx_current');
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
