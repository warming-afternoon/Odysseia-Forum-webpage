import axios from 'axios';
import { clearStoredAuthToken, getStoredAuthToken, isUsingAuthHeader } from '@/shared/lib/authSession';

const DEFAULT_API_URL = 'http://localhost:10810/v1';
const API_URL = import.meta.env.VITE_API_URL || DEFAULT_API_URL;

// 在生产环境下如果未配置 VITE_API_URL，则给出警告，避免悄悄回退到本地地址
if (!import.meta.env.VITE_API_URL && import.meta.env.MODE === 'production') {
  console.warn('[API] VITE_API_URL is not set in production; falling back to default URL:', DEFAULT_API_URL);
}

export const apiClient = axios.create({
  baseURL: API_URL,
  timeout: 10000,
  withCredentials: true,
  // 【状态更新：2026-04-21】后端已开始逐步将 Snowflake ID 转换为原生字符串（如 thread_id, guild_id）。
  // 核心动机：彻底解决 JavaScript 精度导致的 ID 损坏问题。
  // 注意：虽然核心 ID 已转为 string，但部分字段（如 tag_id）经实测仍为 int，
  // 因此本拦截器暂需保留。由于正则 `/: (\d{16,})/g` 仅匹配冒号后紧跟数字的模式，
  // 对于后端已经返回引号化的 `"thread_id": "..."` 是幂等的（不会重复处理），非常安全。
  transformResponse: [
    (data) => {
      if (typeof data !== 'string') return data;
      try {
        // 匹配并修复尚未被后端字符串化的 16 位以上长数字
        const fixedData = data.replace(/: (\d{16,})/g, ': "$1"');
        return JSON.parse(fixedData);
      } catch {
        return JSON.parse(data);
      }
    },
  ],
});

// 请求拦截器：当检测到跨域 cookie 被拦截时，回退到 Authorization header
apiClient.interceptors.request.use((config) => {
  if (isUsingAuthHeader() && !config.skipAuthHeader) {
    const token = getStoredAuthToken();
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
  }
  return config;
});

// 响应拦截器
apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    // 只在非认证检查的请求中处理401
    // 认证检查接口应该由组件自己处理
    if (error.response?.status === 401 && !error.config.url?.includes('/auth/checkauth')) {
      clearStoredAuthToken();
      // 不要直接跳转，让ProtectedRoute处理
      // window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);
