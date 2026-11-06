import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { worksApi } from './api';
import { workGovernanceApi } from './governanceApi';
import { workKeys } from './layout';
import { WorkTagPicker } from './tags';
import { WorkStatus, workError } from './components';
import { workTime } from './workTime';

const statuses = { pending: '等待审核', approved: '已通过', rejected: '已驳回', failed: '未生效' };
export function WorkTagGovernance({ workId, canManage }: { workId: string; canManage: boolean }) {
  const client = useQueryClient();
  const snapshot = useQuery({ queryKey: [...workKeys.all, 'tag-snapshot', workId], queryFn: ({ signal }) => workGovernanceApi.tagSnapshot(workId, signal), retry: false });
  const proposals = useQuery({ queryKey: [...workKeys.all, 'tag-proposals', workId, canManage], queryFn: ({ signal }) => workGovernanceApi.proposals(workId, canManage, signal), retry: false });
  const mutation = useMutation({ mutationFn: async (action: { tagId?: string; remove?: boolean; bindingId?: string; vote?: -1 | 0 | 1; proposalId?: string; approve?: boolean }): Promise<unknown> => {
    if (action.bindingId) return workGovernanceApi.vote(workId, action.bindingId, action.vote!);
    if (action.proposalId) return workGovernanceApi.review(workId, action.proposalId, action.approve!);
    if (canManage) return action.remove ? worksApi.removeTag(workId, action.tagId!) : worksApi.addTag(workId, action.tagId!);
    return workGovernanceApi.propose(workId, action.tagId!);
  }, onSuccess: async () => { await client.invalidateQueries({ queryKey: workKeys.all }); } });
  return <section className="my-6"><h3 className="mb-3 text-lg">标签</h3>
    <WorkStatus pending={snapshot.isPending} error={snapshot.error} />
    {snapshot.data && !snapshot.error && <><div className="flex flex-wrap gap-3">{snapshot.data.tags.map(tag => <div key={tag.id} className="rounded border p-3">
      <Link className="underline" to={`/search?include_tag_ids=${encodeURIComponent(tag.id)}`}>#{tag.name}</Link>
      {tag.readonly ? <span className="ml-2 text-xs">来源标签</span> : <>
        {canManage && <button className="ml-3" aria-label={`移除标签 ${tag.name}`} disabled={mutation.isPending} onClick={() => mutation.mutate({ tagId: tag.id, remove: true })}>×</button>}
        {tag.binding_id && <div className="mt-2 flex gap-3 text-sm"><button aria-pressed={tag.my_vote === 1} disabled={mutation.isPending} onClick={() => mutation.mutate({ bindingId: tag.binding_id, vote: tag.my_vote === 1 ? 0 : 1 })}>赞同 {tag.upvotes || 0}</button><button aria-pressed={tag.my_vote === -1} disabled={mutation.isPending} onClick={() => mutation.mutate({ bindingId: tag.binding_id, vote: tag.my_vote === -1 ? 0 : -1 })}>反对 {tag.downvotes || 0}</button></div>}
      </>}
    </div>)}</div>{snapshot.data.over_limit && <p className="mt-2 text-sm">当前标签超过数量上限，请先调整后再添加。</p>}{!!snapshot.data.conflicting_pairs?.length && <p className="mt-2 text-sm">当前标签存在互斥冲突，可先移除冲突标签。</p>}</>}
    {!snapshot.error && !proposals.error && <WorkTagPicker label={canManage ? '添加标签' : '申请添加标签'} add={tagId => mutation.mutate({ tagId })} pending={mutation.isPending} />}
    {!canManage && <p className="my-2 text-sm text-(--od-text-secondary)">申请由作者或管理审核，可在下方查看处理状态和期限。</p>}
    <h4 className="mt-4 font-semibold">{canManage ? '待审核标签申请' : '我的标签申请'}</h4>
    <WorkStatus pending={proposals.isPending} error={proposals.error} />
    {!proposals.error && <ul className="my-3 space-y-3">{proposals.data?.items.map(proposal => <li key={proposal.id} className="rounded border p-3 text-sm">
      <p>#{proposal.tag_name} · {statuses[proposal.status]}</p><p className="mt-1">审核期限 {workTime(proposal.due_at).toLocaleString()}</p>{proposal.reason && <p className="mt-1">{proposal.reason}</p>}
      {canManage && proposal.status === 'pending' && <div className="mt-2 flex gap-4"><button className="underline" disabled={mutation.isPending} onClick={() => mutation.mutate({ proposalId: proposal.id, approve: true })}>通过申请</button><button className="underline" disabled={mutation.isPending} onClick={() => mutation.mutate({ proposalId: proposal.id, approve: false })}>驳回申请</button></div>}
    </li>)}</ul>}
    {mutation.isSuccess && <p role="status">标签操作已保存。</p>}{mutation.error && <p role="alert">{workError(mutation.error)}</p>}
  </section>;
}
