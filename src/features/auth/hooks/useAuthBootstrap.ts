import { useEffect, useRef, useState } from 'react';
import type { QueryClient } from '@tanstack/react-query';
import { claimLoginCode, getForumAuthConfig, hasLoginCode } from '../api/fluxerAuthApi';
import { authApi } from '../api/authApi';
import {
  captureAuthSession,
  consumeAuthTokenFromHash,
  hasAuthTokenInHash,
  isAuthSessionCurrent,
} from '@/shared/lib/authSession';

/** 固定初始回跳类型，StrictMode 重放时仍等待同一个领取请求。 */
export function useAuthBootstrap(queryClient: QueryClient) {
  const [kind] = useState(() =>
    hasLoginCode() ? 'claim' : hasAuthTokenInHash() ? 'legacy' : 'none',
  );
  const [pending, setPending] = useState(kind !== 'none');
  const [verificationFailed, setVerificationFailed] = useState(false);
  const credentials = useRef<Promise<unknown> | null>(null);

  useEffect(() => {
    if (!pending) return;
    let active = true;
    credentials.current ??= kind === 'claim'
      ? claimLoginCode()
      : getForumAuthConfig()
          .then((config) => {
            if (config.mode === 'fluxer') {
              window.history.replaceState(null, '', window.location.pathname + window.location.search);
              throw new Error('原生会话必须通过一次性凭证领取');
            }
            return consumeAuthTokenFromHash();
          });
    const refresh = async () => {
      try {
        await credentials.current;
      } catch (error) {
        if (!active) return;
        if ((error as { code?: string })?.code !== 'AUTH_SESSION_CHANGED') {
          window.history.replaceState(null, '', '/login?error=登录凭证已失效，请重新登录');
        }
        setPending(false);
        return;
      }
      if (!active) return;
      const session = captureAuthSession();
      try {
        await queryClient.cancelQueries({ queryKey: ['auth'] });
        if (!active) return;
        if (!isAuthSessionCurrent(session)) {
          setVerificationFailed(true);
          return;
        }
        // 路由尚未挂载，没有活跃订阅；仅 invalidate 不会请求新的登录状态。
        const result = await authApi.checkAuth();
        if (!active) return;
        if (isAuthSessionCurrent(session)) {
          queryClient.setQueryData(['auth'], result);
        } else if (result.loggedIn || captureAuthSession().token) {
          // 账号切换期间返回的旧用户信息不能进入新会话的缓存。
          setVerificationFailed(true);
        }
      } catch (error) {
        if (!active) return;
        const status = (error as { response?: { status?: number } })?.response?.status;
        if (status !== 401 || isAuthSessionCurrent(session) || captureAuthSession().token) {
          setVerificationFailed(true);
        }
      } finally {
        if (active) setPending(false);
      }
    };
    void refresh();
    return () => { active = false; };
  }, [kind, pending, queryClient]);

  return {
    pending,
    verificationFailed,
    retry: () => {
      setVerificationFailed(false);
      setPending(true);
    },
  };
}
