import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Link, useNavigate } from 'react-router-dom';
import { WorkFollowActions } from './social';
import { WorkTasks } from './tasks';
import { WorkBooklistPicker } from './booklists';
import { WorkAnnouncements } from './announcements';
import { WorkThreads } from './threads';
import { WorkDiscussionLinks } from './WorkDiscussionLinks';
import { WorkModerationPanel } from './moderation';
import { WorkTagGovernance } from './tagGovernance';
import { worksApi } from './api';
import { workKeys } from './layout';
import { workError } from './components';
import { useWorkMember } from './member';
import type { Work } from './types';

/** Existing V2 actions inside the original preview, not a second detail page. */
export function WorkPresentationControls({ work }: { work: Work }) {
  const member = useWorkMember();
  const client = useQueryClient();
  const navigate = useNavigate();
  const canManage = !!member.data && (member.data.id === work.author_id || member.data.is_admin);
  const awaitingSource = work.sync_status === 'pending' || (work.source_platform === 'fluxer' && !work.source_thread_id);
  const collection = useMutation({ mutationFn: (collect: boolean) => worksApi.collect(work.id, collect), onSuccess: () => client.invalidateQueries({ queryKey: workKeys.all }) });
  const remove = useMutation({
    mutationFn: () => worksApi.remove(work.id),
    onSuccess: async () => { await client.invalidateQueries({ queryKey: workKeys.all }); navigate('/'); },
  });
  return <><WorkDiscussionLinks work={work} /><details className="mb-6 border-t border-(--od-shell-line) pt-4">
    <summary className="cursor-pointer text-sm font-medium text-(--od-text-secondary)">讨论、公告与作品操作</summary>
    <div className="mt-4">
      {awaitingSource && <p role="status">原生主帖正在创建，同步完成后可编辑作品、发布公告和管理讨论。</p>}
      {canManage && !awaitingSource && <Link className="underline" to={`/works/${encodeURIComponent(work.id)}/edit`}>编辑作品</Link>}
      <div className="my-4 flex gap-3"><button disabled={collection.isPending} onClick={() => collection.mutate(true)}>加入默认收藏书单</button><button disabled={collection.isPending} onClick={() => collection.mutate(false)}>取消收藏</button></div>
      {collection.error && <p role="alert">{workError(collection.error)}</p>}
      <WorkFollowActions workId={work.id} />
      <WorkBooklistPicker workId={work.id} />
      <WorkTagGovernance workId={work.id} canManage={canManage} />
      {!awaitingSource && <><WorkThreads workId={work.id} authorId={work.author_id} /><WorkAnnouncements workId={work.id} authorId={work.author_id} /></>}
      {canManage && <><WorkTasks workId={work.id} />{!awaitingSource && <WorkModerationPanel workId={work.id} sourcePlatform={work.source_platform} />}
        <button className="my-4 rounded border px-3 py-2" disabled={remove.isPending} onClick={() => { if (window.confirm('隐藏这个作品及其主帖展示？管理员可恢复尚未从来源平台删除的作品。')) remove.mutate(); }}>隐藏作品</button>
      </>}
      {remove.error && <p role="alert">{workError(remove.error)}</p>}
    </div>
  </details></>;
}
