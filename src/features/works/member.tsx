import { useWorkMember } from './useWorkMember';
import { V2PreferencesSection } from '@/features/preferences/components/V2PreferencesSection';
import { Link } from 'react-router-dom';
import { WorkAuthorFollows } from './authors';
import { WorkBannerApplications } from './bannerApplications';
import { WorkStatus } from './components';

export { useWorkMember } from './useWorkMember';

export function WorkMePage() {
  const member = useWorkMember();
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
          <V2PreferencesSection key={member.data.id} userId={member.data.id} />
          <WorkAuthorFollows />
          <WorkBannerApplications />
        </section>
      )}
    </>
  );
}
