import { useState, type FormEvent } from 'react';
import { useInfiniteQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { nativeMessagesApi, type NativeMessage } from './nativeApi';
import { useWorkMember } from './member';
import { workKeys } from './layout';
import { WorkStatus, workError } from './components';

function Message({ message, channelId, canEdit }: { message: NativeMessage; channelId: string; canEdit: boolean }) {
  const member = useWorkMember();
  const queryClient = useQueryClient();
  const [editing, setEditing] = useState(false);
  const [content, setContent] = useState(message.content);
  const update = useMutation({ mutationFn: () => nativeMessagesApi.edit(channelId, message.id, content), onSuccess: async () => { setEditing(false); await queryClient.invalidateQueries({ queryKey: [...workKeys.all, 'native', channelId] }); } });
  return <article className="border-b py-4">
    <p className="text-sm font-semibold">{message.author.global_name || message.author.username} <time className="ml-2 text-xs font-normal text-(--od-text-secondary)">{new Date(message.timestamp).toLocaleString()}{message.edited_timestamp ? ' · 已编辑' : ''}</time></p>
    {editing ? <form onSubmit={event => { event.preventDefault(); update.mutate(); }} className="my-2 grid gap-2"><textarea aria-label="编辑消息正文" value={content} onChange={event => setContent(event.target.value)} className="rounded border bg-transparent p-2" /><div className="flex gap-3"><button disabled={update.isPending || !content.trim()} className="underline">保存消息</button><button type="button" onClick={() => setEditing(false)}>取消</button></div></form> : <p className="my-2 whitespace-pre-wrap break-words">{message.content}</p>}
    <div className="grid gap-2 sm:grid-cols-2">{message.attachments?.map(attachment => attachment.content_type?.startsWith('image/') ? <a key={attachment.id} href={attachment.url} target="_blank" rel="noreferrer"><img src={attachment.url} alt={attachment.filename} className="max-h-80 rounded object-contain" loading="lazy" /></a> : <a className="underline" key={attachment.id} href={attachment.url} target="_blank" rel="noreferrer">{attachment.filename}</a>)}</div>
    <div className="mt-2 flex gap-3">{message.reactions?.map(reaction => <span key={reaction.emoji.id || reaction.emoji.name}>{reaction.emoji.name} {reaction.count}</span>)}</div>
    {member.data?.id === message.author.id && canEdit && <button onClick={() => setEditing(!editing)} className="mt-2 text-sm underline">编辑我的消息</button>}
    {update.error && <p role="alert">{workError(update.error)}</p>}
  </article>;
}
export function NativeThreadMessages({ channelId, canReply, canEditMessages = canReply, editStarter = false }: { channelId: string; canReply: boolean; canEditMessages?: boolean; editStarter?: boolean }) {
  const [content, setContent] = useState('');
  const [nonce, setNonce] = useState<string | null>(null);
  const queryClient = useQueryClient();
  const query = useInfiniteQuery({ queryKey: [...workKeys.all, 'native', channelId],
    queryFn: ({ pageParam, signal }) => nativeMessagesApi.list(channelId, pageParam, signal), initialPageParam: undefined as string | undefined,
    getNextPageParam: page => page.length === 50 ? page[page.length - 1].id : undefined,
    retry: false, refetchInterval: 30000,
  });
  const send = useMutation({ mutationFn: ({ text, requestNonce }: { text: string; requestNonce: string }) => nativeMessagesApi.send(channelId, text, requestNonce), onSuccess: async () => {
    setContent(''); setNonce(null); await queryClient.invalidateQueries({ queryKey: [...workKeys.all, 'native', channelId] });
  } });
  function submit(event: FormEvent) {
    event.preventDefault();
    const requestNonce = nonce || crypto.randomUUID().replace(/-/g, ''); setNonce(requestNonce);
    send.mutate({ text: content, requestNonce });
  }
  const messages = [...new Map(query.data?.pages.flat().map(message => [message.id, message]) || []).values()].reverse();
  return <div className="my-3">
    <WorkStatus pending={query.isPending} error={query.error} />
    {query.hasNextPage && <button disabled={query.isFetchingNextPage} onClick={() => query.fetchNextPage()} className="my-2 underline">加载更早消息</button>}
    {!query.error && messages.map(message => <Message key={message.id} message={message} channelId={channelId} canEdit={canEditMessages && (message.id !== channelId || editStarter)} />)}
    {canReply && !query.error && <form className="mt-4 grid gap-2" onSubmit={submit}>
      <label className="grid gap-1">回复<textarea rows={4} maxLength={2000} disabled={send.isPending} value={content} onChange={event => { setContent(event.target.value); setNonce(null); }} className="rounded border bg-transparent p-2" /></label>
      <button disabled={send.isPending || !content.trim()} className="w-fit rounded border px-4 py-2">{send.isPending ? '发送中…' : '发送回复'}</button>
    </form>}
    {send.error && <p role="alert">{workError(send.error)}</p>}
  </div>;
}
