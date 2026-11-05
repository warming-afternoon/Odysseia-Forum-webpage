import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  captureAuthSession,
  invalidateAuthSession,
  setStoredAuthToken,
} from '@/shared/lib/authSession';
import type { FluxerLoginIdentity as Identity } from '../api/fluxerIdentityApi';

const api = vi.hoisted(() => ({ getFluxerLoginIdentity: vi.fn() }));
vi.mock('../api/fluxerIdentityApi', () => api);
vi.mock('../api/fluxerAuthApi', () => ({
  getPasswordSetupProof: () => 'proof',
  acceptFluxerToken: vi.fn(),
  fluxerRequest: vi.fn(),
}));
import { FluxerLoginIdentity } from './FluxerLoginIdentity';
import { InitialPasswordPrompt } from './InitialPasswordPrompt';

const token = 'flx_' + 'a'.repeat(36);
const makeIdentity = (name = 'native_alice'): Identity => ({
  username: name, login: name, session: captureAuthSession(),
});

function show(element = <FluxerLoginIdentity />) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<QueryClientProvider client={client}>{element}</QueryClientProvider>);
}

beforeEach(() => {
  invalidateAuthSession();
  setStoredAuthToken(token);
  vi.resetAllMocks();
  api.getFluxerLoginIdentity.mockImplementation(async () => makeIdentity());
});

describe('Fluxer 登录用户名展示', () => {
  it('等待真实资料，并显示可选择的原生用户名', async () => {
    let finish!: (value: Identity) => void;
    api.getFluxerLoginIdentity.mockImplementation(() => new Promise((resolve) => { finish = resolve; }));
    show();
    expect(screen.getByRole('status')).toHaveTextContent('正在读取 Fluxer 用户名');
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
    await act(async () => finish(makeIdentity()));
    const input = await screen.findByRole('textbox', { name: 'Fluxer 登录用户名' });
    expect(input).toHaveValue('native_alice');
    expect(input).toHaveAttribute('readonly');
    expect(input).toHaveAttribute('autocomplete', 'username');
  });

  it('请求失败不显示任何替代账号，允许重试', async () => {
    api.getFluxerLoginIdentity.mockRejectedValueOnce(new Error('offline'));
    show();
    expect(await screen.findByRole('alert')).toHaveTextContent('暂时无法读取 Fluxer 用户名');
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: '重新读取用户名' }));
    expect(await screen.findByRole('textbox')).toHaveValue('native_alice');
    expect(api.getFluxerLoginIdentity).toHaveBeenCalledTimes(2);
  });

  it('未登录时隐藏身份且不发送请求', () => {
    invalidateAuthSession();
    const { container } = show();
    expect(container).toBeEmptyDOMElement();
    expect(api.getFluxerLoginIdentity).not.toHaveBeenCalled();
  });

  it('旧鉴权模式隐藏整个原生身份区块', async () => {
    api.getFluxerLoginIdentity.mockResolvedValue(null);
    const { container } = show();
    await waitFor(() => expect(container).toBeEmptyDOMElement());
  });

  it('退出后立即移除已显示的原生用户名', async () => {
    show();
    await screen.findByRole('textbox');
    act(() => invalidateAuthSession());
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
    expect(screen.queryByText('Fluxer 登录用户名')).not.toBeInTheDocument();
  });

  it('切换账号后忽略旧请求，并读取新账号', async () => {
    let finish!: (value: Identity) => void;
    const oldIdentity = makeIdentity('old_alice');
    api.getFluxerLoginIdentity.mockImplementationOnce(() => new Promise((resolve) => { finish = resolve; }));
    show();
    await waitFor(() => expect(api.getFluxerLoginIdentity).toHaveBeenCalledOnce());
    api.getFluxerLoginIdentity.mockImplementation(async () => makeIdentity('new_bob'));
    act(() => {
      invalidateAuthSession();
      setStoredAuthToken('flx_' + 'b'.repeat(36));
    });
    expect(await screen.findByRole('textbox')).toHaveValue('new_bob');
    await act(async () => finish(oldIdentity));
    expect(screen.getByRole('textbox')).toHaveValue('new_bob');
  });

  it('跨标签页退出时清除用户名', async () => {
    show();
    await screen.findByRole('textbox');
    act(() => {
      localStorage.removeItem('auth_token');
      window.dispatchEvent(new StorageEvent('storage', {
        key: 'auth_token', oldValue: token, newValue: null,
      }));
    });
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
  });

  it('首次密码弹窗显示登录名，并说明以后在哪里查看', async () => {
    show(<InitialPasswordPrompt />);
    expect(await screen.findByRole('textbox', { name: 'Fluxer 登录用户名' })).toHaveValue('native_alice');
    expect(screen.getByText('以后也可以在「我的」页面查看登录用户名。')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: '以后再设置' }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

});
