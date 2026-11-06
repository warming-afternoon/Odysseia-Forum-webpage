// @vitest-environment jsdom
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { NsfwPreferencesSection } from './NsfwPreferencesSection';
import { V2PreferencesSection } from './V2PreferencesSection';
import { worksApi } from '@/features/works/api';
import { preferencesApi } from '../api/preferencesApi';
import { fakeV2Preferences as basePreferences } from '../testFixtures';
import { preferenceQueryKey } from '../hooks/useUserPreferences';
import { captureAuthSession, invalidateAuthSession } from '@/shared/lib/authSession';
import { usePreviewStore } from '@/features/search/store/previewStore';
import type { WorkMember } from '@/features/works/types';

const fakeV2Preferences: Awaited<ReturnType<typeof worksApi.preferences>> = {
  ...basePreferences, user_id: String(basePreferences.user_id), guild_id: String(basePreferences.guild_id),
  is_first_time: false, show_nsfw: false, nsfw_eligible: true,
  nsfw_guild_id: '9007199254740993125', nsfw_preference_version: 3,
};

const member: WorkMember = {
  id: String(fakeV2Preferences.user_id), discord_user_id: '222', username: 'test',
  display_name: null, avatar_url: null, is_admin: false, can_create_work: true,
  can_view_abyss: false, can_speak: true, show_nsfw: false,
};
const checkbox = () => screen.getByRole('checkbox', { name: '显示 NSFW 作品' });
function mount(withDiscovery = false) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: Infinity }, mutations: { retry: false } } });
  client.setQueryData(['auth'], { loggedIn: true, user: { id: member.id } });
  client.setQueryData(['works-v2', 'me'], member);
  client.setQueryData(preferenceQueryKey('v2', captureAuthSession().generation, member.id), fakeV2Preferences);
  const view = render(<QueryClientProvider client={client}><NsfwPreferencesSection />{withDiscovery && <V2PreferencesSection userId={member.id} />}</QueryClientProvider>);
  return { client, ...view };
}
beforeEach(() => {
  vi.restoreAllMocks();
  vi.spyOn(worksApi, 'me').mockResolvedValue(member);
  vi.spyOn(preferencesApi, 'getByUserId').mockResolvedValue(fakeV2Preferences);
});
afterEach(cleanup);
it('sends CAS with authority identity, locks repeated clicks, clears visible caches and preview', async () => {
  let resolve!: (value: typeof fakeV2Preferences) => void;
  const save = vi.spyOn(worksApi, 'preferences').mockImplementation(() => new Promise(done => { resolve = done; }));
  const { client } = mount();
  await waitFor(() => expect(checkbox()).toBeEnabled());
  client.setQueryData(['works-v2', 'search'], { title: 'restricted' });
  client.setQueryData(['search', 'old'], { title: 'restricted' });
  usePreviewStore.getState().setPreviewThreadId('123');
  fireEvent.click(checkbox());
  await waitFor(() => expect(checkbox()).toBeDisabled());
  fireEvent.click(checkbox());
  expect(save).toHaveBeenCalledTimes(1);
  expect(save).toHaveBeenCalledWith({ show_nsfw: true, expected_version: 3 }, captureAuthSession(), { user_id: member.id, nsfw_guild_id: fakeV2Preferences.nsfw_guild_id });
  const updated = { ...fakeV2Preferences, show_nsfw: true, nsfw_preference_version: 4 };
  vi.mocked(preferencesApi.getByUserId).mockResolvedValue(updated);
  await act(async () => resolve(updated));
  await waitFor(() => expect(checkbox()).toBeChecked());
  expect(client.getQueryData(['works-v2', 'search'])).toBeUndefined();
  expect(client.getQueryData(['search', 'old'])).toBeUndefined();
  expect(usePreviewStore.getState().previewThreadId).toBeNull();
});
it.each([401, 403, 404])('hides cached controls after member access returns %s', async status => {
  const { client } = mount();
  await waitFor(() => expect(checkbox()).toBeEnabled());
  vi.mocked(worksApi.me).mockRejectedValue(Object.assign(new Error('denied'), { response: { status } }));
  await act(async () => { await client.invalidateQueries({ queryKey: ['works-v2', 'me'] }); });
  await waitFor(() => expect(screen.queryByRole('checkbox')).not.toBeInTheDocument());
});
it('reconciles conflicts without retaining old visible content', async () => {
  vi.spyOn(worksApi, 'preferences').mockRejectedValue(Object.assign(new Error('conflict'), { response: { status: 409 } }));
  const { client } = mount();
  await waitFor(() => expect(checkbox()).toBeEnabled());
  client.setQueryData(['works-v2', 'detail', '1'], { title: 'restricted' });
  fireEvent.click(checkbox());
  await waitFor(() => expect(screen.getByRole('alert')).toBeInTheDocument());
  expect(client.getQueryData(['works-v2', 'detail', '1'])).toBeUndefined();
  expect(preferencesApi.getByUserId).toHaveBeenCalled();
});
it('does not apply a late save to a replacement login session', async () => {
  let resolve!: (value: typeof fakeV2Preferences) => void;
  vi.spyOn(worksApi, 'preferences').mockImplementation(() => new Promise(done => { resolve = done; }));
  const { client } = mount();
  await waitFor(() => expect(checkbox()).toBeEnabled());
  fireEvent.click(checkbox());
  await waitFor(() => expect(worksApi.preferences).toHaveBeenCalled());
  invalidateAuthSession();
  client.setQueryData(['works-v2', 'me'], { ...member, id: 'replacement' });
  await act(async () => resolve({ ...fakeV2Preferences, show_nsfw: true, nsfw_preference_version: 4 }));
  expect(client.getQueryData(['works-v2', 'me'])).toMatchObject({ id: 'replacement', show_nsfw: false });
});
it('retains an ineligible users saved switch and explains the viewing restriction', async () => {
  const { client } = mount();
  await act(async () => client.setQueryData(preferenceQueryKey('v2', captureAuthSession().generation, member.id), { ...fakeV2Preferences, show_nsfw: true, nsfw_eligible: false }));
  await waitFor(() => expect(checkbox()).toBeChecked());
  expect(screen.getByText(/当前年龄资格尚不允许/)).toBeInTheDocument();
});
it('native authority refetch updates the switch and removes stale projections', async () => {
  const { client } = mount();
  await waitFor(() => expect(checkbox()).toBeEnabled());
  client.setQueryData(['works-v2', 'search'], { title: 'restricted' });
  vi.mocked(preferencesApi.getByUserId).mockResolvedValue({ ...fakeV2Preferences, show_nsfw: true, nsfw_preference_version: 4 });
  await act(async () => { await client.invalidateQueries({ queryKey: ['user-preferences'] }); });
  await waitFor(() => expect(checkbox()).toBeChecked());
  expect(client.getQueryData(['works-v2', 'search'])).toBeUndefined();
});

it.each(['discovery', 'nsfw'] as const)('serializes both preference forms when %s saves first', async first => {
  let resolveFirst!: (value: typeof fakeV2Preferences) => void;
  const firstResponse = new Promise<typeof fakeV2Preferences>(resolve => { resolveFirst = resolve; });
  const discovered = { ...fakeV2Preferences, include_keywords: 'changed' };
  const enabled = { ...fakeV2Preferences, show_nsfw: true, nsfw_preference_version: 4 };
  const combined = { ...discovered, show_nsfw: true, nsfw_preference_version: 4 };
  const saveDiscovery = vi.spyOn(preferencesApi, 'updateByUserId')
    .mockImplementation(() => first === 'discovery' ? firstResponse : Promise.resolve(combined));
  const saveNsfw = vi.spyOn(worksApi, 'preferences')
    .mockImplementation(() => first === 'nsfw' ? firstResponse : Promise.resolve(combined));
  const { client } = mount(true);
  await waitFor(() => expect(checkbox()).toBeEnabled());
  fireEvent.change(screen.getByRole('textbox', { name: /包含关键词/ }), { target: { value: 'changed' } });
  const submitDiscovery = () => fireEvent.click(screen.getByRole('button', { name: '保存偏好' }));
  const submitNsfw = () => fireEvent.click(checkbox());
  const firstSave = first === 'discovery' ? saveDiscovery : saveNsfw;
  const secondSave = first === 'discovery' ? saveNsfw : saveDiscovery;
  (first === 'discovery' ? submitDiscovery : submitNsfw)();
  await waitFor(() => expect(firstSave).toHaveBeenCalledTimes(1));
  (first === 'discovery' ? submitNsfw : submitDiscovery)();
  // Pending UI covers the queued write, but its transport must not run yet.
  await waitFor(() => {
    expect(checkbox()).toBeDisabled();
    expect(screen.getByRole('button', { name: '保存中…' })).toBeDisabled();
  });
  expect(secondSave).not.toHaveBeenCalled();
  vi.mocked(preferencesApi.getByUserId).mockResolvedValue(combined);
  await act(async () => resolveFirst(first === 'discovery' ? discovered : enabled));
  await waitFor(() => expect(secondSave).toHaveBeenCalledTimes(1));
  await waitFor(() => expect(checkbox()).toBeEnabled());
  expect(checkbox()).toBeChecked();
  expect(screen.getByRole('textbox', { name: /包含关键词/ })).toHaveValue('changed');
  expect(client.getQueryData(preferenceQueryKey('v2', captureAuthSession().generation, member.id)))
    .toMatchObject({ show_nsfw: true, nsfw_preference_version: 4, include_keywords: 'changed' });
});
