import type { UserPreferencesResponse, UserPreferencesUpdateRequest } from '../api/preferencesApi';

export const preferenceSortOptions = [
  ['comprehensive', '综合排序'],
  ['created_at', '发布时间'],
  ['last_active', '最新活跃'],
  ['last_active_at', '最新活跃（兼容）'],
  ['reaction_count', '反应数量'],
  ['reply_count', '回复数量'],
  ['collection_count', '收藏数量'],
  ['view_count', '浏览数量'],
  ['collected_at', '收藏时间'],
  ['reddit_hot', '热门排序'],
  ['custom', '自定义顺序'],
] as const;
export const preferenceFields = [
  'preferred_channels',
  'include_authors',
  'exclude_authors',
  'include_tags',
  'exclude_tags',
  'include_keywords',
  'exclude_keywords',
  'exclude_keyword_exemption_markers',
  'preview_image_mode',
  'results_per_page',
  'ui_page_size',
  'sort_method',
  'custom_base_sort',
  'created_after',
  'created_before',
  'active_after',
  'active_before',
] as const;
export type PreferenceField = (typeof preferenceFields)[number];
export type PreferenceDraft = Partial<Record<PreferenceField, string>>;
const arrayFields = new Set<PreferenceField>([
  'preferred_channels',
  'include_authors',
  'exclude_authors',
  'include_tags',
  'exclude_tags',
  'exclude_keyword_exemption_markers',
]);
const idFields = new Set<PreferenceField>([
  'preferred_channels',
  'include_authors',
  'exclude_authors',
]);
const timeFields = new Set<PreferenceField>([
  'created_after',
  'created_before',
  'active_after',
  'active_before',
]);
export function preferenceFormValues(
  preferences: UserPreferencesResponse,
): Record<PreferenceField, string> {
  return Object.fromEntries(
    preferenceFields.map((field) => {
      const value = preferences[field];
      return [field, Array.isArray(value) ? value.join(', ') : String(value ?? '')];
    }),
  ) as Record<PreferenceField, string>;
}
export function preferencePatch(draft: PreferenceDraft): UserPreferencesUpdateRequest {
  const patch: Record<string, unknown> = {};
  for (const field of preferenceFields) {
    if (draft[field] === undefined) continue;
    const value = draft[field].trim();
    if (arrayFields.has(field)) {
      const values = [
        ...new Set(
          value
            .split(/[,，\n]/)
            .map((item) => item.trim())
            .filter(Boolean),
        ),
      ];
      if (
        idFields.has(field) &&
        values.some(
          (id) => !/^\d+$/.test(id) || BigInt(id) <= 0n || BigInt(id) > 9223372036854775807n,
        )
      ) {
        throw new Error('频道和作者 ID 必须是有效的正整数，请保持原始 ID，不要使用用户名。');
      }
      patch[field] = values;
    } else if (field === 'results_per_page' || field === 'ui_page_size') {
      const number = Number(value);
      const max = field === 'results_per_page' ? 9 : 100;
      if (!value || !Number.isInteger(number) || number < 1 || number > max)
        throw new Error(
          `${field === 'results_per_page' ? 'BOT 每页条数' : '网页每页条数'}必须是 1–${max} 的整数。`,
        );
      patch[field] = number;
    } else {
      patch[field] = timeFields.has(field) && !value ? null : value;
    }
  }
  return patch;
}
