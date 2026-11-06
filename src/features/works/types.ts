import type { Work } from "@/entities/work/types";
export type { Work, WorkTag } from "@/entities/work/types";

export interface Page<T> {
  items: T[];
  total: number;
  offset: number;
  limit: number;
}
export interface ThreadRef {
  id: string;
  platform: string;
  thread_id: string;
  guild_id: string;
  channel_id: string;
  role: 'main' | 'child';
  title?: string | null;
  body?: string | null;
  archived?: boolean;
  locked?: boolean;
  own_locked?: boolean;
  own_archived?: boolean;
  deleted_at?: string | null;
  author_id?: string | null;
  can_restore?: boolean;
  deletion_reason?: string | null;
  initializing?: boolean;
  created_at?: string | null;
  last_active_at?: string | null;
  reaction_count?: number;
  reply_count?: number;
  collection_count?: number;
}
export interface WorkInput {
  title: string;
  description?: string;
  images?: string[];
  attachments?: WorkAttachment[];
  is_nsfw: boolean;
  is_abyss: boolean;
}
export interface WorkQuery {
  q?: string;
  author_id?: string;
  tag_id?: string;
  offset?: number;
  limit?: number;
  is_nsfw?: boolean;
  is_abyss?: boolean;
}
export interface WorkMember {
  id: string;
  discord_user_id: string;
  username: string;
  display_name: string | null;
  avatar_url: string | null;
  is_admin: boolean;
  can_create_work: boolean;
  can_view_abyss: boolean;
  can_speak: boolean;
  show_nsfw: boolean;
  nsfw_eligible?: boolean;
}
export interface WorkBooklist {
  id: string;
  title: string;
  description: string | null;
  is_public: boolean;
  is_default: boolean;
  item_count: number;
}
export interface WorkBooklistDetail extends Omit<WorkBooklist, 'item_count'>, Page<Work> {}
export interface AnnouncementInput {
  title?: string | null;
  body: string;
  images: string[];
}
export interface WorkAnnouncement extends AnnouncementInput {
  id: string;
  work_id: string;
  author_id: string | null;
  created_at: string;
  withdrawn_at: string | null;
}

export interface WorkTask {
  id: string;
  kind: string;
  status: 'pending' | 'running' | 'done' | 'failed';
  attempts: number;
  error: string | null;
  available_at: string;
}
export interface WorkNotification {
  id: string;
  type?: 'thread_update' | 'author_new_thread' | 'tag_review' | 'work_announcement';
  work_id: string | null;
  announcement_id: string | null;
  title: string | null;
  target_type?: string | null;
  target_id?: string | null;
  proposal_id?: string | null;
  body: string;
  withdrawn: boolean;
  read_at: string | null;
  created_at: string;
}
export type WorkBanner =
  | { kind: 'work'; id: string; work: Work; image_url?: string | null }
  | {
      kind: 'channel';
      id: string;
      title: string;
      platform: string;
      guild_id: string;
      channel_id: string;
      image_url: string | null;
    };

export interface UploadedWorkAttachment {
  id: number;
  filename: string;
  file_size: number;
  content_type: string;
  upload_filename: string;
}
export type WorkAttachment = UploadedWorkAttachment | { id: string };

export interface WorkCardsQuery {
  offset?: number;
  limit?: number;
  sort_method?: 'last_active' | 'created_at' | 'reply_count' | 'reaction_count' | 'comprehensive' | 'reddit_hot' | 'collection_count';
  sort_order?: 'asc' | 'desc';
}

export interface WorkCardsPageData extends Page<ThreadRef> { can_create: boolean; create_disabled_reason: string | null }
