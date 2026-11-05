import { worksV2Enabled } from '@/shared/config/works';
import axios, { type InternalAxiosRequestConfig } from 'axios';
import { AuthVerificationUnavailableError, FeatureNotMigratedError } from './featureMigration';
import { showFeatureMigrationNotice } from '@/shared/lib/featureMigrationNotice';
import {
  captureAuthSession,
  getStoredAuthToken,
  invalidateAuthSession,
  isAuthSessionCurrent,
  isUsingAuthHeader,
  subscribeAuthInvalidation,
  type AuthSessionSnapshot,
} from '@/shared/lib/authSession';

const DEFAULT_API_URL = 'http://localhost:10810/v1';
const API_URL = import.meta.env.VITE_API_URL || DEFAULT_API_URL;

// 在生产环境下如果未配置 VITE_API_URL，则给出警告，避免悄悄回退到本地地址
if (!import.meta.env.VITE_API_URL && import.meta.env.MODE === 'production') {
  console.warn(
    '[API] VITE_API_URL is not set in production; falling back to default URL:',
    DEFAULT_API_URL,
  );
}

// 【状态更新：2026-04-21】后端已开始逐步将 Snowflake ID 转换为原生字符串（如 thread_id, guild_id）。
// 核心动机：彻底解决 JavaScript 精度导致的 ID 损坏问题。
// 虽然核心 ID 已转为 string，但部分字段（如 tag_id）经实测仍为 int，因此仍需在解析前修复。
//
// 只匹配「以 _id 结尾或名为 id 的键 + 16 位以上数字」。此前的 `/: (\d{16,})/g` 作用于整个
// 响应文本、不看键名，帖子正文里出现 `": 1234567890123456"` 就会在字符串值内部插入裸引号，
// 导致 JSON.parse 抛错后静默回退——那条路径下所有长 ID 都未被字符串化，精度已损坏且无任何日志。
//
// 对后端已引号化的 `"thread_id": "..."` 幂等（冒号后是引号而非数字，不匹配）。
// 数组元素（如 `"ids": [123..., 456...]`）不在覆盖范围内，与修改前的行为一致。
const LONG_ID_ENTRY = /"([A-Za-z_][A-Za-z0-9_]*_id|id)"(\s*:\s*)(\d{16,})/g;

export const parseWithSafeSnowflakeIds = (data: unknown) => {
  if (typeof data !== 'string') return data;
  const normalized = data.replace(LONG_ID_ENTRY, '"$1"$2"$3"');
  try {
    return JSON.parse(normalized);
  } catch (error) {
    // Axios 的响应转换也会经过 4xx/5xx 响应。纯文本错误页不是 JSON，
    // 应保留原始响应交给 Axios 按 HTTP 状态拒绝，不能在这里用二次 JSON.parse 覆盖真实错误。
    const firstCharacter = data.trimStart()[0];
    if (firstCharacter === '{' || firstCharacter === '[') {
      console.error('[API] Snowflake ID 预处理后 JSON 解析失败，已保留原始响应', error);
    }
    return data;
  }
};

export function forumAuthBaseUrl(v1Url: string, useV2: boolean): string {
  return useV2 ? v1Url.replace(/\/v1\/?$/, '/v2') : v1Url;
}

export const apiClient = axios.create({
  baseURL: API_URL,
  timeout: 10000,
  withCredentials: true,
  transformResponse: [parseWithSafeSnowflakeIds],
});

// 请求拦截器：当检测到跨域 cookie 被拦截时，回退到 Authorization header
const requestSessions = new WeakMap<object, AuthSessionSnapshot>();
const requestHeaderPreferences = new WeakMap<object, boolean>();
apiClient.interceptors.request.use((config) => {
  const session = captureAuthSession();
  requestSessions.set(config, session);
  requestHeaderPreferences.set(config, isUsingAuthHeader());
  if (config.url?.startsWith('/auth/')) config.baseURL = forumAuthBaseUrl(API_URL, worksV2Enabled);
  if (isUsingAuthHeader() && !config.skipAuthHeader) {
    const token = session.token;
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
  }
  return config;
});

type Verification = 'valid' | 'invalid' | 'unavailable';
type CredentialMode = 'bearer' | 'cookie';
const VERIFIED_SESSION_TTL_MS = 3 * 60 * 1000;
let verifiedSession:
  | {
      session: AuthSessionSnapshot;
      mode: CredentialMode;
      headerPreference: boolean;
      expiresAt: number;
    }
  | undefined;
subscribeAuthInvalidation(() => {
  verifiedSession = undefined;
});
const sameSession = (a: AuthSessionSnapshot, b: AuthSessionSnapshot) =>
  a.generation === b.generation && a.token === b.token;
const isAuthCheckRequest = (config: InternalAxiosRequestConfig) =>
  config.url?.split(/[?#]/, 1)[0] === '/auth/checkauth';
const credentialMode = (
  config: InternalAxiosRequestConfig,
  session: AuthSessionSnapshot,
): CredentialMode | null => {
  if (config.headers.Authorization)
    return session.token && config.headers.Authorization === `Bearer ${session.token}`
      ? 'bearer'
      : null;
  return config.withCredentials !== false ? 'cookie' : null;
};
const isRequestAuthCurrent = (config: InternalAxiosRequestConfig, session: AuthSessionSnapshot) =>
  isAuthSessionCurrent(session) && requestHeaderPreferences.get(config) === isUsingAuthHeader();
let pendingVerification:
  | {
      session: AuthSessionSnapshot;
      mode: CredentialMode;
      headerPreference: boolean;
      promise: Promise<Verification>;
    }
  | undefined;

function legacyBusinessPath(config: InternalAxiosRequestConfig): string | null {
  if (!worksV2Enabled) return null;
  try {
    const base = new URL(API_URL, window.location.href);
    const prefix = base.pathname.replace(/\/$/, '');
    const target = new URL(apiClient.getUri(config), window.location.href);
    if (
      !prefix.endsWith('/v1') ||
      target.origin !== base.origin ||
      !target.pathname.startsWith(`${prefix}/`)
    )
      return null;
    const path = target.pathname.slice(prefix.length);
    return /^\/(?:preferences|meta|search|authors|author-follows|follows|notifications|banner|collection|booklist|tags|discovery|fetch-images)(?:\/|$)/.test(
      path,
    )
      ? path
      : null;
  } catch {
    return null;
  }
}

function verifyCurrentSession(
  session: AuthSessionSnapshot,
  mode: CredentialMode,
  headerPreference: boolean,
): Promise<Verification> {
  if (
    verifiedSession &&
    sameSession(verifiedSession.session, session) &&
    verifiedSession.mode === mode &&
    verifiedSession.headerPreference === headerPreference &&
    performance.now() < verifiedSession.expiresAt
  ) {
    return Promise.resolve('valid');
  }
  if (
    pendingVerification &&
    sameSession(pendingVerification.session, session) &&
    pendingVerification.mode === mode &&
    pendingVerification.headerPreference === headerPreference
  ) {
    return pendingVerification.promise;
  }
  // This auth route is excluded from the business branch, preventing recursion.
  const promise: Promise<Verification> = apiClient
    .get('/auth/checkauth', {
      skipAuthHeader: true,
      headers:
        mode === 'bearer' && session.token ? { Authorization: `Bearer ${session.token}` } : {},
    })
    .then(
      ({ data }) =>
        data?.loggedIn === true ? 'valid' : data?.loggedIn === false ? 'invalid' : 'unavailable',
      (error) => (error.response?.status === 401 ? 'invalid' : 'unavailable'),
    );
  const pending = { session, mode, headerPreference, promise };
  pendingVerification = pending;
  void promise.finally(() => {
    if (pendingVerification === pending) pendingVerification = undefined;
  });
  return promise;
}

// 响应拦截器
apiClient.interceptors.response.use(
  (response) => {
    const session = requestSessions.get(response.config);
    const mode = session && credentialMode(response.config, session);
    if (
      isAuthCheckRequest(response.config) &&
      session &&
      mode &&
      isRequestAuthCurrent(response.config, session)
    ) {
      if (response.data?.loggedIn === true) {
        verifiedSession = {
          session,
          mode,
          headerPreference: isUsingAuthHeader(),
          expiresAt: performance.now() + VERIFIED_SESSION_TTL_MS,
        };
      } else {
        verifiedSession = undefined;
      }
    }
    return response;
  },
  async (error) => {
    // 只在非认证检查的请求中处理401
    // 认证检查接口应该由组件自己处理
    const session = error.config && requestSessions.get(error.config);
    if (
      error.config &&
      isAuthCheckRequest(error.config) &&
      session &&
      isRequestAuthCurrent(error.config, session) &&
      credentialMode(error.config, session)
    )
      verifiedSession = undefined;
    if (
      error.response?.status === 401 &&
      !error.config?.url?.includes('/auth/checkauth') &&
      session &&
      isRequestAuthCurrent(error.config, session)
    ) {
      const currentToken = getStoredAuthToken();
      const requestAuthorization = error.config?.headers?.Authorization;
      // A cookie request can coexist with a stored token; it still needs V2 verification.
      const currentBearer = currentToken && requestAuthorization === `Bearer ${currentToken}`;
      const cookieRequest =
        !requestAuthorization &&
        !error.config.skipAuthHeader &&
        error.config.withCredentials !== false;
      const path = legacyBusinessPath(error.config);
      if (path && (currentBearer || cookieRequest)) {
        const verification = await verifyCurrentSession(
          session,
          currentBearer ? 'bearer' : 'cookie',
          isUsingAuthHeader(),
        );
        if (!isRequestAuthCurrent(error.config, session)) return Promise.reject(error);
        if (verification === 'valid') {
          showFeatureMigrationNotice(session, path);
          return Promise.reject(new FeatureNotMigratedError());
        }
        if (verification === 'unavailable')
          return Promise.reject(new AuthVerificationUnavailableError());
        invalidateAuthSession();
      } else if (!currentToken || currentBearer) {
        // 旧账号的迟到响应不能注销已经切换到的新账号。
        invalidateAuthSession();
      }
    }
    return Promise.reject(error);
  },
);
