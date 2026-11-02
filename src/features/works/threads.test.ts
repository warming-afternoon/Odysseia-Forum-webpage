import { describe, expect, it } from 'vitest';
import { threadPermissions } from './threads';
import type { ThreadRef, WorkMember } from './types';
const member: WorkMember = { id: 'work-owner', discord_user_id: '111', username: 'author', display_name: null, avatar_url: null, can_create_work: true, can_view_abyss: false, can_speak: true, show_nsfw: false, is_admin: false };
const thread: ThreadRef = { id: '1', platform: 'fluxer', thread_id: '222', guild_id: '333', channel_id: '444', role: 'child', author_id: 'child-owner', locked: false, archived: false };
describe('work thread capability boundaries', () => {
  it('permits the work author to manage another creators child without edit/delete rights', () => {
    expect(threadPermissions(thread, member, member.id)).toEqual({ edit: false, remove: false, manage: true, restore: false });
  });
  it('blocks editing a creators locked or archived child', () => {
    const creator = { ...member, id: 'child-owner' };
    expect(threadPermissions(thread, creator, 'work-owner').edit).toBe(true);
    expect(threadPermissions({ ...thread, locked: true }, creator, 'work-owner').edit).toBe(false);
    expect(threadPermissions({ ...thread, archived: true }, creator, 'work-owner').edit).toBe(false);
  });
  it('reserves restoration for administrators and never offers main restoration', () => {
    const deleted = { ...thread, deleted_at: '2026-11-02T00:00:00Z', can_restore: true };
    expect(threadPermissions(deleted, { ...member, id: 'child-owner' }, member.id).restore).toBe(false);
    expect(threadPermissions(deleted, { ...member, is_admin: true }, member.id).restore).toBe(true);
    expect(threadPermissions({ ...deleted, role: 'main' }, { ...member, is_admin: true }, member.id).restore).toBe(false);
  });
});

it('does not broaden a speech restriction to body edits, and does not restore a native-deleted source or manage an initializing child', () => {
  const creator = { ...member, id: 'child-owner', can_speak: false };
  expect(threadPermissions(thread, creator, 'work-owner').edit).toBe(true);
  expect(threadPermissions({ ...thread, initializing: true }, creator, 'work-owner')).toMatchObject({ edit: false, remove: false, manage: false });
  expect(threadPermissions({ ...thread, deleted_at: '2026-11-02T00:00:00Z', can_restore: true, deletion_reason: 'source_deleted' }, { ...member, is_admin: true }, 'work-owner').restore).toBe(false);
});
