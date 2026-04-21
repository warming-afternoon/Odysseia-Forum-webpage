import axios from 'axios';
import { clearStoredAuthToken, getStoredAuthToken } from '@/shared/lib/authSession';

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
  // 【权宜之计/技术债】在 JSON 被解析为 JS 对象前，使用正则截获长数字 ID 并将其引号化
  // 核心动机：解决 JavaScript (64位双精度浮点数) 对 Discord Snowflake ID (64位整数) 的精度溢出问题。
  // 若不进行此预处理，ID 的末位会发生精度损失，导致前端去重、发贴定位及分页黑名单过滤完全失效。
  // 注意：此方案依赖于 JSON 格式中 ID 字段紧跟在冒号后面且当前未带引号的模式。待后端重构为全字符串 ID 后应移除。
  transformResponse: [
    (data) => {
      if (typeof data !== 'string') return data;
      try {
        // 匹配 JSON 字符串中值超过 16 位的数值（非科学计数法形式）
        // 正则解释：匹配冒号和空格后的 16 位以上数字，并捕获之。
        const fixedData = data.replace(/: (\d{16,})/g, ': "$1"');
        return JSON.parse(fixedData);
      } catch {
        // 解析异常时（如非 JSON 格式）回退到原生逻辑，避免阻塞
        return JSON.parse(data);
      }
    },
  ],
});

// 请求拦截器
apiClient.interceptors.request.use((config) => {
  const token = getStoredAuthToken();
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
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
