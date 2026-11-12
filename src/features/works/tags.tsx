import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { worksApi } from './api';
import { workKeys } from './layout';
import { WorkStatus } from './components';
import type { WorkTag } from './types';

const PAGE_SIZE = 100;

export function WorkTagPicker({ add, pending, label = '添加标签', selectedIds = [] }: {
  add: (id: string, tag: WorkTag) => void;
  pending: boolean;
  label?: string;
  selectedIds?: string[];
}) {
  const [search, setSearch] = useState('');
  const [offset, setOffset] = useState(0);
  const query = useQuery({
    queryKey: [...workKeys.all, 'tags', search, ...(offset ? [offset] : [])],
    queryFn: ({ signal }) => worksApi.tags(search, signal, offset, PAGE_SIZE),
    retry: false,
  });
  return <div className="mt-3">
    <label className="grid max-w-sm gap-1">{label}<input
      value={search}
      onChange={event => { setSearch(event.target.value); setOffset(0); }}
      onKeyDown={event => { if (event.key === 'Enter') event.preventDefault(); }}
      placeholder="按名称或别名查找标签"
      className="rounded border bg-transparent p-2"
    /></label>
    <WorkStatus pending={query.isPending} error={query.error} />
    {query.error && <button type="button" className="mt-2 underline" disabled={query.isFetching} onClick={() => void query.refetch()}>重试加载标签</button>}
    {!query.error && <>
      <div className="mt-3 flex flex-wrap gap-2">{query.data?.items?.map(tag => <button
        key={tag.id}
        type="button"
        title={tag.category_name}
        className="rounded-full border px-3 py-1 text-sm disabled:opacity-50"
        disabled={pending || selectedIds.includes(tag.id)}
        onClick={() => add(tag.id, tag)}
      >{selectedIds.includes(tag.id) ? '已选' : '＋'} {tag.name}</button>)}</div>
      {query.data?.items?.length === 0 && <p className="mt-2 text-sm text-(--od-text-secondary)">没有匹配的可选标签。</p>}
    </>}
    {(offset > 0 || query.data?.has_more) && <div className="mt-3 flex items-center gap-4 text-sm">
      <button type="button" disabled={pending || query.isFetching || offset === 0} onClick={() => setOffset(current => Math.max(0, current - PAGE_SIZE))}>上一页标签</button>
      <span>第 {Math.floor(offset / PAGE_SIZE) + 1} 页</span>
      <button type="button" disabled={pending || query.isFetching || !!query.error || !query.data?.has_more} onClick={() => setOffset(current => current + PAGE_SIZE)}>下一页标签</button>
    </div>}
  </div>;
}
