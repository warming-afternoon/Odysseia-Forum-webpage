import { beforeEach, describe, expect, it, vi } from 'vitest';
const mocks = vi.hoisted(() => ({ get: vi.fn(), post: vi.fn() }));
vi.mock('@/features/works/api', () => ({ worksClient: mocks }));
vi.mock('@/shared/config/works', () => ({ worksV2Enabled: true }));
import { bannerApi, bannerWorkId } from './bannerApi';

describe('V2 Banner', () => {
    beforeEach(() => vi.clearAllMocks());
    it('作品申请保留字符串编号，不将其当Discord帖子', async () => {
        mocks.post.mockResolvedValue({ data: { id: '8' } });
        await bannerApi.apply({ thread_link: '9007199254740993', target_kind: 'work', target_scope: 'global' });
        expect(mocks.post).toHaveBeenCalledWith('/works/9007199254740993/banner-applications', {
            target_scope: 'global', cover_image_url: undefined,
        });
    });
    it('Discord频道申请使用明确入口', async () => {
        mocks.post.mockResolvedValue({ data: { id: '8' } });
        await bannerApi.apply({ thread_link: '123456789012345678', target_kind: 'discord', target_scope: 'global' });
        expect(mocks.post).toHaveBeenCalledWith('/banner/discord-applications', {
            thread_link: '123456789012345678', target_scope: 'global', cover_image_url: undefined,
        });
    });
    it('作品链接限制本站，拒绝溢出和伪造来源', () => {
        expect(bannerWorkId('/works/31')).toBe('31');
        expect(() => bannerWorkId('https://evil.example/works/31')).toThrow();
        expect(() => bannerWorkId('9223372036854775808')).toThrow();
        expect(() => bannerWorkId('0')).toThrow();
    });
    it('作品Banner打开作品，频道Banner打开原生频道', async () => {
        mocks.get.mockResolvedValue({ data: { items: [
            { id: '1', kind: 'work', work: { id: '31', title: '作品', source_channel_id: '20', source_guild_id: '10' }, image_url: 'https://example.org/a.png' },
            { id: '2', kind: 'channel', channel_id: '20', guild_id: '10', title: '赛事', image_url: 'https://example.org/b.png' },
        ] } });
        const result = await bannerApi.getActiveBanners(['20']);
        expect(result.map(item => item.link)).toEqual(['/works/31', 'https://discord.com/channels/10/20']);
        expect(mocks.get).toHaveBeenCalledWith('/banner', { params: { channel_ids: ['20'] }, paramsSerializer: { indexes: null } });
    });
});
