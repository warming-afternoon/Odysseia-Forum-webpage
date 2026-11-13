import { worksV2Enabled } from '@/shared/config/works';
import { v2BooklistsApi } from '@/features/booklists/api/v2BooklistsApi';
import type { Author } from "@/entities/thread/types";
import type { Booklist } from "@/entities/booklist/types";
import { bannerApi } from "@/features/banner/api/bannerApi";
import { booklistsApi } from "@/features/booklists/api/booklistsApi";

export interface PlazaBannerItem {
  id?: string;
  link?: string;
  thread_id: string;
  title: string;
  cover_image_url: string;
  channel_id?: string;
  guild_id?: string;
  author?: Author;
}


export const plazaApi = {
  getBanners: async (channelIds: string[] = []): Promise<PlazaBannerItem[]> => {
    const items = await bannerApi.getActiveBanners(
      channelIds.length > 0 ? channelIds : undefined,
    );
    return (items || []).map((item) => ({
      id: item.id,
      link: item.link,
      thread_id: String(item.thread_id ?? ""),
      title: String(item.title ?? ""),
      cover_image_url: String(item.cover_image_url ?? ""),
      channel_id: item.channel_id ? String(item.channel_id) : undefined,
      guild_id: item.guild_id ? String(item.guild_id) : undefined,
    }));
  },

  getFeaturedBooklists: async (): Promise<Booklist[]> => {
    const response = worksV2Enabled ? await v2BooklistsApi.list({ scope: "public", sortMethod: 3, sortOrder: "desc", pageIndex: 0, pageSize: 6, isTournament: false }) : await booklistsApi.listPublic({
      sortMethod: 3,
      sortOrder: "desc",
      pageIndex: 0,
      pageSize: 6,
      isTournament: false,
    });
    return response.results || [];
  },
};
