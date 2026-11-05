import { getForumAuthConfig } from './fluxerAuthApi';
import { apiClient } from '@/shared/api/client';
import type { User } from '@/entities/user/types';
import {
  getStoredAuthToken,
  captureAuthSession,
  isAuthSessionCurrent,
  invalidateAuthSession,
  setUseAuthHeader,
} from '@/shared/lib/authSession';

export interface AuthResponse {
  loggedIn: boolean;
  user?: User;
  // 当前用户关注列表的未读更新数量（来自 /auth/checkauth）
  unread_count?: number;
}

export const authApi = {
  checkAuth: async (): Promise<AuthResponse> => {
    const session = captureAuthSession();
    try {
      const result = await checkAuthWithFallback();
      if (result.loggedIn === false && session.token && isAuthSessionCurrent(session))
        invalidateAuthSession();
      return result;
    } catch (error) {
      if (
        (error as { response?: { status?: number } })?.response?.status === 401 &&
        session.token &&
        isAuthSessionCurrent(session)
      )
        invalidateAuthSession();
      throw error;
    }
  },

  logout: async (): Promise<void> => {
    const session = captureAuthSession();
    const logoutToken = session.token;
    try {
      const config = await getForumAuthConfig();
      if (!isAuthSessionCurrent(session)) return;
      if (config.mode === 'fluxer') {
        await apiClient.post(
          '/auth/logout',
          {},
          {
            headers: logoutToken ? { Authorization: `Bearer ${logoutToken}` } : {},
            skipAuthHeader: true,
          },
        );
        return;
      }
      await apiClient.get('/auth/logout', {
        // 当前后端会 302 到前端 HTML；登出已成功，不能再交给全局 JSON 解析器。
        transformResponse: (data) => data,
        headers: logoutToken ? { Authorization: `Bearer ${logoutToken}` } : {},
        skipAuthHeader: true,
      });
    } finally {
      if (isAuthSessionCurrent(session)) invalidateAuthSession();
    }
  },
};

async function tryFallbackToAuthHeader(storedToken?: string): Promise<AuthResponse> {
  const token = storedToken || getStoredAuthToken();
  if (!token) return { loggedIn: false };

  const response = await apiClient.get<AuthResponse>('/auth/checkauth', {
    headers: { Authorization: `Bearer ${token}` },
    skipAuthHeader: true,
  });
  const result = checkedAuthResponse(response.data);
  if (result.loggedIn) {
    setUseAuthHeader(true);
    return result;
  }

  return { loggedIn: false };
}

async function checkAuthWithFallback(): Promise<AuthResponse> {
  const config = await getForumAuthConfig();
  if (config.mode === 'fluxer') {
    setUseAuthHeader(true);
    return await tryFallbackToAuthHeader();
  }
  try {
    const response = await apiClient.get<AuthResponse>('/auth/checkauth', {
      skipAuthHeader: true,
    });

    const result = checkedAuthResponse(response.data);
    if (result.loggedIn) {
      setUseAuthHeader(false);
      return result;
    }

    return await tryFallbackToAuthHeader();
  } catch (cookieError) {
    if (cookieError instanceof InvalidAuthResponseError) throw cookieError;
    const token = getStoredAuthToken();
    if (!token) throw cookieError;
    return await tryFallbackToAuthHeader(token);
  }
}

class InvalidAuthResponseError extends Error {
  constructor() {
    super('登录状态响应无效，请稍后重试');
    this.name = 'InvalidAuthResponseError';
  }
}
function checkedAuthResponse(data: unknown): AuthResponse {
  if (!data || typeof data !== 'object' || typeof (data as AuthResponse).loggedIn !== 'boolean')
    throw new InvalidAuthResponseError();
  return data as AuthResponse;
}
