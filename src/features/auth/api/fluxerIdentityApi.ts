import {
  captureAuthSession,
  isAuthSessionCurrent,
  type AuthSessionSnapshot,
} from '@/shared/lib/authSession';
import { fluxerRequest, getForumAuthConfig } from './fluxerAuthApi';

export interface FluxerLoginIdentity {
  username: string;
  login: string;
  session: AuthSessionSnapshot;
}

/** 原生登录名只能取自当前 Fluxer 会话，不能用 Forum 的 Discord 展示资料替代。 */
export async function getFluxerLoginIdentity(): Promise<FluxerLoginIdentity | null> {
  const session = captureAuthSession();
  if (!session.token?.startsWith('flx_')) return null;

  const assertCurrentSession = () => {
    if (!isAuthSessionCurrent(session)) {
      throw Object.assign(new Error('账号已切换，请重新操作'), { code: 'AUTH_SESSION_CHANGED' });
    }
  };

  const config = await getForumAuthConfig();
  assertCurrentSession();
  if (config.mode !== 'fluxer') return null;

  const data = await fluxerRequest<{
    username?: unknown;
    discriminator?: unknown;
  }>('/users/@me', undefined, session.token);
  assertCurrentSession();
  if (
    !data ||
    typeof data.username !== 'string' ||
    !/^[A-Za-z0-9_.]{1,32}$/.test(data.username) ||
    typeof data.discriminator !== 'string' ||
    !/^\d{4}$/.test(data.discriminator)
  ) {
    throw new Error('未能读取有效的 Fluxer 登录用户名');
  }

  return {
    username: data.username,
    // 0000 为唯一用户名模式；旧式账号保留编号，避免同名账号登录歧义。
    login: data.discriminator === '0000'
      ? data.username
      : `${data.username}#${data.discriminator}`,
    session,
  };
}
