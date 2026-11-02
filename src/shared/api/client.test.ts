import { describe, expect, it, vi } from 'vitest';
import { apiClient, forumAuthBaseUrl, parseWithSafeSnowflakeIds } from './client';
import { getStoredAuthToken, setStoredAuthToken, setUseAuthHeader } from '@/shared/lib/authSession';

describe('parseWithSafeSnowflakeIds', () => {
  it('把超出 Number 精度的 ID 字段转成字符串', () => {
    const parsed = parseWithSafeSnowflakeIds('{"thread_id": 1400626067887718401}');
    expect(parsed).toEqual({ thread_id: '1400626067887718401' });
  });

  it('覆盖所有以 _id 结尾的字段以及裸 id', () => {
    const parsed = parseWithSafeSnowflakeIds(
      '{"tag_id": 1400626067887718402, "guild_id": 1400626067887718403, "id": 1400626067887718404}',
    );
    expect(parsed).toEqual({
      tag_id: '1400626067887718402',
      guild_id: '1400626067887718403',
      id: '1400626067887718404',
    });
  });

  it('对后端已经字符串化的 ID 是幂等的', () => {
    const parsed = parseWithSafeSnowflakeIds('{"thread_id": "1400626067887718401"}');
    expect(parsed).toEqual({ thread_id: '1400626067887718401' });
  });

  // 回归：此前的实现用 /: (\d{16,})/g 扫描整个响应文本，帖子正文里出现「冒号 + 16 位数字」
  // 就会在字符串值内部插入裸引号，JSON.parse 抛错后静默回退到原始文本，
  // 结果这一整个响应里的长 ID 全部丢失精度（末位被舍入）。
  it('正文中出现长数字时，不影响 ID 字段的修复', () => {
    const parsed = parseWithSafeSnowflakeIds(
      '{"thread_id": 1400626067887718401, "excerpt": "频道: 1400626067887718999 看这里"}',
    );
    expect(parsed).toEqual({
      thread_id: '1400626067887718401',
      excerpt: '频道: 1400626067887718999 看这里',
    });
  });

  it('不改动正常量级的数字', () => {
    const parsed = parseWithSafeSnowflakeIds('{"reply_count": 42, "view_count": 1234}');
    expect(parsed).toEqual({ reply_count: 42, view_count: 1234 });
  });

  it('非字符串输入原样返回', () => {
    const already = { thread_id: '1' };
    expect(parseWithSafeSnowflakeIds(already)).toBe(already);
  });

  it('非 JSON 错误响应原样交给 Axios 处理', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const response = 'Internal Server Error';
    expect(parseWithSafeSnowflakeIds(response)).toBe(response);
    expect(spy).not.toHaveBeenCalled();
    spy.mockRestore();
  });

  it('疑似 JSON 但格式损坏时保留原文并留下日志', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const response = '{"thread_id": 1400626067887718401';
    expect(parseWithSafeSnowflakeIds(response)).toBe(response);
    expect(spy).toHaveBeenCalledOnce();
    spy.mockRestore();
  });
});

describe('迟到的认证错误', () => {
  it('旧账号请求返回 401 时不会清除新账号的令牌', async () => {
    let rejectRequest!: (error: unknown) => void;
    const originalAdapter = apiClient.defaults.adapter;
    apiClient.defaults.adapter = (config) => new Promise((_resolve, reject) => {
      rejectRequest = () => reject({ response: { status: 401 }, config });
    });
    setStoredAuthToken('old-token');
    setUseAuthHeader(true);
    const request = apiClient.get('/private').catch((error) => error);
    await Promise.resolve();
    await Promise.resolve();
    setStoredAuthToken('new-token');
    rejectRequest({});
    await request;
    expect(getStoredAuthToken()).toBe('new-token');
    apiClient.defaults.adapter = originalAdapter;
    localStorage.clear();
  });
});

describe('feature-gated auth protocol', () => {
  it('selects V2 auth without changing V1 business API URLs', () => {
    expect(forumAuthBaseUrl('/api/v1', true)).toBe('/api/v2');
    expect(forumAuthBaseUrl('https://forum.example/v1/', true)).toBe('https://forum.example/v2');
    expect(forumAuthBaseUrl('/api/v1', false)).toBe('/api/v1');
  });
});
