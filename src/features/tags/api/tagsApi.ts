import { apiClient } from '@/shared/api/client';

/**
 * 标签在某个频道下的统计信息
 */
export interface ChannelTagInfo {
  channel_id: string;
  tag_id: string;
  thread_count: number;
  is_virtual: boolean;
}

/**
 * 单个标签的聚合统计
 */
export interface TagStatItem {
  tag_name: string;
  total_thread_count: number;
  channel_info: ChannelTagInfo[];
}

/**
 * /tags/stats 请求体
 */
export interface TagStatsRequest {
  guild_id?: number | null;
  channel_ids?: number[] | null;
  include_virtual?: boolean;
}

/**
 * /tags/stats 响应体
 */
export interface TagStatsResponse {
  total_threads: number;
  items: TagStatItem[];
}

export const tagsApi = {
  /**
   * 聚合查询标签统计数据
   * 一次请求替代之前 N+2 次 search 调用
   */
  getStats: async (params: TagStatsRequest = {}): Promise<TagStatsResponse> => {
    const response = await apiClient.post<TagStatsResponse>('/tags/stats', {
      guild_id: params.guild_id ?? null,
      channel_ids: params.channel_ids ?? null,
      include_virtual: params.include_virtual ?? true,
    });
    return response.data;
  },
};
