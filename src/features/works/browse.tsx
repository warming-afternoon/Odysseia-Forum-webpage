import { useState, type FormEvent } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useParams, useSearchParams } from 'react-router-dom';
import { worksApi } from './api';
import { workGovernanceApi } from './governanceApi';
import { buildAdvancedWorkSearch } from './advancedSearch';
import { WorkSearchFilters } from './searchFilters';
import { WorkAuthorProfile } from './authors';
import { workKeys, WorksBanners } from './layout';
import { WorkGrid, WorkPagination, WorkStatus } from './components';

export function WorksSearchPage() {
  const [params, setParams] = useSearchParams();
  const { userId } = useParams();
  const q = params.get('q') || '';
  const [draft, setDraft] = useState({ query: q, text: q });
  const text = draft.query === q ? draft.text : q;
  const query = buildAdvancedWorkSearch(params, userId);
  const result = useQuery({ queryKey: [...workKeys.all, 'search', query], queryFn: ({ signal }) => workGovernanceApi.search(query, signal), retry: false });
  function change(name: string, value: string) {
    const next = new URLSearchParams(params); next.delete('offset');
    if (value) next.set(name, value); else next.delete(name);
    setParams(next);
  }
  function submit(event: FormEvent) { event.preventDefault(); change('q', text.trim()); }
  return <>
    {userId ? <WorkAuthorProfile authorId={userId} /> : <WorksBanners />}
    <form onSubmit={submit} className="mb-4 flex gap-2"><input aria-label="搜索作品" className="min-w-0 flex-1 rounded border bg-transparent p-2" value={text} onChange={event => setDraft({ query: q, text: event.target.value })} placeholder="搜索作品" /><button className="rounded border px-4">搜索</button></form>
    <div className="mb-5 flex flex-wrap gap-3">
      <label>内容分级 <select className="rounded border bg-(--od-bg) p-2" value={params.get('is_nsfw') || ''} onChange={event => change('is_nsfw', event.target.value)}><option value="">全部可见</option><option value="false">SFW</option><option value="true">NSFW</option></select></label>
      <label>区域 <select className="rounded border bg-(--od-bg) p-2" value={params.get('is_abyss') || ''} onChange={event => change('is_abyss', event.target.value)}><option value="">全部可见</option><option value="false">普通</option><option value="true">深渊</option></select></label>
      {params.get('tag_id') && <button className="underline" onClick={() => change('tag_id', '')}>清除标签筛选</button>}
    </div>
    <WorkSearchFilters params={params} apply={setParams} />
    <WorkStatus pending={result.isPending} error={result.error} />
    {result.data && !result.error && <><WorkGrid works={result.data.items} />{result.data.total > 0 && <WorkPagination offset={query.offset} total={result.data.total} onChange={value => change('offset', String(value))} />}</>}
  </>;
}
export function WorksCollectionPage() {
  const [offset, setOffset] = useState(0);
  const result = useQuery({ queryKey: [...workKeys.all, 'collection', offset], queryFn: ({ signal }) => worksApi.collection(offset, signal), retry: false });
  return <><h2 className="mb-4 text-xl">默认收藏书单</h2><WorkStatus pending={result.isPending} error={result.error} />{result.data && !result.error && <><WorkGrid works={result.data.items} />{result.data.total > 0 && <WorkPagination offset={offset} total={result.data.total} onChange={setOffset} />}</>}</>;
}
export function WorksDiscoverPage() {
  const result = useQuery({ queryKey: [...workKeys.all, 'discover'], queryFn: ({ signal }) => worksApi.discovery(signal), retry: false });
  return <><h2 className="mb-4 text-xl">发现作品</h2><WorksBanners /><WorkStatus pending={result.isPending} error={result.error} />{result.data && !result.error && <WorkGrid works={result.data.items} />}</>;
}
