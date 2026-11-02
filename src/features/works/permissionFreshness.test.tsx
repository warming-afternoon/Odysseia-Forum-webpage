import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { WorksLayout } from './layout';
import { useWorkMember } from './member';
import { WorkThreads } from './threads';
import { WorkAnnouncements } from './announcements';
import { WorkBooklistPage } from './booklists';
import { WorkModerationPanel } from './moderation';
import { WorkTagGovernance } from './tagGovernance';
import { workGovernanceApi } from './governanceApi';
import { worksApi } from './api';
import type { WorkMember } from './types';
vi.mock('./messages',()=>({NativeThreadMessages:()=>null}));
const member:WorkMember={id:'owner',discord_user_id:'22',username:'fake',display_name:'fake',avatar_url:null,is_admin:true,can_create_work:true,can_view_abyss:true,can_speak:true,show_nsfw:true};
const denied=()=>Object.assign(new Error('fake denied'),{response:{status:403}});
function mount(node:React.ReactNode,seed:[readonly unknown[],unknown][]){const client=new QueryClient({defaultOptions:{queries:{retry:false,staleTime:Infinity},mutations:{retry:false}}});for(const [key,data]of seed)client.setQueryData(key,data);const view=render(<MemoryRouter initialEntries={['/booklists/1']}><QueryClientProvider client={client}>{node}</QueryClientProvider></MemoryRouter>);return{client,...view};}
async function fail(client:QueryClient,key:readonly unknown[]){await act(async()=>{await client.invalidateQueries({queryKey:key});});await waitFor(()=>expect(client.getQueryState(key)?.status).toBe('error'));}
beforeEach(()=>{vi.restoreAllMocks();vi.spyOn(worksApi,'me').mockResolvedValue(member);});
afterEach(cleanup);
describe('交叉查询权限不依赖已被拒绝的旧快照',()=>{
 it('会员查询被拒绝后不暴露旧admin资格，且整个作品Outlet收起',async()=>{
  let reject!:(reason:unknown)=>void;vi.mocked(worksApi.me).mockImplementation(()=>new Promise((_resolve,fail)=>{reject=fail;}));
  function Probe(){const me=useWorkMember();return <p>{me.data?.is_admin?'CACHED ADMIN':'NO ADMIN'}</p>;}
  mount(<><Probe/><Routes><Route path="/booklists/1" element={<WorksLayout/>}><Route index element={<p>CACHED PRIVATE OUTLET</p>}/></Route></Routes></>,[[['works-v2','me'],member]]);
  expect(screen.getByText('CACHED ADMIN')).toBeTruthy();expect(screen.getByText('CACHED PRIVATE OUTLET')).toBeTruthy();
  await waitFor(()=>expect(worksApi.me).toHaveBeenCalled());await act(async()=>reject(denied()));
  await waitFor(()=>expect(screen.queryByText('CACHED ADMIN')).toBeNull());
  expect(screen.queryByText('CACHED PRIVATE OUTLET')).toBeNull();expect(screen.queryByRole('link',{name:'管理已隐藏作品'})).toBeNull();
 });
 it('讨论列表被拒绝后关闭已展开的新建子帖表单',async()=>{
  const key=['works-v2','threads','1',true] as const;vi.spyOn(worksApi,'threads').mockRejectedValue(denied());
  const main={id:'m',platform:'discord',thread_id:'33',guild_id:'22',channel_id:'11',role:'main',locked:false,archived:false,initializing:false};
  const {client}=mount(<WorkThreads workId="1" authorId="owner"/>,[[['works-v2','me'],member],[key,{items:[main]}]]);
  fireEvent.click(screen.getByRole('button',{name:'创建子卡贴'}));expect(screen.getByLabelText('子卡贴正文')).toBeTruthy();
  await fail(client,key);expect(screen.queryByLabelText('子卡贴正文')).toBeNull();expect(screen.queryByRole('button',{name:'创建子卡贴'})).toBeNull();
 });
 it('公告查询被拒绝后隐藏撰写入口与已打开表单',async()=>{
  const key=['works-v2','announcements','1',0] as const;vi.spyOn(worksApi,'announcements').mockRejectedValue(denied());
  const {client}=mount(<WorkAnnouncements workId="1" authorId="owner"/>,[[['works-v2','me'],member],[key,{items:[],total:0}]]);
  fireEvent.click(screen.getByRole('button',{name:'撰写公告'}));expect(screen.getByLabelText('公告正文')).toBeTruthy();
  await fail(client,key);expect(screen.queryByLabelText('公告正文')).toBeNull();expect(screen.queryByRole('button',{name:'撰写公告'})).toBeNull();
 });
 it('拥有书单查询被拒绝后移除旧编辑权限和已打开表单，公开详情不伪删除',async()=>{
  const key=['works-v2','booklists'] as const;vi.spyOn(worksApi,'booklists').mockRejectedValue(denied());
  const list={id:'1',title:'VISIBLE PUBLIC LIST',description:'public',is_public:true,is_default:false,items:[],total:0,offset:0,limit:20};
  const {client}=mount(<Routes><Route path="/booklists/:booklistId" element={<WorkBooklistPage/>}/></Routes>,[[key,{items:[list]}],[['works-v2','booklist','1',0],list]]);
  fireEvent.click(screen.getByRole('button',{name:'编辑书单'}));expect(screen.getByLabelText('书单标题')).toBeTruthy();
  await fail(client,key);expect(screen.queryByLabelText('书单标题')).toBeNull();expect(screen.queryByRole('button',{name:'编辑书单'})).toBeNull();expect(screen.getByText('VISIBLE PUBLIC LIST')).toBeTruthy();
 });
 it('作品处罚查询被拒绝后不继续展示写表单或触发审计查询',async()=>{
  const key=['works-v2','mutes','1'] as const;vi.spyOn(workGovernanceApi,'mutes').mockRejectedValue(denied());
  const {client}=mount(<WorkModerationPanel workId="1" sourcePlatform="discord"/>,[[key,{items:[]}]]);
  expect(screen.getByLabelText('用户编号')).toBeTruthy();expect(screen.getByRole('button',{name:'查看操作记录'})).toBeTruthy();
  await fail(client,key);expect(screen.queryByLabelText('用户编号')).toBeNull();expect(screen.queryByRole('button',{name:'查看操作记录'})).toBeNull();
 });
 it.each(['snapshot','proposals'] as const)('标签%s查询被拒绝后不继续展示添加入口',async(which)=>{
  const snapshot=['works-v2','tag-snapshot','1'] as const,proposals=['works-v2','tag-proposals','1',true] as const;
  vi.spyOn(workGovernanceApi,which==='snapshot'?'tagSnapshot':'proposals').mockRejectedValue(denied());
  const {client}=mount(<WorkTagGovernance workId="1" canManage/>,[[snapshot,{tags:[]}],[proposals,{items:[]}],[['works-v2','tags',''],{items:[]}]]);
  expect(screen.getByLabelText('添加标签')).toBeTruthy();await fail(client,which==='snapshot'?snapshot:proposals);expect(screen.queryByLabelText('添加标签')).toBeNull();
 });

});
