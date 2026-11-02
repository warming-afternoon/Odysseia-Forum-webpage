import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { getStoredAuthToken, invalidateAuthSession, setStoredAuthToken } from '@/shared/lib/authSession';

const api = vi.hoisted(() => ({
  acceptFluxerToken: vi.fn(),
  fluxerRequest: vi.fn(),
  getPasswordSetupProof: vi.fn(),
}));
vi.mock('../api/fluxerAuthApi', () => api);
import { InitialPasswordPrompt } from './InitialPasswordPrompt';

beforeEach(() => {
  localStorage.clear();
  vi.clearAllMocks();
});

describe('首次密码设置的会话边界', () => {
  it('旧账号请求返回前切换账号不会覆盖新账号会话', async () => {
    const oldToken = 'flx_' + 'a'.repeat(36);
    const newToken = 'flx_' + 'b'.repeat(36);
    const replacement = 'flx_' + 'c'.repeat(36);
    let finish!: (value: { token: string }) => void;
    api.getPasswordSetupProof.mockReturnValue('proof');
    api.fluxerRequest.mockImplementation(() => new Promise((resolve) => {
      finish = resolve;
    }));
    setStoredAuthToken(oldToken);
    render(
      <QueryClientProvider client={new QueryClient()}>
        <InitialPasswordPrompt />
      </QueryClientProvider>,
    );
    fireEvent.change(screen.getByLabelText('新密码'), { target: { value: 'password123' } });
    fireEvent.change(screen.getByLabelText('确认新密码'), { target: { value: 'password123' } });
    fireEvent.click(screen.getByRole('button', { name: '设置密码' }));
    await waitFor(() => expect(api.fluxerRequest).toHaveBeenCalledOnce());
    act(() => {
      invalidateAuthSession();
      setStoredAuthToken(newToken);
    });
    await act(async () => {
      finish({ token: replacement });
    });
    expect(getStoredAuthToken()).toBe(newToken);
    expect(api.acceptFluxerToken).not.toHaveBeenCalled();
    expect(screen.queryByRole('dialog')).toBeNull();
  });
});
