import { useEffect } from 'react';
import { act, cleanup, render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { captureAuthSession, invalidateAuthSession, setStoredAuthToken } from '@/shared/lib/authSession';
import { useWorkPresentation } from './useWorkPresentation';
import { WorkTasks } from './tasks';

const api = vi.hoisted(() => ({ get: vi.fn(), tasks: vi.fn(), mounted: vi.fn() }));
vi.mock('./api', () => ({ worksApi: api }));
vi.mock('./layout', () => ({ workKeys: { all: ['works-v2'] } }));
vi.mock('./components', () => ({ WorkStatus: () => null }));

const ready = { id: '31572', title: 'fresh body', sync_status: 'ready', source_platform: 'fluxer', source_thread_id: '123' };
const done = { id: 'task1', kind: 'create_main', status: 'done', attempts: 1 };
let client: QueryClient;
const key = (id = '31572') => ['works-v2', 'presentation', id, captureAuthSession().generation];
function Content({ title }: { title: string }) {
  useEffect(() => { api.mounted(); }, []);
  return <><p>{title}</p><WorkTasks workId="31572" /></>;
}
// The same validation/error branches used by both the overlay and route.
function Gate({ id = '31572' }: { id?: string }) {
  const result = useWorkPresentation(id);
  if (result.isValidating) return <p>loading</p>;
  if (result.error || !result.data) return <p>unavailable</p>;
  return <Content title={result.data.title} />;
}
function open(id = '31572') {
  return render(<QueryClientProvider client={client}><Gate id={id} /></QueryClientProvider>);
}
async function tick(ms = 100) {
  for (let elapsed = 0; elapsed < ms; elapsed += 20) {
    await act(async () => { await vi.advanceTimersByTimeAsync(20); });
  }
}
beforeEach(() => {
  vi.useFakeTimers();
  client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  api.get.mockImplementation(async () => {
    await new Promise(resolve => setTimeout(resolve, 10));
    return ready;
  });
  api.tasks.mockResolvedValue({ items: [done] });
});
afterEach(() => {
  cleanup(); client.clear(); vi.useRealTimers(); vi.resetAllMocks();
});

it('ready work with a historical done task settles, without remounting on its refresh', async () => {
  open();
  expect(screen.getByText('loading')).toBeInTheDocument();
  await tick(600);
  expect(screen.getByText('fresh body')).toBeInTheDocument();
  expect(api.get).toHaveBeenCalledTimes(2);
  expect(api.tasks).toHaveBeenCalledTimes(1);
  expect(api.mounted).toHaveBeenCalledTimes(1);
  await tick(6000);
  expect(api.get).toHaveBeenCalledTimes(2);
});

it('revalidates cached data on every opening and does not reannounce historical done tasks', async () => {
  client.setQueryData(key(), { ...ready, title: 'cached body' });
  const first = open();
  expect(screen.queryByText('cached body')).not.toBeInTheDocument();
  expect(screen.getByText('loading')).toBeInTheDocument();
  await tick();
  first.unmount();
  const count = api.get.mock.calls.length;
  open();
  expect(screen.queryByText('fresh body')).not.toBeInTheDocument();
  await tick();
  expect(api.get).toHaveBeenCalledTimes(count + 1);
  expect(screen.getByText('fresh body')).toBeInTheDocument();
});

it('keeps descendants mounted during a slow background request, then hides content on failure', async () => {
  open(); await tick();
  let reject!: (error: Error) => void;
  api.get.mockImplementationOnce(() => new Promise((_, fail) => { reject = fail; }));
  await act(async () => { void client.invalidateQueries({ queryKey: key() }); });
  await tick();
  expect(screen.getByText('fresh body')).toBeInTheDocument();
  expect(api.mounted).toHaveBeenCalledTimes(1);
  await act(async () => { reject(new Error('403')); });
  await tick();
  expect(screen.queryByText('fresh body')).not.toBeInTheDocument();
  expect(screen.getByText('unavailable')).toBeInTheDocument();
});

it('shows a first-load failure instead of a permanent loading gate', async () => {
  api.get.mockRejectedValue(new Error('network unavailable'));
  open(); await tick();
  expect(screen.getByText('unavailable')).toBeInTheDocument();
  expect(api.get).toHaveBeenCalledTimes(1);
});

it('refreshes once for each newly completed task, ignoring reordered or repeated completions', async () => {
  open(); await tick();
  const tasksKey = ['works-v2', 'tasks', '31572'];
  await act(async () => { client.setQueryData(tasksKey, { items: [done, { ...done, id: 'task2', status: 'running' }] }); });
  await tick();
  expect(api.get).toHaveBeenCalledTimes(2);
  await act(async () => { client.setQueryData(tasksKey, { items: [{ ...done, id: 'task2' }, done] }); });
  await tick();
  expect(api.get).toHaveBeenCalledTimes(3);
  await act(async () => { client.setQueryData(tasksKey, { items: [done, { ...done, id: 'task2' }] }); });
  await tick();
  expect(api.get).toHaveBeenCalledTimes(3);
});

it('polls a pending source until ready and then stops', async () => {
  api.tasks.mockResolvedValue({ items: [] });
  api.get.mockResolvedValueOnce({ ...ready, sync_status: 'pending', source_thread_id: null }).mockResolvedValue(ready);
  open(); await tick();
  expect(api.get).toHaveBeenCalledTimes(1);
  await tick(3100);
  expect(api.get).toHaveBeenCalledTimes(2);
  await tick(6000);
  expect(api.get).toHaveBeenCalledTimes(2);
  expect(api.mounted).toHaveBeenCalledTimes(1);
});

it('immediately hides a validated old account on invalidation and rejects its late response', async () => {
  setStoredAuthToken('flx_old');
  open(); await tick();
  let resolveOld!: (data: typeof ready) => void;
  api.get.mockImplementationOnce(() => new Promise(resolve => { resolveOld = resolve; }));
  await act(async () => { void client.invalidateQueries({ queryKey: key() }); });
  api.get.mockImplementationOnce(() => new Promise((_, reject) => setTimeout(() => reject(new Error('403 new account')), 40)));
  await act(async () => { invalidateAuthSession(); setStoredAuthToken('flx_new'); });
  expect(screen.queryByText('fresh body')).not.toBeInTheDocument();
  await act(async () => { resolveOld({ ...ready, title: 'old late body' }); });
  await tick();
  expect(screen.queryByText('old late body')).not.toBeInTheDocument();
  expect(screen.getByText('unavailable')).toBeInTheDocument();
});

it('revalidates when changing works instead of exposing another cached body', async () => {
  api.tasks.mockResolvedValue({ items: [] });
  const view = open(); await tick();
  client.setQueryData(key('other'), { ...ready, id: 'other', title: 'other cached body' });
  view.rerender(<QueryClientProvider client={client}><Gate id="other" /></QueryClientProvider>);
  expect(screen.queryByText('other cached body')).not.toBeInTheDocument();
  expect(screen.getByText('loading')).toBeInTheDocument();
  await tick();
  expect(api.get).toHaveBeenLastCalledWith('other', expect.any(AbortSignal));
});

it('shares completion deduplication between simultaneous task observers', async () => {
  open(); await tick();
  render(<QueryClientProvider client={client}><WorkTasks workId="31572" /></QueryClientProvider>);
  await tick();
  expect(api.get).toHaveBeenCalledTimes(2);
  await act(async () => {
    client.setQueryData(['works-v2', 'tasks', '31572'], { items: [done, { ...done, id: 'task2' }] });
  });
  await tick();
  expect(api.get).toHaveBeenCalledTimes(3);
});

it('allows completion refresh again after the task query is removed and recreated', async () => {
  const first = open(); await tick(); first.unmount();
  client.removeQueries({ queryKey: ['works-v2', 'tasks', '31572'], exact: true });
  open(); await tick();
  expect(api.get).toHaveBeenCalledTimes(4); // two opens and one completion refresh per query lifetime
});
