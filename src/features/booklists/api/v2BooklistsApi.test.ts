import { beforeEach, describe, expect, it, vi } from 'vitest';
import { worksClient } from '@/features/works/api';
import { presentBooklistItem, v2BooklistsApi } from './v2BooklistsApi';
import { threadFromBooklistItem } from '@/entities/booklist/lib/threadFromBooklistItem';
import type { Work } from '@/features/works/types';
vi.mock('@/features/works/api', () => ({ worksClient: { get: vi.fn(), post: vi.fn(), put: vi.fn(), patch: vi.fn(), delete: vi.fn() } }));
const work: Work = { id: '9007199254740993123', title: '作品', description: '正文', author_id: '9007199254740993124', source_platform: 'discord', source_thread_id: '9007199254740993125', source_guild_id: '9', source_channel_id: '8', main_ref: null, images: [], tags: [], is_nsfw: false, is_abyss: false, created_at: '2026-11-05', deleted_at: null, reactions: [], statistics: { view_count: 3, collection_count: 4, reaction_count: 5, reply_count: 6 } };
beforeEach(() => { vi.clearAllMocks(); vi.mocked(worksClient.post).mockResolvedValue({ data: {} }); });
describe('booklist V2 page adapter', () => {
  it('keeps logical work identity on original cards, distinct from platform thread ID', () => {
    const item = presentBooklistItem({ booklist_item_id: 4, work, comment: '备注', display_order: 3 });
    const card = threadFromBooklistItem(item);
    expect(card.work).toBe(work);
    expect(card.thread_id).toBe(work.id);
    expect(card.work?.source_thread_id).toBe('9007199254740993125');
    expect(item.comment).toBe('备注');
    expect(item.display_order).toBe(3);
  });
  it('requests canonical author lists and server pagination without numeric coercion', async () => {
    vi.mocked(worksClient.get).mockResolvedValue({ data: { results: [{ id: 1, owner_id: work.author_id, can_manage: false }], total: 1, offset: 12, limit: 12 } });
    const signal = new AbortController().signal;
    const result = await v2BooklistsApi.list({ scope: 'public', ownerId: work.author_id!, pageIndex: 1 }, signal);
    expect(worksClient.get).toHaveBeenCalledWith('/booklists/page', expect.objectContaining({ signal, params: expect.objectContaining({ owner_id: work.author_id, offset: 12, limit: 12 }) }));
    expect(result.results[0]).toMatchObject({ canonical: true, can_manage: false });
  });
  it('uses explicit work IDs for writes and rejects legacy thread-only payloads', async () => {
    const input = { work_id: work.id, thread_id: '', comment: '备注', display_order: 2 };
    await v2BooklistsApi.add(1, [input]);
    expect(worksClient.post).toHaveBeenCalledWith('/booklists/1/items', { items: [{ work_id: work.id, comment: '备注', display_order: 2 }] });
    await expect(v2BooklistsApi.add(1, [{ thread_id: work.source_thread_id! }])).rejects.toThrow();
    await v2BooklistsApi.add(1, [input, { ...input, work_id: "42" }]);
    expect(worksClient.post).toHaveBeenCalledTimes(2);
    await v2BooklistsApi.removeItem(1, work.id);
    expect(worksClient.delete).toHaveBeenCalledWith(`/booklists/1/works/${work.id}`);
  });
  it('sends only existing item fields, never tournament fields to V2', async () => {
    vi.mocked(worksClient.patch).mockResolvedValue({ data: {} });
    await v2BooklistsApi.updateItem(1, work.id, { comment: '', display_order: 0, tournament_participated_at: '2026-11-05' });
    expect(worksClient.patch).toHaveBeenCalledWith(`/booklists/1/works/${work.id}`, { comment: '', display_order: 0 });
  });
});
it('collects and uncollects canonical lists without a legacy request', async () => {
  await v2BooklistsApi.toggleCollection(9, false);
  expect(worksClient.put).toHaveBeenCalledWith('/booklists/9/collection');
  await v2BooklistsApi.toggleCollection(9, true);
  expect(worksClient.delete).toHaveBeenCalledWith('/booklists/9/collection');
});
it('loads collected scope and marks work membership with string IDs', async () => {
  vi.mocked(worksClient.get).mockResolvedValue({ data: { results: [], total: 0, offset: 0, limit: 12 } });
  await v2BooklistsApi.list({ scope: 'collected', markWorkId: work.id });
  expect(worksClient.get).toHaveBeenCalledWith('/booklists/page', expect.objectContaining({ params: expect.objectContaining({ scope: 'collected', mark_work_id: work.id }) }));
});
it('normalizes empty cover on create and clear, while retaining omitted fields', async () => {
  await v2BooklistsApi.create({ title: '书单', is_public: false, display_type: 1, cover_image_url: '' });
  expect(worksClient.post).toHaveBeenCalledWith('/booklists', expect.objectContaining({ cover_image_url: null }));
  vi.mocked(worksClient.patch).mockResolvedValue({ data: {} });
  await v2BooklistsApi.update(1, { cover_image_url: '' });
  expect(worksClient.patch).toHaveBeenLastCalledWith('/booklists/1', { cover_image_url: null });
  await v2BooklistsApi.update(1, { title: 'changed' });
  expect(worksClient.patch).toHaveBeenLastCalledWith('/booklists/1', { title: 'changed' });
});
it('sends multi-list synchronization and rejects invalid work identity', async () => {
  const body = { work_id: work.id, scope_booklist_ids: [1, 2], target_booklist_ids: [2], comment: '推荐' };
  await v2BooklistsApi.syncItems(body);
  expect(worksClient.post).toHaveBeenCalledWith('/booklists/items/sync', body);
  await expect(v2BooklistsApi.syncItems({ ...body, work_id: '' })).rejects.toThrow();
  expect(worksClient.post).toHaveBeenCalledTimes(1);
});

it('preserves existing include/exclude tag query semantics with repeated params', async () => {
  vi.mocked(worksClient.get).mockResolvedValue({ data: { results: [], total: 0, offset: 0, limit: 12 } });
  await v2BooklistsApi.list({ scope: 'public', includeTagIds: ['1', '2'], excludeTagIds: ['3'], tagLogic: 'or' });
  expect(worksClient.get).toHaveBeenCalledWith('/booklists/page', expect.objectContaining({ paramsSerializer: { indexes: null }, params: expect.objectContaining({ include_tag_ids: ['1', '2'], exclude_tag_ids: ['3'], tag_logic: 'or' }) }));
});
