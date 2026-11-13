import { worksClient } from '@/features/works/api';

export interface FetchImageItem {
    /** 图片恢复键；work: 前缀只用于客户端区分作品和旧 Discord 帖子。 */
    thread_id: string;
    channel_id?: string;
}

export interface FetchImageRequest {
    items: FetchImageItem[];
}

export interface FetchImageResponseItem {
    thread_id: string;
    thumbnail_urls: string[];
    updated: boolean;
    error?: string;
}

export interface FetchImageResponse {
    results: FetchImageResponseItem[];
}

interface WorkImageResult {
    work_id?: string;
    discord_thread_id?: string;
    thumbnail_urls: string[];
    updated: boolean;
    error?: string;
}

export const fetchImagesApi = {
    refresh: async (items: FetchImageItem[]): Promise<FetchImageResponse> => {
        const response = await worksClient.post<{ results: WorkImageResult[] }>('/images/refresh', {
            items: items.map((item) => item.thread_id.startsWith('work:')
                ? { work_id: item.thread_id.slice(5) }
                : { discord_thread_id: item.thread_id }),
        }, { timeout: 60000 });
        return {
            results: response.data.results.map((item) => ({
                thread_id: item.discord_thread_id ?? `work:${item.work_id}`,
                thumbnail_urls: item.thumbnail_urls,
                updated: item.updated,
                error: item.error,
            })),
        };
    },
};
