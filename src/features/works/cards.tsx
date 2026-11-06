import { useQuery } from '@tanstack/react-query';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { worksApi } from './api';
import { workKeys } from './layout';
import { WorkStatus } from './components';
import { WorkThreads } from './threads';
import { WorkTasks } from './tasks';
import type { WorkCardsQuery } from './types';

export const cardSortOptions = [
  ['last_active', '最近活跃'], ['created_at', '最新发布'], ['reply_count', '回复数'],
  ['reaction_count', '反应数'], ['comprehensive', '相关度'], ['reddit_hot', '热度'], ['collection_count', '收藏数'],
] as const;
export function parseCardParams(params: URLSearchParams): WorkCardsQuery {
  const raw = Number(params.get('offset') || 0);
  return {
    offset: Number.isSafeInteger(raw) && raw >= 0 && raw <= 100000 ? raw : 0,
    limit: 20,
    sort_method: cardSortOptions.find(([value]) => value === params.get('sort'))?.[0] || 'last_active',
    sort_order: params.get('order') === 'asc' ? 'asc' : 'desc',
  };
}
export function WorkCardsPage() {
  const { workId = '' } = useParams();
  const [params, setParams] = useSearchParams();
  const cards = parseCardParams(params);
  const work = useQuery({ queryKey: [...workKeys.all, 'detail', workId], queryFn: ({ signal }) => worksApi.get(workId, signal), retry: false });
  function update(key: string, value: string) {
    setParams(previous => { const next = new URLSearchParams(previous); next.set(key, value); if (key !== 'offset') next.delete('offset'); return next; });
  }
  return <main className="mx-auto w-full max-w-6xl p-4 sm:p-6">
    <Link className="underline" to={`/works/${encodeURIComponent(workId)}`}>返回作品</Link>
    <h1 className="my-5 text-2xl font-semibold">{work.data && !work.error ? `${work.data.title} · 子卡区` : '子卡区'}</h1>
    <WorkStatus pending={work.isPending} error={work.error} />
    {work.error && <button className="underline" onClick={() => void work.refetch()}>重试加载作品</button>}
    {work.data && !work.error && <>
      <div className="flex flex-wrap gap-4">
        <label>排序方式 <select className="rounded border bg-(--od-bg-primary) p-2" value={cards.sort_method} onChange={event => update('sort', event.target.value)}>{cardSortOptions.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
        <label>排序方向 <select className="rounded border bg-(--od-bg-primary) p-2" value={cards.sort_order} onChange={event => update('order', event.target.value)}><option value="desc">降序</option><option value="asc">升序</option></select></label>
      </div>
      <WorkTasks workId={workId} />
      <WorkThreads workId={workId} authorId={work.data.author_id} cards={cards} onPageChange={offset => update('offset', String(offset))} />
    </>}
  </main>;
}
