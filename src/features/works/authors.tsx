import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { workGovernanceApi } from './governanceApi';
import { workKeys } from './layout';
import { useWorkMember } from './member';
import { WorkStatus, workError } from './components';

export function WorkAuthorProfile({ authorId }: { authorId: string }) {
  const member = useWorkMember();
  const client = useQueryClient();
  const profile = useQuery({ queryKey: [...workKeys.all, 'author', authorId], queryFn: ({ signal }) => workGovernanceApi.author(authorId, signal), retry: false });
  const follow = useMutation({ mutationFn: (value: boolean) => workGovernanceApi.followAuthor(authorId, value), onSuccess: async () => { await client.invalidateQueries({ queryKey: workKeys.all }); } });
  return <section className="mb-5 rounded border p-4"><WorkStatus pending={profile.isPending} error={profile.error} />
    {profile.data && !profile.error && <><div className="flex items-center gap-3">{profile.data.avatar_url && <img className="h-12 w-12 rounded-full" src={profile.data.avatar_url} alt="" />}<h2 className="text-xl">{profile.data.display_name || profile.data.username}</h2></div><p className="my-2 text-sm">{profile.data.work_count} 个可见作品</p>
      {member.data && member.data.id !== authorId && <button className="rounded border px-3 py-2" disabled={follow.isPending} onClick={() => follow.mutate(!profile.data?.followed)}>{profile.data.followed ? '取消关注作者' : '关注作者'}</button>}</>}
    {follow.error && <p role="alert">{workError(follow.error)}</p>}
  </section>;
}
export function WorkAuthorFollows() {
  const query = useQuery({ queryKey: [...workKeys.all, 'author-follows'], queryFn: ({ signal }) => workGovernanceApi.authorFollows(signal), retry: false });
  return <section className="my-4"><h3 className="mb-3 text-lg">关注的作者</h3><WorkStatus pending={query.isPending} error={query.error} />
    {!query.error && <ul className="flex flex-wrap gap-3">{query.data?.items.map(author => <li key={author.id}><Link className="underline" to={`/works/users/${encodeURIComponent(author.id)}`}>{author.display_name || author.username}</Link></li>)}</ul>}
  </section>;
}
