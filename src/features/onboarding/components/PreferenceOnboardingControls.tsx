import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Check, Globe2, LayoutGrid, Rows3, Save, Smartphone } from "lucide-react";

import { useUserPreferences } from "@/features/preferences/hooks/useUserPreferences";
import { searchApi } from "@/features/search/api/searchApi";
import { GUILD_ID } from "@/shared/config/channelCategories.private";
import { useChannels } from "@/shared/hooks/useChannels";
import { useSettings } from "@/shared/hooks/useSettings";
import { useLayoutPreference, type LayoutMode } from "@/shared/hooks/useLayoutPreference";

const DRAFT_KEY = "odysseia_preference_onboarding_draft";

interface PreferenceDraft {
  excludeChannelIds: string[];
  excludeTags: string[];
}

function readDraft(): PreferenceDraft {
  if (typeof window === "undefined") {
    return { excludeChannelIds: [], excludeTags: [] };
  }

  try {
    const parsed = JSON.parse(window.localStorage.getItem(DRAFT_KEY) || "{}");
    return {
      excludeChannelIds: Array.isArray(parsed.excludeChannelIds)
        ? parsed.excludeChannelIds.filter((id: unknown): id is string => typeof id === "string")
        : [],
      excludeTags: Array.isArray(parsed.excludeTags)
        ? parsed.excludeTags.filter((tag: unknown): tag is string => typeof tag === "string")
        : [],
    };
  } catch {
    return { excludeChannelIds: [], excludeTags: [] };
  }
}

function writeDraft(draft: PreferenceDraft) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(DRAFT_KEY, JSON.stringify(draft));
}

function compact<T>(values: T[]) {
  return Array.from(new Set(values));
}

function PreferenceChannelStep() {
  const { data: channelsData } = useChannels();
  const [draft, setDraft] = useState(readDraft);
  const channels = (channelsData?.channels || []).slice(0, 12);

  const toggleChannel = (channelId: string) => {
    setDraft((prev) => {
      const next = prev.excludeChannelIds.includes(channelId)
        ? prev.excludeChannelIds.filter((id) => id !== channelId)
        : [...prev.excludeChannelIds, channelId];
      const nextDraft = { ...prev, excludeChannelIds: next };
      writeDraft(nextDraft);
      return nextDraft;
    });
  };

  return (
    <div className="mt-4 grid max-h-[220px] grid-cols-2 gap-2 overflow-y-auto pr-1">
      {channels.map((channel) => {
        const active = draft.excludeChannelIds.includes(channel.id);
        return (
          <button
            key={channel.id}
            type="button"
            onClick={() => toggleChannel(channel.id)}
            className={`flex min-h-10 items-center justify-between rounded-xl border px-3 py-2 text-left text-xs transition-colors ${
              active
                ? "border-rose-500/45 bg-rose-500/15 text-rose-300"
                : "border-(--od-shell-line) text-(--od-text-secondary) hover:text-(--od-text-primary)"
            }`}
          >
            <span className="min-w-0 truncate">{channel.name}</span>
            {active && <Check className="h-3.5 w-3.5 shrink-0" />}
          </button>
        );
      })}
    </div>
  );
}

function PreferenceTagStep() {
  const [draft, setDraft] = useState(readDraft);
  const { data: channelTagCatalog = [] } = useQuery({
    queryKey: ["onboarding", "preference-tags"],
    queryFn: () => searchApi.getChannelTagCatalog(),
    staleTime: 5 * 60 * 1000,
    retry: false,
  });

  const tags = useMemo(() => {
    const excludedChannels = new Set(draft.excludeChannelIds);
    const scopedCatalog =
      excludedChannels.size > 0
        ? channelTagCatalog.filter((channel) => !excludedChannels.has(channel.channel_id))
        : channelTagCatalog;

    return compact(
      scopedCatalog.flatMap((channel) => [
        ...(channel.available_tags || []),
        ...(channel.virtual_tags || []),
      ]),
    )
      .filter(Boolean)
      .slice(0, 18);
  }, [channelTagCatalog, draft.excludeChannelIds]);

  const toggleTag = (tag: string) => {
    setDraft((prev) => {
      const next = prev.excludeTags.includes(tag)
        ? prev.excludeTags.filter((item) => item !== tag)
        : [...prev.excludeTags, tag];
      const nextDraft = { ...prev, excludeTags: next };
      writeDraft(nextDraft);
      return nextDraft;
    });
  };

  return (
    <div className="mt-4 flex max-h-[220px] flex-wrap gap-2 overflow-y-auto pr-1">
      {tags.length > 0 ? (
        tags.map((tag) => {
          const active = draft.excludeTags.includes(tag);
          return (
            <button
              key={tag}
              type="button"
              onClick={() => toggleTag(tag)}
              className={`rounded-full border px-3 py-1.5 text-xs transition-colors ${
                active
                  ? "border-rose-500/45 bg-rose-500/15 text-rose-300"
                  : "border-(--od-shell-line) text-(--od-text-secondary) hover:text-(--od-text-primary)"
              }`}
            >
              {active ? "- " : ""}
              {tag}
            </button>
          );
        })
      ) : (
        <p className="text-xs text-(--od-text-tertiary)">
          标签目录暂时没有加载出来，也可以先跳过，之后在“我的-偏好”里补。
        </p>
      )}
    </div>
  );
}

function LayoutChoice({
  title,
  value,
  onChange,
}: {
  title: string;
  value: LayoutMode;
  onChange: (mode: LayoutMode) => void;
}) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-xl border border-(--od-shell-line) px-3 py-2">
      <span className="text-xs font-medium text-(--od-text-secondary)">{title}</span>
      <div className="inline-flex items-center gap-1 rounded-full bg-[color-mix(in_srgb,var(--od-surface-input)_70%,transparent)] p-1">
        <button
          type="button"
          onClick={() => onChange("list")}
          className={`inline-flex items-center gap-1 rounded-full px-2 py-1 text-[11px] transition-colors ${
            value === "list"
              ? "bg-(--od-accent) text-white"
              : "text-(--od-text-secondary) hover:text-(--od-text-primary)"
          }`}
        >
          <Rows3 className="h-3 w-3" />
          列表
        </button>
        <button
          type="button"
          onClick={() => onChange("grid")}
          className={`inline-flex items-center gap-1 rounded-full px-2 py-1 text-[11px] transition-colors ${
            value === "grid"
              ? "bg-(--od-accent) text-white"
              : "text-(--od-text-secondary) hover:text-(--od-text-primary)"
          }`}
        >
          <LayoutGrid className="h-3 w-3" />
          网格
        </button>
      </div>
    </div>
  );
}

function PreferenceLayoutStep() {
  const { settings, updateSettings } = useSettings();
  const [searchLayout, setSearchLayout] = useLayoutPreference("search", "grid");
  const [booklistsLayout, setBooklistsLayout] = useLayoutPreference("booklists", "grid");
  const [booklistDetailLayout, setBooklistDetailLayout] = useLayoutPreference(
    "booklist-detail",
    "grid",
  );
  const [tournamentsLayout, setTournamentsLayout] = useLayoutPreference(
    "tournaments",
    "list",
  );

  return (
    <div className="mt-4 space-y-2">
      <LayoutChoice title="搜索页" value={searchLayout} onChange={setSearchLayout} />
      <LayoutChoice title="书单列表" value={booklistsLayout} onChange={setBooklistsLayout} />
      <LayoutChoice title="书单内容" value={booklistDetailLayout} onChange={setBooklistDetailLayout} />
      <LayoutChoice title="赛事区" value={tournamentsLayout} onChange={setTournamentsLayout} />
      <div className="flex items-center justify-between gap-3 rounded-xl border border-(--od-shell-line) px-3 py-2">
        <span className="text-xs font-medium text-(--od-text-secondary)">Discord 跳转</span>
        <div className="inline-flex items-center gap-1 rounded-full bg-[color-mix(in_srgb,var(--od-surface-input)_70%,transparent)] p-1">
          <button
            type="button"
            onClick={() => updateSettings({ openMode: "web" })}
            className={`inline-flex items-center gap-1 rounded-full px-2 py-1 text-[11px] transition-colors ${
              settings.openMode === "web"
                ? "bg-(--od-accent) text-white"
                : "text-(--od-text-secondary) hover:text-(--od-text-primary)"
            }`}
          >
            <Globe2 className="h-3 w-3" />
            Web
          </button>
          <button
            type="button"
            onClick={() => updateSettings({ openMode: "app" })}
            className={`inline-flex items-center gap-1 rounded-full px-2 py-1 text-[11px] transition-colors ${
              settings.openMode === "app"
                ? "bg-(--od-accent) text-white"
                : "text-(--od-text-secondary) hover:text-(--od-text-primary)"
            }`}
          >
            <Smartphone className="h-3 w-3" />
            App
          </button>
        </div>
      </div>
    </div>
  );
}

function PreferenceSaveStep() {
  const { preferences, savePreferences, isSaving, user } = useUserPreferences({
    guildId: GUILD_ID,
  });
  const { data: channelsData } = useChannels();
  const [saved, setSaved] = useState(false);
  const [failed, setFailed] = useState(false);

  const save = async () => {
    if (!user?.id) {
      setFailed(true);
      return;
    }

    const draft = readDraft();
    const allChannelIds = (channelsData?.channels || []).map((channel) => channel.id);
    const preferredChannels =
      draft.excludeChannelIds.length > 0 && allChannelIds.length > 0
        ? allChannelIds.filter((id) => !draft.excludeChannelIds.includes(id))
        : preferences?.preferred_channels || [];

    try {
      await savePreferences({
        preferred_channels: preferredChannels,
        include_tags: preferences?.include_tags || [],
        exclude_tags: compact([
          ...(preferences?.exclude_tags || []),
          ...draft.excludeTags,
        ]),
        include_keywords: preferences?.include_keywords || "",
        exclude_keywords: preferences?.exclude_keywords || "",
        preview_image_mode: preferences?.preview_image_mode || "thumbnail",
        results_per_page: preferences?.results_per_page ?? 5,
        ui_page_size: preferences?.ui_page_size ?? 48,
        sort_method: preferences?.sort_method || "last_active",
      });
      setSaved(true);
      setFailed(false);
    } catch {
      setSaved(false);
      setFailed(true);
    }
  };

  return (
    <div className="mt-4 space-y-3">
      <button
        type="button"
        onClick={save}
        disabled={isSaving || saved}
        className="od-button-primary inline-flex w-full items-center justify-center gap-2 rounded-xl px-4 py-2 text-xs font-semibold disabled:opacity-60"
      >
        <Save className="h-3.5 w-3.5" />
        {saved ? "发现偏好已保存" : isSaving ? "保存中..." : "保存发现偏好"}
      </button>
      {failed && (
        <p className="text-[11px] leading-relaxed text-(--od-error)">
          暂时没能保存到账号。布局选择已经保存在本机，发现偏好之后还能在“我的-偏好”里补。
        </p>
      )}
    </div>
  );
}

export function PreferenceOnboardingControls({ stepId }: { stepId: string }) {
  if (stepId === "preference_channels") return <PreferenceChannelStep />;
  if (stepId === "preference_tags") return <PreferenceTagStep />;
  if (stepId === "preference_layouts") return <PreferenceLayoutStep />;
  if (stepId === "preference_save") return <PreferenceSaveStep />;
  return null;
}
