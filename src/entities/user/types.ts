export interface User {
  id: string;
  username: string;
  global_name?: string | null;
  display_name?: string | null;
  avatar?: string;
  avatar_url?: string | null;
  discord_user_id?: string | null;
}
