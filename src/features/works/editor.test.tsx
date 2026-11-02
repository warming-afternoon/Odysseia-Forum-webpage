import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { describe, expect, it, vi } from 'vitest';
import { WorkForm } from './editor';
import { nativeMessagesApi } from './nativeApi';
import type { Work } from './types';

vi.mock('./layout', () => ({ workKeys: { all: ['works-v2'] } }));
vi.mock('./nativeApi', () => ({ nativeMessagesApi: { get: vi.fn() } }));
vi.mock('./attachmentUpload', () => ({ uploadWorkAttachments: vi.fn().mockResolvedValue([]) }));

describe('native work attachment-only edit', () => {
  it('loads actual starter refs and omits unchanged body instead of overwriting a newer native edit', async () => {
    vi.mocked(nativeMessagesApi.get).mockResolvedValue({id:'900',channel_id:'900',content:'当前原生正文',timestamp:'2026-11-02',edited_timestamp:null,author:{id:'u1',username:'author'},attachments:[{id:'9007199254740993',url:'https://cdn.test/cover',filename:'cover.png',content_type:'image/png'}]});
    const work = {id:'1',title:'作品',description:'旧PG投影',source_platform:'fluxer',source_thread_id:'900',images:[],is_nsfw:false,is_abyss:false,author_id:'u1',source_guild_id:'1',source_channel_id:'2',main_ref:null,created_at:'2026-11-02',deleted_at:null,statistics:{view_count:0,collection_count:0,reaction_count:0,reply_count:0},reactions:[],tags:[]} satisfies Work;
    const save=vi.fn();
    render(<QueryClientProvider client={new QueryClient({defaultOptions:{queries:{retry:false}}})}><WorkForm work={work} save={save} pending={false}/></QueryClientProvider>);
    await screen.findByDisplayValue('当前原生正文');
    fireEvent.click(screen.getByRole('button',{name:'保存作品'}));
    await waitFor(()=>expect(save).toHaveBeenCalled());
    expect(save.mock.calls[0][0]).not.toHaveProperty('description');
    expect(save.mock.calls[0][0].attachments).toEqual([{id:'9007199254740993'}]);
  });
});
