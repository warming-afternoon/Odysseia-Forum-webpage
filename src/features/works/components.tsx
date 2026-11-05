import { useContext } from 'react';
import { PreferencePreviewContext } from '@/features/preferences/lib/preferenceDisplay';
import { isAxiosError } from 'axios';
import { Link } from 'react-router-dom';
import type { Work } from './types';

export function workError(error: unknown): string {
  if (isAxiosError(error)) {
    if (error.response?.status === 404) return '作品不存在或当前不可见';
    const detail: unknown = error.response?.data?.detail;
    if (typeof detail === 'string') return detail;
    if (detail && typeof detail === 'object' && 'message' in detail) return String(detail.message);
  }
  return error instanceof Error ? error.message : '请求失败，请重试';
}
export function WorkCard({ work }: { work: Work }) {
  const preview = useContext(PreferencePreviewContext);
  return (
    <article className="overflow-hidden rounded-xl border border-(--od-border) p-4">
      <Link to={`/works/${encodeURIComponent(work.id)}`} className="block">
        {preview !== 'none' && work.images[0] && (
          <img
            src={work.images[0]}
            alt=""
            loading="lazy"
            className={
              preview === 'full'
                ? 'mb-3 h-auto w-full rounded-lg object-contain'
                : 'mb-3 aspect-video w-full rounded-lg object-cover'
            }
          />
        )}
        <h2 className="text-lg font-semibold">{work.title}</h2>
      </Link>
      <p className="my-2 line-clamp-3 whitespace-pre-wrap text-sm text-(--od-text-secondary)">
        {work.description}
      </p>
      <p className="text-xs">
        {work.is_abyss ? '深渊' : '普通'} · {work.is_nsfw ? 'NSFW' : 'SFW'} ·{' '}
        {work.statistics.reaction_count} 反应 · {work.statistics.collection_count} 收藏
      </p>
      <div className="mt-2 flex flex-wrap gap-2">
        {work.tags.map((tag) => (
          <Link
            className="text-sm underline"
            key={tag.id}
            to={`/works?tag_id=${encodeURIComponent(tag.id)}`}
          >
            #{tag.name}
          </Link>
        ))}
      </div>
      {work.author_id && (
        <Link
          className="mt-2 block text-sm underline"
          to={`/works/users/${encodeURIComponent(work.author_id)}`}
        >
          作者主页
        </Link>
      )}
    </article>
  );
}
export function WorkGrid({ works }: { works: Work[] }) {
  return works.length ? (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
      {works.map((work) => (
        <WorkCard key={work.id} work={work} />
      ))}
    </div>
  ) : (
    <p className="py-8 text-(--od-text-secondary)">暂无可见作品</p>
  );
}
export function WorkStatus({ pending, error }: { pending: boolean; error: unknown }) {
  if (pending)
    return (
      <p role="status" className="py-8">
        正在加载…
      </p>
    );
  if (error)
    return (
      <p role="alert" className="py-8">
        {workError(error)}
      </p>
    );
  return null;
}
export function WorkPagination({
  offset,
  total,
  limit = 20,
  onChange,
}: {
  offset: number;
  total: number;
  limit?: number;
  onChange: (offset: number) => void;
}) {
  return (
    <div className="mt-5 flex items-center gap-4">
      <button
        className="rounded border px-3 py-2 disabled:opacity-40"
        disabled={offset === 0}
        onClick={() => onChange(Math.max(0, offset - limit))}
      >
        上一页
      </button>
      <span>
        {offset + 1}–{Math.min(offset + limit, total)} / {total}
      </span>
      <button
        className="rounded border px-3 py-2 disabled:opacity-40"
        disabled={offset + limit >= total}
        onClick={() => onChange(offset + limit)}
      >
        下一页
      </button>
    </div>
  );
}

export function WorkReactions({ reactions }: { reactions: Work['reactions'] }) {
  return (
    <div aria-label="作品反应" className="my-4 flex flex-wrap gap-3">
      {reactions.map((reaction) => {
        const emoji = typeof reaction.emoji === 'string' ? reaction.emoji : reaction.emoji.name;
        const key = typeof reaction.emoji === 'string' ? emoji : reaction.emoji.id || emoji;
        return (
          <span key={key} className="rounded-full border px-3 py-1">
            {emoji} {reaction.count}
          </span>
        );
      })}
    </div>
  );
}
