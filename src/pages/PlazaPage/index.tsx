import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Compass, Dices, Plus, Sparkles, RotateCw } from 'lucide-react';

import { ThreadCard } from '@/entities/thread/ThreadCard';
import { BooklistCard } from '@/entities/booklist/BooklistCard';
import { BannerCarousel } from '@/widgets/layout/BannerCarousel';
import type { Booklist } from '@/entities/booklist/types';
import { plazaApi, PLAZA_RAILS, type PlazaRailKey } from '@/features/plaza/api/plazaApi';
import type { Thread } from '@/entities/thread/types';
import { useToggleBooklistCollection } from '@/features/booklists/hooks/useBooklistsData';
import { useUserPreferences } from '@/features/preferences/hooks/useUserPreferences';
import { getDiscoveryPreferenceContext } from '@/features/preferences/lib/discoveryPreferences';
import { filterThreadsByPreferences } from '@/entities/thread/lib/threadFilter';
import { plazaKeys } from '@/features/plaza/lib/queryKeys';
import { usePreviewStore } from '@/features/search/store/previewStore';
import { GUILD_ID } from '@/shared/config/channelCategories.private';
import { buildDiscordWebThreadUrl } from '@/shared/lib/discord';
import { FluidDivider } from '@/shared/ui/FluidDivider';
import { useCardGridClass } from '@/shared/hooks/useSettings';

interface RailRefreshButtonProps {
  onRefresh: () => void;
  isLoading: boolean;
}

function RailRefreshButton({ onRefresh, isLoading }: RailRefreshButtonProps) {
  return (
    <button
      type="button"
      onClick={onRefresh}
      disabled={isLoading}
      className="od-inline-action od-inline-action-ghost gap-2 group/refresh transition-all active:scale-92 hover:bg-transparent hover:translate-y-0 hover:text-(--od-accent)"
    >
      <RotateCw className={`h-3.5 w-3.5 transition-transform duration-500 ${isLoading ? 'animate-spin' : 'group-hover/refresh:rotate-180'}`} />
      <span>换一批</span>
    </button>
  );
}

export function PlazaPage() {
  const navigate = useNavigate();
  const setPreviewThread = usePreviewStore((state) => state.setPreviewThread);
  const { preferences } = useUserPreferences({ guildId: GUILD_ID });
  const [ignorePreferenceFilter, setIgnorePreferenceFilter] = useState(false);

  // 判断是否有生效的偏好设置，用于展示 UI 提示
  const hasActivePreferences = useMemo(() => {
    if (!preferences) return false;
    const channelIds = preferences.preferred_channels || [];
    const includeTags = preferences.include_tags || [];
    const excludeTags = preferences.exclude_tags || [];
    return channelIds.length > 0 || includeTags.length > 0 || excludeTags.length > 0;
  }, [preferences]);

  const showPreferenceNotice = hasActivePreferences && !ignorePreferenceFilter;

  const discoveryPreferenceContext = useMemo(
    () => getDiscoveryPreferenceContext(preferences),
    [preferences],
  );

  const gridClass = useCardGridClass();

  // 状态：存储每个轨道的具体帖子（由 query 或 refresh 产生）
  const [railThreadsMap, setRailThreadsMap] = useState<Record<string, Thread[]>>({});
  const [refreshingKeys, setRefreshingKeys] = useState<Record<string, boolean>>({});
  const [railOffsets, setRailOffsets] = useState<Record<string, number>>({});

  const bannersQuery = useQuery({
    queryKey: plazaKeys.banners(),
    queryFn: plazaApi.getBanners,
    staleTime: 60 * 1000,
  });

  const booklistsQuery = useQuery({
    queryKey: plazaKeys.booklists(),
    queryFn: plazaApi.getFeaturedBooklists,
    staleTime: 2 * 60 * 1000,
  });

  // 聚合查询所有轨道（初始化）
  const railsQuery = useQuery({
    queryKey: plazaKeys.rails({
      limit: 12,
      days: 30,
      applyPreferences: !ignorePreferenceFilter,
    }),
    queryFn: () => plazaApi.getRails({
      limit: 12,
      days: 30,
      apply_preferences: !ignorePreferenceFilter,
    }),
    staleTime: 90 * 1000,
  });

  // 当基础查询数据到达时，初始化 Map
  useEffect(() => {
    if (railsQuery.data) {
      const applyFilter = (threads: Thread[]) =>
        !ignorePreferenceFilter ? filterThreadsByPreferences(threads, discoveryPreferenceContext) : threads;

      setRailThreadsMap({
        latest: applyFilter(railsQuery.data.latest || []),
        reaction_surge: applyFilter(railsQuery.data.reaction_surge || []),
        discussion_surge: applyFilter(railsQuery.data.discussion_surge || []),
        collection_surge: applyFilter(railsQuery.data.collection_surge || []),
        editors_pick: applyFilter((railsQuery.data as any).editors_pick || []),
      });
      setRailOffsets({
        latest: railsQuery.data.latest?.length || 0,
        reaction_surge: railsQuery.data.reaction_surge?.length || 0,
        discussion_surge: railsQuery.data.discussion_surge?.length || 0,
        collection_surge: railsQuery.data.collection_surge?.length || 0,
        editors_pick: ((railsQuery.data as any).editors_pick || []).length,
      });
    }
  }, [railsQuery.data, ignorePreferenceFilter, discoveryPreferenceContext]);

  const handleRefreshRail = useCallback(async (key: PlazaRailKey) => {
    if (refreshingKeys[key]) return;

    setRefreshingKeys(prev => ({ ...prev, [key]: true }));

    try {
      const currentList = railThreadsMap[key] || [];
      const currentOffset = railOffsets[key] ?? currentList.length;

      let nextThreads = await plazaApi.getRail(key, {
        limit: 12,
        days: 30,
        offset: currentOffset,
        apply_preferences: !ignorePreferenceFilter,
      });

      let nextOffset = currentOffset + nextThreads.length;

      if (nextThreads.length === 0 && currentOffset > 0) {
        nextThreads = await plazaApi.getRail(key, {
          limit: 12,
          days: 30,
          offset: 0,
          apply_preferences: !ignorePreferenceFilter,
        });
        nextOffset = nextThreads.length;
      }

      if (nextThreads.length > 0) {
        const filteredNextThreads = !ignorePreferenceFilter
          ? filterThreadsByPreferences(nextThreads, discoveryPreferenceContext)
          : nextThreads;

        setRailThreadsMap(prev => ({
          ...prev,
          [key]: filteredNextThreads,
        }));
        setRailOffsets(prev => ({
          ...prev,
          [key]: nextOffset,
        }));
      }
    } catch (error) {
      console.error(`[PlazaPage] Failed to refresh rail ${key}:`, error);
    } finally {
      setRefreshingKeys(prev => ({ ...prev, [key]: false }));
    }
  }, [railThreadsMap, railOffsets, refreshingKeys, ignorePreferenceFilter, discoveryPreferenceContext]);

  const collectMutation = useToggleBooklistCollection();

  return (
    <div className="animate-in fade-in slide-in-from-bottom-4 duration-500 flex flex-col min-h-screen">
      {/* 顶部 Banner 区域：释放圆角约束，全宽展示 */}
      <section className="w-full">
        {bannersQuery.isLoading ? (
          <div className="h-48 w-full animate-pulse bg-(--od-surface-input) xl:h-64" />
        ) : bannersQuery.data && bannersQuery.data.length > 0 ? (
          <BannerCarousel
            fullWidth={true}
            banners={bannersQuery.data!.map((b) => ({
              id: b.thread_id,
              image: b.cover_image_url,
              title: b.title,
              description: b.author ? `作者：${b.author.display_name || b.author.global_name || b.author.name}` : '点击可以直接探索原帖',
              link: buildDiscordWebThreadUrl({
                guildId: b.guild_id || GUILD_ID,
                channelId: b.channel_id,
                threadId: b.thread_id,
              }),
            }))}
            onBannerClick={(banner) => {
              const url = banner.link || buildDiscordWebThreadUrl({
                guildId: GUILD_ID,
                channelId: banner.id,
                threadId: banner.id,
              });
              window.open(url, '_blank', 'noopener,noreferrer');
            }}
          />
        ) : (
          <BannerCarousel fullWidth={true} banners={[]} />
        )}
      </section>

      {/* 主体内容区域：保持原有的间距设计 */}
      <div className="flex flex-col gap-10 p-4 sm:p-6 lg:p-8">
        <section className="relative">
          <div className="relative z-10 flex flex-col justify-between pt-2 sm:pt-4">
            <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
              <div className="max-w-3xl">
                <div className="od-editorial-kicker mb-3 text-(--od-text-tertiary)">
                  <Compass className="h-3.5 w-3.5" />
                  Plaza Spotlight
                </div>
                <h1 className="od-hero-title max-w-2xl text-(--od-text-primary)">内容广场</h1>
              </div>

              <div className="flex flex-wrap items-center gap-2 self-start lg:max-w-[24rem] lg:justify-end">
                <button
                  type="button"
                  onClick={() => navigate('/draw')}
                  className="od-inline-action od-inline-action-primary"
                >
                  <Dices className="h-4 w-4" />
                  进入随机抽卡
                </button>
                <button
                  type="button"
                  onClick={() => navigate('/booklists')}
                  className="od-inline-action od-inline-action-ghost"
                >
                  <Plus className="h-4 w-4" />
                  去书单页
                </button>
              </div>
            </div>
          </div>
        </section>

      <section className="px-1 py-2">


        <FluidDivider label="Discovery Feed" tone="strong" className="mb-6" />
        {showPreferenceNotice && (
          <div className="mb-0">
            <div className="od-inline-notice" data-tone="accent">
              <div className="od-inline-notice-head">
                <div className="min-w-0">
                  <div className="od-editorial-kicker">
                    <Compass className="h-3.5 w-3.5" />
                    Preference Filter Active
                  </div>
                  <p className="od-inline-notice-title mt-3">我先按你的偏好帮你筛过一遍啦</p>
                </div>

                <div className="od-inline-notice-actions shrink-0 sm:justify-end">
                  <button
                    type="button"
                    onClick={() => setIgnorePreferenceFilter(true)}
                    className="od-inline-action od-inline-action-soft"
                  >
                    暂时忽略偏好
                  </button>
                  <button
                    type="button"
                    onClick={() => navigate('/me?tab=preferences')}
                    className="od-inline-action od-inline-action-ghost"
                  >
                    去调整偏好
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
        {!showPreferenceNotice && hasActivePreferences && ignorePreferenceFilter && (
          <div className="mb-5 flex justify-end">
            <button
              type="button"
              onClick={() => setIgnorePreferenceFilter(false)}
              className="od-inline-action od-inline-action-ghost"
            >
              恢复偏好过滤
            </button>
          </div>
        )}
      </section>

      <section className="px-1">
        {PLAZA_RAILS.map((rail) => {
          const list = railThreadsMap[rail.key];
          if (!list || list.length === 0) return null;

          return (
            <div key={rail.key} className="od-page-section py-4 sm:py-5">
              <FluidDivider label={rail.label} className="mb-5" />
              <div className="mb-5 flex items-center justify-between gap-3">
                <div>
                  <h2 className="od-section-title">{rail.title}</h2>
                  <p className="mt-1 text-sm text-(--od-text-secondary)">{rail.subtitle}</p>
                </div>
                <RailRefreshButton
                  onRefresh={() => handleRefreshRail(rail.key)}
                  isLoading={refreshingKeys[rail.key]}
                />
              </div>

              <div className={gridClass}>
                {list.map((thread) => (
                  <ThreadCard
                    key={`${rail.key}-${thread.thread_id}`}
                    thread={thread}
                    onPreview={(item) => setPreviewThread(item)}
                  />
                ))}
              </div>
            </div>
          );
        })}
      </section>

      <section className="px-1">
        <FluidDivider label="Booklists" tone="strong" className="mb-5" />
        <div className="mb-5 flex items-center justify-between gap-3">
          <div>
            <h2 className="od-section-title">书单精选</h2>
            <p className="mt-1 text-sm text-(--od-text-secondary)">这些都是大家比较爱收的书单，我替你放在前面啦，说不定会刚好合你胃口。</p>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => navigate('/booklists')}
              className="od-inline-action od-inline-action-ghost"
            >
              全部书单
            </button>
            <button
              type="button"
              onClick={() => navigate('/booklists')}
              className="od-inline-action od-inline-action-primary"
            >
              <Plus className="h-3.5 w-3.5" />
              创建
            </button>
          </div>
        </div>

        {booklistsQuery.isLoading ? (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {Array.from({ length: 3 }).map((_, idx) => (
              <div key={idx} className="h-72 animate-pulse rounded-xl bg-(--od-bg-tertiary)" />
            ))}
          </div>
        ) : booklistsQuery.data && booklistsQuery.data.length > 0 ? (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {booklistsQuery.data!.map((booklist: Booklist) => (
              <BooklistCard
                key={booklist.id}
                booklist={booklist}
                canManage={false}
                onOpen={(id) => navigate(`/booklists/${id}`)}
                onToggleCollect={(item) =>
                  collectMutation.mutate({ id: item.id, collected: Boolean(item.collected_flag) })
                }
                onEdit={() => undefined}
                onDelete={() => undefined}
                collectLoading={collectMutation.isPending}
              />
            ))}
          </div>
        ) : (
          <div className="rounded-[1.25rem] bg-(--od-surface-input) p-6 text-sm text-(--od-text-secondary)">
            这会儿还没有我想先塞给你的书单呢，晚点再来看看也许就有啦。
          </div>
        )}
      </section>

      <div className="px-1 text-xs text-(--od-text-tertiary)">
        <div className="inline-flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-(--od-accent)" />
          这些内容是我按最近的热度和时间顺手排出来的，先给你一个好逛的起点呀。
        </div>
      </div>

      </div>
    </div>
  );
}
