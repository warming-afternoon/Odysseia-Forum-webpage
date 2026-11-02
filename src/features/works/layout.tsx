import { getForumAuthConfig } from '@/features/auth/api/fluxerAuthApi';
import { useQuery } from '@tanstack/react-query';
import { Link, Outlet } from 'react-router-dom';
import { worksApi } from './api';
import { useWorkMember } from './member';

export const workKeys = { all: ['works-v2'] as const };
export function WorksLayout() {
  const member = useWorkMember();
  return <div className="mx-auto w-full max-w-6xl p-4 sm:p-6">
    <header className="mb-6 border-b border-(--od-border) pb-4">
      <h1 className="mb-3 text-2xl font-semibold">作品</h1>
      <nav aria-label="作品导航" className="flex flex-wrap gap-4 text-sm">
        <Link to="/works">搜索</Link><Link to="/works/discover">发现</Link>
        <Link to="/works/collection">收藏</Link><Link to="/works/booklists">书单</Link>
        <Link to="/works/follows">关注</Link><Link to="/works/notifications">通知</Link>
        <Link to="/works/me">个人页</Link><Link to="/works/new">发布作品</Link>
        {member.data?.is_admin && <Link to="/works/admin/deleted">管理已隐藏作品</Link>}
        <Link to="/">旧版首页</Link>
      </nav>
    </header>
    <Outlet />
  </div>;
}
export function WorksBanners() {
  const banners = useQuery({ queryKey: [...workKeys.all, 'banners'], queryFn: ({ signal }) => worksApi.banners(signal) });
  const auth = useQuery({ queryKey: ['works-v2', 'native-config'], queryFn: getForumAuthConfig });
  if (!banners.data?.items.length || banners.error) return null;
  return <aside aria-label="推荐作品与赛事" className="mb-6 flex gap-4 overflow-auto">{banners.data.items.map(item => {
    if (item.kind === 'work') return <Link key={item.id} to={`/works/${encodeURIComponent(item.work.id)}`} className="min-w-48 rounded-lg border p-3">{(item.image_url || item.work.images[0]) && <img src={item.image_url || item.work.images[0]} alt="" className="mb-2 h-24 w-48 rounded object-cover" />}{item.work.title}</Link>;
    const base = item.platform === 'discord' ? 'https://discord.com' : auth.data?.fluxer_api_url ? new URL(auth.data.fluxer_api_url).origin : null;
    const target = base ? `${base}/channels/${encodeURIComponent(item.guild_id)}/${encodeURIComponent(item.channel_id)}` : null;
    return <div className="min-w-48 rounded-lg border p-3" key={item.id}>{target ? <a href={target} target="_blank" rel="noreferrer">{item.image_url && <img src={item.image_url} alt="" className="mb-2 h-24 w-48 rounded object-cover" />}{item.title} ↗</a> : item.title}</div>;
  })}</aside>;
}
