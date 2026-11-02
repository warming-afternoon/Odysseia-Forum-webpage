import { useState, type FormEvent } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { workGovernanceApi } from './governanceApi';
import { useWorkMember } from './member';
import { workKeys } from './layout';
import { WorkPagination, WorkStatus, workError } from './components';
import type { WorkModlogEntry } from './governanceTypes';
import { workTime } from './workTime';

const when = (value: string) => workTime(value).toLocaleString();
const actionNames: Record<string, string> = { 'work.delete': '隐藏作品', 'work.restore': '恢复作品', 'work.mute': '添加发言处罚', 'work.unmute': '解除发言处罚', 'work.update': '编辑作品', 'thread.lock': '锁定帖子', 'thread.unlock': '解除帖子锁定', 'thread.archive': '归档帖子' };
function logDescription(detail: WorkModlogEntry['detail']) {
  if (typeof detail === 'string') return detail;
  if (!detail) return '';
  return ['reason', 'user_id', 'source', 'target_channel_id'].map(key => {
    const labels: Record<string, string> = { reason: '原因', user_id: '用户', source: '来源', target_channel_id: '目标分类' };
    return detail[key] == null ? '' : `${labels[key]}：${String(detail[key])}`;
  }).filter(Boolean).join(' · ');
}

export function WorkAuditLog({ workId }: { workId: string }) {
  const [offset, setOffset] = useState(0);
  const query = useQuery({ queryKey: [...workKeys.all, 'modlog', workId, offset], queryFn: ({ signal }) => workGovernanceApi.modlog(workId, offset, signal), retry: false });
  return <section className="my-5"><h4 className="mb-3 font-semibold">操作记录</h4>
    <WorkStatus pending={query.isPending} error={query.error} />
    {query.data && !query.error && <><ol className="space-y-3">{query.data.items.map(entry => <li key={entry.id} className="rounded border p-3 text-sm">
      <p>{actionNames[entry.type] || entry.type} · 操作人 {entry.actor_id || '系统'} · <time>{when(entry.created_at)}</time></p>
      {logDescription(entry.detail) && <p className="mt-1 break-words text-(--od-text-secondary)">{logDescription(entry.detail)}</p>}
    </li>)}</ol>{!query.data.items.length && <p>暂无操作记录</p>}{query.data.total > 20 && <WorkPagination offset={offset} total={query.data.total} onChange={setOffset} />}</>}
  </section>;
}

export function WorkModerationPanel({ workId, sourcePlatform }: { workId: string; sourcePlatform: string }) {
  const client = useQueryClient();
  const [userId, setUserId] = useState('');
  const [reason, setReason] = useState('');
  const [deadline, setDeadline] = useState('');
  const [auditOpen, setAuditOpen] = useState(false);
  const query = useQuery({ queryKey: [...workKeys.all, 'mutes', workId], queryFn: ({ signal }) => workGovernanceApi.mutes(workId, signal), retry: false });
  const mutation = useMutation({ mutationFn: async (muteId?: string): Promise<unknown> => muteId ? workGovernanceApi.unmute(workId, muteId) : workGovernanceApi.mute(workId, { user_id: userId.trim(), reason: reason.trim(), expires_at: deadline ? new Date(deadline).toISOString() : null }), onSuccess: async () => {
    setUserId(''); setReason(''); setDeadline(''); await client.invalidateQueries({ queryKey: workKeys.all });
  } });
  function submit(event: FormEvent) { event.preventDefault(); mutation.mutate(undefined); }
  return <section className="my-6 rounded border p-4"><h3 className="mb-3 text-lg">作品管理</h3>
    {sourcePlatform === 'discord' && <p className="mb-3 text-sm">处罚仅作用于本站与 Fluxer 子卡帖，不改变 Discord 主帖权限。</p>}{!query.error && <form onSubmit={submit} className="grid gap-3 sm:grid-cols-2">
      <label className="grid gap-1">用户编号<input required pattern="[0-9]+" value={userId} onChange={event => setUserId(event.target.value)} className="rounded border bg-transparent p-2" /></label>
      <label className="grid gap-1">到期时间（留空为长期）<input type="datetime-local" value={deadline} onChange={event => setDeadline(event.target.value)} className="rounded border bg-transparent p-2" /></label>
      <label className="grid gap-1 sm:col-span-2">原因<input required maxLength={512} value={reason} onChange={event => setReason(event.target.value)} className="rounded border bg-transparent p-2" /></label>
      <button className="w-fit rounded border px-3 py-2" disabled={mutation.isPending || !reason.trim() || !userId.trim()}>禁止在此作品发言与新建子帖</button>
    </form>}
    <WorkStatus pending={query.isPending} error={query.error} />
    {!query.error && <ul className="my-4 space-y-3">{query.data?.items.map(mute => {
      const expired = !!mute.expires_at && workTime(mute.expires_at).getTime() <= Date.now();
      return <li className="rounded border p-3 text-sm" key={mute.id}>
        <p>用户 {mute.user_id} · {mute.revoked_at ? '已撤销' : expired ? '已到期' : '生效中'}</p>
        <p className="my-1">{mute.reason}</p><p>{mute.own_source ? '由我添加' : `由 ${mute.actor_id} 添加`} · {mute.expires_at ? `到期 ${when(mute.expires_at)}` : '长期'}</p>
        {mute.own_source && !mute.revoked_at && !expired && <button className="mt-2 underline" disabled={mutation.isPending} onClick={() => mutation.mutate(mute.id)}>解除我的这项处罚</button>}
      </li>;
    })}</ul>}
    {mutation.isSuccess && <p role="status" className="my-2">操作已提交，帖子权限正在同步。</p>}
    {mutation.error && <p role="alert">{workError(mutation.error)}</p>}
    {!query.error && <button className="underline" onClick={() => setAuditOpen(!auditOpen)}>{auditOpen ? '收起操作记录' : '查看操作记录'}</button>}
    {auditOpen && !query.error && <WorkAuditLog workId={workId} />}
  </section>;
}

export function DeletedWorksAdminPage() {
  const member = useWorkMember();
  const client = useQueryClient();
  const [offset, setOffset] = useState(0);
  const [auditId, setAuditId] = useState<string | null>(null);
  const query = useQuery({ queryKey: [...workKeys.all, 'deleted', offset], queryFn: ({ signal }) => workGovernanceApi.deleted(offset, signal), enabled: member.data?.is_admin === true, retry: false });
  const restore = useMutation({ mutationFn: workGovernanceApi.restore, onSuccess: async () => { await client.invalidateQueries({ queryKey: workKeys.all }); } });
  if (!member.data?.is_admin) return <><WorkStatus pending={member.isPending} error={member.error} />{member.data && <p role="alert">仅管理组可访问已隐藏作品。</p>}</>;
  return <section><h2 className="mb-4 text-xl">已隐藏作品</h2><WorkStatus pending={query.isPending} error={query.error} />
    {query.data && !query.error && <><div className="grid gap-4">{query.data.items.map(work => <article className="rounded border p-4" key={work.id}>
      <h3 className="font-semibold">{work.title}</h3><p className="my-2 line-clamp-2 text-sm">{work.description}</p>
      <p className="text-sm">{work.deletion_reason === 'source_deleted' ? '原生主帖已删除，无法恢复' : '作品已隐藏'}</p>
      <div className="mt-3 flex gap-4">{work.can_restore && work.deletion_reason !== 'source_deleted' && <button className="underline" disabled={restore.isPending} onClick={() => { if (window.confirm(`恢复作品「${work.title}」？`)) restore.mutate(work.id); }}>恢复作品</button>}
        <button className="underline" onClick={() => setAuditId(auditId === work.id ? null : work.id)}>操作记录</button></div>
      {auditId === work.id && <WorkAuditLog workId={work.id} />}
    </article>)}</div>{!query.data.items.length && <p>没有可见的已隐藏作品。</p>}{query.data.total > 20 && <WorkPagination offset={offset} total={query.data.total} onChange={setOffset} />}</>}
    {restore.error && <p role="alert">{workError(restore.error)}</p>}{restore.isSuccess && <p role="status">作品已恢复。</p>}
  </section>;
}
