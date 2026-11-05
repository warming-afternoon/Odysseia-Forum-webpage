import { worksClient } from '@/features/works/api';
import { workToThread } from '@/features/works/workPresentation';
import type { Work } from '@/features/works/types';
import type { Booklist, BooklistFormInput, BooklistItem, BooklistItemAddInput, BooklistItemUpdateInput, PaginatedResponse } from '@/entities/booklist/types';

interface WorkBooklistItem {
  booklist_item_id: number;
  work: Work;
  comment?: string | null;
  display_order: number;
  added_at?: string;
}
export function presentBooklistItem(item: WorkBooklistItem): BooklistItem {
  const thread = workToThread(item.work);
  return {
    ...thread,
    work: item.work,
    added_at: item.added_at ?? item.work.created_at,
    booklist_item_id: item.booklist_item_id,
    channel_id: thread.channel_id || '',
    author: thread.author || { id: '', name: '未知作者', display_name: '未知作者', global_name: null, avatar_url: null },
    display_count: thread.display_count || 0,
    collection_count: thread.collection_count || 0,
    thumbnail_urls: thread.thumbnail_urls || [],
    comment: item.comment,
    display_order: item.display_order,
  };
}
const presentation = (row: Booklist): Booklist => ({ ...row, canonical: true });
export const v2BooklistsApi = {
  async list(params: { scope: 'public' | 'mine' | 'collected'; ownerId?: string; markWorkId?: string; includeTagIds?: string[]; excludeTagIds?: string[]; tagLogic?: 'and' | 'or'; keywords?: string; sortMethod?: number; pageIndex?: number; pageSize?: number }, signal?: AbortSignal): Promise<PaginatedResponse<Booklist>> {
    const limit = params.pageSize ?? 12;
    const { data } = await worksClient.get<PaginatedResponse<Booklist>>('/booklists/page', { signal, paramsSerializer: { indexes: null }, params: {
      scope: params.scope, owner_id: params.ownerId, mark_work_id: params.markWorkId, keywords: params.keywords,
      include_tag_ids: params.includeTagIds, exclude_tag_ids: params.excludeTagIds, tag_logic: params.tagLogic,
      sort_method: params.sortMethod ?? 4, sort_order: 'desc',
      offset: (params.pageIndex ?? 0) * limit, limit,
    } });
    return { ...data, results: data.results.map(presentation) };
  },
  async detail(id: string | number, signal?: AbortSignal): Promise<Booklist> {
    const { data } = await worksClient.get<Booklist>(`/booklists/${id}/presentation`, { signal });
    return presentation(data);
  },
  async items(id: string | number, offset: number, signal?: AbortSignal): Promise<PaginatedResponse<BooklistItem>> {
    const { data } = await worksClient.get<PaginatedResponse<WorkBooklistItem>>(`/booklists/${id}/items`, { signal, params: { offset, limit: 24 } });
    return { ...data, results: data.results.map(presentBooklistItem) };
  },
  async create(body: BooklistFormInput) {
    return (await worksClient.post('/booklists', { ...body, cover_image_url: body.cover_image_url || null })).data;
  },
  async update(id: string | number, body: Partial<BooklistFormInput>) {
    return (await worksClient.patch(`/booklists/${id}`, { ...body, ...(body.cover_image_url !== undefined ? { cover_image_url: body.cover_image_url || null } : {}) })).data;
  },
  async remove(id: string | number) { await worksClient.delete(`/booklists/${id}`); },
  async add(id: string | number, items: BooklistItemAddInput[]) {
    if (!items.length || items.length > 100 || items.some(item => !item.work_id || !/^[1-9]\d*$/.test(item.work_id))) throw new Error('请输入 1 至 100 个作品 ID');
    return (await worksClient.post(`/booklists/${id}/items`, { items: items.map(item => ({ work_id: item.work_id, comment: item.comment, display_order: item.display_order })) })).data;
  },
  async syncItems(body: { work_id: string; scope_booklist_ids: number[]; target_booklist_ids: number[]; comment?: string }): Promise<{ work_id: string; added_to_booklist_ids?: number[]; removed_from_booklist_ids?: number[]; unchanged_booklist_ids?: number[] }> {
    if (!/^[1-9]\d*$/.test(body.work_id)) throw new Error('作品 ID 无效');
    return (await worksClient.post('/booklists/items/sync', body)).data;
  },
  async toggleCollection(id: number, collected: boolean) {
    if (collected) await worksClient.delete(`/booklists/${id}/collection`);
    else await worksClient.put(`/booklists/${id}/collection`);
  },
  async removeItem(id: string | number, workId: string | number) { await worksClient.delete(`/booklists/${id}/works/${workId}`); },
  async updateItem(id: string | number, workId: string | number, body: BooklistItemUpdateInput) {
    return (await worksClient.patch(`/booklists/${id}/works/${workId}`, { comment: body.comment, display_order: body.display_order })).data;
  },
};
