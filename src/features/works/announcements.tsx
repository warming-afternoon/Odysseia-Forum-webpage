import { useState, type FormEvent } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { worksApi } from './api';
import { useWorkMember } from './member';
import { workKeys } from './layout';
import { WorkPagination, WorkStatus, workError } from './components';
import type { AnnouncementInput, WorkAnnouncement } from './types';

function AnnouncementForm({ initial, save, pending, cancel }: { initial?: WorkAnnouncement; save: (body: AnnouncementInput) => void; pending: boolean; cancel?: () => void }) {
  const [title, setTitle] = useState(initial?.title || '');
  const [body, setBody] = useState(initial?.body || '');
  const [images, setImages] = useState(initial?.images.join('\n') || '');
  function submit(event: FormEvent) { event.preventDefault(); save({ title: title.trim() || null, body, images: images.split('\n').map(image => image.trim()).filter(Boolean) }); }
  return <form className="my-4 grid max-w-3xl gap-3" onSubmit={submit}>
    <label className="grid gap-1">标题（选填）<input value={title} onChange={event => setTitle(event.target.value)} className="rounded border bg-transparent p-2" /></label>
    <label className="grid gap-1">公告正文<textarea required rows={5} value={body} onChange={event => setBody(event.target.value)} className="rounded border bg-transparent p-2" /></label>
    <label className="grid gap-1">公告图片地址（每行一张）<textarea value={images} onChange={event => setImages(event.target.value)} className="rounded border bg-transparent p-2" /></label>
    <div className="flex gap-3"><button disabled={pending || !body.trim()} className="rounded border px-4 py-2">{pending ? '提交中…' : initial ? '保存编辑' : '发布更新公告'}</button>{cancel && <button type="button" onClick={cancel}>取消</button>}</div>
  </form>;
}
export function WorkAnnouncements({ workId, authorId }: { workId: string; authorId: string | null }) {
  const member = useWorkMember();
  const queryClient = useQueryClient();
  const [editing, setEditing] = useState<string | null>(null);
  const [compose, setCompose] = useState(false);
  const [offset, setOffset] = useState(0);
  const query = useQuery({ queryKey: [...workKeys.all, 'announcements', workId, offset], queryFn: ({ signal }) => worksApi.announcements(workId, signal, offset), retry: false });
  const mutation = useMutation({ mutationFn: async (action: { body?: AnnouncementInput; announcementId?: string; withdraw?: boolean }) => action.withdraw
    ? worksApi.withdrawAnnouncement(workId, action.announcementId!)
    : action.announcementId ? worksApi.updateAnnouncement(workId, action.announcementId, action.body!) : worksApi.publishAnnouncement(workId, action.body!),
    onSuccess: async () => { setEditing(null); setCompose(false); await queryClient.invalidateQueries({ queryKey: workKeys.all }); },
  });
  const own = !query.error && !!member.data && (member.data.id === authorId || member.data.is_admin);
  return <section className="my-6 border-t pt-5"><h3 className="text-xl">更新公告</h3>
    {own && <><p className="my-2 text-sm text-(--od-text-secondary)">手动发布会发送一条独立通知。编辑不再通知；历史公告不会向新关注者补发。</p><button disabled={!member.data?.can_speak} onClick={() => setCompose(!compose)} className="rounded border px-4 py-2">撰写公告</button></>}
    {compose && own && <AnnouncementForm save={body => mutation.mutate({ body })} pending={mutation.isPending} cancel={() => setCompose(false)} />}
    <WorkStatus pending={query.isPending} error={query.error} />
    {!query.error && query.data?.items.map(item => <article className="my-4 rounded border p-4" key={item.id}>
      <p className="text-xs text-(--od-text-secondary)">{new Date(item.created_at).toLocaleString()}</p>
      {item.withdrawn_at ? <p className="mt-2">已撤回</p> : editing === item.id ? <AnnouncementForm initial={item} save={body => mutation.mutate({ body, announcementId: item.id })} pending={mutation.isPending} cancel={() => setEditing(null)} /> : <>
        {item.title && <h4 className="my-2 font-semibold">{item.title}</h4>}<p className="my-2 whitespace-pre-wrap break-words">{item.body}</p>
        <div className="grid gap-2 sm:grid-cols-2">{item.images.map((url, index) => <img key={`${index}-${url}`} src={url} alt={`公告图片 ${index + 1}`} className="max-h-80 rounded object-contain" loading="lazy" />)}</div>
        {own && <div className="mt-3 flex gap-4"><button disabled={mutation.isPending} className="underline" onClick={() => setEditing(item.id)}>编辑</button><button disabled={mutation.isPending} className="underline" onClick={() => mutation.mutate({ announcementId: item.id, withdraw: true })}>撤回</button></div>}
      </>}
    </article>)}
    {query.data?.items.length === 0 && <p className="my-4 text-sm">暂无公告</p>}
    {query.data && query.data.total > 0 && <WorkPagination offset={offset} total={query.data.total} onChange={value => { setOffset(value); setEditing(null); }} />}
    {mutation.error && <p role="alert">{workError(mutation.error)}</p>}
  </section>;
}
