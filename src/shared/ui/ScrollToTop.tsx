import { useState, useEffect } from 'react';
import { ArrowUp } from 'lucide-react';
import { AnimatedIcon } from '@/shared/ui/animation/AnimatedIcon';

export function ScrollToTop() {
  const [isVisible, setIsVisible] = useState(false);
  const [isAnimating, setIsAnimating] = useState(false);

  useEffect(() => {
    const container = document.getElementById('main-scroll-container');
    if (!container) return;

    const toggleVisibility = () => {
      // 滚动超过 300px 时显示按钮
      if (container.scrollTop > 300) {
        setIsVisible(true);
      } else {
        setIsVisible(false);
      }
    };

    container.addEventListener('scroll', toggleVisibility);
    return () => container.removeEventListener('scroll', toggleVisibility);
  }, []);

  const scrollToTop = () => {
    const container = document.getElementById('main-scroll-container');
    if (!container) return;

    setIsAnimating(true);
    setTimeout(() => setIsAnimating(false), 600);

    container.scrollTo({
      top: 0,
      behavior: 'smooth',
    });

    // 寻找主内容区内的第一个可交互元素，转移焦点
    const focusableSelectors = 'a[href], button:not([disabled]), textarea:not([disabled]), input[type="text"]:not([disabled]), input[type="radio"]:not([disabled]), input[type="checkbox"]:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';

    setTimeout(() => {
      const firstFocusable = container.querySelector(focusableSelectors) as HTMLElement;
      if (firstFocusable) {
        firstFocusable.focus();
      } else {
        // 如果主内容区是空的，把焦点交给 main 容器本身
        container.focus();
      }
    }, 300);
  };

  return (
    <button
      tabIndex={isVisible ? 0 : -1}
      onClick={scrollToTop}
      className={`fixed bottom-20 right-4 z-50 flex items-center justify-center leading-none rounded-full bg-[var(--od-accent)] p-3 text-white shadow-lg transition-all duration-300 hover:scale-110 hover:bg-[var(--od-accent-hover)] hover:shadow-xl lg:bottom-8 ${isVisible
        ? 'pointer-events-auto opacity-100 translate-y-0'
        : 'pointer-events-none opacity-0 translate-y-4'
        }`}
      aria-label="回到顶部"
      title="回到顶部"
    >
      <AnimatedIcon
        icon={ArrowUp}
        className="h-6 w-6"
        animation={isAnimating ? 'flyUp' : 'bounce'}
        trigger={isAnimating ? 'none' : 'hover'}
        isActive={isAnimating}
      />
    </button>
  );
}
