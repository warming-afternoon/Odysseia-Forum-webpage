import { render, screen, waitFor, act } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { WorkDetailPage } from './detail';
import { WorkForm } from './editor';
import { worksApi } from './api';
import { nativeMessagesApi } from './nativeApi';
import type { Work } from './types';

vi.mock('./layout', () => ({workKeys:{all:['works-v2']}}));
vi.mock('./member', () => ({useWorkMember:()=>({data:{id:'u1',is_admin:false}})}));
vi.mock('./api', () => ({worksApi:{get:vi.fn(),view:vi.fn().mockResolvedValue({counted:true})}}));
vi.mock('./nativeApi', () => ({nativeMessagesApi:{get:vi.fn()}}));
vi.mock('./social', () => ({WorkFollowActions:()=> <p>关注入口</p>}));
vi.mock('./booklists', () => ({WorkBooklistPicker:()=> <p>书单入口</p>}));
vi.mock('./tasks', () => ({WorkTasks:()=> <p>任务进度</p>}));
vi.mock('./tagGovernance', () => ({WorkTagGovernance:()=> <p>标签入口</p>}));
vi.mock('./bannerApplications', () => ({WorkBannerApply:()=> <p>Banner申请</p>}));
vi.mock('./threads', () => ({WorkThreads:()=> <p>原生讨论区</p>}));
vi.mock('./announcements', () => ({WorkAnnouncements:()=> <p>公告入口</p>}));
vi.mock('./moderation', () => ({WorkModerationPanel:()=> <p>原生管理入口</p>}));
const pending:Work={id:'1',title:'创建中的作品',description:'内容',images:[],sync_status:'pending',author_id:'u1',source_platform:'fluxer',source_guild_id:'2',source_channel_id:'3',source_thread_id:null,main_ref:null,is_nsfw:false,is_abyss:false,created_at:'2026-11-02',deleted_at:null,statistics:{view_count:0,collection_count:0,reaction_count:0,reply_count:0},reactions:[],tags:[]};

describe('pending native source boundaries', () => {
  beforeEach(()=>vi.clearAllMocks());
  it('keeps local actions available and restores native entry points when the source becomes ready', async () => {
    vi.mocked(worksApi.get).mockResolvedValue(pending);
    const client=new QueryClient({defaultOptions:{queries:{retry:false}}});
    render(<QueryClientProvider client={client}><MemoryRouter initialEntries={['/works/1']}><Routes><Route path="/works/:workId" element={<WorkDetailPage/>}/></Routes></MemoryRouter></QueryClientProvider>);
    await screen.findByText(/原生主帖正在创建/);
    expect(screen.queryByRole('link',{name:'编辑作品'})).toBeNull();
    for(const label of ['Banner申请','原生讨论区','公告入口','原生管理入口']) expect(screen.queryByText(label)).toBeNull();
    for(const label of ['关注入口','书单入口','任务进度','标签入口']) expect(screen.getByText(label)).toBeTruthy();
    expect(screen.getByRole('button',{name:'加入默认收藏书单'})).toBeTruthy();
    act(()=>client.setQueryData(['works-v2','detail','1'],{...pending,sync_status:'ready',source_thread_id:'900'}));
    await screen.findByRole('link',{name:'编辑作品'});
    for(const label of ['Banner申请','原生讨论区','公告入口','原生管理入口']) expect(screen.getByText(label)).toBeTruthy();
  });
  it('blocks direct edit and preupload for both explicit pending and old DTOs with no source reference', async () => {
    const client=new QueryClient({defaultOptions:{queries:{retry:false}}});
    const save=vi.fn();
    const renderForm=(work:Work)=><QueryClientProvider client={client}><WorkForm work={work} save={save} pending={false}/></QueryClientProvider>;
    const view=render(renderForm(pending));
    await screen.findByText(/暂时不能编辑或上传图片/);
    expect(screen.queryByLabelText('添加作品图片')).toBeNull();
    expect(nativeMessagesApi.get).not.toHaveBeenCalled();
    view.rerender(renderForm({...pending,sync_status:undefined}));
    await waitFor(()=>expect(screen.queryByRole('button',{name:'保存作品'})).toBeNull());
    expect(save).not.toHaveBeenCalled();
  });
});
