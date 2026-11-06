import { useContext } from 'react';
import { PreferencePreviewContext } from '@/features/preferences/lib/preferenceDisplay';
import { isAxiosError } from 'axios';
import { Link } from 'react-router-dom';
import type { Work } from './types';

export function workError(error: unknown): string {
  if (isAxiosError(error)) {
    const data: unknown = error.response?.data;
    if (data && typeof data === 'object') {
      // Forum uses detail; Fluxer returns code/message and optional field errors.
      const body = data as Record<string, unknown>;
      if (typeof body.detail === 'string') return body.detail;
      if (body.detail && typeof body.detail === 'object' && 'message' in body.detail && typeof body.detail.message === 'string') return body.detail.message;
      if (typeof body.message === 'string' || typeof body.code === 'string') {
        const code = typeof body.code === 'string' ? body.code : '';
        const message = typeof body.message === 'string' ? body.message : '';
        const hints: Record<number, string> = { 400: '请求参数无效', 403: '当前账号无权执行此操作', 404: '频道或消息不存在，或当前不可见', 429: '请求过于频繁，请稍后重试' };
        const summary = [hints[error.response?.status ?? 0], message, code && code !== message ? `错误码：${code}` : ''].filter(Boolean);
        if (Array.isArray(body.errors)) {
          for (const field of body.errors) {
            if (field && typeof field === 'object' && typeof field.message === 'string') {
              summary.push([typeof field.path === 'string' ? field.path : '', field.message, typeof field.code === 'string' ? field.code : ''].filter(Boolean).join('：'));
            }
          }
        }
        if (error.response?.status === 429 && typeof body.retry_after === 'number' && Number.isFinite(body.retry_after) && body.retry_after >= 0) summary.push(`请在 ${Math.ceil(body.retry_after)} 秒后重试`);
        return summary.filter(Boolean).join('；') || '请求失败，请重试';
      }
    }
    if (error.response?.status === 404) return '内容不存在或当前不可见';
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
