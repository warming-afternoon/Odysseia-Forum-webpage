import {
  isAuthSessionCurrent,
  subscribeAuthInvalidation,
  type AuthSessionSnapshot,
} from './authSession';

const listeners = new Set<() => void>();
let open = false;
let session: AuthSessionSnapshot | undefined;
const seenFeatures = new Set<string>();
let lastDismissedAt = -Infinity;
const NOTICE_COOLDOWN_MS = 10000;
const emit = () => listeners.forEach((listener) => listener());

export const getFeatureMigrationNotice = () => open;
export function subscribeFeatureMigrationNotice(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
export function dismissFeatureMigrationNotice() {
  if (!open) return;
  open = false;
  lastDismissedAt = performance.now();
  emit();
}
export function showFeatureMigrationNotice(current: AuthSessionSnapshot, feature: string) {
  if (!isAuthSessionCurrent(current)) return;
  if (session?.generation !== current.generation || session.token !== current.token) {
    session = current;
    seenFeatures.clear();
    lastDismissedAt = -Infinity;
  }
  const key = feature.replace(/\/\d+(?=\/|$)/g, '/:id');
  // These endpoints are automatic shell polls/repairs, not save buttons.
  const background =
    /^\/(?:notifications\/unread-count|follows\/unread-count|meta\/channels|fetch-images)(?:\/|$)/.test(
      key,
    );
  if (background && seenFeatures.has(key)) return;
  seenFeatures.add(key);
  if (open || performance.now() - lastDismissedAt < NOTICE_COOLDOWN_MS) return;
  open = true;
  emit();
}
subscribeAuthInvalidation(() => {
  session = undefined;
  seenFeatures.clear();
  dismissFeatureMigrationNotice();
});
