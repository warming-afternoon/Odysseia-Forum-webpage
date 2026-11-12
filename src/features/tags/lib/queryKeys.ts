import type { TagStatsRequest } from '../api/tagsApi';

export const tagKeys = {
  all: ['tags'] as const,
  stats: (params: TagStatsRequest) => ['tags', 'stats-v2', params] as const,
};
