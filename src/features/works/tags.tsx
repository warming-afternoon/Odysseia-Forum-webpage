import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { worksApi } from './api';
import { workKeys } from './layout';
import { WorkStatus } from './components';
export function WorkTagPicker({ add, pending, label = '添加标签' }: { add: (id: string) => void; pending: boolean; label?: string }) {
  const [search, setSearch] = useState('');
  const query = useQuery({ queryKey: [...workKeys.all, 'tags', search], queryFn: ({ signal }) => worksApi.tags(search, signal), retry: false });
  return <div className="mt-3"><label className="grid max-w-sm gap-1">{label}<input value={search} onChange={event => setSearch(event.target.value)} placeholder="按名称查找标签" className="rounded border bg-transparent p-2" /></label><WorkStatus pending={query.isPending} error={query.error} /><div className="mt-3 flex flex-wrap gap-2">{!query.error && query.data?.items.map(tag => <button key={tag.id} className="rounded-full border px-3 py-1 text-sm" disabled={pending} onClick={() => add(tag.id)}>＋ {tag.name}</button>)}</div></div>;
}
