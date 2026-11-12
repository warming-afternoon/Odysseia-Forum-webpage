import { worksClient } from '@/features/works/api';

export interface ChannelTagInfo {
  platform: 'discord' | 'fluxer';
  guild_id: string;
  channel_id: string;
  channel_name?: string | null;
  work_count: number;
  is_virtual: boolean;
}

export interface TagStatItem {
  id: string;
  tag_name: string;
  category?: number;
  category_name?: string;
  is_abyss?: boolean;
  is_virtual: boolean;
  total_work_count: number;
  channel_info: ChannelTagInfo[];
}

export interface TagStatsRequest {
  platform?: 'discord' | 'fluxer';
  guild_id?: string | null;
  channel_ids?: string[] | null;
  include_virtual?: boolean;
}

export interface TagStatsResponse {
  total_works: number;
  items: TagStatItem[];
}

export const tagsApi = {
  /** 按作品统计标签，关联子卡与多来源绑定不重复计数。 */
  getStats: async (params: TagStatsRequest = {}, signal?: AbortSignal): Promise<TagStatsResponse> => {
    const response = await worksClient.post<TagStatsResponse>('/tags/stats', {
      ...params,
      include_virtual: params.include_virtual ?? true,
    }, { signal });
    return response.data;
  },
};
