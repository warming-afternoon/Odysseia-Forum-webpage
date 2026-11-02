import { WorkTasks } from './tasks';
import { WorkBannerApply } from './bannerApplications';
import { WorkFollowActions } from './social';
import { useEffect } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useWorkMember } from './member';
import { WorkBooklistPicker } from './booklists';
import { WorkAnnouncements } from './announcements';
import { WorkThreads } from './threads';
import { WorkModerationPanel } from './moderation';
import { WorkTagGovernance } from './tagGovernance';
import { worksApi } from './api';
import { workKeys } from './layout';
import { workError, WorkStatus, WorkReactions } from './components';

export function WorkDetailPage() {
  const { workId = '' } = useParams();
  const member = useWorkMember();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const result = useQuery({ queryKey: [...workKeys.all, 'detail', workId], queryFn: ({ signal }) => worksApi.get(workId, signal), retry: false, staleTime: 0, refetchInterval: query => { const work = query.state.data; return work && (work.sync_status === 'pending' || (work.source_platform === 'fluxer' && !work.source_thread_id)) ? 3000 : false; } });
  const refresh = () => queryClient.invalidateQueries({ queryKey: workKeys.all });
  const collection = useMutation({ mutationFn: (collect: boolean) => worksApi.collect(workId, collect), onSuccess: refresh });
  const remove = useMutation({ mutationFn: () => worksApi.remove(workId), onSuccess: async () => { await queryClient.invalidateQueries({ queryKey: workKeys.all }); navigate('/works'); } });
  const work = result.data;
  const awaitingSource = !!work && (work.sync_status === 'pending' || (work.source_platform === 'fluxer' && !work.source_thread_id));
  const visibleWorkId = result.error ? undefined : work?.id;
  useEffect(() => { if (visibleWorkId) void worksApi.view(visibleWorkId).catch(() => undefined); }, [visibleWorkId]);
  const isAuthor = !!member.data && (member.data.id === work?.author_id || member.data.is_admin);

  return <>
    <WorkStatus pending={result.isPending} error={result.error} />
    {work && !result.error && <article>
      <div className="mb-4 flex items-center justify-between gap-3"><h2 className="text-2xl font-semibold">{work.title}</h2>{isAuthor && !awaitingSource && <Link className="underline" to={`/works/${encodeURIComponent(work.id)}/edit`}>编辑作品</Link>}</div>
      {awaitingSource && <p role="status" className="mb-4 rounded border p-3">原生主帖正在创建，请等待后台处理完成。同步完成后可编辑作品、发布公告和管理讨论。</p>}
      <p className="mb-3 text-sm">{work.is_abyss ? '深渊' : '普通'} · {work.is_nsfw ? 'NSFW' : 'SFW'}</p>
      {work.author_id && <Link className="underline" to={`/works/users/${encodeURIComponent(work.author_id)}`}>作者主页</Link>}
      <div className="my-4 grid gap-3 sm:grid-cols-2">{work.images.map((url, index) => <a key={`${index}-${url}`} href={url} target="_blank" rel="noreferrer"><img src={url} alt={`${work.title} 图片 ${index + 1}`} className="max-h-96 w-full rounded-lg object-contain" /></a>)}</div>
      <p className="my-5 whitespace-pre-wrap break-words">{work.description}</p>
      <WorkReactions reactions={work.reactions} />
      <p className="mb-4 text-sm">浏览 {work.statistics.view_count} · 收藏 {work.statistics.collection_count} · 回复 {work.statistics.reply_count}</p>
      <div className="mb-5 flex gap-3"><button disabled={collection.isPending} className="rounded border px-3 py-2" onClick={() => collection.mutate(true)}>加入默认收藏书单</button><button disabled={collection.isPending} className="rounded border px-3 py-2" onClick={() => collection.mutate(false)}>取消收藏</button></div>
      {collection.error && <p role="alert">{workError(collection.error)}</p>}
      <WorkFollowActions workId={workId} /><WorkBooklistPicker workId={workId} /><WorkTasks workId={workId} />
      <WorkTagGovernance workId={workId} canManage={isAuthor} />
      {!awaitingSource && member.data?.id === work.author_id && <WorkBannerApply workId={workId} />}
      {!awaitingSource && <><WorkThreads workId={workId} authorId={work.author_id} /><WorkAnnouncements workId={workId} authorId={work.author_id} /></>}
      {isAuthor && <>{!awaitingSource && <WorkModerationPanel workId={workId} sourcePlatform={work.source_platform} />}<button className="my-5 rounded border px-4 py-2" disabled={remove.isPending} onClick={() => { if (window.confirm('隐藏这个作品及其主帖展示？管理员可恢复尚未从来源平台删除的作品。')) remove.mutate(); }}>隐藏作品</button></>}
      {remove.error && <p role="alert">{workError(remove.error)}</p>}
    </article>}
  </>;
}
