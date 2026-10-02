import { act, fireEvent, render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { StrictMode } from 'react';
import { MemoryRouter, Route, Routes, useNavigate } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { authApi } from '@/features/auth/api/authApi';
import { LOGIN_REDIRECT_STORAGE_KEY } from '@/shared/lib/navigationSafety';
import { CallbackPage } from './CallbackPage';

vi.mock('@/features/auth/api/authApi', () => ({ authApi: { checkAuth: vi.fn() } }));
vi.mock('@/features/mascot/lib/mascotToast', () => ({ showMascotToast: vi.fn() }));
vi.mock('@/features/mascot/lib/notify', () => ({ notifySuccess: vi.fn() }));

function Login() {
  const navigate = useNavigate();
  return <button onClick={() => navigate('/callback')}>重新登录</button>;
}

describe('登录返回路径生命周期', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.clearAllMocks();
    sessionStorage.clear();
    sessionStorage.setItem(LOGIN_REDIRECT_STORAGE_KEY, '/booklists/1');
  });
  afterEach(() => vi.useRealTimers());

  it.each(['session', 'network'])('认证失败保留返回路径，重试成功才消费（%s）', async (failure) => {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: Infinity } } });
    if (failure === 'network') vi.mocked(authApi.checkAuth).mockRejectedValueOnce(new Error('网络失败'));
    else vi.mocked(authApi.checkAuth).mockResolvedValueOnce({ loggedIn: false } as never);
    vi.mocked(authApi.checkAuth).mockResolvedValue({ loggedIn: true } as never);
    const { unmount } = render(<StrictMode><QueryClientProvider client={client}>
      <MemoryRouter initialEntries={['/callback']} future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <Routes>
          <Route path="/callback" element={<CallbackPage />} />
          <Route path="/login" element={<Login />} />
          <Route path="/booklists/1" element={<p>原书单页面</p>} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider></StrictMode>);
    await act(async () => vi.advanceTimersByTimeAsync(700));
    expect(screen.getByRole('button', { name: '重新登录' })).toBeInTheDocument();
    expect(sessionStorage.getItem(LOGIN_REDIRECT_STORAGE_KEY)).toBe('/booklists/1');
    fireEvent.click(screen.getByRole('button', { name: '重新登录' }));
    await act(async () => vi.advanceTimersByTimeAsync(700));
    expect(screen.getByText('原书单页面')).toBeInTheDocument();
    expect(sessionStorage.getItem(LOGIN_REDIRECT_STORAGE_KEY)).toBeNull();
    unmount();
    client.clear();
  });
});
