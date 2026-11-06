import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { getForumAuthConfig } from '@/features/auth/api/fluxerAuthApi';
import type { Work } from './types';

export function workDiscussionUrl(work: Work, fluxerApiUrl?: string | null): string | null {
  if (work.sync_status === 'pending' || work.deleted_at || !/^\d+$/.test(work.source_guild_id || '') || !/^\d+$/.test(work.source_thread_id || '')) return null;
  let base = 'https://discord.com';
  if (work.source_platform === 'fluxer') {
    try {
      const url = new URL(fluxerApiUrl || '');
      if (!['https:', 'http:'].includes(url.protocol) || url.username || url.password) return null;
      base = url.origin;
    } catch { return null; }
  } else if (work.source_platform !== 'discord') return null;
  return `${base}/channels/${work.source_guild_id}/${work.source_thread_id}`;
}

export function WorkDiscussionLinks({ work }: { work: Work }) {
  const config = useQuery({ queryKey: ['works-v2', 'native-config'], queryFn: getForumAuthConfig, enabled: work.source_platform === 'fluxer', retry: false });
  const href = workDiscussionUrl(work, config.error ? null : config.data?.fluxer_api_url);
  const style = 'inline-flex min-h-11 items-center justify-center rounded-lg border border-(--od-shell-line) px-5 py-2 font-medium hover:bg-(--od-interactive-hover)';
  return <nav aria-label="作品讨论" className="my-5 flex flex-wrap gap-3">
    {href ? <a className={style} href={href} target="_blank" rel="noreferrer">主讨论区 ↗</a> : <button className={style} disabled title="主讨论帖尚未就绪或链接暂不可用">主讨论区（暂不可用）</button>}
    <Link className={style} to={`/works/${encodeURIComponent(work.id)}/cards`}>子卡区</Link>
    {config.error && <button type="button" className="underline" onClick={() => void config.refetch()}>重试讨论链接</button>}
  </nav>;
}
