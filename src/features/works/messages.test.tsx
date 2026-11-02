import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { NativeThreadMessages } from './messages';
import { nativeMessagesApi } from './nativeApi';
vi.mock('./nativeApi', () => ({ nativeMessagesApi: { list: vi.fn(), send: vi.fn(), edit: vi.fn() } }));
vi.mock('./member', () => ({ useWorkMember: () => ({ data: { id: 'me', can_speak: true } }) }));
const message = { id: '222', channel_id: '222', content: '原生主帖正文', timestamp: '2026-11-02T00:00:00Z', edited_timestamp: null, author: { id: 'me', username: '作者' }, attachments: [] };
function renderThread(canReply = true) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  return render(<QueryClientProvider client={client}><NativeThreadMessages channelId="222" canReply={canReply} /></QueryClientProvider>);
}
describe('native discussion flow', () => {
  beforeEach(() => { vi.resetAllMocks(); vi.mocked(nativeMessagesApi.list).mockResolvedValue([message]); });
  it('displays native content and posts replies directly with a stable nonce', async () => {
    vi.mocked(nativeMessagesApi.send).mockResolvedValue({ ...message, id: '333', content: '读者回复' });
    renderThread();
    expect(await screen.findByText('原生主帖正文')).toBeInTheDocument();
    expect(screen.queryByText('编辑我的消息')).not.toBeInTheDocument();
    fireEvent.change(screen.getByRole('textbox', { name: '回复' }), { target: { value: '读者回复' } });
    fireEvent.click(screen.getByRole('button', { name: '发送回复' }));
    await waitFor(() => expect(nativeMessagesApi.send).toHaveBeenCalledWith('222', '读者回复', expect.any(String)));
  });
  it('does not offer composing or starter editing when the thread is locked', async () => {
    renderThread(false);
    await screen.findByText('原生主帖正文');
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
    expect(screen.queryByText('编辑我的消息')).not.toBeInTheDocument();
  });
  it('shows native access failures without a Forum-body fallback', async () => {
    vi.mocked(nativeMessagesApi.list).mockRejectedValue(new Error('原生访问被拒绝'));
    renderThread();
    expect(await screen.findByRole('alert')).toHaveTextContent('原生访问被拒绝');
    expect(screen.queryByText('原生主帖正文')).not.toBeInTheDocument();
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
  });
});

it('allows editing an own reply when composing is disabled but the thread is not locked or archived', async () => {
  vi.resetAllMocks();
  vi.mocked(nativeMessagesApi.list).mockResolvedValue([{ ...message, id: '333', content: '自己的旧回复' }]);
  vi.mocked(nativeMessagesApi.edit).mockResolvedValue({ ...message, id: '333', content: '自己的新回复' });
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  render(<QueryClientProvider client={client}><NativeThreadMessages channelId="222" canReply={false} canEditMessages={true} /></QueryClientProvider>);
  fireEvent.click(await screen.findByRole('button', { name: '编辑我的消息' }));
  expect(screen.queryByRole('textbox', { name: '回复' })).not.toBeInTheDocument();
  fireEvent.change(screen.getByRole('textbox', { name: '编辑消息正文' }), { target: { value: '自己的新回复' } });
  fireEvent.click(screen.getByRole('button', { name: '保存消息' }));
  await waitFor(() => expect(nativeMessagesApi.edit).toHaveBeenCalledWith('222', '333', '自己的新回复'));
});
