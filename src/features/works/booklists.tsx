import { useState, type FormEvent } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, useParams } from 'react-router-dom';
import { worksApi } from './api';
import { workKeys } from './layout';
import { WorkGrid, WorkPagination, WorkStatus, workError } from './components';
import type { WorkBooklistDetail } from './types';

function BooklistForm({ initial, save, pending }: { initial?: Pick<WorkBooklistDetail, 'title' | 'description' | 'is_public'>; save: (body: { title: string; description: string; is_public: boolean }) => void; pending: boolean }) {
  const [title, setTitle] = useState(initial?.title || '');
  const [description, setDescription] = useState(initial?.description || '');
  const [isPublic, setPublic] = useState(initial?.is_public || false);
  function submit(event: FormEvent) { event.preventDefault(); save({ title: title.trim(), description, is_public: isPublic }); }
  return <form onSubmit={submit} className="my-4 grid max-w-xl gap-3">
    <label className="grid gap-1">书单标题<input required value={title} onChange={event => setTitle(event.target.value)} className="rounded border bg-transparent p-2" /></label>
    <label className="grid gap-1">简介<textarea value={description} onChange={event => setDescription(event.target.value)} className="rounded border bg-transparent p-2" /></label>
    <label><input type="checkbox" checked={isPublic} onChange={event => setPublic(event.target.checked)} /> 公开书单</label>
    <button disabled={pending || !title.trim()} className="w-fit rounded border px-4 py-2">{pending ? '保存中…' : '保存书单'}</button>
  </form>;
}
export function WorkBooklistsPage() {
  const queryClient = useQueryClient();
  const query = useQuery({ queryKey: [...workKeys.all, 'booklists'], queryFn: ({ signal }) => worksApi.booklists(signal), retry: false });
  const create = useMutation({ mutationFn: worksApi.createBooklist, onSuccess: () => queryClient.invalidateQueries({ queryKey: workKeys.all }) });
  return <><h2 className="text-xl">我的作品书单</h2><WorkStatus pending={query.isPending} error={query.error} /><div className="my-4 grid gap-3">{!query.error && query.data?.items.map(list => <Link className="rounded border p-4" to={`/works/booklists/${encodeURIComponent(list.id)}`} key={list.id}>{list.title}{list.is_default ? ' · 默认收藏' : ''}</Link>)}</div><h3 className="mt-6 text-lg">创建书单</h3><BooklistForm save={input => create.mutate(input)} pending={create.isPending} />{create.error && <p role="alert">{workError(create.error)}</p>}</>;
}
export function WorkBooklistPage() {
  const { booklistId = '' } = useParams();
  const [offset, setOffset] = useState(0);
  const [editing, setEditing] = useState(false);
  const queryClient = useQueryClient();
  const query = useQuery({ queryKey: [...workKeys.all, 'booklist', booklistId, offset], queryFn: ({ signal }) => worksApi.booklist(booklistId, offset, signal), retry: false });
  const mine = useQuery({ queryKey: [...workKeys.all, 'booklists'], queryFn: ({ signal }) => worksApi.booklists(signal) });
  const update = useMutation({ mutationFn: (body: { title: string; description: string; is_public: boolean }) => worksApi.updateBooklist(booklistId, body), onSuccess: async () => { setEditing(false); await queryClient.invalidateQueries({ queryKey: workKeys.all }); } });
  const remove = useMutation({ mutationFn: (workId: string) => worksApi.booklistItem(booklistId, workId, false), onSuccess: () => queryClient.invalidateQueries({ queryKey: workKeys.all }) });
  const own = !mine.error && mine.data?.items.some(list => list.id === booklistId);
  return <><WorkStatus pending={query.isPending} error={query.error} />{query.data && !query.error && <>
    <h2 className="text-xl">{query.data.title}</h2><p className="my-3 whitespace-pre-wrap">{query.data.description}</p>
    {own && <button onClick={() => setEditing(!editing)} className="mb-4 underline">编辑书单</button>}
    {editing && own && <BooklistForm initial={query.data} save={input => update.mutate(input)} pending={update.isPending} />}
    <WorkGrid works={query.data.items} />
    {own && <div className="mt-4 flex flex-wrap gap-3">{query.data.items.map(work => <button disabled={remove.isPending} onClick={() => remove.mutate(work.id)} className="rounded border p-2" key={work.id}>移出：{work.title}</button>)}</div>}
    {query.data.total > 0 && <WorkPagination offset={offset} total={query.data.total} onChange={setOffset} />}
  </>}{(remove.error || update.error) && <p role="alert">{workError(remove.error || update.error)}</p>}</>;
}
export function WorkBooklistPicker({ workId }: { workId: string }) {
  const [selected, setSelected] = useState('');
  const queryClient = useQueryClient();
  const lists = useQuery({ queryKey: [...workKeys.all, 'booklists'], queryFn: ({ signal }) => worksApi.booklists(signal) });
  const add = useMutation({ mutationFn: () => worksApi.booklistItem(selected, workId, true), onSuccess: () => queryClient.invalidateQueries({ queryKey: workKeys.all }) });
  return <div className="my-4"><WorkStatus pending={lists.isPending} error={lists.error} />{!lists.error && <div className="flex flex-wrap gap-2"><select aria-label="选择作品书单" value={selected} onChange={event => setSelected(event.target.value)} className="rounded border bg-(--od-bg) p-2"><option value="">选择书单</option>{lists.data?.items.map(list => <option key={list.id} value={list.id}>{list.title}</option>)}</select><button disabled={!selected || add.isPending} onClick={() => add.mutate()} className="rounded border px-3 py-2">加入书单</button></div>}{!lists.error && add.isSuccess && <p role="status">已加入书单</p>}{add.error && <p role="alert">{workError(add.error)}</p>}</div>;
}
