import type { FormEvent } from 'react';
import { workSortOptions } from './advancedSearch';

const fields = [
  ['include_tags', '包含标签', '多个标签用逗号分隔'],
  ['exclude_tags', '排除标签', '多个标签用逗号分隔'],
  ['include_authors', '包含作者编号', '多个用户编号用逗号分隔'],
  ['exclude_authors', '排除作者编号', '多个用户编号用逗号分隔'],
  ['exclude_keywords', '排除关键词', '多个词用逗号分隔'],
  ['exemption_markers', '排除词豁免标记', '例如：无、没有'],
  ['created_after', '发布于此时间之后', 'YYYY-MM-DD 或 -7d'],
  ['created_before', '发布于此时间之前', 'YYYY-MM-DD 或 -7d'],
  ['active_after', '活跃于此时间之后', 'YYYY-MM-DD 或 -7d'],
  ['active_before', '活跃于此时间之前', 'YYYY-MM-DD 或 -7d'],
  ['reaction_count_range', '反应数范围', '[0, 10000000)'],
  ['reply_count_range', '回复数范围', '[0, 10000000)'],
] as const;

export function WorkSearchFilters({ params, apply }: { params: URLSearchParams; apply: (next: URLSearchParams) => void }) {
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const values = new FormData(event.currentTarget);
    const next = new URLSearchParams(params);
    next.delete('offset');
    for (const name of [...fields.map(([key]) => key), 'tag_logic', 'sort_method', 'custom_base_sort', 'sort_order', 'platform']) {
      const value = String(values.get(name) || '').trim();
      if (value) next.set(name, value); else next.delete(name);
    }
    next.set('apply_preferences', values.has('apply_preferences') ? 'true' : 'false');
    if (values.has('collected')) next.set('collected', 'true'); else next.delete('collected');
    apply(next);
  }
  return <details className="mb-5 rounded border p-4"><summary className="cursor-pointer font-medium">高级筛选与排序</summary>
    <form key={params.toString()} onSubmit={submit} className="mt-4 grid gap-3 sm:grid-cols-2">
      {fields.map(([name, label, placeholder]) => <label className="grid gap-1 text-sm" key={name}>{label}<input name={name} defaultValue={params.get(name) || ''} placeholder={placeholder} className="rounded border bg-transparent p-2" /></label>)}
      <label className="grid gap-1 text-sm">标签匹配<select name="tag_logic" defaultValue={params.get('tag_logic') || 'and'} className="rounded border bg-(--od-bg) p-2"><option value="and">包含全部标签</option><option value="or">包含任一标签</option></select></label>
      <label className="grid gap-1 text-sm">主来源<select name="platform" defaultValue={params.get('platform') || ''} className="rounded border bg-(--od-bg) p-2"><option value="">全部来源</option><option value="fluxer">Fluxer</option><option value="discord">Discord</option></select></label>
      <label className="grid gap-1 text-sm">排序<select name="sort_method" defaultValue={params.get('sort_method') || 'comprehensive'} className="rounded border bg-(--od-bg) p-2">{workSortOptions.map(([value, label]) => <option value={value} key={value}>{label}</option>)}</select></label>
      <label className="grid gap-1 text-sm">自定义排序基础<select name="custom_base_sort" defaultValue={params.get('custom_base_sort') || 'comprehensive'} className="rounded border bg-(--od-bg) p-2">{workSortOptions.filter(([value]) => value !== 'custom').map(([value, label]) => <option value={value} key={value}>{label}</option>)}</select></label>
      <label className="grid gap-1 text-sm">排序方向<select name="sort_order" defaultValue={params.get('sort_order') || 'desc'} className="rounded border bg-(--od-bg) p-2"><option value="desc">降序</option><option value="asc">升序</option></select></label>
      <label className="text-sm"><input name="apply_preferences" type="checkbox" defaultChecked={params.get('apply_preferences') !== 'false'} /> 应用我的搜索偏好</label>
      <label className="text-sm"><input name="collected" type="checkbox" defaultChecked={params.get('collected') === 'true'} /> 仅搜索我的收藏</label>
      <div className="flex gap-4 sm:col-span-2"><button className="rounded border px-4 py-2">应用高级筛选</button><button type="button" className="underline" onClick={() => { const next = new URLSearchParams(); if (params.get('q')) next.set('q', params.get('q')!); apply(next); }}>清空筛选</button></div>
    </form>
  </details>;
}
