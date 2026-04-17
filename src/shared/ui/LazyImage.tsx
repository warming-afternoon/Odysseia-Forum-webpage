import { useState, useEffect, useRef, useLayoutEffect } from 'react';
import { useImageModeSetting } from '@/shared/hooks/useSettings';
import { reportBrokenThreadThumbnail, subscribeThreadThumbnailRepair } from '@/features/threads/lib/thumbnailRepairQueue';

interface LazyImageProps {
  src: string;
  alt: string;
  className?: string;
  placeholder?: string;
  threadId?: string;
  channelId?: string;
}

export function LazyImage({
  src,
  alt,
  className = '',
  placeholder,
  threadId,
  channelId,
}: LazyImageProps) {
  const [isLoaded, setIsLoaded] = useState(false);
  const [isInView, setIsInView] = useState(false);
  const [currentSrc, setCurrentSrc] = useState(src);
  const imgRef = useRef<HTMLDivElement>(null);
  const imageMode = useImageModeSetting();
  const isImageDisabled = imageMode === 'off';

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsInView(true);
          observer.disconnect();
        }
      },
      {
        rootMargin: '50px',
      }
    );

    if (imgRef.current) {
      observer.observe(imgRef.current);
    }

    return () => observer.disconnect();
  }, []);

  const imageRef = useRef<HTMLImageElement>(null);

  useEffect(() => {
    setCurrentSrc(src);
    setIsLoaded(false);
  }, [src]);

  useEffect(() => {
    if (!threadId) return;
    return subscribeThreadThumbnailRepair(threadId, (urls) => {
      if (urls.length > 0) {
        setCurrentSrc(urls[0]);
      }
    });
  }, [threadId]);

  return (
    <div ref={imgRef} className={`relative overflow-hidden ${className}`}>
      {isImageDisabled ? (
        // 节省流量模式
        <div className="absolute inset-0 flex items-center justify-center bg-[color-mix(in_oklab,var(--od-bg-tertiary)_85%,transparent)]">
          <div className="flex flex-col items-center gap-1">
            <div className="h-8 w-8 rounded-md border border-[var(--od-border-strong)] bg-[color-mix(in_oklab,var(--od-bg-secondary)_85%,transparent)]" />
            <span className="text-[10px] text-[var(--od-text-tertiary)]">图片已关闭</span>
          </div>
        </div>
      ) : (
        <>
          {/* 占位符 / 骨架屏 */}
          {!isLoaded && (
            <div className="absolute inset-0 bg-[var(--od-surface-raised)]">
              {placeholder ? (
                <img src={placeholder} alt="" className="h-full w-full object-cover opacity-50" />
              ) : (
                <div className="h-full w-full animate-pulse bg-gradient-to-r from-[var(--od-surface-raised)] via-[var(--od-interactive-hover)] to-[var(--od-surface-raised)] bg-[length:200%_100%]" />
              )}
            </div>
          )}

          {/* 实际图片 */}
          {isInView && (
            <img
              key={currentSrc}
              ref={imageRef}
              src={currentSrc}
              alt={alt}
              className={`h-full w-full object-cover transition-all duration-[800ms] cubic-bezier(0.4, 0, 0.2, 1) ${isLoaded ? 'scale-100 opacity-100 blur-0' : 'scale-[1.03] opacity-0 blur-md'
                }`}
              onLoad={() => {
                // 使用 decode() 确保图片不仅加载完，且已完成解码可以立即显示
                imageRef.current?.decode()
                  .then(() => setIsLoaded(true))
                  .catch(() => setIsLoaded(true)); // 回退
              }}
              onError={() => {
                if (!threadId) return;
                reportBrokenThreadThumbnail({ threadId, channelId });
              }}
            />
          )}
        </>
      )}
    </div>
  );
}
