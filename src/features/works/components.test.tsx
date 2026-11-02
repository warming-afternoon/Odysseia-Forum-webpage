import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { WorkCard, WorkReactions } from './components';
import { discordThreadUrl } from './threads';
import type { Work } from './types';

const work: Work = {
  id: '9007199254740993123', title: '作品标题', description: '作品正文', images: ['https://example.com/first.png', 'https://example.com/second.png'],
  author_id: '123', source_platform: 'fluxer', source_guild_id: null, source_channel_id: null, source_thread_id: null, main_ref: null,
  is_nsfw: false, is_abyss: false, created_at: '2026-11-02T00:00:00Z', deleted_at: null,
  statistics: { view_count: 1, collection_count: 2, reaction_count: 3, reply_count: 4 }, reactions: [], tags: [{ id: '5', name: '冒险' }],
};
describe('work presentation', () => {
  it('uses the first work image as the cover and links to work identity', () => {
    render(<MemoryRouter><WorkCard work={work} /></MemoryRouter>);
    expect(screen.getByRole('presentation')).toHaveAttribute('src', work.images[0]);
    expect(screen.getByRole('link', { name: work.title })).toHaveAttribute('href', `/works/${work.id}`);
    expect(screen.getByRole('link', { name: '#冒险' })).toHaveAttribute('href', '/works?tag_id=5');
  });
  it('only opens validated Discord references externally', () => {
    const ref = { id: '1', platform: 'discord', thread_id: '33', guild_id: '22', channel_id: '11', role: 'main' as const };
    expect(discordThreadUrl(ref)).toBe('https://discord.com/channels/22/33');
    expect(discordThreadUrl({ ...ref, platform: 'fluxer' })).toBeNull();
    expect(discordThreadUrl({ ...ref, guild_id: '../bad' })).toBeNull();
  });
});

it('renders native emoji objects and legacy Unicode aggregates without treating an object as a React child', () => {
  render(<WorkReactions reactions={[{ emoji: { id: null, name: '👍', animated: false }, count: 2 }, { emoji: { id: '9007199254740993123', name: 'party', animated: true }, count: 3 }, { emoji: '❤️', count: 1 }]} />);
  expect(screen.getByText('👍 2')).toBeInTheDocument();
  expect(screen.getByText('party 3')).toBeInTheDocument();
  expect(screen.getByText('❤️ 1')).toBeInTheDocument();
});
