import { checkedV2Preferences } from './preferencesContract';
import { getForumAuthConfig } from '@/features/auth/api/fluxerAuthApi';
import { worksV2Enabled } from '@/shared/config/works';
import { captureAuthSession, isAuthSessionCurrent } from '@/shared/lib/authSession';
import { worksClient } from '@/features/works/api';
import { apiClient } from '@/shared/api/client';
import type { components } from '@shared-types/openapi';

type RawUserPreferencesResponse = components['schemas']['UserPreferencesResponse'];
type RawUserPreferencesUpdateRequest = components['schemas']['UserPreferencesUpdateRequest'];
type SnowflakeListField = 'preferred_channels' | 'include_authors' | 'exclude_authors';

export type UserPreferencesResponse = Omit<
  RawUserPreferencesResponse,
  SnowflakeListField | 'user_id'
> & {
  user_id: string | number;
  guild_id?: string;
  is_first_time?: boolean;
  show_nsfw?: boolean;
  nsfw_eligible?: boolean;
  nsfw_guild_id?: string;
  nsfw_preference_version?: number;
  preferred_channels?: string[] | null;
  include_authors?: string[] | null;
  exclude_authors?: string[] | null;
};

export type UserPreferencesUpdateRequest = Omit<
  RawUserPreferencesUpdateRequest,
  SnowflakeListField
> & {
  preferred_channels?: string[] | null;
  include_authors?: string[] | null;
  exclude_authors?: string[] | null;
};

export interface PreferencesApiOptions {
  guildId?: string | number;
  mode?: 'v2' | 'legacy';
  userId?: string;
}

function toGuildQuery(guildId?: string | number) {
  if (guildId === undefined || guildId === null || guildId === '') {
    return undefined;
  }
  return { guild_id: guildId };
}

function parsePreferencesResponseText(text: string): UserPreferencesResponse {
  const patched = text.replace(
    /("(?:preferred_channels|include_authors|exclude_authors)"\s*:\s*)\[(.*?)\]/g,
    (_match, prefix: string, inner: string) => {
      const normalized = inner
        .split(',')
        .map((item) => item.trim())
        .filter(Boolean)
        .map((item) => item.replace(/^"|"$/g, ''))
        .map((item) => `"${item}"`)
        .join(',');
      return `${prefix}[${normalized}]`;
    },
  );

  return JSON.parse(patched) as UserPreferencesResponse;
}

export async function usesV2Preferences(options: PreferencesApiOptions = {}) {
  if (options.mode) return options.mode === 'v2';
  return worksV2Enabled || (await getForumAuthConfig()).mode === 'fluxer';
}

export const preferencesApi = {
  getByUserId: async (
    userId: string | number,
    options: PreferencesApiOptions = {},
  ): Promise<UserPreferencesResponse | null> => {
    const session = captureAuthSession();
    const v2 = await usesV2Preferences(options);
    if (!isAuthSessionCurrent(session)) throw new Error('登录状态已变化，请重试。');
    if (v2) {
      const data = (
        await worksClient.get<UserPreferencesResponse>('/me/preferences', {
          expectedAuthSession: session,
        })
      ).data;
      if (!isAuthSessionCurrent(session)) throw new Error('登录状态已变化，请重试。');
      return checkedV2Preferences(data, userId);
    }
    try {
      const response = await apiClient.get<string>(
        `/preferences/users/${encodeURIComponent(String(userId))}`,
        {
          params: toGuildQuery(options.guildId),
          responseType: 'text',
          transformResponse: [(data) => data],
        },
      );
      return parsePreferencesResponseText(response.data);
    } catch (error) {
      if ((error as { response?: { status?: number } }).response?.status === 404) return null;
      throw error;
    }
  },

  updateByUserId: async (
    userId: string | number,
    payload: UserPreferencesUpdateRequest,
    options: PreferencesApiOptions = {},
  ): Promise<UserPreferencesResponse> => {
    const session = captureAuthSession();
    const v2 = await usesV2Preferences(options);
    if (!isAuthSessionCurrent(session)) throw new Error('登录状态已变化，请重试。');
    if (v2) {
      // Deliberately forward only supplied fields. Never populate absent arrays.
      const data = (
        await worksClient.patch<UserPreferencesResponse>('/me/preferences', payload, {
          expectedAuthSession: session,
        })
      ).data;
      if (!isAuthSessionCurrent(session)) throw new Error('登录状态已变化，请重试。');
      return checkedV2Preferences(data, userId);
    }
    const response = await apiClient.put<string>(
      `/preferences/users/${encodeURIComponent(String(userId))}`,
      payload,
      {
        params: toGuildQuery(options.guildId),
        responseType: 'text',
        transformResponse: [(data) => data],
      },
    );
    return parsePreferencesResponseText(response.data);
  },
};
