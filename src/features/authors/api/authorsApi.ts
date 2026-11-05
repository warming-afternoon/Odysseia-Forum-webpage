import { worksClient } from '@/features/works/api';
import { workGovernanceApi } from '@/features/works/governanceApi';

export interface AuthorStats {
  thread_count: number;
  reaction_count: number | null;
  reply_count: number | null;
}

export interface AuthorProfileResponse {
  id: string;
  name: string;
  global_name: string | null;
  display_name: string;
  avatar_url: string | null;
  stats: AuthorStats;
}

export const authorsApi = {
  resolveLegacyAuthor: async (discordId: string, signal?: AbortSignal): Promise<string> => {
    if (!/^\d+$/.test(discordId)) throw new Error('无效旧作者 ID');
    const { data } = await worksClient.get<{ id: string }>(`/authors/discord/${encodeURIComponent(discordId)}`, { signal });
    if (!data || typeof data.id !== 'string' || !data.id.trim()) throw new Error('作者映射不可用');
    return data.id;
  },
  /** Canonical V2 author ID. Never interpret a Discord identity as this ID. */
  getAuthorProfile: async (authorId: string, signal?: AbortSignal): Promise<AuthorProfileResponse> => {
    const profile = await workGovernanceApi.author(authorId, signal);
    return {
      id: profile.id, name: profile.username, global_name: null,
      display_name: profile.display_name || profile.username,
      avatar_url: profile.avatar_url,
      stats: { thread_count: profile.work_count, reaction_count: null, reply_count: null },
    };
  },
};
