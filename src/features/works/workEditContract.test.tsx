import { cleanup, render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { WorkForm, workUpdateInput } from './editor';
import type { Work, WorkInput } from './types';

vi.mock('./layout',()=>({workKeys:{all:['works-v2']}}));
vi.mock('./attachmentUpload',()=>({uploadWorkAttachments:vi.fn()}));
const discord:Work={id:'1',title:'来源标题',description:'来源正文',images:[],source_platform:'discord',source_thread_id:'900',source_guild_id:'1',source_channel_id:'2',author_id:'owner',main_ref:null,is_nsfw:false,is_abyss:false,created_at:'2026-11-02',deleted_at:null,statistics:{view_count:0,collection_count:0,reaction_count:0,reply_count:0},reactions:[],tags:[]};
afterEach(cleanup);
describe('Discord 主帖元数据边界',()=>{
  it('只允许发送NSFW分类，不夹带只读的来源字段或固定深渊值',()=>{
    const input:WorkInput={title:'不应写入',description:'不应写入',images:['https://fake.invalid/cover'],attachments:[],is_nsfw:true,is_abyss:true};
    expect(workUpdateInput(discord,input)).toEqual({is_nsfw:true});
    expect(workUpdateInput({...discord,source_platform:'fluxer'},input)).toBe(input);
  });
  it('Discord标题/正文只读且不出现附件编辑器，NSFW仍可修改',()=>{
    render(<QueryClientProvider client={new QueryClient({defaultOptions:{queries:{retry:false}}})}><WorkForm work={discord} save={vi.fn()} pending={false}/></QueryClientProvider>);
    expect(screen.getByDisplayValue('来源标题')).toHaveAttribute('readonly');
    expect(screen.getByDisplayValue('来源正文')).toHaveAttribute('readonly');
    expect(screen.queryByLabelText('添加作品图片')).toBeNull();
    expect(screen.getByRole('checkbox',{name:'NSFW'})).not.toBeDisabled();
    expect(screen.getByRole('checkbox',{name:'深渊'})).toBeDisabled();
  });
});
