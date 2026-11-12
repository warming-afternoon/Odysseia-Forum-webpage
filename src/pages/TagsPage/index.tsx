import { useMemo, useState, type MouseEvent } from "react";
import { Search } from "lucide-react";
import { useNavigate } from "react-router-dom";

import { addToken } from "@/shared/lib/searchTokenizer";
import { workError } from "@/features/works/components";
import type { ChannelTagInfo } from "@/features/tags/api/tagsApi";
import { useSidebarCollapsedSetting } from "@/shared/hooks/useSettings";
import { Select } from "@/shared/ui/Select";
import { useTagStats } from "@/features/tags/hooks/useTagStats";
import { useChannels } from "@/shared/hooks/useChannels";
import { customTagsEnabled } from "@/shared/config/tags";
import { LiveTagPool } from "@/features/tags/components/LiveTagPool";

interface AggregatedChannelSlice {
  channelId: string;
  platform: ChannelTagInfo['platform'];
  guildId: string;
  scopeKey: string;
  channelName: string;
  isVirtual: boolean;
  count: number;
}

interface AggregatedTagCard {
  key: string;
  name: string;
  categoryName: string;
  totalCount: number;
  channelSlices: AggregatedChannelSlice[];
  topChannelSlices: AggregatedChannelSlice[];
  remainingChannels: number;
  hasVirtual: boolean;
  normalizedChannelSearch: string;
}

const ALL_CHANNELS_VALUE = "__all__";
const TOP_CHANNEL_SLICE_COUNT = 3;

export function TagsPage() {
  const [tab, setTab] = useState<"pool" | "stats">("pool");
  if (!customTagsEnabled) return <TagStatistics />;
  return <div className="flex h-full min-h-0 shrink-0 flex-col gap-5 p-4 text-(--od-text-primary) sm:p-6 lg:p-8">
    <header className="od-page-heading shrink-0"><h1 className="od-page-title">标签</h1></header>
    <nav aria-label="标签视图" className="flex shrink-0 gap-2">
      {([{ id: "pool", label: "标签池" }, { id: "stats", label: "使用统计" }] as const).map((item) =>
        <button key={item.id} type="button" aria-pressed={tab === item.id} onClick={() => setTab(item.id)} className={`od-pill-chip min-h-10 ${tab === item.id ? "bg-(--od-accent)/10 text-(--od-accent)" : ""}`}>{item.label}</button>)}
    </nav>
    <div className="min-h-0 flex-1">{tab === "pool" ? <LiveTagPool /> : <div className="h-full overflow-y-auto"><TagStatistics embedded /></div>}</div>
  </div>;
}

function TagStatistics({ embedded = false }: { embedded?: boolean }) {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedChannelId, setSelectedChannelId] =
    useState<string>(ALL_CHANNELS_VALUE);
  const navigate = useNavigate();
  const sidebarCollapsed = useSidebarCollapsedSetting();

  const { data: channelsData, isLoading: isChannelsLoading } = useChannels();
  const channelMap = useMemo(() => {
    const map = new Map<string, string>();
    channelsData?.apiData?.forEach((c) => map.set(c.channel_id, c.name));
    return map;
  }, [channelsData]);

  const allStats = useTagStats();
  const channelOptions = useMemo(() => {
    const map = new Map<string, ChannelTagInfo & { id: string; name: string }>();
    if (allStats.error) return [];
    for (const item of allStats.data?.items ?? []) {
      for (const info of item.channel_info) {
        const id = `${info.platform}:${info.guild_id}:${info.channel_id}`;
        const name = info.channel_name || (info.platform === 'discord' ? channelMap.get(info.channel_id) : undefined) || `频道 ${info.channel_id}`;
        map.set(id, { ...info, id, name });
      }
    }
    return [...map.values()].sort((a, b) => a.name.localeCompare(b.name, 'zh-CN'));
  }, [allStats.data, allStats.error, channelMap]);

  const selectedChannel = channelOptions.find(channel => channel.id === selectedChannelId);
  const selectedChannelName = selectedChannelId === ALL_CHANNELS_VALUE ? '全部频道' : selectedChannel?.name || '所选频道';
  const [platform, guildId, channelId] = selectedChannelId.split(':');
  const stats = useTagStats(selectedChannelId === ALL_CHANNELS_VALUE ? {} : {
    platform: platform as 'discord' | 'fluxer', guild_id: guildId, channel_ids: [channelId],
  });
  const statsData = stats.error ? undefined : stats.data;
  const isStatsLoading = stats.isPending;

  const aggregatedTags = useMemo<AggregatedTagCard[]>(() => {
    if (!statsData) return [];
    return statsData.items.map(item => {
      const channelSlices = item.channel_info.map(info => ({
        channelId: info.channel_id,
        platform: info.platform,
        guildId: info.guild_id,
        scopeKey: `${info.platform}:${info.guild_id}:${info.channel_id}`,
        channelName: info.channel_name || (info.platform === 'discord' ? channelMap.get(info.channel_id) : undefined) || `频道 ${info.channel_id}`,
        isVirtual: info.is_virtual,
        count: info.work_count,
      })).sort((a, b) => b.count - a.count);
      return {
        key: item.id,
        name: item.tag_name,
        categoryName: item.category_name || '未分类',
        totalCount: item.total_work_count,
        channelSlices,
        topChannelSlices: channelSlices.slice(0, TOP_CHANNEL_SLICE_COUNT),
        remainingChannels: Math.max(0, channelSlices.length - TOP_CHANNEL_SLICE_COUNT),
        hasVirtual: item.is_virtual,
        normalizedChannelSearch: channelSlices.map(slice => slice.channelName.toLowerCase()).join(' '),
      };
    }).sort((a, b) => b.totalCount - a.totalCount);
  }, [channelMap, statsData]);

  const filteredTags = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    if (!query) return aggregatedTags;
    return aggregatedTags.filter(
      (tag) =>
        tag.name.toLowerCase().includes(query) ||
        tag.normalizedChannelSearch.includes(query),
    );
  }, [aggregatedTags, searchQuery]);

  const totalWorks = Number(statsData?.total_works || 0);
  const totalTags = aggregatedTags.length;
  const maxTagCount = useMemo(
    () =>
      aggregatedTags.length > 0
        ? Math.max(...aggregatedTags.map((tag) => tag.totalCount))
        : 1,
    [aggregatedTags],
  );

  const openTagSearch = (tag: AggregatedTagCard, scope?: { channelId: string; platform: string; guildId: string }) => {
    const nextParams = new URLSearchParams();
    if (tag.hasVirtual) nextParams.set('q', addToken('', 'tag', tag.name));
    else nextParams.set('include_tag_ids', tag.key);
    if (scope) {
      nextParams.set('channel', scope.channelId);
      nextParams.set('platform', scope.platform);
      nextParams.set('guild_id', scope.guildId);
    }
    navigate(`/search?${nextParams.toString()}`);
  };

  const handleTagClick = (tag: AggregatedTagCard) => openTagSearch(tag, selectedChannelId === ALL_CHANNELS_VALUE ? undefined : { channelId, platform, guildId });
  const handleChannelSliceClick = (event: MouseEvent, tag: AggregatedTagCard, scope: AggregatedChannelSlice) => {
    event.stopPropagation();
    openTagSearch(tag, scope);
  };

  const isPageLoading = isChannelsLoading || isStatsLoading;

  return (
    <div className="flex min-h-full flex-col overflow-x-clip text-(--od-text-primary)">
      <div className={`animate-in fade-in duration-500 flex-1 ${embedded ? "" : "p-4 sm:p-6 lg:p-8"}`}>
        <div className="mx-auto flex w-full max-w-7xl flex-col gap-8 lg:gap-10">
          <div>
            {!embedded && <div className="od-page-heading flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
              <h1 className="od-page-title">标签总览</h1>
              <button
                type="button"
                onClick={() => navigate("/search")}
                className="od-inline-action od-inline-action-ghost hidden sm:inline-flex"
              >
                返回搜索
              </button>
            </div>}

            <div
              className="mt-6 grid grid-cols-1 gap-x-8 gap-y-6 sm:grid-cols-2 lg:mt-8 lg:grid-cols-3 animate-in fade-in slide-in-from-top-4 duration-500"
              style={{ animationDelay: "100ms" }}
            >
              <div className="py-2">
                <div className="space-y-2">
                  <p className="text-sm font-medium text-(--od-text-secondary)">
                    标签总数
                  </p>
                  <p className="text-[2rem] font-semibold tracking-tight text-(--od-text-value)">
                    {totalTags}
                  </p>
                </div>
              </div>

              <div className="py-2">
                <div className="space-y-2">
                  <p className="text-sm font-medium text-(--od-text-secondary)">
                    相关作品
                  </p>
                  <p className="text-[2rem] font-semibold tracking-tight text-(--od-text-value)">
                    {totalWorks}
                  </p>
                </div>
              </div>

              <div className="py-2 sm:col-span-2 lg:col-span-1">
                <div className="space-y-2">
                  <p className="text-sm font-medium text-(--od-text-secondary)">
                    平均作品 / 标签
                  </p>
                  <p className="text-[2rem] font-semibold tracking-tight text-(--od-text-value)">
                    {totalTags > 0 ? Math.round(aggregatedTags.reduce((total, tag) => total + tag.totalCount, 0) / totalTags) : 0}
                  </p>
                </div>
              </div>
            </div>
          </div>

          <section className="px-1">
            <h2 className="od-section-title mb-5 lg:mb-6">筛选标签范围</h2>

            <div
              className="animate-in fade-in slide-in-from-top-4 duration-500"
              style={{ animationDelay: "200ms" }}
            >
              <div className="mb-3 flex flex-wrap items-center gap-2 text-xs text-(--od-text-tertiary)">
                <span className="rounded-full border border-(--od-shell-line) px-2.5 py-1">
                  频道视图:{" "}
                  <span className="text-(--od-text-secondary)">
                    {selectedChannelName}
                  </span>
                </span>
                <span>按作品去重统计</span>
                <span>展示前三个频道</span>
              </div>

              <div className="grid grid-cols-1 gap-4 md:grid-cols-[240px_minmax(0,1fr)]">
                <Select
                  value={selectedChannelId}
                  options={[
                    { value: ALL_CHANNELS_VALUE, label: "全部频道" },
                    ...channelOptions.map((ch) => ({
                      value: ch.id,
                      label: ch.name,
                    })),
                  ]}
                  onChange={(v) => setSelectedChannelId(v)}
                  className="w-full"
                />
                <div className="relative">
                  <Search className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-(--od-text-tertiary)" />
                  <input
                    type="search"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="搜索标签或频道..."
                    className="od-ghost-input min-h-10 w-full pl-10 pr-1 text-(--od-text-primary) placeholder:text-(--od-text-tertiary)"
                  />
                </div>
              </div>
            </div>
          </section>

          {stats.error ? <p role="alert" className="text-sm">统计加载失败：{workError(stats.error)} <button type="button" className="underline" onClick={() => void stats.refetch()}>重试</button></p> : isPageLoading ? (
            <div
              className={`grid grid-cols-1 gap-4 sm:grid-cols-2 lg:gap-5 ${
                sidebarCollapsed
                  ? "lg:grid-cols-4 xl:grid-cols-5"
                  : "lg:grid-cols-3 xl:grid-cols-4"
              }`}
            >
              {Array.from({ length: 12 }).map((_, i) => (
                <div
                  key={i}
                  className="h-40 animate-pulse rounded-2xl bg-(--od-surface-soft)"
                />
              ))}
            </div>
          ) : filteredTags.length > 0 ? (
            <div
              className={`grid grid-cols-1 gap-x-6 gap-y-2 sm:grid-cols-2 lg:gap-x-8 lg:gap-y-3 ${
                sidebarCollapsed
                  ? "lg:grid-cols-4 xl:grid-cols-5"
                  : "lg:grid-cols-3 xl:grid-cols-4"
              } animate-in fade-in duration-500`}
              style={{ animationDelay: "300ms" }}
            >
              {filteredTags.map((tag, index) => (
                <article
                  key={tag.key}
                  role="link"
                  tabIndex={0}
                  aria-label={`搜索标签 ${tag.name}`}
                  onClick={() => handleTagClick(tag)}
                  onKeyDown={event => { if (event.target === event.currentTarget && (event.key === 'Enter' || event.key === ' ')) { event.preventDefault(); handleTagClick(tag); } }}
                  className="group relative flex min-h-[168px] w-full flex-col py-3 text-left transition-colors duration-200"
                  style={{ animationDelay: `${300 + index * 24}ms` }}
                >
                  <div className="mb-2 flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <h3 className="truncate text-[1.02rem] font-semibold tracking-tight text-(--od-text-primary) transition-colors group-hover:text-(--od-accent)">
                          {tag.name}
                        </h3>
                        {tag.hasVirtual && (
                          <span className="rounded-full border border-(--od-accent)/30 bg-(--od-accent)/10 px-2 py-0.5 text-[10px] font-semibold text-(--od-accent)">
                            虚拟
                          </span>
                        )}
                      </div>
                      <p className="mt-1 text-xs text-(--od-text-tertiary)">
                        {tag.categoryName}
                      </p>
                    </div>
                    <div className="shrink-0 text-right">
                      <p className="text-lg font-semibold tracking-tight text-(--od-accent)">
                        {tag.totalCount}
                      </p>
                      <p className="text-[11px] text-(--od-text-tertiary)">
                        作品
                      </p>
                    </div>
                  </div>

                  <div className="min-h-[56px] flex-1">
                    <div className="flex min-h-[56px] flex-col items-stretch gap-1.5">
                      {tag.topChannelSlices.map((slice) => (
                        <div
                          key={`${tag.key}-${slice.scopeKey}-${slice.isVirtual ? "v" : "r"}`}
                          className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-2"
                        >
                          <button
                            type="button"
                            onClick={(e) =>
                              handleChannelSliceClick(
                                e,
                                tag,
                                slice,
                              )
                            }
                            className="truncate text-left text-xs text-(--od-text-secondary) transition-colors hover:text-(--od-accent)"
                            title={`在频道 ${slice.channelName} 中搜索标签 ${tag.name}`}
                          >
                            {slice.channelName}
                          </button>
                          <span className="text-[11px] tabular-nums text-(--od-text-tertiary)">
                            {slice.count}
                          </span>
                        </div>
                      ))}
                      {tag.remainingChannels > 0 && (
                        <span className="mb-2 block text-[11px] leading-none text-(--od-text-tertiary)">
                          +{tag.remainingChannels} 频道
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="relative mt-4 h-[2px] overflow-hidden rounded-full bg-[color-mix(in_srgb,var(--od-text-secondary)_10%,transparent)]">
                    <div
                      className="h-full bg-linear-to-r from-(--od-accent)/50 to-(--od-accent) transition-all duration-500"
                      style={{
                        width: `${Math.min((tag.totalCount / maxTagCount) * 100, 100)}%`,
                      }}
                    />
                  </div>
                </article>
              ))}
            </div>
          ) : (
            <div className="flex min-h-[420px] items-center justify-center p-10">
              <div className="text-center">
                <Search className="mx-auto mb-4 h-16 w-16 text-(--od-text-tertiary)" />
                <h3 className="mb-2 text-xl font-bold text-(--od-text-primary)">
                  没有找到匹配的标签
                </h3>
                <p className="text-(--od-text-secondary)">
                  换个关键词试试看？或者切换一下频道范围。
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
