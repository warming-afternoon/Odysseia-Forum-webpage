/**
 * 图片优化工具类
 * 专门处理 Discord CDN 链接的加速与动态缩放
 */

const DISCORD_CDN_DOMAIN = 'cdn.discordapp.com';
const DISCORD_MEDIA_DOMAIN = 'media.discordapp.net';

/**
 * 优化 Discord 图片链接
 * 1. 将 cdn.discordapp.com 替换为 media.discordapp.net (支持更好的压缩和缩放)
 * 2. 注入宽度参数以开启 Discord 的云端缩放功能
 * 3. 强制请求 WebP 格式以平衡清晰度与体积
 */
export function optimizeDiscordImageUrl(url: string, width: number = 800): string {
  if (!url || !url.includes(DISCORD_CDN_DOMAIN) || url.includes('/embed/')) {
    return url;
  }

  try {
    // 基础清理：防止重复处理
    let targetUrl = url;

    // --- 策略 A: 头像类链接 (Avatars/Icons) ---
    // Discord 头像接口更倾向于直接修改后缀名来切换格式
    if (targetUrl.includes('/avatars/') || targetUrl.includes('/icons/')) {
      // 1. 强制换成高速媒体域名
      targetUrl = targetUrl.replace(DISCORD_CDN_DOMAIN, DISCORD_MEDIA_DOMAIN);
      // 2. 强行把后缀换成 .webp (这是让头像真正变 WebP 的绝招)
      targetUrl = targetUrl.replace(/\.(png|jpg|jpeg|gif|jfif)(\?|$)/i, '.webp$2');
      
      const urlObj = new URL(targetUrl);
      // 3. 头像使用 size 参数限制 (最接近的 2 的幂次方)
      urlObj.searchParams.set('size', width > 512 ? '1024' : '512');
      return urlObj.toString();
    }

    // --- 策略 B: 附件/帖子媒体类链接 ---
    const urlObj = new URL(targetUrl);
    
    // 安全检查：带签名的链接不能随意修改参数或域名
    if (urlObj.searchParams.has('hm')) {
      return url;
    }

    // 切换至高性能媒体域名
    urlObj.hostname = DISCORD_MEDIA_DOMAIN;

    // 注入缩放参数
    // 对于附件，width 参数在 media 域名下可以触发实时缩放
    urlObj.searchParams.set('width', width.toString());
    urlObj.searchParams.set('format', 'webp');
    urlObj.searchParams.set('quality', 'lossless'); 

    return urlObj.toString();
  } catch {
    return url;
  }
}
