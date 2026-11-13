import { render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { WorkForm } from './editor';
import { nativeMessagesApi } from './nativeApi';
import type { Work } from './types';

vi.mock('./layout', () => ({workKeys:{all:['works-v2']}}));
vi.mock('./member', () => ({useWorkMember:()=>({data:{id:'u1',is_admin:false}})}));
vi.mock('./api', () => ({worksApi:{get:vi.fn(),view:vi.fn().mockResolvedValue({counted:true})}}));
vi.mock('./nativeApi', () => ({nativeMessagesApi:{get:vi.fn()}}));
const pending:Work={id:'1',title:'创建中的作品',description:'内容',images:[],sync_status:'pending',author_id:'u1',source_platform:'fluxer',source_guild_id:'2',source_channel_id:'3',source_thread_id:null,main_ref:null,is_nsfw:false,is_abyss:false,created_at:'2026-11-02',deleted_at:null,statistics:{view_count:0,collection_count:0,reaction_count:0,reply_count:0},reactions:[],tags:[]};

describe('pending native source boundaries', () => {
  beforeEach(()=>vi.clearAllMocks());
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
