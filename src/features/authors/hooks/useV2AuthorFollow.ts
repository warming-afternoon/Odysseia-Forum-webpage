import { notifyError, notifySuccess } from '@/features/mascot/lib/notify';
import { extractErrorMessage } from '@/shared/lib/notify';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { workGovernanceApi } from '@/features/works/governanceApi';
import { captureAuthSession, isAuthSessionCurrent } from '@/shared/lib/authSession';

const key = (id: string) => ['authors', 'v2-follow', captureAuthSession().generation, id] as const;
export function useAuthorFollowState(authorId: string | undefined, { enabled = true }: { enabled?: boolean; initialFollowed?: boolean } = {}) {
  return useQuery({
    queryKey: key(authorId || ''),
    queryFn: async ({ signal }) => (await workGovernanceApi.author(authorId!, signal)).followed,
    enabled: enabled && Boolean(authorId),
    staleTime: 0,
    retry: false,
  });
}
export function useToggleAuthorFollow(authorId: string | undefined, followed: boolean) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      if (!authorId) throw new Error('无效作者 ID');
      const session = captureAuthSession();
      await workGovernanceApi.followAuthor(authorId, !followed);
      return { value: !followed, session, queryKey: key(authorId) };
    },
    onError: (error) => notifyError(extractErrorMessage(error, '更新作者关注失败，请稍后再试')),
    onSuccess: async ({ value, session, queryKey }) => {
      if (!isAuthSessionCurrent(session)) return;
      client.setQueryData(queryKey, value);
      notifySuccess(value ? '已关注这位作者' : '已取消关注这位作者');
      await Promise.all([
        client.invalidateQueries({ queryKey: ['authors'] }),
        client.invalidateQueries({ queryKey: ['works-v2'] }),
      ]);
    },
  });
}
