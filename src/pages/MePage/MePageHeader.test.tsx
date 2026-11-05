import { render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { beforeEach, expect, it, vi } from 'vitest';
import { captureAuthSession, invalidateAuthSession, setStoredAuthToken } from '@/shared/lib/authSession';

const api = vi.hoisted(() => ({ getFluxerLoginIdentity: vi.fn() }));
vi.mock('@/features/auth/api/fluxerIdentityApi', () => api);
vi.mock('@/entities/user/UserHeaderCard', () => ({ UserHeaderCard: () => <p>Discord 昵称</p> }));
import { MePageHeader } from './MePageHeader';

beforeEach(() => {
  invalidateAuthSession();
  setStoredAuthToken('flx_' + 'a'.repeat(36));
  vi.clearAllMocks();
  api.getFluxerLoginIdentity.mockImplementation(async () => ({
    username: 'native.alice', login: 'native.alice', session: captureAuthSession(),
  }));
});

it('「我的」页长期展示真实登录名，独立于 Discord 用户资料', async () => {
  render(<QueryClientProvider client={new QueryClient()}>
    <MePageHeader
      currentTab="booklists"
      onOpenProfile={vi.fn()}
      onSelectTab={vi.fn()}
      showProfileButton
      tabOptions={[]}
      user={{ id: 'discord-id', username: 'discord_alice', display_name: 'Discord 昵称' }}
    />
  </QueryClientProvider>);
  expect(await screen.findByRole('textbox', { name: 'Fluxer 登录用户名' })).toHaveValue('native.alice');
  expect(screen.getByText('Discord 昵称')).toBeInTheDocument();
});
