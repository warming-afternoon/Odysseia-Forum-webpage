import { Outlet, useLocation } from 'react-router-dom';
import { ResizableSidebar } from '@/widgets/sidebar/ResizableSidebar';
import { AppSidebar } from '@/widgets/layout/AppSidebar';
import { TopBar } from '@/widgets/layout/TopBar';
import { MobileTabBar } from '@/widgets/layout/MobileTabBar';
import { MascotBar } from '@/features/mascot/components/MascotBar';
import { ScrollToTop } from '@/shared/ui/ScrollToTop';
import { GlobalThreadPreview } from '@/widgets/thread-preview/GlobalThreadPreview';
import { useSidebarCollapsedSetting, useSettings } from '@/shared/hooks/useSettings';
import { useEffect, useState } from 'react';

/**
 * AppShell — 全站布局骨架
 *
 * 采用 h-screen + overflow-hidden 的"应用壳"模式：
 *   ┌──────────────────────────────────────────┐
 *   │  Sidebar  │  TopBar                       │
 *   │           │  ┌───────────────────────────┐│
 *   │           │  │ MainScrollArea (Outlet)   ││
 *   │  (PC端)   │  │                           ││
 *   │           │  │                           ││
 *   │           │  └───────────────────────────┘│
 *   └──────────────────────────────────────────┘
 *   [  移动端底部 Tab 栏  ] (md:hidden)
 *
 * 布局模式可通过 useSettings 或将来的 useLayoutStore 控制：
 *   - sidebarCollapsed: 侧边栏收起
 *   - 未来: topBarVisible / immersiveMode 等
 */
export function RootLayout() {
  const [isMobileOpen, setIsMobileOpen] = useState(false);
  const sidebarCollapsed = useSidebarCollapsedSetting();
  const { updateSettings } = useSettings();
  const location = useLocation();

  useEffect(() => {
    setIsMobileOpen(false);
    // 当发生页面或筛选跳转时，将焦点转移到主内容区，避免停留在侧边栏
    const mainContainer = document.getElementById('main-scroll-container');
    if (mainContainer) {
      setTimeout(() => mainContainer.focus(), 50);
    }
  }, [location.pathname, location.search, location.hash]);

  return (
    <div className="od-app-shell relative flex h-screen w-full overflow-hidden text-[var(--od-text-primary)]">
      <div className="pointer-events-none absolute inset-0 z-0 od-shell-surface" />

      <div className="od-operation-base pointer-events-none absolute inset-0 z-[5]" />

      {/* ── Sidebar (桌面端固定 / 移动端抽屉) ── */}
        <ResizableSidebar
          isMobileOpen={isMobileOpen}
          setIsMobileOpen={setIsMobileOpen}
          isCollapsed={sidebarCollapsed}
          setIsCollapsed={(collapsed: boolean) => updateSettings({ sidebarCollapsed: collapsed })}
        >
          <AppSidebar />
      </ResizableSidebar>

      {/* TopBar 与 Sidebar 处于同一操作层 */}
      <TopBar
        onMenuClick={() => setIsMobileOpen(true)}
        sidebarCollapsed={sidebarCollapsed}
      />

      {/* ── 主内容列 ── */}
      <div
        className={`relative z-10 flex min-w-0 flex-1 flex-col transition-[margin] duration-300 ${
          sidebarCollapsed ? 'lg:ml-0' : 'lg:ml-[170px]'
        }`}
      >
        {/* 主滚动区 — 圆角面板 + 独立背景色，形成视觉层级 */}
        <div className="od-content-surface relative z-10 mt-[3.25rem] flex-1 min-h-0 sm:mt-[4.25rem] sm:rounded-tl-[2.5rem] sm:overflow-hidden">
          {/* 顶部高光渐变装饰 */}
          <div className="pointer-events-none absolute left-0 right-0 top-0 z-0 hidden h-24 rounded-tl-[2.5rem] bg-gradient-to-b from-white/[0.02] to-transparent sm:block" />
          <main
            id="main-scroll-container"
            role="main"
            tabIndex={-1}
            className="relative z-10 h-full overflow-y-auto scroll-smooth pb-20 md:pb-0 focus:outline-none flex flex-col"
          >
            <Outlet />
            {/* 防止网速跟不上按 Tab 导致焦点滑出主区域 */}
            <div
              tabIndex={0}
              aria-live="polite"
              aria-atomic="true"
              className="mt-auto sr-only focus:not-sr-only focus:p-6 focus:text-center focus:text-sm focus:font-medium focus:text-[var(--od-text-secondary)] focus:outline-none focus:ring-2 focus:ring-inset focus:ring-[var(--od-accent)]"
              onFocus={(e) => {
                const sentinel = e.currentTarget;
                const mainContainer = sentinel.parentElement;
                if (!mainContainer) return;

                sentinel.textContent = "已到达列表底部，正在加载更多内容...";

                const initialArticleCount = mainContainer.querySelectorAll('article').length;

                const observer = new MutationObserver(() => {
                  const newArticles = mainContainer.querySelectorAll('article');
                  if (newArticles.length > initialArticleCount) {
                    observer.disconnect();

                    // 监听到新数据，通过 aria-live 播报加载完成
                    sentinel.textContent = "加载完成";

                    // 留出 1 秒钟让读屏器播报，随后转移焦点
                    setTimeout(() => {
                      // 如果在这 1 秒内用户主动切走了焦点，就不再强行把焦点拽回来
                      if (document.activeElement === sentinel) {
                        const nextCard = newArticles[initialArticleCount] as HTMLElement;
                        if (nextCard) {
                          nextCard.focus();
                        }
                      }
                      // 焦点转移后重置缓冲垫文字，以备下次触发
                      sentinel.textContent = "已到达列表底部，正在加载更多内容...";
                    }, 1000);
                  }
                });

                observer.observe(mainContainer, { childList: true, subtree: true });

                // 如果用户没等到加载完就切走了焦点，中止监听
                sentinel.addEventListener('blur', () => {
                  observer.disconnect();
                  sentinel.textContent = "已到达列表底部，正在加载更多内容...";
                }, { once: true });
              }}
            >
              已到达列表底部，正在加载更多内容...
            </div>
          </main>
        </div>
      </div>

      {/* ── 移动端底部 Tab 栏 ── */}
      <MobileTabBar />

      {/* ── 全局辅助层 ── */}
      <GlobalThreadPreview />
      <MascotBar />
      <ScrollToTop />
    </div>
  );
}
