import { useEffect, useState } from 'react';
import type { QueryClient } from '@tanstack/react-query';
import { claimLoginCode, getForumAuthConfig, hasLoginCode } from '../api/fluxerAuthApi';
import { consumeAuthTokenFromHash, hasAuthTokenInHash } from '@/shared/lib/authSession';

/** 固定初始回跳类型，StrictMode 重放时仍等待同一个领取请求。 */
export function useAuthBootstrap(queryClient: QueryClient): boolean {
  const [kind] = useState(() =>
    hasLoginCode() ? 'claim' : hasAuthTokenInHash() ? 'legacy' : 'none',
  );
  const [pending, setPending] = useState(kind !== 'none');

  useEffect(() => {
    if (!pending) return;
    const refresh = kind === 'claim'
      ? claimLoginCode().then(() => queryClient.invalidateQueries({ queryKey: ['auth'] }))
      : getForumAuthConfig()
          .then((config) => {
            if (config.mode === 'fluxer') {
              window.history.replaceState(null, '', window.location.pathname + window.location.search);
              throw new Error('原生会话必须通过一次性凭证领取');
            }
            return consumeAuthTokenFromHash();
          })
          .then(() => queryClient.invalidateQueries({ queryKey: ['auth'] }));
    void refresh
      .catch((error: { code?: string }) => {
        if (error?.code !== 'AUTH_SESSION_CHANGED') {
          window.history.replaceState(null, '', '/login?error=登录凭证已失效，请重新登录');
        }
      })
      .finally(() => setPending(false));
  }, [kind, pending, queryClient]);

  return pending;
}
