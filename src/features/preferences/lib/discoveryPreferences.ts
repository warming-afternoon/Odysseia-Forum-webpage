import type { UserPreferencesResponse } from '@/features/preferences/api/preferencesApi';
import { toPreferencesFormValue } from '@/features/preferences/lib/preferencesMapper';
import type { UISortMethod } from '@/features/search/api/searchApi';

export type DiscoveryPreferenceMode = 'search-active' | 'suggestion' | 'plaza';

export interface DiscoveryPreferenceContext {
  preferredChannelIds: string[];
  includeTags: string[];
  excludeTags: string[];
  sortMethod?: UISortMethod;
  resultsPerPage?: number;
  signature: string;
}

function normalizeStringList(values: string[]) {
  return Array.from(new Set(values.map((value) => value.trim()).filter(Boolean)));
}

export function getDiscoveryPreferenceContext(
  preferences?: UserPreferencesResponse | null,
): DiscoveryPreferenceContext | null {
  if (!preferences) return null;

  const mapped = toPreferencesFormValue(preferences);
  const preferredChannelIds = normalizeStringList(mapped.preferredChannelIds);
  const includeTags = normalizeStringList(
    mapped.includeTagsText.split(',').map((item) => item.trim()),
  );
  const excludeTags = normalizeStringList(
    mapped.excludeTagsText.split(',').map((item) => item.trim()),
  );
  const sortMethod = mapped.sortMethod;
  const resultsPerPage = Number.isFinite(mapped.resultsPerPage) ? mapped.resultsPerPage : undefined;

  const hasUsefulContent =
    preferredChannelIds.length > 0 ||
    includeTags.length > 0 ||
    excludeTags.length > 0;

  if (!hasUsefulContent) return null;

  return {
    preferredChannelIds,
    includeTags,
    excludeTags,
    sortMethod,
    resultsPerPage,
    signature: JSON.stringify({
      preferredChannelIds,
      includeTags,
      excludeTags,
      sortMethod,
      resultsPerPage,
    }),
  };
}
