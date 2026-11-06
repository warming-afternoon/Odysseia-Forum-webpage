import { useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { worksApi } from './api';
import { workKeys } from './layout';
import { WorkStatus } from './components';

// Query lifetime, not component lifetime: remounts must not announce old completions
// again. Cache removal (including account changes) naturally resets this record.
const announcedCompletions = new WeakMap<object, Set<string>>();

export function WorkTasks({ workId }: { workId: string }) {
  const queryClient = useQueryClient();
  const query = useQuery({ queryKey: [...workKeys.all, 'tasks', workId], queryFn: ({ signal }) => worksApi.tasks(workId, signal), retry: false,
    refetchInterval: query => query.state.data?.items.some(task => task.status === 'pending' || task.status === 'running') ? 3000 : false,
  });
  const taskQuery = queryClient.getQueryCache().find({ queryKey: [...workKeys.all, 'tasks', workId], exact: true });
  const finished = !query.error && query.data
    ? JSON.stringify(query.data.items.filter(task => task.status === 'done').map(task => task.id))
    : undefined;
  useEffect(() => {
    if (finished && taskQuery) {
      const seen = announcedCompletions.get(taskQuery) || new Set<string>();
      const completed = JSON.parse(finished) as string[];
      if (!completed.some(id => !seen.has(id))) return;
      // Record before invalidating: another observer may mount during the refresh.
      completed.forEach(id => seen.add(id));
      announcedCompletions.set(taskQuery, seen);
      void queryClient.invalidateQueries({ queryKey: [...workKeys.all, 'threads', workId] });
      void queryClient.invalidateQueries({ queryKey: [...workKeys.all, 'cards', workId] });
      void queryClient.invalidateQueries({ queryKey: [...workKeys.all, 'detail', workId] });
      void queryClient.invalidateQueries({ queryKey: [...workKeys.all, 'presentation', workId] });
    }
  }, [finished, queryClient, taskQuery, workId]);
  if (!query.data?.items.length && !query.error) return null;
  const labels: Record<string, string> = { move: '分类迁移', create_main: '创建主帖', create_child: '创建子卡贴', announcement: '公告通知' };
  const states = { pending: '排队中', running: '处理中', done: '已完成', failed: '失败' };
  return <section className="my-5 rounded border p-4"><h3 className="mb-2 text-lg">后台处理进度</h3><WorkStatus pending={query.isPending} error={query.error} />{!query.error && query.data?.items.map(task => <p className="my-2 text-sm" key={task.id}>{labels[task.kind] || task.kind} · {states[task.status]}{task.attempts > 0 ? ` · 尝试 ${task.attempts} 次` : ''}{task.error ? ` · ${task.error}` : ''}</p>)}</section>;
}
