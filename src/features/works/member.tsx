import { resetVisibleContent } from './contentCache';
import {
  captureAuthSession,
  isAuthSessionCurrent,
  type AuthSessionSnapshot,
} from '@/shared/lib/authSession';
import {
  preferenceQueryKey,
  useUserPreferences,
} from '@/features/preferences/hooks/useUserPreferences';
import type { UserPreferencesResponse } from '@/features/preferences/api/preferencesApi';
import { GUILD_ID } from '@/shared/config/channelCategories.private';
import { V2PreferencesSection } from '@/features/preferences/components/V2PreferencesSection';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { worksApi } from './api';
import { WorkAuthorFollows } from './authors';
import { WorkBannerApplications } from './bannerApplications';
import { workKeys } from './layout';
import { workError, WorkStatus } from './components';

export function useWorkMember() {
  const query = useQuery({
    queryKey: [...workKeys.all, 'me'],
    queryFn: ({ signal }) => worksApi.me(signal),
    retry: false,
    staleTime: 0,
  });
  return { ...query, data: query.error ? undefined : query.data };
}
type NsfwMutationInput = {
  show_nsfw: boolean;
  expected_version: number;
  user_id: string;
  nsfw_guild_id: string;
  session: AuthSessionSnapshot;
};

export function WorkMePage() {
  const member = useWorkMember();
  const preferences = useUserPreferences({
    mode: 'v2',
    guildId: GUILD_ID,
    userId: member.data?.id,
  });
  const session = captureAuthSession();
  const queryKey = preferenceQueryKey('v2', session.generation, member.data?.id);
  const queryClient = useQueryClient();
  const snapshot = preferences.preferences;
  const nsfwSnapshot =
    snapshot &&
    !preferences.isError &&
    !preferences.isLoading &&
    !preferences.isFetching &&
    snapshot?.user_id === member.data?.id &&
    typeof snapshot.show_nsfw === 'boolean' &&
    typeof snapshot.nsfw_eligible === 'boolean' &&
    typeof snapshot.nsfw_guild_id === 'string' &&
    Number.isSafeInteger(snapshot.nsfw_preference_version) &&
    snapshot.nsfw_preference_version! >= 0 &&
    snapshot.nsfw_preference_version! < Number.MAX_SAFE_INTEGER
      ? snapshot
      : undefined;
  const preference = useMutation({
    retry: false,
    onMutate: (input: NsfwMutationInput) => ({ session: input.session, queryKey }),
    mutationFn: (input: NsfwMutationInput) => {
      if (!isAuthSessionCurrent(input.session)) throw new Error('登录状态已变化，请重试。');
      return worksApi.preferences(
        { show_nsfw: input.show_nsfw, expected_version: input.expected_version },
        input.session,
        { user_id: input.user_id, nsfw_guild_id: input.nsfw_guild_id },
      );
    },
    onSuccess: async (data, _input, context) => {
      if (!context || !isAuthSessionCurrent(context.session)) return;
      await queryClient.cancelQueries({ queryKey: workKeys.all });
      if (!isAuthSessionCurrent(context.session)) return;
      queryClient.setQueryData([...workKeys.all, 'me'], (previous: typeof member.data) =>
        previous ? { ...previous, ...data } : previous,
      );
      await queryClient.cancelQueries({ queryKey: context.queryKey, exact: true });
      if (!isAuthSessionCurrent(context.session)) return;
      queryClient.setQueriesData<UserPreferencesResponse>(
        { queryKey: context.queryKey, exact: true },
        (previous) => (previous ? { ...previous, ...data } : previous),
      );
      await resetVisibleContent(queryClient);
      void queryClient.invalidateQueries({ queryKey: [...workKeys.all, 'me'] });
      void queryClient.invalidateQueries({ queryKey: queryKey, exact: true });
    },
    onError: async (_error, _input, context) => {
      if (!context || !isAuthSessionCurrent(context.session)) return;
      // A failed acknowledgement is not a rollback: durable recovery may have
      // committed the new preference. Remove old projections before reconciling.
      await resetVisibleContent(queryClient);
      if (!isAuthSessionCurrent(context.session)) return;
      void queryClient.invalidateQueries({ queryKey: queryKey, exact: true });
      void queryClient.invalidateQueries({ queryKey: [...workKeys.all, 'me'] });
    },
  });
  return (
    <>
      <WorkStatus pending={member.isPending} error={member.error} />
      {member.data && !member.error && (
        <section className="grid gap-4">
          <h2 className="text-xl">{member.data.display_name || member.data.username}</h2>
          <Link className="underline" to={`/works/users/${encodeURIComponent(member.data.id)}`}>
            我的作品
          </Link>
          <p>当前 Discord 正式成员 · {member.data.can_view_abyss ? '可访问深渊' : '普通区域'}</p>
          <label>
            <input
              type="checkbox"
              checked={nsfwSnapshot?.show_nsfw ?? member.data.show_nsfw}
              disabled={preference.isPending || !nsfwSnapshot}
              onChange={(event) => {
                if (nsfwSnapshot)
                  preference.mutate({
                    show_nsfw: event.target.checked,
                    expected_version: nsfwSnapshot.nsfw_preference_version!,
                    user_id: String(nsfwSnapshot.user_id),
                    nsfw_guild_id: nsfwSnapshot.nsfw_guild_id!,
                    session,
                  });
              }}
            />{' '}
            显示 NSFW 作品
          </label>
          {(nsfwSnapshot?.show_nsfw ?? member.data.show_nsfw) &&
            (nsfwSnapshot?.nsfw_eligible ?? member.data.nsfw_eligible) === false && (
              <p role="status">
                NSFW 开关已开启，但当前年龄资格尚不允许查看 NSFW 内容。你的开关设置仍会保留。
              </p>
            )}
          {preference.isPending && <p role="status">正在更新可见内容…</p>}
          {preference.error && <p role="alert">{workError(preference.error)}</p>}
          <V2PreferencesSection key={member.data.id} userId={member.data.id} />
          <WorkAuthorFollows />
          <WorkBannerApplications />
        </section>
      )}
    </>
  );
}
