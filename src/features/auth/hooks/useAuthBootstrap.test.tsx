import { act, renderHook, waitFor } from '@testing-library/react';
import { QueryClient } from '@tanstack/react-query';
import { describe, expect, it, vi } from 'vitest';

const api = vi.hoisted(() => ({
  hasLoginCode: vi.fn(),
  claimLoginCode: vi.fn(),
  getForumAuthConfig: vi.fn(),
}));
vi.mock('../api/fluxerAuthApi', () => api);
vi.mock('@/shared/lib/authSession', () => ({
  hasAuthTokenInHash: () => false,
  consumeAuthTokenFromHash: vi.fn(),
}));
import { useAuthBootstrap } from './useAuthBootstrap';

describe('useAuthBootstrap', () => {
  it('StrictMode 重放继续等待同一个一次性领取而不退回旧凭证', async () => {
    let complete!: () => void;
    const claim = new Promise<void>((resolve) => {
      complete = resolve;
    });
    let codePresent = true;
    api.hasLoginCode.mockImplementation(() => codePresent);
    api.claimLoginCode.mockImplementation(() => {
      codePresent = false;
      return claim;
    });
    const client = new QueryClient();
    const { result } = renderHook(() => useAuthBootstrap(client), { reactStrictMode: true });
    expect(result.current).toBe(true);
    expect(api.claimLoginCode).toHaveBeenCalledTimes(2);
    expect(api.getForumAuthConfig).not.toHaveBeenCalled();
    await act(async () => {
      complete();
      await claim;
    });
    await waitFor(() => expect(result.current).toBe(false));
    expect(api.getForumAuthConfig).not.toHaveBeenCalled();
  });
});
