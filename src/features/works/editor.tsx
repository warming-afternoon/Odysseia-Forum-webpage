import { useWorkMember } from './member';
import { useState, type FormEvent } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate, useParams } from 'react-router-dom';
import { worksApi } from './api';
import { workKeys } from './layout';
import { workError, WorkStatus } from './components';
import type { Work, WorkInput } from './types';
import { nativeMessagesApi, type NativeMessage } from './nativeApi';
import { uploadWorkAttachments } from './attachmentUpload';
import { WorkImageEditor, type WorkImageEntry } from './WorkImageEditor';

function WorkFields({ work, starter, save, pending }: { work?: Work; starter?: NativeMessage; save: (input: WorkInput) => void; pending: boolean }) {
  const [title, setTitle] = useState(work?.title || '');
  const initialDescription = starter?.content ?? work?.description ?? '';
  const [description, setDescription] = useState(initialDescription);
  const [entries, setEntries] = useState<WorkImageEntry[]>(() => (starter?.attachments || []).map(attachment => ({ key: attachment.id, attachment })));
  const [uploading, setUploading] = useState(false);
  const [nsfw, setNsfw] = useState(work?.is_nsfw || false);
  const [abyss, setAbyss] = useState(work?.is_abyss || false);
  const [error, setError] = useState('');
  async function submit(event: FormEvent) {
    event.preventDefault();
    if (entries.length > 10 || uploading || pending) return;
    setError(''); setUploading(true);
    try {
      const files = entries.flatMap(entry => 'file' in entry ? [entry.file] : []);
      const target = files.length ? (work?.source_thread_id ? work.source_thread_id : (await worksApi.uploadTarget(nsfw, abyss)).channel_id) : '';
      const uploaded = await uploadWorkAttachments(target, files);
      let next = 0;
      const attachments = entries.map(entry => 'attachment' in entry ? { id: entry.attachment.id } : uploaded[next++]);
      save({ title: title.trim(), ...(work && description === initialDescription ? {} : { description }), ...(work?.source_platform === 'discord' ? {} : { attachments }), is_nsfw: nsfw, is_abyss: abyss });
    } catch (cause) { setError(workError(cause)); }
    finally { setUploading(false); }
  }
  return <form onSubmit={submit} className="grid max-w-3xl gap-4">
    <label className="grid gap-1">作品标题<input required maxLength={100} value={title} onChange={event => setTitle(event.target.value)} className="rounded border bg-transparent p-2" /></label>
    <label className="grid gap-1">正文<textarea maxLength={4000} rows={10} value={description} onChange={event => setDescription(event.target.value)} className="rounded border bg-transparent p-2" /></label>
    {work?.source_platform !== 'discord' && <WorkImageEditor entries={entries} change={setEntries} disabled={pending || uploading} />}

    <div className="flex gap-5"><label><input type="checkbox" checked={nsfw} onChange={event => setNsfw(event.target.checked)} /> NSFW</label><label><input type="checkbox" checked={abyss} disabled={work?.source_platform === 'discord'} onChange={event => setAbyss(event.target.checked)} /> 深渊</label></div>
    {work && <p className="text-sm text-(--od-text-secondary)">分类调整将在后台迁移频道，可在作品页查看进度。</p>}
    {error && <p role="alert">{error}</p>}
    <button disabled={pending || uploading || entries.length > 10 || !title.trim()} className="w-fit rounded border px-5 py-2 disabled:opacity-40">{uploading ? '上传图片中…' : pending ? '保存中…' : '保存作品'}</button>
  </form>;
}
export function WorkForm(props: { work?: Work; save: (input: WorkInput) => void; pending: boolean }) {
  const awaitingSource = props.work?.sync_status === 'pending' || (props.work?.source_platform === 'fluxer' && !props.work.source_thread_id);
  const native = !awaitingSource && props.work?.source_platform === 'fluxer' && !!props.work.source_thread_id;
  const starter = useQuery({ queryKey: [...workKeys.all, 'starter-edit', props.work?.source_thread_id], queryFn: ({ signal }) => nativeMessagesApi.get(props.work!.source_thread_id!, props.work!.source_thread_id!, signal), enabled: native, retry: false });
  if (awaitingSource) return <p role="status">原生主帖正在创建，暂时不能编辑或上传图片。请等待同步完成。</p>;
  if (native && (!starter.data || starter.error)) return <WorkStatus pending={starter.isPending} error={starter.error} />;
  return <WorkFields {...props} starter={starter.data} />;
}
export function WorkEditPage() {
  const { workId = '' } = useParams();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const query = useQuery({ queryKey: [...workKeys.all, 'detail', workId], queryFn: ({ signal }) => worksApi.get(workId, signal), retry: false, refetchInterval: query => { const work = query.state.data; return work && (work.sync_status === 'pending' || (work.source_platform === 'fluxer' && !work.source_thread_id)) ? 3000 : false; } });
  const mutation = useMutation({ mutationFn: (body: WorkInput) => worksApi.update(workId, body), onSuccess: async () => { await queryClient.invalidateQueries({ queryKey: workKeys.all }); navigate(`/works/${encodeURIComponent(workId)}`); } });
  return <><h2 className="mb-4 text-xl">编辑作品</h2><WorkStatus pending={query.isPending} error={query.error} />{query.data && !query.error && <WorkForm key={query.data.id} work={query.data} save={input => mutation.mutate(input)} pending={mutation.isPending} />}{mutation.error && <p role="alert">{workError(mutation.error)}</p>}</>;
}


export function WorkCreatePage() {
  const member = useWorkMember();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const mutation = useMutation({ mutationFn: worksApi.create, onSuccess: async result => {
    await queryClient.invalidateQueries({ queryKey: workKeys.all });
    navigate(`/works/${encodeURIComponent(result.work.id)}`);
  } });
  return <><h2 className="mb-4 text-xl">发布作品</h2><WorkStatus pending={member.isPending} error={member.error} />{member.data && !member.error && (member.data.can_create_work && member.data.can_speak ? <WorkForm save={input => mutation.mutate(input)} pending={mutation.isPending} /> : <p>发布作品需要当前 Discord 正式成员身份及发言权限。</p>)}{mutation.error && <p role="alert">{workError(mutation.error)}</p>}</>;
}
