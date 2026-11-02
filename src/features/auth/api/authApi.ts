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
    const config = await getForumAuthConfig();
    if (config.mode === 'fluxer') {
      setUseAuthHeader(true);
      return await tryFallbackToAuthHeader();
    }
    try {
      const response = await apiClient.get<AuthResponse>('/auth/checkauth', {
        skipAuthHeader: true,
      });

      if (response.data.loggedIn) {
        setUseAuthHeader(false);
        return response.data;
      }

      return await tryFallbackToAuthHeader();
    } catch (cookieError) {
      const token = getStoredAuthToken();
      if (!token) throw cookieError;
      return await tryFallbackToAuthHeader(token);
    }
  },

  logout: async (): Promise<void> => {
    const session = captureAuthSession();
    const logoutToken = session.token;
    try {
      const config = await getForumAuthConfig();
      if (!isAuthSessionCurrent(session)) return;
      if (config.mode === 'fluxer') {
        await apiClient.post('/auth/logout', {}, {
          headers: logoutToken ? { Authorization: `Bearer ${logoutToken}` } : {},
          skipAuthHeader: true,
        });
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
  if (response.data.loggedIn) {
    setUseAuthHeader(true);
    return response.data;
  }

  return { loggedIn: false };
}
