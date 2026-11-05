import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AxiosError, type InternalAxiosRequestConfig } from 'axios';
vi.mock('@/shared/config/works', () => ({ worksV2Enabled: true }));
import { apiClient } from './client';
import { AuthVerificationUnavailableError, FeatureNotMigratedError } from './featureMigration';
import {
  captureAuthSession,
  getStoredAuthToken,
  invalidateAuthSession,
  setStoredAuthToken,
  setUseAuthHeader,
} from '@/shared/lib/authSession';
import {
  dismissFeatureMigrationNotice,
  getFeatureMigrationNotice,
  subscribeFeatureMigrationNotice,
} from '@/shared/lib/featureMigrationNotice';

const originalAdapter = apiClient.defaults.adapter;
const response = (config: InternalAxiosRequestConfig, data: unknown) => ({
  data,
  status: 200,
  statusText: 'OK',
  headers: {},
  config,
});
const denied = (config: InternalAxiosRequestConfig, status = 401) =>
  new AxiosError('request failed', 'ERR_BAD_REQUEST', config, undefined, {
    data: { detail: 'backend detail' },
    status,
    statusText: 'error',
    headers: {},
    config,
  });
let checks = 0;
let now = 1000;
beforeEach(() => {
  invalidateAuthSession();
  setStoredAuthToken('migration-test-token');
  setUseAuthHeader(true);
  now = 1000;
  checks = 0;
  vi.spyOn(performance, 'now').mockImplementation(() => now);
});
afterEach(() => {
  apiClient.defaults.adapter = originalAdapter;
  invalidateAuthSession();
  vi.restoreAllMocks();
});
function adapter(
  check: (config: InternalAxiosRequestConfig) => unknown = () => ({ loggedIn: true }),
) {
  apiClient.defaults.adapter = async (config) => {
    if (config.url === '/auth/checkauth') {
      checks++;
      return response(config, await check(config));
    }
    throw denied(config);
  };
}
const business = (path = '/notifications/unread-count') =>
  apiClient.get(path).catch((error) => error);

describe('V1 business 401 migration notice', () => {
  it('verifies V2 auth, keeps the session, rejects the operation and never changes the URL', async () => {
    const before = window.location.href;
    adapter((config) => {
      expect(config.baseURL).toMatch(/\/v2$/);
      expect(config.headers.Authorization).toBe('Bearer migration-test-token');
      return { loggedIn: true };
    });
    const error = await business();
    expect(error).toBeInstanceOf(FeatureNotMigratedError);
    expect(error.message).toBe('功能未迁移成功');
    expect(checks).toBe(1);
    expect(getStoredAuthToken()).toBe('migration-test-token');
    expect(getFeatureMigrationNotice()).toBe(true);
    expect(window.location.href).toBe(before);
    expect(JSON.stringify(error)).not.toContain('migration-test-token');
  });
  it('verifies a cookie-mode business 401 even when a local token is present', async () => {
    setUseAuthHeader(false);
    apiClient.defaults.adapter = async (config) => {
      if (config.url === '/auth/checkauth') {
        checks++;
        expect(config.headers.Authorization).toBeUndefined();
        return response(config, { loggedIn: true });
      }
      expect(config.headers.Authorization).toBeUndefined();
      expect(config.withCredentials).toBe(true);
      throw denied(config);
    };
    expect(await business()).toBeInstanceOf(FeatureNotMigratedError);
    expect(checks).toBe(1);
    expect(getStoredAuthToken()).toBe('migration-test-token');
  });
  it('coalesces concurrent checks and shows one dialog for a whole burst, including after dismissal', async () => {
    let finish!: (value: object) => void;
    const wait = new Promise((resolve) => {
      finish = resolve;
    });
    adapter(() => wait);
    let opens = 0;
    const unsubscribe = subscribeFeatureMigrationNotice(() => {
      if (getFeatureMigrationNotice()) opens++;
    });
    const paths = ['/meta/channels', '/preferences/users/123', '/notifications/unread-count'];
    const requests = Array.from({ length: 24 }, (_, i) => business(paths[i % paths.length]));
    await vi.waitFor(() => expect(checks).toBe(1));
    finish({ loggedIn: true });
    expect(
      (await Promise.all(requests)).every((error) => error instanceof FeatureNotMigratedError),
    ).toBe(true);
    expect(opens).toBe(1);
    dismissFeatureMigrationNotice();
    await Promise.all(paths.map((path) => business(path)));
    expect(checks).toBe(1);
    expect(getFeatureMigrationNotice()).toBe(false);
    expect(opens).toBe(1);
    unsubscribe();
  });
  it('caches positive verification for exactly three minutes, not in localStorage', async () => {
    adapter();
    await business();
    now += 179999;
    await business('/meta/channels');
    expect(checks).toBe(1);
    now += 1;
    await business('/meta/channels');
    expect(checks).toBe(2);
    expect(Object.keys(localStorage).sort()).toEqual(['auth_token', 'use_auth_header']);
  });
  it('clears the cache immediately on account switch, including same-token ABA', async () => {
    adapter();
    await business();
    const old = captureAuthSession();
    invalidateAuthSession();
    setStoredAuthToken('migration-test-token');
    setUseAuthHeader(true);
    expect(captureAuthSession().generation).not.toBe(old.generation);
    await business();
    expect(checks).toBe(2);
    expect(getFeatureMigrationNotice()).toBe(true);
  });
  it('does not reuse Bearer verification for cookie mode or vice versa', async () => {
    adapter();
    await business();
    expect(checks).toBe(1);
    setUseAuthHeader(false);
    await business();
    expect(checks).toBe(2);
    setUseAuthHeader(true);
    await business();
    expect(checks).toBe(3);
  });
  it('a late cookie denial after switching to Bearer cannot clear the current session', async () => {
    let failCookie!: (error: unknown) => void;
    setUseAuthHeader(false);
    apiClient.defaults.adapter = async (config) => {
      if (config.url === '/auth/checkauth') {
        checks++;
        if (!config.headers.Authorization)
          return new Promise((_resolve, reject) => {
            failCookie = () => reject(denied(config));
          });
        return response(config, { loggedIn: true });
      }
      throw denied(config);
    };
    const cookieRequest = business();
    await vi.waitFor(() => expect(checks).toBe(1));
    setUseAuthHeader(true);
    expect(await business()).toBeInstanceOf(FeatureNotMigratedError);
    failCookie({});
    expect(await cookieRequest).toBeInstanceOf(AxiosError);
    expect(checks).toBe(2);
    expect(getStoredAuthToken()).toBe('migration-test-token');
  });
  it('rejects POST, PUT and DELETE once each without replaying an unsupported write', async () => {
    const writes: string[] = [];
    apiClient.defaults.adapter = async (config) => {
      if (config.url === '/auth/checkauth') {
        checks++;
        return response(config, { loggedIn: true });
      }
      writes.push(`${config.method} ${config.url}`);
      throw denied(config);
    };
    const results = await Promise.all(
      [
        apiClient.post('/booklist/save', { title: 'test' }),
        apiClient.put('/booklist/update/123', { title: 'test' }),
        apiClient.delete('/booklist/delete/123'),
      ].map((request) => request.catch((error) => error)),
    );
    expect(results.every((error) => error instanceof FeatureNotMigratedError)).toBe(true);
    expect(writes).toEqual([
      'post /booklist/save',
      'put /booklist/update/123',
      'delete /booklist/delete/123',
    ]);
    expect(checks).toBe(1);
    expect(getStoredAuthToken()).toBe('migration-test-token');
  });
  it('does not let a late old-account check clear, cache or show a notice for the new account', async () => {
    let finish!: (value: object) => void;
    adapter(
      () =>
        new Promise((resolve) => {
          finish = resolve;
        }),
    );
    const oldRequest = business();
    await vi.waitFor(() => expect(checks).toBe(1));
    invalidateAuthSession();
    setStoredAuthToken('new-token');
    setUseAuthHeader(true);
    finish({ loggedIn: true });
    expect(await oldRequest).toBeInstanceOf(AxiosError);
    expect(getFeatureMigrationNotice()).toBe(false);
    adapter();
    await business();
    expect(checks).toBe(2);
    expect(getStoredAuthToken()).toBe('new-token');
  });
  it.each(['401', 'false'])(
    'preserves genuine authentication failure (%s) without recursion or migration notice',
    async (kind) => {
      adapter((config) => {
        if (kind === '401') throw denied(config);
        return { loggedIn: false };
      });
      const error = await business();
      expect(error).toBeInstanceOf(AxiosError);
      expect(checks).toBe(1);
      expect(getStoredAuthToken()).toBe(null);
      expect(getFeatureMigrationNotice()).toBe(false);
    },
  );
  it.each([403, 429, 500, 503, 'network', 'malformed'])(
    'does not misclassify unavailable auth verification (%s), or cache its failure',
    async (status) => {
      adapter((config) => {
        if (status === 'malformed') return {};
        if (status === 'network') throw new Error('offline');
        throw denied(config, typeof status === 'number' ? status : 500);
      });
      expect(await business()).toBeInstanceOf(AuthVerificationUnavailableError);
      expect(getStoredAuthToken()).toBe('migration-test-token');
      expect(getFeatureMigrationNotice()).toBe(false);
      await business();
      expect(checks).toBe(2);
    },
  );
  it('a real auth-check failure clears the positive cache immediately', async () => {
    let valid = true;
    adapter((config) => {
      if (!valid) throw denied(config);
      return { loggedIn: true };
    });
    await business();
    valid = false;
    await apiClient.get('/auth/checkauth').catch(() => undefined);
    expect(getFeatureMigrationNotice()).toBe(true);
    dismissFeatureMigrationNotice();
    await business();
    expect(checks).toBe(3);
    expect(getStoredAuthToken()).toBe(null);
  });
  it('drops an earlier positive cache when a newer auth check becomes unavailable, without logging out', async () => {
    let available = true;
    adapter((config) => {
      if (!available) throw denied(config, 503);
      return { loggedIn: true };
    });
    await business();
    dismissFeatureMigrationNotice();
    available = false;
    await apiClient.get('/auth/checkauth').catch(() => undefined);
    expect(await business()).toBeInstanceOf(AuthVerificationUnavailableError);
    expect(checks).toBe(3);
    expect(getStoredAuthToken()).toBe('migration-test-token');
    expect(getFeatureMigrationNotice()).toBe(false);
  });
  it.each([400, 403, 404, 429, 500])('leaves a business %s untouched', async (status) => {
    let original: AxiosError | undefined;
    apiClient.defaults.adapter = async (config) => {
      original = denied(config, status);
      throw original;
    };
    expect(await business()).toBe(original);
    expect(checks).toBe(0);
    expect(getStoredAuthToken()).toBe('migration-test-token');
    expect(getFeatureMigrationNotice()).toBe(false);
  });
  it.each([
    { path: '/auth/logout' },
    { path: '/admin/security' },
    { path: '/tournament/create' },
    { path: '/me', baseURL: '/v2' },
    { path: '/search/', baseURL: 'https://other.example/v1' },
  ])('does not hide security, V2 or other-origin 401: $path $baseURL', async (config) => {
    apiClient.defaults.adapter = async (request) => {
      throw denied(request);
    };
    const error = await apiClient.get(config.path, config).catch((error) => error);
    expect(error).toBeInstanceOf(AxiosError);
    expect(checks).toBe(0);
    expect(getStoredAuthToken()).toBe(null);
    expect(getFeatureMigrationNotice()).toBe(false);
  });
  it('does not interpret an unauthenticated public request as an unsupported logged-in feature', async () => {
    adapter();
    const error = await apiClient.get('/public', { skipAuthHeader: true }).catch((error) => error);
    expect(error).toBeInstanceOf(AxiosError);
    expect(checks).toBe(0);
    expect(getFeatureMigrationNotice()).toBe(false);
  });
  it('does not cache a response authenticated with a different explicitly supplied token', async () => {
    adapter();
    await apiClient.get('/auth/checkauth', {
      skipAuthHeader: true,
      headers: { Authorization: 'Bearer old-explicit-token' },
    });
    expect(checks).toBe(1);
    await business();
    expect(checks).toBe(2);
    expect(getStoredAuthToken()).toBe('migration-test-token');
  });
  it('cross-tab account change clears the positive cache and closes an old notice', async () => {
    adapter();
    await business();
    expect(getFeatureMigrationNotice()).toBe(true);
    setStoredAuthToken('cross-tab-token');
    window.dispatchEvent(
      new StorageEvent('storage', {
        key: 'auth_token',
        oldValue: 'migration-test-token',
        newValue: 'cross-tab-token',
      }),
    );
    expect(getFeatureMigrationNotice()).toBe(false);
    await business();
    expect(checks).toBe(2);
  });
  it('leaves successful business requests untouched and does not recheck authentication', async () => {
    apiClient.defaults.adapter = async (config) => response(config, { saved: true });
    expect((await apiClient.post('/booklist/save')).data).toEqual({ saved: true });
    expect(checks).toBe(0);
    expect(getFeatureMigrationNotice()).toBe(false);
  });
});
