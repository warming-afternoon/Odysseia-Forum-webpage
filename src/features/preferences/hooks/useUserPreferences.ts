import { resetVisibleContent } from '@/features/works/contentCache';
import { isFeatureNotMigratedError } from '@/shared/api/featureMigration';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { AxiosError } from 'axios';
import { useAuth } from '@/features/auth/hooks/useAuth';
import { worksV2Enabled } from '@/shared/config/works';
import { captureAuthSession, isAuthSessionCurrent } from '@/shared/lib/authSession';
import {
  preferencesApi,
  usesV2Preferences,
  type PreferencesApiOptions,
  type UserPreferencesUpdateRequest,
  type UserPreferencesResponse,
} from '../api/preferencesApi';

export function preferenceQueryKey(
  protocol: 'legacy' | 'v2' | undefined,
  generation: number,
  userId?: string,
  guildId?: string | number,
) {
  // V2 self preferences always use the server-configured main guild, not a caller-selected guild.
  return [
    'user-preferences',
    protocol || 'pending',
    generation,
    userId,
    protocol === 'v2' ? 'server-main-guild' : String(guildId || 0),
  ] as const;
}

export function useUserPreferences(options: PreferencesApiOptions = {}) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const userId = options.userId || user?.id;
  const session = captureAuthSession();
  const knownProtocol = options.mode || (worksV2Enabled ? 'v2' : undefined);
  const protocolQuery = useQuery({
    queryKey: ['preferences-protocol', session.generation],
    enabled: Boolean(userId) && !knownProtocol,
    queryFn: async () => {
      const mode = (await usesV2Preferences()) ? ('v2' as const) : ('legacy' as const);
      if (!isAuthSessionCurrent(session)) throw new Error('登录状态已变化，请重试。');
      return mode;
    },
    staleTime: Infinity,
    retry: false,
  });
  const protocol = knownProtocol || protocolQuery.data;
  const queryKey = preferenceQueryKey(protocol, session.generation, userId, options.guildId);
  const query = useQuery({
    queryKey,
    enabled: Boolean(userId && protocol),
    retry: (failureCount, error) => {
      if (
        [401, 403, 404, 422].includes((error as AxiosError)?.response?.status || 0) ||
        isFeatureNotMigratedError(error)
      )
        return false;
      return failureCount < 2;
    },
    queryFn: async () => {
      if (!userId || !protocol || !isAuthSessionCurrent(session))
        throw new Error('登录状态已变化，请重试。');
      const data = await preferencesApi.getByUserId(userId, { ...options, mode: protocol });
      if (!isAuthSessionCurrent(session)) throw new Error('登录状态已变化，请重试。');
      const previous = queryClient.getQueryData<UserPreferencesResponse>(queryKey);
      // A native Fluxer save (or recovered partial save) does not emit a browser event.
      // Revalidate content when our existing preference refetch observes a new authority
      // snapshot. The reset excludes this preference query, so it cannot refetch itself.
      if (protocol === 'v2' && previous && (
        previous.show_nsfw !== data?.show_nsfw ||
        previous.nsfw_eligible !== data?.nsfw_eligible ||
        previous.nsfw_preference_version !== data?.nsfw_preference_version ||
        previous.nsfw_guild_id !== data?.nsfw_guild_id
      )) {
        await resetVisibleContent(queryClient);
        if (!isAuthSessionCurrent(session)) throw new Error('登录状态已变化，请重试。');
      }
      return data;
    },
    staleTime: 60 * 1000,
  });
  const saveMutation = useMutation({
    onMutate: () => ({ session, queryKey }),
    mutationFn: async (payload: UserPreferencesUpdateRequest) => {
      if (!userId || !protocol || !isAuthSessionCurrent(session))
        throw new Error('登录状态已变化，请重新加载偏好。');
      const data = await preferencesApi.updateByUserId(userId, payload, {
        ...options,
        mode: protocol,
      });
      if (!isAuthSessionCurrent(session)) throw new Error('登录状态已变化，请重新加载偏好。');
      return data;
    },
    onSuccess: async (data, _variables, context) => {
      if (!context || !isAuthSessionCurrent(context.session)) return;
      await queryClient.cancelQueries({ queryKey: context.queryKey, exact: true });
      if (!isAuthSessionCurrent(context.session)) return;
      queryClient.setQueryData(context.queryKey, data);
      // Keep the successful document. Invalidate only this account/protocol/guild scope.
      void queryClient.invalidateQueries({
        queryKey: context.queryKey,
        exact: true,
        refetchType: 'none',
      });
      void queryClient.invalidateQueries({ queryKey: ['works-v2', 'search'] });
      void queryClient.invalidateQueries({ queryKey: ['works-v2', 'discover'] });
      void queryClient.invalidateQueries({ queryKey: ['search'] });
      void queryClient.invalidateQueries({ queryKey: ['discovery'] });
    },
  });
  return {
    user,
    preferences: query.data,
    isFirstTime: query.isSuccess && (query.data?.is_first_time ?? !query.data),
    isLoading: (Boolean(userId) && !protocol && !protocolQuery.isError) || query.isLoading,
    isFetching: (!knownProtocol && protocolQuery.isFetching) || query.isFetching,
    isError: (!knownProtocol && protocolQuery.isError) || query.isError,
    error: (!knownProtocol && protocolQuery.error) || query.error,
    refetch: () => (protocol ? query.refetch() : protocolQuery.refetch()),
    savePreferences: saveMutation.mutateAsync,
    isSaving: saveMutation.isPending,
  } as const;
}
