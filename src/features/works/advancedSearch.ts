import { tokenizeSearchPayload } from '@/shared/lib/searchTokenizer';
import type { AdvancedWorkSearch } from './governanceTypes';

export const workSortOptions = [['comprehensive', '综合排序'], ['created_at', '发布时间'], ['last_active', '最新活跃'], ['reaction_count', '反应数量'], ['reply_count', '回复数量'], ['collection_count', '收藏数量'], ['reddit_hot', '热门排序'], ['custom', '自定义顺序']] as const;

export function buildAdvancedWorkSearch(params: URLSearchParams, authorId?: string): AdvancedWorkSearch {
  const tokens = tokenizeSearchPayload(params.get('q') || '');
  const split = (value: string | null) => [...new Set((value || '').split(/[,，\n]/).map(item => item.trim()).filter(Boolean))];
  const merged = (values: string[], raw: string | null) => [...new Set([...values, ...split(raw)])];
  const authorNames = tokens.includeAuthors.filter(value => !/^\d+$/.test(value));
  const keywords = [...authorNames.map(name => `author:"${name.replace(/"/g, '')}"`), tokens.text].filter(Boolean).join(' ');
  const parsedOffset = Number(params.get('offset'));
  const query: AdvancedWorkSearch = {
    offset: Number.isSafeInteger(parsedOffset) && parsedOffset >= 0 ? parsedOffset : 0, limit: 20,
    keywords: keywords || undefined,
    include_tags: merged(tokens.includeTags, params.get('include_tags')),
    exclude_tags: merged(tokens.excludeTags, params.get('exclude_tags')),
    include_tag_ids: merged(tokens.includeTagIds, params.get('tag_id')),
    exclude_tag_ids: split(params.get('exclude_tag_ids')),
    include_authors: authorId ? [authorId] : merged(tokens.includeAuthors.filter(value => /^\d+$/.test(value)), params.get('include_authors')),
    exclude_authors: merged(tokens.excludeAuthors.filter(value => /^\d+$/.test(value)), params.get('exclude_authors')),
    channel_ids: tokens.channels,
    exclude_keywords: params.get('exclude_keywords') || undefined,
    exclude_keyword_exemption_markers: split(params.get('exemption_markers')),
    tag_logic: params.get('tag_logic') === 'or' ? 'or' : 'and',
    created_after: params.get('created_after') || tokens.dateFrom || undefined,
    created_before: params.get('created_before') || tokens.dateTo || undefined,
    active_after: params.get('active_after') || undefined,
    active_before: params.get('active_before') || undefined,
    reaction_count_range: params.get('reaction_count_range') || (tokens.reactionMin !== null ? `[${tokens.reactionMin}, 10000000)` : undefined),
    reply_count_range: params.get('reply_count_range') || (tokens.replyMin !== null ? `[${tokens.replyMin}, 10000000)` : undefined),
    sort_method: workSortOptions.some(([value]) => value === params.get('sort_method')) ? params.get('sort_method')! : 'comprehensive',
    custom_base_sort: params.get('sort_method') === 'custom' && workSortOptions.some(([value]) => value !== 'custom' && value === params.get('custom_base_sort')) ? params.get('custom_base_sort')! : 'comprehensive',
    sort_order: params.get('sort_order') === 'asc' ? 'asc' : 'desc',
    apply_preferences: params.get('apply_preferences') !== 'false',
    search_by_collection: params.get('collected') === 'true',
    platform: ['fluxer', 'discord'].includes(params.get('platform') || '') ? params.get('platform')! : undefined,
  };
  for (const key of ['is_nsfw', 'is_abyss'] as const) if (params.get(key) === 'true' || params.get(key) === 'false') query[key] = params.get(key) === 'true';
  return query;
}
