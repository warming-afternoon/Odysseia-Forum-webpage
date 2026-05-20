import { useState, useEffect } from 'react';
import { ChevronLeft, ChevronRight, Image as ImageIcon } from 'lucide-react';
import { BannerApplicationModal } from '@/features/banner/components/BannerApplicationModal';
import defaultBannerImage from '@/assets/images/banners/banner.png';
import { LazyImage } from '@/shared/ui/LazyImage';

const WIKI_URL = 'https://wiki.xn--35zx7g.org/';

interface Banner {
  id: string;
  image: string;
  title: string;
  description: string;
  link?: string;
}

interface BannerCarouselProps {
  banners: Banner[];
  autoPlayInterval?: number;
  onBannerClick?: (banner: Banner) => void;
  fullWidth?: boolean;
}

export function BannerCarousel({ banners, autoPlayInterval = 5000, onBannerClick, fullWidth = false }: BannerCarouselProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isHovered, setIsHovered] = useState(false);
  const [isApplyModalOpen, setIsApplyModalOpen] = useState(false);

  useEffect(() => {
    if (isHovered || banners.length <= 1) return;

    const timer = setInterval(() => {
      setCurrentIndex((prev) => (prev + 1) % banners.length);
    }, autoPlayInterval);

    return () => clearInterval(timer);
  }, [isHovered, banners.length, autoPlayInterval]);

  const goToPrevious = (e?: React.MouseEvent) => {
    e?.stopPropagation();
    setCurrentIndex((prev) => (prev - 1 + banners.length) % banners.length);
  };

  const goToNext = (e?: React.MouseEvent) => {
    e?.stopPropagation();
    setCurrentIndex((prev) => (prev + 1) % banners.length);
  };

  const openApplyModal = (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsApplyModalOpen(true);
  };

  const renderFooter = () => (
    <div
      className="flex flex-wrap items-center justify-between gap-3 border-t border-(--od-border) bg-(--od-card) px-4 py-3"
      onClick={(e) => e.stopPropagation()}
    >
      <p className="text-xs text-(--od-text-secondary)">
        想推荐自己的帖子到展示位？提交 Banner 申请后等待审核即可。
      </p>
      <button
        type="button"
        onClick={openApplyModal}
        className="inline-flex items-center gap-2 rounded-full bg-(--od-accent) px-4 py-2 text-xs font-semibold text-white transition-colors hover:bg-(--od-accent-hover)"
      >
        <ImageIcon className="h-4 w-4" />
        申请 Banner
      </button>
    </div>
  );

  if (banners.length === 0) {
    return (
      <div className={`group relative overflow-hidden ${fullWidth ? '' : 'mb-4 rounded-xl'}`}>
        <div className="relative aspect-video">
          <LazyImage
            src={defaultBannerImage}
            alt="欢迎来到 Odysseia"
            className="h-full w-full"
          />
          <div className="absolute inset-0 bg-linear-to-t from-black/80 via-black/40 to-transparent" />
          <div className="absolute bottom-0 left-0 right-0 p-6">
            <h2 className="mb-2 text-2xl font-bold text-white line-clamp-1">
              欢迎来到类脑Odysseia索引页
            </h2>
            <p className="text-sm text-gray-200 line-clamp-2">
              今天的头图位还空着呢，不过没关系，先往下逛逛看吧。
            </p>
            <div className="mt-4">
              <a
                href={WIKI_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center rounded-full border border-white/20 bg-black/30 px-4 py-2 text-xs font-semibold tracking-[0.12em] text-white transition-colors hover:bg-black/45"
                onClick={(e) => e.stopPropagation()}
              >
                类脑智识库 Wiki
              </a>
            </div>
          </div>
        </div>
        {renderFooter()}
        <BannerApplicationModal
          isOpen={isApplyModalOpen}
          onClose={() => setIsApplyModalOpen(false)}
        />
      </div>
    );
  }

  const currentBanner = banners[currentIndex];

  return (
    <div
      className={`group relative overflow-hidden bg-[#2b2d31] cursor-pointer ${fullWidth ? '' : 'mb-4 rounded-xl'}`}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      onClick={() => onBannerClick?.(currentBanner)}
    >
      {/* Banner 图片 */}
      <div className="relative aspect-video">
        <LazyImage
          src={currentBanner.image}
          alt={currentBanner.title}
          className="h-full w-full transition-transform duration-700"
        />

        {/* 渐变遮罩 */}
        <div className="absolute inset-0 bg-linear-to-t from-black/80 via-black/40 to-transparent" />

        {/* 内容 */}
        <div className="absolute bottom-0 left-0 right-0 p-6">
          <h2 className="mb-2 text-2xl font-bold text-white line-clamp-1">
            {currentBanner.title}
          </h2>
          <p className="text-sm text-gray-200 line-clamp-2">
            {currentBanner.description}
          </p>
        </div>
      </div>

      {/* 导航按钮 */}
      {banners.length > 1 && (
        <>
          <button
            onClick={goToPrevious}
            className="absolute left-4 top-1/2 -translate-y-1/2 rounded-full bg-black/50 p-2 text-white opacity-0 transition-opacity hover:bg-black/70 group-hover:opacity-100"
            aria-label="上一张"
          >
            <ChevronLeft className="h-6 w-6" />
          </button>
          <button
            onClick={goToNext}
            className="absolute right-4 top-1/2 -translate-y-1/2 rounded-full bg-black/50 p-2 text-white opacity-0 transition-opacity hover:bg-black/70 group-hover:opacity-100"
            aria-label="下一张"
          >
            <ChevronRight className="h-6 w-6" />
          </button>
        </>
      )}

      {/* 指示器 */}
      {banners.length > 1 && (
        <div className="absolute bottom-4 left-1/2 flex -translate-x-1/2 gap-2">
          {banners.map((_, index) => (
            <button
              key={index}
              onClick={() => setCurrentIndex(index)}
              className={`h-2 rounded-full transition-all ${index === currentIndex
                ? 'w-8 bg-white'
                : 'w-2 bg-white/50 hover:bg-white/75'
                }`}
              aria-label={`跳转到第 ${index + 1} 张`}
            />
          ))}
        </div>
      )}

      <div className="absolute right-4 top-4 z-10">
        <a
          href={WIKI_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center rounded-full border border-white/15 bg-black/35 px-3.5 py-2 text-xs font-semibold tracking-[0.12em] text-white backdrop-blur-md transition-colors hover:bg-black/55"
          onClick={(e) => e.stopPropagation()}
        >
          类脑智识库 Wiki
        </a>
      </div>

      {renderFooter()}

      <BannerApplicationModal
        isOpen={isApplyModalOpen}
        onClose={() => setIsApplyModalOpen(false)}
      />
    </div>
  );
}
