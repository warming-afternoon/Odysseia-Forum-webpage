import type { Work, WorkTag } from './types';

export interface WorkMute {
  id: string;
  work_id: string;
  user_id: string;
  actor_id: string;
  reason: string;
  created_at: string;
  expires_at: string | null;
  revoked_at: string | null;
  own_source: boolean;
}
export interface WorkModlogEntry {
  id: string;
  type: string;
  actor_id: string | null;
  detail: Record<string, unknown> | string | null;
  created_at: string;
}
export interface DeletedWork extends Work {
  deletion_reason: string | null;
  can_restore: boolean;
}
export interface WorkTagBinding extends WorkTag {
  binding_id?: string;
  readonly?: boolean;
  binding_source?: string;
  upvotes?: number;
  downvotes?: number;
  my_vote?: -1 | 0 | 1;
}
export interface WorkTagSnapshot {
  version: string;
  tags: WorkTagBinding[];
  over_limit?: boolean;
  conflicting_pairs?: string[][];
}
export interface WorkTagProposal {
  id: string;
  tag_id: string;
  tag_name: string;
  status: 'pending' | 'approved' | 'rejected' | 'failed';
  reason: string | null;
  created_at: string;
  due_at: string;
  resolved_at: string | null;
}
export interface WorkAuthor {
  id: string;
  username: string;
  display_name: string | null;
  avatar_url: string | null;
  work_count: number;
  followed: boolean;
}
export interface AdvancedWorkSearch {
  keywords?: string;
  exclude_keywords?: string;
  exclude_keyword_exemption_markers?: string[];
  include_tags?: string[];
  exclude_tags?: string[];
  include_tag_ids?: string[];
  exclude_tag_ids?: string[];
  include_authors?: string[];
  exclude_authors?: string[];
  channel_ids?: string[];
  tag_logic?: 'and' | 'or';
  created_after?: string;
  created_before?: string;
  active_after?: string;
  active_before?: string;
  reaction_count_range?: string;
  reply_count_range?: string;
  sort_method?: string;
  custom_base_sort?: string;
  sort_order?: 'asc' | 'desc';
  search_by_collection?: boolean;
  apply_preferences?: boolean;
  is_nsfw?: boolean;
  is_abyss?: boolean;
  platform?: string;
  offset: number;
  limit?: number;
}
