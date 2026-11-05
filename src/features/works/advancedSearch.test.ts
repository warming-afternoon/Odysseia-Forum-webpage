import { describe, expect, it } from 'vitest';
import { buildAdvancedWorkSearch } from './advancedSearch';
import { workTime } from './workTime';

describe('work advanced search contract', () => {
  it('keeps canonical IDs as strings while combining token syntax and explicit advanced filters', () => {
    const params = new URLSearchParams({ q: '$tag:冒险$ -$tag:恐怖$ $author:9876543210987654321$ 机器人', tag_id: '9007199254740993123', exclude_keywords: '广告,剧透', exemption_markers: '无,没有', created_after: '-7d', active_before: '2026-11-01', reaction_count_range: '[5, 20]', reply_count_range: '[1, 100)', is_nsfw: 'false', is_abyss: 'true', offset: '40', sort_method: 'reddit_hot', apply_preferences: 'false' });
    expect(buildAdvancedWorkSearch(params)).toMatchObject({ keywords: '机器人', include_tags: ['冒险'], exclude_tags: ['恐怖'], include_tag_ids: ['9007199254740993123'], include_authors: ['9876543210987654321'], exclude_keywords: '广告,剧透', exclude_keyword_exemption_markers: ['无', '没有'], created_after: '-7d', active_before: '2026-11-01', reaction_count_range: '[5, 20]', reply_count_range: '[1, 100)', is_nsfw: false, is_abyss: true, offset: 40, sort_method: 'reddit_hot', apply_preferences: false });
  });
  it('pins public profile searches to the route author and rejects unsafe offsets', () => {
    for (const offset of ['-1', 'Infinity', 'NaN', '9007199254740993000']) expect(buildAdvancedWorkSearch(new URLSearchParams({ offset, include_authors: 'other' }), '9876543210987654321')).toMatchObject({ offset: 0, include_authors: ['9876543210987654321'] });
    expect(buildAdvancedWorkSearch(new URLSearchParams({ sort_method: 'custom', custom_base_sort: 'reaction_count', sort_order: 'asc' }))).toMatchObject({ sort_method: 'custom', custom_base_sort: 'reaction_count', sort_order: 'asc' });
  });
  it('interprets native database timestamps as UTC without shifting explicitly zoned deadlines', () => {
    expect(workTime('2026-11-02T12:30:00').toISOString()).toBe('2026-11-02T12:30:00.000Z');
    expect(workTime('2026-11-02T20:30:00+08:00').toISOString()).toBe('2026-11-02T12:30:00.000Z');
  });
});

describe('Work search keeps negative canonical tag IDs', () => {
  it('retains a token-only negative ID without Number conversion', () => {
    expect(buildAdvancedWorkSearch(new URLSearchParams({ q: '-$tagid:9007199254740993123|隐藏$' })).exclude_tag_ids)
      .toEqual(['9007199254740993123']);
  });
  it('merges distinct URL IDs and tokens, preserving both as strings', () => {
    expect(buildAdvancedWorkSearch(new URLSearchParams({ q: '-$tagid:9007199254740993123|隐藏$', exclude_tag_ids: '22' })).exclude_tag_ids)
      .toEqual(['9007199254740993123', '22']);
  });
  it('deduplicates the same negative ID across a token and the URL', () => {
    expect(buildAdvancedWorkSearch(new URLSearchParams({ q: '-$tagid:22|标签$', exclude_tag_ids: '22' })).exclude_tag_ids).toEqual(['22']);
  });
  it('does not rewrite positive/negative conflict semantics', () => {
    expect(buildAdvancedWorkSearch(new URLSearchParams({ q: '$tagid:22|标签$ -$tagid:22|标签$' })))
      .toMatchObject({ include_tag_ids: ['22'], exclude_tag_ids: ['22'] });
  });
});



describe('saved preferences are server defaults', () => {
  it('omits all unrequested preference fields, including page size', () => {
    expect(buildAdvancedWorkSearch(new URLSearchParams())).toEqual({ offset: 0, apply_preferences: true, search_by_collection: false });
  });
  it('preserves explicitly empty overrides and explicit page size', () => {
    expect(buildAdvancedWorkSearch(new URLSearchParams({ include_tags: '', exclude_authors: '', q: '', active_after: '', limit: '9' }))).toMatchObject({ include_tags: [], exclude_authors: [], keywords: '', active_after: '', limit: 9 });
  });
  it('rejects invalid request page sizes instead of replacing the saved default', () => {
    for (const limit of ['0', '101', '-1', 'NaN', '1.5']) expect(buildAdvancedWorkSearch(new URLSearchParams({ limit }))).not.toHaveProperty('limit');
  });
});


it('a tag-only query does not silently erase saved keyword preferences', () => {
  expect(buildAdvancedWorkSearch(new URLSearchParams({ q: '$tag:冒险$' }))).not.toHaveProperty('keywords');
  expect(buildAdvancedWorkSearch(new URLSearchParams({ custom_base_sort: 'view_count' }))).toMatchObject({ custom_base_sort: 'view_count' });
});
