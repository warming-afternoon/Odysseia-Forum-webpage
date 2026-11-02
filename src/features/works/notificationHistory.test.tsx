import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { WorkNotificationsPage } from './social';
import { WorkAnnouncements } from './announcements';
import { worksApi } from './api';

vi.mock('./layout', () => ({ workKeys: { all: ['works-v2'] } }));
vi.mock('./member', () => ({ useWorkMember: () => ({ data: null }) }));
vi.mock('./api', () => ({ worksApi: { notifications: vi.fn(), readNotification: vi.fn(), announcements: vi.fn() } }));
function wrap(content: React.ReactNode) { return render(<QueryClientProvider client={new QueryClient({defaultOptions:{queries:{retry:false}}})}><MemoryRouter>{content}</MemoryRouter></QueryClientProvider>); }

describe('compatible notification targets and bounded history', () => {
  beforeEach(() => vi.resetAllMocks());
  it('opens the booklist review target without manufacturing an empty work URL', async () => {
    vi.mocked(worksApi.notifications).mockResolvedValue({items:[{id:'1',type:'tag_review',work_id:null,announcement_id:null,title:'标签审核',body:'待审核',withdrawn:false,read_at:null,created_at:'2026-11-02',target_type:'booklist',target_id:'42'}],total:1,offset:0,limit:20});
    wrap(<WorkNotificationsPage/>);
    const link=await screen.findByRole('link',{name:'查看书单标签审核'});
    expect(link.getAttribute('href')).toBe('/booklists/42');
    expect(screen.queryByRole('link',{name:'查看作品与公告历史'})).toBeNull();
  });
  it('requests later announcement pages so bounded history remains accessible', async () => {
    vi.mocked(worksApi.announcements).mockImplementation(async (_work, _signal, offset=0) => ({items:[{id:String(offset+1),work_id:'1',author_id:null,title:null,body:`历史公告 ${offset}`,images:[],created_at:'2026-11-02',withdrawn_at:null}],total:21,offset,limit:20}));
    wrap(<WorkAnnouncements workId="1" authorId="u1"/>);
    await screen.findByText('历史公告 0');
    fireEvent.click(screen.getByRole('button',{name:'下一页'}));
    await screen.findByText('历史公告 20');
    await waitFor(()=>expect(worksApi.announcements).toHaveBeenLastCalledWith('1',expect.any(AbortSignal),20));
  });
});
