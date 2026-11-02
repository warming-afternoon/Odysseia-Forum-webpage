import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { worksApi } from './api';
import { WorkAuthorFollows } from './authors';
import { workKeys } from './layout';
import { workError, WorkStatus } from './components';

export function useWorkMember() {
  return useQuery({ queryKey: [...workKeys.all, 'me'], queryFn: ({ signal }) => worksApi.me(signal), retry: false, staleTime: 0 });
}
export function WorkMePage() {
  const member = useWorkMember();
  const queryClient = useQueryClient();
  const preference = useMutation({ mutationFn: worksApi.preferences, onSuccess: async () => {
    await queryClient.cancelQueries({ queryKey: workKeys.all });
    await queryClient.resetQueries({ queryKey: workKeys.all });
  } });
  return <><WorkStatus pending={member.isPending} error={member.error} />{member.data && <section className="grid gap-4">
    <h2 className="text-xl">{member.data.display_name || member.data.username}</h2>
    <Link className="underline" to={`/works/users/${encodeURIComponent(member.data.id)}`}>我的作品</Link>
    <p>当前 Discord 正式成员 · {member.data.can_view_abyss ? '可访问深渊' : '普通区域'}</p>
    <label><input type="checkbox" checked={member.data.show_nsfw} disabled={preference.isPending} onChange={event => preference.mutate(event.target.checked)} /> 显示 NSFW 作品</label>
    {preference.isPending && <p role="status">正在更新可见内容…</p>}
    {preference.error && <p role="alert">{workError(preference.error)}</p>}
    <WorkAuthorFollows />
  </section>}</>;
}
