import { apiClient } from '@/shared/api/client';
import {
  captureAuthSession,
  getStoredAuthToken,
  invalidateAuthSession,
  isAuthSessionCurrent,
  setStoredAuthToken,
  setUseAuthHeader,
  subscribeAuthInvalidation,
  type AuthSessionSnapshot,
} from '@/shared/lib/authSession';
import type { User } from '@/entities/user/types';

export interface ForumAuthConfig {
  mode: 'legacy' | 'fluxer';
  fluxer_api_url: string | null;
}

export interface FluxerLoginResult {
  token?: string;
  user_id?: string;
  mfa?: boolean;
  ticket?: string;
  totp?: boolean;
  webauthn?: boolean;
  backup_codes?: boolean;
}

interface SessionClaimResponse {
  token: string;
  user: User;
  password_setup_proof?: string;
  proof_expires_in?: number;
}

let configPromise: Promise<ForumAuthConfig> | undefined;
let claimPromise: Promise<void> | undefined;
let passwordProof: {
  proof: string;
  expires: number;
  session: AuthSessionSnapshot;
} | undefined;

subscribeAuthInvalidation(() => {
  passwordProof = undefined;
});

/** 读取后端切换状态，旧部署仅在配置接口不存在时继续使用旧鉴权。 */
export function getForumAuthConfig(): Promise<ForumAuthConfig> {
  configPromise ??= apiClient
    .get<ForumAuthConfig>('/auth/config', { skipAuthHeader: true })
    .then(({ data }) => {
      if (data.mode !== 'legacy' && data.mode !== 'fluxer') {
        throw new Error('登录配置无效');
      }
      if (data.mode === 'fluxer') {
        const url = new URL(data.fluxer_api_url || '');
        if (
          url.username ||
          url.password ||
          url.search ||
          url.hash ||
          (url.protocol !== 'https:' && !(
            url.protocol === 'http:' &&
            ['localhost', '127.0.0.1'].includes(url.hostname)
          ))
        ) {
          throw new Error('登录服务地址无效');
        }
      }
      return data;
    })
    .catch((error: { response?: { status?: number } }) => {
      configPromise = undefined;
      if (error.response?.status === 404) {
        return { mode: 'legacy' as const, fluxer_api_url: null };
      }
      throw error;
    });
  return configPromise;
}

/** 保存经过登录服务签发的原生会话，并清除旧账号的查询状态。 */
export function acceptFluxerToken(token: string, expectedSession?: AuthSessionSnapshot): void {
  if (expectedSession && !isAuthSessionCurrent(expectedSession)) {
    throw Object.assign(new Error('账号已切换，请重新操作'), { code: 'AUTH_SESSION_CHANGED' });
  }
  if (!/^flx_[A-Za-z0-9]{36}$/.test(token)) {
    throw new Error('登录服务返回了无效会话');
  }
  invalidateAuthSession();
  setStoredAuthToken(token);
  if (getStoredAuthToken() !== token) {
    throw new Error('无法保存登录会话，请检查浏览器存储设置');
  }
  setUseAuthHeader(true);
}

/** 检查回跳是否携带待领取的一次性凭证。 */
export function hasLoginCode(): boolean {
  return (
    new URLSearchParams(window.location.hash.slice(1)).has('login_code') ||
    new URLSearchParams(window.location.search).has('login_code')
  );
}

/** 一次性领取回跳凭证；同页并发调用共享请求，长期凭证不出现在 URL。 */
export function claimLoginCode(): Promise<void> {
  if (claimPromise) return claimPromise;
  const query = new URLSearchParams(window.location.search);
  const hash = new URLSearchParams(window.location.hash.slice(1));
  const code = hash.get('login_code') || query.get('login_code');
  if (!code) return Promise.resolve();

  query.delete('login_code');
  hash.delete('login_code');
  window.history.replaceState(
    null,
    '',
    `${window.location.pathname}${query.size ? `?${query}` : ''}${hash.size ? `#${hash}` : ''}`,
  );
  const initialSession = captureAuthSession();
  claimPromise = apiClient.post<SessionClaimResponse>(
    '/auth/session/claim',
    { login_code: code },
    { skipAuthHeader: true },
  ).then(({ data }) => {
    acceptFluxerToken(data.token, initialSession);
    passwordProof = data.password_setup_proof
      ? {
          proof: data.password_setup_proof,
          expires: Date.now() + Math.min(data.proof_expires_in ?? 120, 120) * 1000,
          session: captureAuthSession(),
        }
      : undefined;
  });
  return claimPromise;
}

/** 在当前页面内使用短期能力，既不写入 URL，也不长期持久化。 */
export function getPasswordSetupProof(): string | null {
  return passwordProof &&
    passwordProof.expires > Date.now() &&
    isAuthSessionCurrent(passwordProof.session)
    ? passwordProof.proof
    : null;
}

/** 只向后端指定的 Fluxer API 发送原生登录或账号请求。 */
export async function fluxerRequest<T>(path: string, body?: unknown, token?: string): Promise<T> {
  const config = await getForumAuthConfig();
  if (
    config.mode !== 'fluxer' ||
    !config.fluxer_api_url ||
    !path.startsWith('/') ||
    path.startsWith('//')
  ) {
    throw new Error('Fluxer 登录尚未启用');
  }
  const url = `${config.fluxer_api_url.replace(/\/$/, '')}${path}`;
  const send = (captcha?: string) => fetch(url, {
    method: body === undefined ? 'GET' : 'POST',
    credentials: 'omit',
    redirect: 'error',
    signal: AbortSignal.timeout(20000),
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(captcha ? { 'X-Captcha-Token': captcha } : {}),
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
  let response = await send();
  let data = await response.json();
  if (!response.ok && data.captcha_provider === 'altcha' && data.altcha_challenge) {
    const { solveFluxerCaptcha } = await import('../lib/fluxerCaptcha');
    const solution = await solveFluxerCaptcha(data.altcha_challenge);
    response = await send(solution);
    data = await response.json();
  }
  if (!response.ok) {
    throw Object.assign(new Error(data.message || '登录请求失败，请稍后重试'), {
      data,
      status: response.status,
    });
  }
  return data as T;
}
