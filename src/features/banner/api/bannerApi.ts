import type { components } from '@shared-types/openapi';
import type { Work } from '@/entities/work/types';
import { apiClient } from '@/shared/api/client';
import { worksClient } from '@/features/works/api';
import { worksV2Enabled } from '@/shared/config/works';
import type { BannerItem } from '@/entities/thread/types';

export type BannerApplicationRequest = components['schemas']['BannerApplicationRequest'] & {
    target_kind?: 'work' | 'discord';
};
export type BannerApplicationResponse = Omit<components['schemas']['BannerApplicationResponse'], 'application_id'> & { application_id?: string | number | null };
export interface DisplayBanner {
    id?: string;
    thread_id: string;
    title: string;
    cover_image_url?: string | null;
    channel_id?: string;
    guild_id?: string;
    link?: string;
}
interface WorkBannerItem {
    id: string;
    kind: 'work' | 'channel';
    work?: Work;
    title?: string;
    guild_id?: string;
    channel_id?: string;
    image_url: string | null;
}

/** 作品链接与 Discord 来源链接分开解析，纯数字按用户选择的目标类型解释。 */
export function bannerWorkId(value: string): string {
    const text = value.trim();
    let identifier = text;
    if (!/^\d+$/.test(text)) {
        let url: URL;
        try { url = new URL(text, window.location.origin); }
        catch { throw new Error('请输入作品 ID 或本网站的作品链接'); }
        const match = url.pathname.match(/^\/works\/(\d+)\/?$/);
        if (url.origin !== window.location.origin || !match) throw new Error('请输入本网站的作品链接');
        identifier = match[1];
    }
    if (!/^[1-9]\d{0,18}$/.test(identifier) || BigInt(identifier) > 9223372036854775807n) {
        throw new Error('作品 ID 无效');
    }
    return identifier;
}

export const bannerApi = {
    apply: async (data: BannerApplicationRequest): Promise<BannerApplicationResponse> => {
        const { target_kind, ...legacy } = data;
        if (!worksV2Enabled) return (await apiClient.post<BannerApplicationResponse>('/banner/apply', legacy)).data;
        const body = { cover_image_url: data.cover_image_url, target_scope: data.target_scope };
        const isDiscord = target_kind === 'discord' || /^https?:\/\/(?:[a-z]+\.)?discord\.com\//i.test(data.thread_link);
        const response = isDiscord
            ? await worksClient.post<{ id: string }>('/banner/discord-applications', { ...body, thread_link: data.thread_link })
            : await worksClient.post<{ id: string }>(`/works/${bannerWorkId(data.thread_link)}/banner-applications`, body);
        return { success: true, message: '申请已提交', application_id: response.data.id };
    },
    getScopes: async (signal?: AbortSignal): Promise<{ id: string; name: string }[]> =>
        (await worksClient.get<{ items: { id: string; name: string }[] }>('/banner/scopes', { signal })).data.items,
    getActiveBanners: async (channelIds?: string[]): Promise<DisplayBanner[]> => {
        const params = channelIds?.length ? { channel_ids: channelIds } : {};
        if (!worksV2Enabled) {
            const response = await apiClient.get<BannerItem[]>('/banner/active', { params, paramsSerializer: { indexes: null } });
            return response.data.map(item => ({ ...item, thread_id: String(item.thread_id), channel_id: String(item.channel_id || ''), guild_id: String(item.guild_id || '') }));
        }
        const response = await worksClient.get<{ items: WorkBannerItem[] }>('/banner', { params, paramsSerializer: { indexes: null } });
        return response.data.items.flatMap<DisplayBanner>(item => {
            if (item.kind === 'work' && item.work) return [{
                id: item.id, thread_id: item.work.id, title: item.work.title,
                cover_image_url: item.image_url, channel_id: item.work.source_channel_id || undefined,
                guild_id: item.work.source_guild_id || undefined, link: `/works/${item.work.id}`,
            }];
            if (item.kind === 'channel' && item.guild_id && item.channel_id) return [{
                id: item.id, thread_id: item.channel_id, title: item.title || '',
                cover_image_url: item.image_url, channel_id: item.channel_id, guild_id: item.guild_id,
                link: `https://discord.com/channels/${item.guild_id}/${item.channel_id}`,
            }];
            return [];
        });
    },
};
