import { apiClient } from '@/shared/api/client';
import {
  clearStoredAuthToken,
  getStoredAuthToken,
  setUseAuthHeader,
} from '@/shared/lib/authSession';

export interface User {
  id: string;
  username: string;
  global_name?: string;
  avatar?: string;
}

export interface AuthResponse {
  loggedIn: boolean;
  user?: User;
  // 当前用户关注列表的未读更新数量（来自 /auth/checkauth）
  unread_count?: number;
}

export const authApi = {
  checkAuth: async (): Promise<AuthResponse> => {
    try {
      const response = await apiClient.get<AuthResponse>('/auth/checkauth', {
        skipAuthHeader: true,
      });

      if (response.data.loggedIn) {
        setUseAuthHeader(false);
        return response.data;
      }

      return await tryFallbackToAuthHeader();
    } catch {
      return await tryFallbackToAuthHeader();
    }
  },

  logout: async (): Promise<void> => {
    await apiClient.get('/auth/logout');
    clearStoredAuthToken();
    setUseAuthHeader(false);
  },
};

async function tryFallbackToAuthHeader(): Promise<AuthResponse> {
  const token = getStoredAuthToken();
  if (!token) return { loggedIn: false };

  try {
    const response = await apiClient.get<AuthResponse>('/auth/checkauth', {
      headers: { Authorization: `Bearer ${token}` },
      skipAuthHeader: true,
    });
    if (response.data.loggedIn) {
      setUseAuthHeader(true);
      return response.data;
    }
  } catch {
    // 两种方式都失败了
  }

  return { loggedIn: false };
}
