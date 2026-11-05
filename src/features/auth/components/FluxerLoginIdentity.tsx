import { useId, useSyncExternalStore } from 'react';
import { useQuery } from '@tanstack/react-query';
import { getFluxerLoginIdentity } from '../api/fluxerIdentityApi';
import {
  captureAuthSession,
  isAuthSessionCurrent,
  subscribeAuthInvalidation,
} from '@/shared/lib/authSession';

const getSessionGeneration = () => captureAuthSession().generation;

/** 首次密码设置与「我的」页共用；会话变化时不显示旧账号资料。 */
export function FluxerLoginIdentity() {
  const inputId = useId();
  const generation = useSyncExternalStore(subscribeAuthInvalidation, getSessionGeneration);
  const enabled = Boolean(captureAuthSession().token?.startsWith('flx_'));
  const identity = useQuery({
    queryKey: ['fluxer-login-identity', generation],
    queryFn: getFluxerLoginIdentity,
    enabled,
    retry: false,
    staleTime: 0,
    gcTime: 0,
  });

  if (!enabled || identity.data === null) return null;
  const current =
    identity.data && isAuthSessionCurrent(identity.data.session) ? identity.data : undefined;

  return (
    <div className="my-4 rounded-lg border border-(--od-border) p-3 text-sm">
      <label htmlFor={inputId} className="block font-medium">
        Fluxer 登录用户名
      </label>
      {identity.isError ? (
        <div role="alert" className="mt-2">
          <p>暂时无法读取 Fluxer 用户名。请重试，也可以继续通过 Discord 登录。</p>
          <button
            type="button"
            disabled={identity.isFetching}
            onClick={() => void identity.refetch()}
            className="mt-2 underline"
          >
            {identity.isFetching ? '正在重试…' : '重新读取用户名'}
          </button>
        </div>
      ) : !current || identity.isFetching ? (
        <p role="status" className="mt-2">
          正在读取 Fluxer 用户名…
        </p>
      ) : (
        <>
          <input
            id={inputId}
            type="text"
            autoComplete="username"
            readOnly
            value={current.login}
            className="mt-2 w-full rounded border p-2 font-mono"
          />
          <p className="mt-2 text-(--od-text-secondary)">
            使用此用户名和已设置的密码登录；它可能与 Discord 昵称或用户名不同。
          </p>
        </>
      )}
    </div>
  );
}
