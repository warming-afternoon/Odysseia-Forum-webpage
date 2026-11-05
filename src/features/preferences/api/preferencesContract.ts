import type { UserPreferencesResponse } from './preferencesApi';

export type V2PreferencesResponse = UserPreferencesResponse & {
  user_id: string;
  guild_id: string;
  is_first_time: boolean;
  show_nsfw: boolean;
  nsfw_eligible: boolean;
  nsfw_guild_id: string;
  nsfw_preference_version: number;
};

export function checkedV2Preferences(
  data: UserPreferencesResponse,
  expectedUserId: string | number,
): V2PreferencesResponse {
  const invalid = () => {
    throw new Error('偏好设置响应无效，请重试。');
  };
  if (
    !data ||
    typeof data !== 'object' ||
    typeof data.user_id !== 'string' ||
    data.user_id !== String(expectedUserId) ||
    typeof data.guild_id !== 'string' ||
    typeof data.nsfw_guild_id !== 'string' ||
    typeof data.is_first_time !== 'boolean' ||
    typeof data.show_nsfw !== 'boolean' ||
    typeof data.nsfw_eligible !== 'boolean' ||
    !Number.isSafeInteger(data.nsfw_preference_version) ||
    data.nsfw_preference_version! < 0
  )
    invalid();
  for (const field of [
    'preferred_channels',
    'include_authors',
    'exclude_authors',
    'include_tags',
    'exclude_tags',
  ] as const) {
    const list = data[field];
    if (list !== null && (!Array.isArray(list) || list.some((value) => typeof value !== 'string')))
      invalid();
  }
  if (
    !Array.isArray(data.exclude_keyword_exemption_markers) ||
    data.exclude_keyword_exemption_markers.some((value) => typeof value !== 'string')
  )
    invalid();
  for (const field of [
    'include_keywords',
    'exclude_keywords',
    'preview_image_mode',
    'sort_method',
    'custom_base_sort',
  ] as const)
    if (typeof data[field] !== 'string') invalid();
  for (const field of ['created_after', 'created_before', 'active_after', 'active_before'] as const)
    if (data[field] !== null && typeof data[field] !== 'string') invalid();
  // Historical rows may have out-of-range sizes. Read them faithfully so the user can repair them.
  if (!Number.isSafeInteger(data.results_per_page) || !Number.isSafeInteger(data.ui_page_size))
    invalid();
  return data as V2PreferencesResponse;
}
