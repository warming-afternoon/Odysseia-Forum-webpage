import { useMemo } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { AxiosError } from 'axios';

import { useAuth } from '@/features/auth/hooks/useAuth';
import {
  preferencesApi,
  type PreferencesApiOptions,
  type UserPreferencesResponse,
  type UserPreferencesUpdateRequest,
} from '@/features/preferences/api/preferencesApi';

function isNotFoundError(error: unknown) {
  return (error as AxiosError | undefined)?.response?.status === 404;
}

export function useUserPreferences(options: PreferencesApiOptions = {}) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const userId = user?.id;
  const queryKey = ['user-preferences', userId] as const;

  const query = useQuery({
    queryKey,
    enabled: Boolean(userId),
    retry: (failureCount, error) => {
      if (isNotFoundError(error)) return false;
      return failureCount < 2;
    },
    queryFn: async ({ signal }) => {
      if (!userId) return null;
      try {
        const data = await preferencesApi.getByUserId(userId, options, signal);
        return data;
      } catch (error) {
        if (isNotFoundError(error)) return null;
        throw error;
      }
    },
    staleTime: 60 * 1000,
  });

  const saveMutation = useMutation({
    onMutate: async () => {
      await queryClient.cancelQueries({ queryKey, exact: true });
      return { queryKey };
    },
    mutationFn: async (payload: UserPreferencesUpdateRequest): Promise<UserPreferencesResponse> => {
      if (!userId) {
        throw new Error('User not authenticated');
      }
      return preferencesApi.updateByUserId(userId, payload, options);
    },
    onSuccess: async (data, _variables, submitted) => {
      await queryClient.cancelQueries({ queryKey: submitted!.queryKey, exact: true });
      queryClient.setQueryData(submitted!.queryKey, data);
    },
  });

  const isFirstTime = useMemo(
    () => query.isSuccess && !query.data,
    [query.isSuccess, query.data],
  );

  return {
    user,
    preferences: query.data,
    isFirstTime,
    isLoading: query.isLoading,
    isFetching: query.isFetching,
    isError: query.isError,
    error: query.error,
    refetch: query.refetch,
    savePreferences: saveMutation.mutateAsync,
    isSaving: saveMutation.isPending,
  } as const;
}
