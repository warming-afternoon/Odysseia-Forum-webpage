import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { worksApi } from './api';
import { workKeys } from './layout';
import { WorkGrid, WorkPagination, WorkStatus, workError } from './components';

export function WorkFollowsPage() {
  const [offset, setOffset] = useState(0);
  const query = useQuery({ queryKey: [...workKeys.all, 'follows', offset], queryFn: ({ signal }) => worksApi.follows(offset, signal), retry: false });
  return <><h2 className="mb-4 text-xl">关注的作品</h2><p className="mb-4 text-sm">关注后接收作者未来手动发布的更新公告。</p><WorkStatus pending={query.isPending} error={query.error} />{query.data && !query.error && <><WorkGrid works={query.data.items} />{query.data.total > 0 && <WorkPagination offset={offset} total={query.data.total} onChange={setOffset} />}</>}</>;
}
export function WorkNotificationsPage() {
  const [offset, setOffset] = useState(0);
  const queryClient = useQueryClient();
  const query = useQuery({ queryKey: [...workKeys.all, 'notifications', offset], queryFn: ({ signal }) => worksApi.notifications(offset, signal), retry: false, refetchInterval: 30000 });
  const read = useMutation({ mutationFn: worksApi.readNotification, onSuccess: async () => { await queryClient.invalidateQueries({ queryKey: workKeys.all }); await queryClient.invalidateQueries({ queryKey: ['notifications'] }); } });
  return <><h2 className="mb-4 text-xl">作品更新通知</h2><WorkStatus pending={query.isPending} error={query.error} />{query.data && !query.error && <>
    {query.data.items.map(notice => <article key={notice.id} className="mb-3 rounded border p-4">
      <p className="mb-2 text-xs">{new Date(notice.created_at).toLocaleString()} · {notice.read_at ? '已读' : '未读'}</p>
      {notice.withdrawn ? <p>公告已撤回</p> : <><h3 className="font-semibold">{notice.title || '作品更新公告'}</h3><p className="my-2 whitespace-pre-wrap">{notice.body}</p></>}
      <div className="mt-3 flex gap-4">{notice.work_id ? <Link className="underline" to={`/works/${encodeURIComponent(notice.work_id)}${notice.type === 'tag_review' ? '#tags' : ''}`}>{notice.type === 'tag_review' ? '查看作品标签审核' : '查看作品与公告历史'}</Link> : notice.target_type === 'booklist' && notice.target_id ? <Link className="underline" to={`/booklists/${encodeURIComponent(notice.target_id)}`}>查看书单标签审核</Link> : null}{!notice.read_at && <button className="underline" disabled={read.isPending} onClick={() => read.mutate(notice.id)}>标为已读</button>}</div>
    </article>)}
    {query.data.items.length === 0 && <p>暂无通知</p>}
    {query.data.total > 0 && <WorkPagination offset={offset} total={query.data.total} onChange={setOffset} />}
  </>}{read.error && <p role="alert">{workError(read.error)}</p>}</>;
}
export function WorkFollowActions({ workId }: { workId: string }) {
  const queryClient = useQueryClient();
  const mutation = useMutation({ mutationFn: (follow: boolean) => worksApi.follow(workId, follow), onSuccess: () => queryClient.invalidateQueries({ queryKey: workKeys.all }) });
  return <div className="my-4"><div className="flex gap-3"><button className="rounded border px-3 py-2" disabled={mutation.isPending} onClick={() => mutation.mutate(true)}>关注作品</button><button className="rounded border px-3 py-2" disabled={mutation.isPending} onClick={() => mutation.mutate(false)}>取消关注</button></div>{mutation.isSuccess && <p role="status">关注状态已更新</p>}{mutation.error && <p role="alert">{workError(mutation.error)}</p>}</div>;
}
