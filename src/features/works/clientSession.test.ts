import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { AxiosAdapter, AxiosInstance, InternalAxiosRequestConfig } from 'axios';
import { worksClient } from './api';
import { nativeClient } from './nativeApi';
import { getForumAuthConfig } from '@/features/auth/api/fluxerAuthApi';
import { getStoredAuthToken, invalidateAuthSession, setStoredAuthToken, subscribeAuthInvalidation } from '@/shared/lib/authSession';

vi.mock('@/features/auth/api/fluxerAuthApi', () => ({getForumAuthConfig:vi.fn()}));
const token=(letter:string)=>'flx_'+letter.repeat(36);
function deferred<T>() {
  let resolve!: (value:T)=>void;
  const promise=new Promise<T>(complete=>{resolve=complete;});
  return {promise,resolve};
}
function request(client:AxiosInstance) {
  const ready=deferred<InternalAxiosRequestConfig>();
  let reject!: (reason:unknown)=>void;
  const adapter:AxiosAdapter=config=>new Promise((_resolve,fail)=>{reject=fail;ready.resolve(config);});
  const pending=client.get('/fake',{adapter});
  return {ready:ready.promise,pending,fail:(config:InternalAxiosRequestConfig,status?:number)=>reject(Object.assign(new Error('fake request failure'),{config,...(status===undefined?{}:{response:{status}})}))};
}
beforeEach(()=>{
  vi.clearAllMocks();invalidateAuthSession();
  vi.mocked(getForumAuthConfig).mockResolvedValue({mode:'fluxer',fluxer_api_url:'https://native.invalid/api/v1'});
});
for(const [name,client] of [['作品',worksClient],['原生',nativeClient]] as const) {
  describe(`${name}请求会话失效`,()=>{
    it('当前认证请求401清理共享会话并通知缓存订阅者',async()=>{
      setStoredAuthToken(token('A'));const listener=vi.fn(),unsubscribe=subscribeAuthInvalidation(listener);
      try {const item=request(client),config=await item.ready;item.fail(config,401);await expect(item.pending).rejects.toThrow();expect(getStoredAuthToken()).toBeNull();expect(listener).toHaveBeenCalledTimes(1);} finally {unsubscribe();}
    });
    it('旧A请求的401不能清掉B或同token的新generation',async()=>{
      for(const replacement of ['B','A']){setStoredAuthToken(token('A'));const item=request(client),config=await item.ready;invalidateAuthSession();setStoredAuthToken(token(replacement));item.fail(config,401);await expect(item.pending).rejects.toThrow();expect(getStoredAuthToken()).toBe(token(replacement));}
    });
    it('403或网络错误不误当成会话撤销',async()=>{
      for(const status of [403,undefined]){setStoredAuthToken(token('A'));const item=request(client),config=await item.ready;item.fail(config,status);await expect(item.pending).rejects.toThrow();expect(getStoredAuthToken()).toBe(token('A'));}
    });
  });
}
it('无凭据公共作品请求的401不清除稍后登录的账号',async()=>{
  const item=request(worksClient),config=await item.ready;setStoredAuthToken(token('B'));item.fail(config,401);await expect(item.pending).rejects.toThrow();expect(getStoredAuthToken()).toBe(token('B'));
});
it('原生异步配置等待期间切换账号则取消，不换用B的token发送A操作',async()=>{
  const config=deferred<{mode:'fluxer';fluxer_api_url:string}>();vi.mocked(getForumAuthConfig).mockReturnValue(config.promise);
  setStoredAuthToken(token('A'));const adapter=vi.fn();const pending=nativeClient.get('/fake',{adapter});
  await Promise.resolve();invalidateAuthSession();setStoredAuthToken(token('B'));config.resolve({mode:'fluxer',fluxer_api_url:'https://native.invalid/api/v1'});
  await expect(pending).rejects.toMatchObject({code:'ERR_CANCELED'});expect(adapter).not.toHaveBeenCalled();expect(getStoredAuthToken()).toBe(token('B'));
});
