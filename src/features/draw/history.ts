import type { Thread } from '@/entities/thread/types';
import { worksApi } from '@/features/works/api';
import { workToThread } from '@/features/works/workPresentation';
const key = (userId: string) => `odysseia_draw_work_ids:${userId}`;
/** Only identifiers are persisted. Titles, descriptions and images require a fresh authorized read. */
export function saveWorkDrawHistory(userId: string, rows: Thread[]) {
  try { localStorage.setItem(key(userId), JSON.stringify(rows.map(row => row.work?.id).filter(Boolean).slice(0, 50))); } catch { /* storage unavailable */ }
}
export async function restoreWorkDrawHistory(userId: string, signal: AbortSignal): Promise<Thread[]> {
  let ids: string[];
  try {
    const parsed: unknown = JSON.parse(localStorage.getItem(key(userId)) || '[]');
    ids = Array.isArray(parsed) ? [...new Set(parsed.filter((id): id is string => typeof id === 'string' && /^\d+$/.test(id)))].slice(0, 50) : [];
  } catch { return []; }
  const results: Thread[] = [];
  // Bounded requests, preserving the original random order; forbidden/missing works stay hidden.
  for (let start = 0; start < ids.length && !signal.aborted; start += 5) {
    const batch = await Promise.all(ids.slice(start, start + 5).map(async id => {
      try { return workToThread(await worksApi.get(id, signal)); } catch { return null; }
    }));
    results.push(...batch.filter((row): row is Thread => row !== null));
  }
  return signal.aborted ? [] : results;
}
