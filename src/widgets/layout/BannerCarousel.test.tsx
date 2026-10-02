import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { BannerCarousel } from './BannerCarousel';

vi.mock('@/features/banner/components/BannerApplicationModal', () => ({ BannerApplicationModal: () => null }));
vi.mock('@/shared/hooks/useCarouselGestures', () => ({ useCarouselGestures: () => ({}) }));
vi.mock('@/shared/hooks/usePrefersReducedMotion', () => ({ usePrefersReducedMotion: () => true }));
vi.mock('@/shared/ui/LazyImage', () => ({ LazyImage: ({ src, alt }: { src: string; alt: string }) => <img src={src} alt={alt} /> }));

describe('Banner 列表变化', () => {
  it('最后一项时列表缩短及切换默认场景仍可渲染和前后切换', () => {
    const banners = [
      { id: '1', image: '/first.png', title: '第一张', description: '' },
      { id: '2', image: '/second.png', title: '第二张', description: '' },
    ];
    const { rerender } = render(<BannerCarousel banners={banners} />);
    fireEvent.click(screen.getByRole('button', { name: '下一张' }));
    expect(screen.getByAltText('第二张')).toBeInTheDocument();
    rerender(<BannerCarousel banners={banners.slice(0, 1)} />);
    expect(screen.getByAltText('第一张')).toBeInTheDocument();
    rerender(<BannerCarousel banners={[]} />);
    expect(screen.getByAltText('欢迎来到类脑Odysseia索引页')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: '下一张' }));
    fireEvent.click(screen.getByRole('button', { name: '上一张' }));
    expect(screen.getByAltText('欢迎来到类脑Odysseia索引页')).toBeInTheDocument();
  });
});
