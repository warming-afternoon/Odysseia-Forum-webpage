import axios from 'axios';
import { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { QueryClient, QueryClientProvider, QueryCache } from '@tanstack/react-query';
import { ReactQueryDevtools } from '@tanstack/react-query-devtools';
import { RouterProvider } from 'react-router-dom';
import { Toaster } from 'sonner';
import { ErrorBoundary } from '@/app/providers/ErrorBoundary';
import { InitialPasswordPrompt } from '@/features/auth/components/InitialPasswordPrompt';
import { useAuthBootstrap } from '@/features/auth/hooks/useAuthBootstrap';
import { showMascotErrorToast } from '@/features/mascot/lib/mascotToast';
import { ThemeProvider } from '@/app/themes/ThemeProvider';
import {
  bindThumbnailRepairQueryClient,
  reportBrokenThreadThumbnail,
  subscribeThreadThumbnailRepair,
} from '@/features/threads/lib/thumbnailRepairQueue';
import { subscribeAuthInvalidation } from '@/shared/lib/authSession';
import {
  getRateLimitInfo,
  isSilentPreloadRateLimit,
  shouldRetryQuery,
} from '@/shared/api/rateLimit';
import { notifyRateLimit } from '@/features/mascot/lib/notify';
import { configureImageRecovery } from '@/shared/lib/imageRecovery';
import { router } from './router';
import { useMascotStore } from '@/features/mascot/store/mascotStore';
import { OmicronLoader } from '@/shared/ui/loaders/OmicronLoader';
import { isTagsChangedError } from '@/shared/api/tagErrors';
import { refreshTagCandidates } from '@/features/tags/lib/refreshTagCandidates';
import { toast } from 'sonner';

const queryClient = new QueryClient({
  queryCache: new QueryCache({
    onError: (error) => {
      // 忽略请求取消（如切换路由、切标签或组件卸载）
      if (
        axios.isCancel(error) ||
        (error as { name?: string })?.name === 'CanceledError' ||
        (error as { code?: string })?.code === 'ERR_CANCELED'
      ) {
        return;
      }

      const rateLimit = getRateLimitInfo(error);
      if (rateLimit) {
        if (!isSilentPreloadRateLimit(error)) notifyRateLimit(rateLimit);
        return;
      }

      if (isTagsChangedError(error)) {
        toast.error('标签已发生变化，请刷新候选后重新选择。', {
          id: 'tags-changed',
          action: { label: '刷新候选', onClick: () => {
            void refreshTagCandidates(queryClient).then(
              () => toast.success('候选已刷新，请移除失效条件后重新选择。'),
              () => toast.error('候选刷新失败，请稍后重试。'),
            );
          } },
        });
        return;
      }

      // 如果有明确的 HTTP 响应（4xx/5xx 等由业务处理），或者属于静默预加载，不弹全局网络错误
      if (axios.isAxiosError(error) && error.response) {
        return;
      }
      if (
        isSilentPreloadRateLimit(error) ||
        (typeof document !== 'undefined' && document.visibilityState === 'hidden')
      ) {
        return;
      }

      console.error('Global Network Error:', error);
      showMascotErrorToast('network', { id: 'global-network-error' });
    },
  }),
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000, // 5 minutes
      refetchOnWindowFocus: false, // Prevent aggressive re-fetching when switching back
      retry: shouldRetryQuery,
    },
  },
});

// 方便调试
if (import.meta.env.DEV) {
  Object.assign(window, { queryClient });
}

export function App() {
  const isAuthBootstrapPending = useAuthBootstrap(queryClient);

  useEffect(() => {
    bindThumbnailRepairQueryClient(queryClient);
    configureImageRecovery({
      report: reportBrokenThreadThumbnail,
      subscribe: subscribeThreadThumbnailRepair,
    });
  }, []);

  useEffect(() => {
    return subscribeAuthInvalidation(() => {
      // 账号切换时所有用户数据均可能变化，取消旧请求并移除其缓存。
      void queryClient.cancelQueries();
      queryClient.removeQueries({ predicate: (query) => query.queryKey[0] !== 'auth' });
      queryClient.setQueryData(['auth'], { loggedIn: false });
      // 本标签页稍后写入新 token；其他标签页的 storage 事件则已更新 token。
      queueMicrotask(() => void queryClient.invalidateQueries({ queryKey: ['auth'] }));
    });
  }, []);

  useEffect(() => {
    const mascotStore = useMascotStore.getState();
    if (!mascotStore.hasWelcomed) {
      mascotStore.reset();
      mascotStore.markWelcomed();
    }

  }, []);


  return (
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <ThemeProvider>
          {isAuthBootstrapPending ? (
            <div className="flex min-h-screen items-center justify-center bg-(--od-bg)">
              <div className="text-center">
                <OmicronLoader className="mx-auto mb-4 h-12 w-12" />
                <p className="text-sm text-(--od-text-secondary)">验证登录状态...</p>
              </div>
            </div>
          ) : (
            <>
              <RouterProvider router={router} />
              <InitialPasswordPrompt />
            </>
          )}
          {createPortal(
            <Toaster
              position="top-center"
              richColors
              visibleToasts={4}
              expand={false}
              gap={14}
              style={{ zIndex: 99999 }}
              toastOptions={{
                style: {
                  background: 'color-mix(in srgb, var(--od-bg-secondary) 82%, transparent)',
                  backdropFilter: 'blur(16px) saturate(122%)',
                  WebkitBackdropFilter: 'blur(16px) saturate(122%)',
                  border: '1px solid var(--od-glass-border)',
                  color: 'var(--od-text-primary)',
                  boxShadow: 'var(--od-shadow-floating)',
                  zIndex: 99999,
                },
              }}
            />,
            document.body,
          )}
          {/* 仅在需要调试时显示 DevTools，默认隐藏 */}
          {import.meta.env.VITE_SHOW_DEVTOOLS === 'true' && (
            <ReactQueryDevtools initialIsOpen={false} />
          )}
        </ThemeProvider>
      </QueryClientProvider>
    </ErrorBoundary>
  );
}
