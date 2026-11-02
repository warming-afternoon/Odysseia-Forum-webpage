import { act, cleanup, render } from '@testing-library/react';
import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';
import type { ReactNode } from 'react';
import { WorkDetailPage } from './detail';

const state = vi.hoisted(() => ({ data: undefined as unknown, error: null as unknown }));
const calls = vi.hoisted(() => ({ view: vi.fn().mockResolvedValue({ counted: true }) }));
vi.mock('@tanstack/react-query', () => ({
  useQuery: () => ({ ...state, isPending: false }),
  useQueryClient: () => ({ invalidateQueries: vi.fn() }),
  useMutation: () => ({ mutate: vi.fn(), isPending: false }),
}));
vi.mock('react-router-dom', () => ({ Link: ({ children }: {children: ReactNode}) => <span>{children}</span>, useParams: () => ({workId:'1'}), useNavigate: () => vi.fn() }));
vi.mock('./api', () => ({ worksApi: calls }));
vi.mock('./layout', () => ({ workKeys: { all: ['works-v2'] } }));
vi.mock('./member', () => ({ useWorkMember: () => ({ data: {id:'owner'} }) }));
vi.mock('./nativeApi', () => ({nativeMessagesApi:{}}));
vi.mock('./attachmentUpload', () => ({uploadWorkAttachments:vi.fn().mockResolvedValue([])}));
vi.mock('./social', () => ({WorkFollowActions:()=>null}));
vi.mock('./booklists', () => ({WorkBooklistPicker:()=>null}));
vi.mock('./tasks', () => ({WorkTasks:()=>null}));
vi.mock('./tagGovernance', () => ({WorkTagGovernance:()=>null}));
vi.mock('./bannerApplications', () => ({WorkBannerApply:()=>null}));
vi.mock('./threads', () => ({WorkThreads:()=>null}));
vi.mock('./announcements', () => ({WorkAnnouncements:()=>null}));
vi.mock('./moderation', () => ({WorkModerationPanel:()=>null}));
const work={id:'1',title:'作品',description:'旧敏感正文',images:[],source_platform:'discord',source_thread_id:'900',source_guild_id:'1',source_channel_id:'2',author_id:'owner',main_ref:null,is_nsfw:false,is_abyss:false,created_at:'2026-11-02',deleted_at:null,statistics:{view_count:0,collection_count:0,reaction_count:0,reply_count:0},reactions:[],tags:[]};
beforeEach(()=>{state.data=work;state.error=null;vi.clearAllMocks();vi.useFakeTimers();});
afterEach(()=>{cleanup();vi.useRealTimers();});

describe('浏览停留上报',()=>{
  it('不足3秒离开不计数，完整停留后只上报一次',()=>{
    const first=render(<WorkDetailPage/>);
    act(()=>vi.advanceTimersByTime(2999));expect(calls.view).not.toHaveBeenCalled();
    first.unmount();act(()=>vi.advanceTimersByTime(1));expect(calls.view).not.toHaveBeenCalled();
    render(<WorkDetailPage/>);act(()=>vi.advanceTimersByTime(3000));expect(calls.view).toHaveBeenCalledTimes(1);
  });
});
