import { nativeMessagesApi } from './nativeApi';
import { useState, type FormEvent } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { NativeThreadMessages } from './messages';
import { worksApi } from './api';
import { useWorkMember } from './member';
import { workKeys } from './layout';
import { WorkStatus, workError } from './components';
import type { ThreadRef, WorkMember } from './types';

export function discordThreadUrl(ref: ThreadRef): string | null {
  return ref.platform === 'discord' && /^\d+$/.test(ref.guild_id) && /^\d+$/.test(ref.thread_id)
    ? `https://discord.com/channels/${ref.guild_id}/${ref.thread_id}` : null;
}
export function threadPermissions(thread: ThreadRef, member: WorkMember | undefined, workAuthorId: string | null) {
  const own = !!member && member.id === thread.author_id;
  return {
    edit: own && thread.role === 'child' && thread.platform === 'fluxer' && !thread.locked && !thread.archived && !thread.deleted_at && !thread.initializing,
    remove: !!member && (own || member.is_admin) && !thread.deleted_at && !thread.initializing,
    manage: !!member && (own || member.id === workAuthorId || member.is_admin) && !thread.deleted_at && !thread.initializing,
    restore: !!member?.is_admin && thread.role === 'child' && !!thread.deleted_at && thread.can_restore === true && thread.deletion_reason !== 'source_deleted',
  };
}
function ThreadBodyForm({ thread, save, pending, cancel }: { thread?: ThreadRef; save: (body: { title: string; body: string }) => void; pending: boolean; cancel: () => void }) {
  const [title, setTitle] = useState(thread?.title || '');
  const [body, setBody] = useState(thread?.body || '');
  function submit(event: FormEvent) { event.preventDefault(); save({ title: title.trim(), body }); }
  return <form className="my-3 grid gap-3" onSubmit={submit}>
    <label className="grid gap-1">子卡贴标题<input required value={title} onChange={event => setTitle(event.target.value)} className="rounded border bg-transparent p-2" /></label>
    <label className="grid gap-1">子卡贴正文<textarea rows={6} value={body} onChange={event => setBody(event.target.value)} className="rounded border bg-transparent p-2" /></label>
    <div className="flex gap-3"><button disabled={pending || !title.trim()} className="rounded border px-4 py-2">保存子卡贴</button><button type="button" onClick={cancel}>取消</button></div>
  </form>;
}
export function WorkThreads({ workId, authorId }: { workId: string; authorId: string | null }) {
  const member = useWorkMember();
  const queryClient = useQueryClient();
  const [editing, setEditing] = useState<string | null>(null);
  const [compose, setCompose] = useState(false);
  const [expanded, setExpanded] = useState<string[]>([]);
  const query = useQuery({ queryKey: [...workKeys.all, 'threads', workId, member.data?.is_admin], queryFn: ({ signal }) => worksApi.threads(workId, signal, !!member.data?.is_admin), retry: false, refetchInterval: 5000 });
  const mutation = useMutation({ mutationFn: async (action: { threadId?: string; body?: { title?: string; body?: string; locked?: boolean; archived?: boolean }; remove?: boolean; restore?: boolean }) => {
    if (action.restore) return worksApi.restoreThread(workId, action.threadId!);
    if (action.remove) return worksApi.deleteThread(workId, action.threadId!);
    if (action.threadId) {
      const thread = query.data?.items.find(item => item.id === action.threadId);
      if (thread?.platform === 'fluxer' && (action.body?.title !== undefined || action.body?.body !== undefined)) {
        if (action.body.title !== undefined) await nativeMessagesApi.updateThread(thread.thread_id, { name: action.body.title });
        if (action.body.body !== undefined) await nativeMessagesApi.edit(thread.thread_id, thread.thread_id, action.body.body);
        return;
      }
      return worksApi.updateThread(workId, action.threadId, action.body!);
    }
    return worksApi.createThread(workId, action.body as { title: string; body: string });
  }, onSuccess: async () => { setEditing(null); setCompose(false); await queryClient.invalidateQueries({ queryKey: workKeys.all }); } });
  const main = query.data?.items.find(thread => thread.role === 'main');
  const canCreate = !query.error && member.data?.can_speak && main && !main.locked && !main.archived && !main.initializing;
  return <section className="my-6 border-t pt-5"><h3 className="text-xl">主帖与子卡贴</h3>
    <WorkStatus pending={query.isPending} error={query.error} />
    {!query.error && query.data?.items.map(thread => {
      const access = threadPermissions(thread, member.data, authorId);
      const externalUrl = discordThreadUrl(thread);
      return <article key={thread.id} className="my-4 rounded border p-4">
        <div className="mb-2 flex flex-wrap items-center gap-3"><h4 className="font-semibold">{thread.role === 'main' ? '主帖' : '子卡贴'}：{thread.title}</h4>{thread.initializing && <span role="status">正在同步权限，暂未开放</span>}{thread.locked && <span>已锁定</span>}{thread.archived && <span>已归档</span>}{thread.deleted_at && <span>已删除</span>}</div>
        {externalUrl ? <a className="underline" href={externalUrl} target="_blank" rel="noreferrer">在 Discord 查看 ↗</a> : editing === thread.id ? <ThreadBodyForm thread={thread} save={body => mutation.mutate({ threadId: thread.id, body })} pending={mutation.isPending} cancel={() => setEditing(null)} /> : null}
        {thread.platform === 'fluxer' && !thread.deleted_at && <>
          {thread.role === 'child' && <button className="my-2 underline" onClick={() => setExpanded(values => values.includes(thread.id) ? values.filter(value => value !== thread.id) : [...values, thread.id])}>{expanded.includes(thread.id) ? '收起讨论' : '查看讨论'}</button>}
          {(thread.role === 'main' || expanded.includes(thread.id)) && <NativeThreadMessages channelId={thread.thread_id} editStarter={thread.role === 'child'} canEditMessages={!thread.locked && !thread.archived && !thread.initializing} canReply={!!member.data?.can_speak && !thread.locked && !thread.archived && !thread.initializing} />}
        </>}
        <div className="mt-3 flex flex-wrap gap-4 text-sm">
          {access.edit && <button className="underline" onClick={() => setEditing(thread.id)}>编辑</button>}
          {access.remove && <button className="underline" disabled={mutation.isPending} onClick={() => { if (window.confirm(thread.role === 'main' ? '删除主帖将隐藏整个作品。继续？' : '删除该子卡贴？')) mutation.mutate({ threadId: thread.id, remove: true }); }}>删除</button>}
          {access.manage && <><button className="underline" disabled={mutation.isPending} onClick={() => mutation.mutate({ threadId: thread.id, body: { locked: !thread.own_locked } })}>{thread.own_locked ? '撤销我的锁定' : '添加我的锁定'}</button><button className="underline" disabled={mutation.isPending} onClick={() => mutation.mutate({ threadId: thread.id, body: { archived: !thread.own_archived } })}>{thread.own_archived ? '撤销我的归档' : '添加我的归档'}</button></>}
          {access.restore && <button disabled={mutation.isPending} className="underline" onClick={() => mutation.mutate({ threadId: thread.id, restore: true })}>管理恢复</button>}
        </div>
      </article>;
    })}
    {canCreate ? <button className="rounded border px-4 py-2" onClick={() => setCompose(!compose)}>创建子卡贴</button> : <p className="text-sm text-(--od-text-secondary)">当前无法创建子卡贴（主帖锁定、归档或账号无发言权限）。</p>}
    {compose && canCreate && <ThreadBodyForm save={body => mutation.mutate({ body })} pending={mutation.isPending} cancel={() => setCompose(false)} />}
    {mutation.isSuccess && <p role="status">操作已提交；原生帖子创建完成后将自动显示。</p>}
    {mutation.error && <p role="alert">{workError(mutation.error)}</p>}
  </section>;
}
