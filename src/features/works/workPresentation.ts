import type { Thread } from '@/entities/thread/types';
import type { Work } from './types';

/** Keep logical work IDs separate from platform thread IDs, including 64-bit strings. */
export function workToThread(work: Work): Thread {
  const author = work.author?.id === work.author_id ? work.author : null;
  return {
    work,
    thread_id: work.id,
    title: work.title,
    channel_id: work.source_channel_id || '',
    guild_id: work.source_guild_id || '',
    author: work.author_id ? {
      id: work.author_id,
      name: author?.username || `作者 ${work.author_id}`,
      display_name: author?.display_name || author?.username || `作者 ${work.author_id}`,
      global_name: null,
      avatar_url: author?.avatar_url || null,
    } : null,
    created_at: work.created_at,
    first_message_excerpt: work.description,
    thumbnail_urls: work.images,
    tags: work.tags.map(tag => tag.name),
    reaction_count: work.statistics.reaction_count,
    reply_count: work.statistics.reply_count,
    collection_count: work.statistics.collection_count,
    display_count: work.statistics.view_count,
    collected_flag: false,
  };
}
