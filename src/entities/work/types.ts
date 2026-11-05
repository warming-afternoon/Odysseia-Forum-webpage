export interface WorkTag {
  id: string;
  name: string;
}
export interface Work {
  id: string;
  title: string;
  description: string | null;
  images: string[];
  sync_status?: 'pending' | 'ready';
  author_id: string | null;
  author?: { id: string; username: string | null; display_name: string | null; avatar_url: string | null } | null;
  source_platform: string;
  source_guild_id: string | null;
  source_channel_id: string | null;
  source_thread_id: string | null;
  main_ref: string | null;
  is_nsfw: boolean;
  is_abyss: boolean;
  created_at: string;
  deleted_at: string | null;
  statistics: {
    view_count: number;
    collection_count: number;
    reaction_count: number;
    reply_count: number;
  };
  reactions: {
    emoji: string | { id: string | null; name: string; animated?: boolean };
    count: number;
  }[];
  tags: WorkTag[];
}
