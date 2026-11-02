import { beforeEach, describe, expect, it, vi } from 'vitest';
import { authApi } from './authApi';
import { getForumAuthConfig, type ForumAuthConfig } from './fluxerAuthApi';
import { apiClient } from '@/shared/api/client';
import { getStoredAuthToken, invalidateAuthSession, setStoredAuthToken } from '@/shared/lib/authSession';
vi.mock('./fluxerAuthApi',()=>({getForumAuthConfig:vi.fn()}));
vi.mock('@/shared/api/client',()=>({apiClient:{get:vi.fn(),post:vi.fn()}}));
const token=(letter:string)=>'flx_'+letter.repeat(36);
beforeEach(()=>{vi.clearAllMocks();invalidateAuthSession();vi.mocked(apiClient.get).mockResolvedValue({data:{}});vi.mocked(apiClient.post).mockResolvedValue({data:{}});});
for(const mode of ['legacy','fluxer'] as const)describe(`${mode}退出的会话快照`,()=>{
 it('等待配置期间切换账号则不发送退出请求，也不清B',async()=>{
  let complete!:(value:ForumAuthConfig)=>void;vi.mocked(getForumAuthConfig).mockImplementation(()=>new Promise(resolve=>{complete=resolve;}));
  setStoredAuthToken(token('A'));const pending=authApi.logout();invalidateAuthSession();setStoredAuthToken(token('B'));complete({mode,fluxer_api_url:mode==='fluxer'?'https://native.invalid':null});await pending;
  expect(apiClient.get).not.toHaveBeenCalled();expect(apiClient.post).not.toHaveBeenCalled();expect(getStoredAuthToken()).toBe(token('B'));
 });
 it('同token新generation也不能被旧退出清除，正常退出仍工作',async()=>{
  vi.mocked(getForumAuthConfig).mockResolvedValue({mode,fluxer_api_url:mode==='fluxer'?'https://native.invalid':null});
  let complete!:(value:unknown)=>void;const transport=mode==='legacy'?vi.mocked(apiClient.get):vi.mocked(apiClient.post);transport.mockImplementationOnce(()=>new Promise(resolve=>{complete=resolve;}));
  setStoredAuthToken(token('A'));const pending=authApi.logout();await vi.waitFor(()=>expect(transport).toHaveBeenCalledTimes(1));invalidateAuthSession();setStoredAuthToken(token('A'));complete({data:{}});await pending;expect(getStoredAuthToken()).toBe(token('A'));
  await authApi.logout();expect(getStoredAuthToken()).toBeNull();
 });
});
