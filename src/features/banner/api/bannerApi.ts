import { apiClient } from '@/shared/api/client';
import type { BannerItem } from '@/entities/thread/types';

export interface BannerApplicationRequest {
    thread_id: string;
    cover_image_url: string;
    target_scope: string;
}

export interface BannerApplicationResponse {
    success: boolean;
    message: string;
    application_id?: number;
}

export const bannerApi = {
    apply: async (data: BannerApplicationRequest): Promise<BannerApplicationResponse> => {
        const response = await apiClient.post<BannerApplicationResponse>('/banner/apply', data);
        return response.data;
    },

    getActiveBanners: async (channelId?: string): Promise<BannerItem[]> => {
        const response = await apiClient.get<BannerItem[]>('/banner/active', {
            params: { channel_id: channelId },
        });
        return response.data;
    },
};
