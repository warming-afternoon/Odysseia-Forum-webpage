# Work V2 frontend

Set `VITE_WORKS_V2=true` to enable `/works` and its sidebar entry. Existing V1 pages, API client and generated OpenAPI types stay available. `VITE_WORKS_API_URL` optionally overrides the V2 base; otherwise `/v1` in `VITE_API_URL` becomes `/v2`.

The V2 interface uses independent types in `src/features/works/types.ts`. Forum V2 requests use Fluxer Bearer authentication. Native discussions use the `fluxer_api_url` returned by `/v1/auth/config`, including its configured API prefix, and the raw Fluxer token expected by native endpoints. Message contents, replies and own-message edits call Fluxer directly. Discord references open Discord.

Available flows include POST `/v2/search` advanced filtering and ordering, discovery, public author profiles and shared author follows, publication and metadata editing, first-image covers, native emoji-object reaction aggregates, default collection/booklists, follows, update announcements, notifications, preferences and asynchronous task status. Tag snapshots expose per-binding votes; ordinary members can propose tags, while authors/admins can review proposals and manage local bindings. Work/child creation remains pending until the backend's native creation task completes. Main-content edits go through Forum work updates so account consolidation can be delegated and audited by the backend. Native starter edits are only offered for a user's own child thread; ordinary replies remain native messages.

Visibility is enforced by Forum before pagination and counting. No hidden-work fallback calls V1. Work content is removed from the rendered view when a subsequent request is denied. Updating `show_nsfw` cancels and resets V2 queries, including native discussion caches. Channel Banner links preserve their supplied platform/channel target; no additional channel visibility filter is introduced in the frontend.

Creation requires current Discord formal-member eligibility from `/v2/me`. Thread creators can edit their unlocked/unarchived children. Work authors get lock/archive controls for another creator's child without edit/delete controls. Administrators can restore soft-hidden works through `/works/admin/deleted`; ordinary hidden-work detail requests remain 404. Native-source deletion never offers restoration, even if another flag is stale. Deleted child restoration also requires an explicit `can_restore` response. Initializing children display synchronization progress and do not expose management/edit controls. Unsupported or unavailable backend operations surface the actual error and never report a local-only success.

## Backend dependencies

- Forum must run its Work task worker and native content projector; the frontend polls pending tasks and thread references.
- All lock/archive actions use Forum's trusted policy workflow, including the thread creator's actions. The UI toggles `own_locked`/`own_archived` rather than clearing another source. Authors can inspect work penalties and moderation records; only their own active penalty source can be released. DC-source work penalties target Forum/Fluxer children and never Discord main threads.
- Native own-child title/body edits use native channel/message endpoints. Speech restrictions do not disable body editing; locks and archive state do. Native messages use stable nonces when retrying a failed reply submission.
- Work share metadata is not routed through the V1 thread OG endpoint, which identifies Discord threads rather than V2 works.

## Validation

Run local tool entrypoints when the installed pnpm version attempts an automatic dependency reinstall:

```powershell
node node_modules/typescript/bin/tsc -b
node node_modules/vitest/vitest.mjs run --reporter=dot
$env:VITE_WORKS_V2='true'
node node_modules/vite/bin/vite.js build
```

With the V2 feature flag enabled, Forum auth configuration, checkauth, claim, logout and Discord login use /v2/auth. The separate V2 Discord OAuth callback must be configured and registered as /v2/auth/callback; username/password native login uses the configured Fluxer API directly.
