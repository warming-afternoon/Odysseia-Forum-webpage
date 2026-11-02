import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { workBannerApi } from './bannerApi';
import { workKeys } from './layout';
import { useWorkMember } from './member';
import { workError, WorkStatus } from './components';

export function WorkBannerApply({ workId }: { workId: string }) {
  const [scope, setScope] = useState('global');
  const [cover, setCover] = useState('');
  const queryClient = useQueryClient();
  const scopes = useQuery({ queryKey: [...workKeys.all, 'banner-scopes', workId], queryFn: ({ signal }) => workBannerApi.scopes(workId, signal) });
  const apply = useMutation({ mutationFn: () => workBannerApi.apply(workId, { target_scope: scope, ...(cover.trim() ? { cover_image_url: cover.trim() } : {}) }), onSuccess: () => queryClient.invalidateQueries({ queryKey: [...workKeys.all, 'banner-applications'] }) });
  return <section className="my-5 rounded border p-4" aria-label="推荐展示申请"><h3 className="font-semibold">申请推荐展示</h3>
    <p className="my-2 text-sm">审核通过后展示三天；全站最多三条，每个频道最多八条，满额后按先后顺序候补。</p>
    <WorkStatus pending={scopes.isPending} error={scopes.error} />
    <form className="flex flex-wrap items-end gap-3" onSubmit={event => { event.preventDefault(); apply.mutate(); }}>
      <label>展示范围<select aria-label="展示范围" className="ml-2 rounded border p-2" value={scope} onChange={event => setScope(event.target.value)}>{scopes.data?.items.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
      <label>自定义封面（可选）<input aria-label="自定义封面" className="ml-2 rounded border p-2" type="url" value={cover} onChange={event => setCover(event.target.value)} placeholder="默认使用作品首图" /></label>
      <button className="rounded border px-3 py-2" disabled={apply.isPending || !scopes.data?.items.length}>提交推荐申请</button>
    </form>
    {apply.error && <p role="alert">{workError(apply.error)}</p>}
    {apply.isSuccess && <p role="status">申请已提交，前往个人页查看审核和候补状态。</p>}
  </section>;
}

export function WorkBannerApplications() {
  const member = useWorkMember();
  return <section className="my-5"><h3 className="text-lg font-semibold">推荐申请</h3>
    <BannerApplicationList admin={false} enabled={!!member.data} />
    {member.data?.is_admin && <><h3 className="my-3 text-lg font-semibold">管理推荐审核</h3><BannerApplicationList admin enabled /></>}
  </section>;
}

function BannerApplicationList({ admin, enabled }: { admin: boolean; enabled: boolean }) {
  const [offset, setOffset] = useState(0);
  const [reasons, setReasons] = useState<Record<string, string>>({});
  const queryClient = useQueryClient();
  const result = useQuery({ queryKey: [...workKeys.all, 'banner-applications', admin, offset], queryFn: ({ signal }) => workBannerApi.list(admin, offset, signal), enabled });
  const review = useMutation({ mutationFn: ({ id, approve }: { id: string; approve: boolean }) => workBannerApi.review(id, { approve, ...(!approve && reasons[id]?.trim() ? { reason: reasons[id].trim() } : {}) }), onSuccess: () => queryClient.invalidateQueries({ queryKey: workKeys.all }) });
  return <div aria-label={admin ? '推荐审核队列' : '我的推荐申请'}>
    <WorkStatus pending={enabled && result.isPending} error={result.error} />
    {review.error && <p role="alert">{workError(review.error)}</p>}
    {result.data?.items.map(item => <article key={item.id} className="my-3 rounded border p-3">
      <p>{item.work_id ? <Link className="underline" to={`/works/${encodeURIComponent(item.work_id)}`}>查看申请作品</Link> : 'Discord 频道或赛事申请'} · {item.target_scope === 'global' ? '全站推荐' : '频道推荐'}</p>
      <p>{item.status === 'pending' ? '待审核' : item.status === 'rejected' ? '未通过' : item.placement === 'waitlist' ? '审核通过，候补中' : item.placement === 'carousel' ? '正在展示' : '展示已结束'}{item.reject_reason && `：${item.reject_reason}`}</p>
      {admin && item.status === 'pending' && (item.target_type === 3 ? <div className="mt-2 flex flex-wrap gap-2">
        <button className="rounded border px-3 py-1" disabled={review.isPending} onClick={() => review.mutate({ id: item.id, approve: true })}>批准推荐</button>
        <input aria-label={`申请 ${item.id} 拒绝原因`} className="rounded border px-2" placeholder="拒绝原因（可选）" maxLength={2000} value={reasons[item.id] || ''} onChange={event => setReasons(current => ({ ...current, [item.id]: event.target.value }))} />
        <button className="rounded border px-3 py-1" disabled={review.isPending} onClick={() => review.mutate({ id: item.id, approve: false })}>拒绝推荐</button>
      </div> : <p className="text-sm">请在现有 Discord 审核入口处理此申请。</p>)}
    </article>)}
    {result.data?.total === 0 && <p className="my-2 text-sm">暂无推荐申请</p>}
    {result.data && result.data.total > 20 && <div className="flex gap-3"><button disabled={!offset} onClick={() => setOffset(Math.max(0, offset - 20))}>上一页</button><button disabled={offset + 20 >= result.data.total} onClick={() => setOffset(offset + 20)}>下一页</button></div>}
  </div>;
}
