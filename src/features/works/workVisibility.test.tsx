import { cleanup, render, screen } from '@testing-library/react';
import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';
import type { ReactNode } from 'react';
import { WorkCreatePage, WorkEditPage, WorkForm } from './editor';

const state = vi.hoisted(() => ({ data: undefined as unknown, error: null as unknown, memberError: null as unknown }));
const calls = vi.hoisted(() => ({ view: vi.fn().mockResolvedValue({ counted: true }) }));
vi.mock('@tanstack/react-query', () => ({
  useQuery: () => ({ ...state, isPending: false }),
  useQueryClient: () => ({ invalidateQueries: vi.fn() }),
  useMutation: () => ({ mutate: vi.fn(), isPending: false }),
}));
vi.mock('react-router-dom', () => ({ Link: ({ children }: {children: ReactNode}) => <span>{children}</span>, useParams: () => ({workId:'1'}), useNavigate: () => vi.fn() }));
vi.mock('./api', () => ({ worksApi: calls }));
vi.mock('./layout', () => ({ workKeys: { all: ['works-v2'] } }));
vi.mock('./member', () => ({ useWorkMember: () => ({ data: {id:'owner',can_create_work:true,can_speak:true}, error:state.memberError }) }));
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
beforeEach(()=>{state.data=work;state.error=null;state.memberError=null;vi.clearAllMocks();});
afterEach(()=>{cleanup();});

describe('请求被拒绝后的编辑可见性',()=>{
  it.each([401,403,404])('编辑重取收到%s后卸载缓存表单',(status)=>{
    const view=render(<WorkEditPage/>);expect(screen.getByDisplayValue('旧敏感正文')).toBeTruthy();
    state.error={isAxiosError:true,response:{status}};
    view.rerender(<WorkEditPage/>);expect(screen.queryByDisplayValue('旧敏感正文')).toBeNull();expect(screen.queryByRole('button',{name:'保存作品'})).toBeNull();
  });
  it('原生首帖重取被拒绝后不能保留旧正文编辑器',()=>{
    state.data={content:'旧原生正文',attachments:[]};
    const native={...work,source_platform:'fluxer'};
    const view=render(<WorkForm work={native} save={vi.fn()} pending={false}/>);
    expect(screen.getByDisplayValue('旧原生正文')).toBeTruthy();
    state.error=new Error('原生访问被拒绝');
    view.rerender(<WorkForm work={native} save={vi.fn()} pending={false}/>);
    expect(screen.queryByDisplayValue('旧原生正文')).toBeNull();
  });
  it('成员资格后续被拒绝时不保留缓存发布表单',()=>{
    const view=render(<WorkCreatePage/>);expect(screen.getByLabelText('作品标题')).toBeTruthy();
    state.memberError=new Error('成员资格被拒绝');view.rerender(<WorkCreatePage/>);expect(screen.queryByLabelText('作品标题')).toBeNull();
  });

});
