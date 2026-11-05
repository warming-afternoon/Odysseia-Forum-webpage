import { useEffect, useRef, useSyncExternalStore } from 'react';
import { createPortal } from 'react-dom';
import { FEATURE_NOT_MIGRATED_MESSAGE } from '@/shared/api/featureMigration';
import {
  dismissFeatureMigrationNotice,
  getFeatureMigrationNotice,
  subscribeFeatureMigrationNotice,
} from '@/shared/lib/featureMigrationNotice';

export function FeatureMigrationNotice() {
  const open = useSyncExternalStore(
    subscribeFeatureMigrationNotice,
    getFeatureMigrationNotice,
    () => false,
  );
  const dialogRef = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const dialog = dialogRef.current;
    if (!open || !dialog || dialog.open) return;
    if (typeof dialog.showModal === 'function') dialog.showModal();
    else dialog.setAttribute('open', '');
  }, [open]);
  if (!open) return null;
  return createPortal(
    <dialog
      ref={dialogRef}
      className="od-floating-panel-solid fixed inset-0 z-3000 m-auto w-[calc(100%-2rem)] max-w-lg rounded-2xl border border-(--od-border) p-6 text-(--od-text-primary) shadow-2xl backdrop:bg-black/60 backdrop:backdrop-blur-xs"
      aria-modal="true"
      aria-labelledby="feature-migration-title"
      aria-describedby="feature-migration-description"
      onCancel={(event) => {
        event.preventDefault();
        dismissFeatureMigrationNotice();
      }}
      onClose={dismissFeatureMigrationNotice}
    >
      <h2 id="feature-migration-title" className="text-xl font-semibold">
        {FEATURE_NOT_MIGRATED_MESSAGE}
      </h2>
      <p
        id="feature-migration-description"
        className="mt-3 text-sm leading-6 text-(--od-text-secondary)"
      >
        这个功能暂时无法使用，请稍后再试。
      </p>
      <div className="mt-6 flex justify-end">
        <button
          type="button"
          onClick={dismissFeatureMigrationNotice}
          className="rounded-lg bg-(--od-accent) px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-(--od-accent-hover)"
        >
          知道了
        </button>
      </div>
    </dialog>,
    document.body,
  );
}
