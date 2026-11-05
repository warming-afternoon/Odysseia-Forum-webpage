import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '@/features/auth/hooks/useAuth';
import { buildCurrentAppRedirect, LOGIN_REDIRECT_STORAGE_KEY } from '@/shared/lib/navigationSafety';
import { OmicronLoader } from '@/shared/ui/loaders/OmicronLoader';

export function ProtectedRoute() {
  const { isAuthenticated, isLoading, error, refetch } = useAuth();
  const authenticationRejected =
    (error as { response?: { status?: number } })?.response?.status === 401;

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-(--od-bg)">
        <div className="text-center">
          <OmicronLoader className="mx-auto mb-4 h-12 w-12" />
          <p className="text-sm text-(--od-text-secondary)">验证登录状态...</p>
        </div>
      </div>
    );
  }

  // An unavailable auth service is not proof that the user's session expired.
  if (error && !authenticationRejected && !isAuthenticated) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-(--od-bg) px-4 text-center">
        <div className="max-w-sm space-y-4">
          <p role="alert" className="text-sm leading-6 text-(--od-text-secondary)">
            暂时无法确认登录状态，请稍后重试。
          </p>
          <button
            type="button"
            onClick={() => void refetch()}
            className="od-button-primary rounded-xl px-5 py-2 text-sm"
          >
            重新检查
          </button>
        </div>
      </div>
    );
  }

  // If not authenticated, save redirect URL and navigate to login.
  if (!isAuthenticated || authenticationRejected) {
    const currentPath = buildCurrentAppRedirect();
    sessionStorage.setItem(LOGIN_REDIRECT_STORAGE_KEY, currentPath);
    return <Navigate to={`/login?redirect=${encodeURIComponent(currentPath)}`} replace />;
  }

  // 已认证，显示内容
  return <Outlet />;
}
