interface ShareTextDialogProps {
  title: string;
  text: string;
  onClose: () => void;
  onCopy: () => void;
}

export function ShareTextDialog({ title, text, onClose, onCopy }: ShareTextDialogProps) {
  return (
    <div
      className="fixed inset-0 z-90 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs"
      role="dialog"
      aria-modal="true"
      aria-labelledby="share-text-dialog-title"
      onClick={onClose}
    >
      <div
        className="od-floating-panel-solid w-full max-w-xl rounded-2xl border border-(--od-border) p-6 shadow-2xl"
        onClick={(event) => event.stopPropagation()}
      >
        <p className="mb-2 text-xs font-semibold uppercase tracking-[0.24em] text-(--od-text-tertiary)">
          分享文案
        </p>
        <h2 id="share-text-dialog-title" className="text-xl font-semibold text-(--od-text-primary)">
          {title}
        </h2>
        <p className="mt-3 text-sm leading-6 text-(--od-text-secondary)">
          可以手动选中文案复制，也可以点击下方按钮一键复制。
        </p>
        <textarea
          readOnly
          value={text}
          onFocus={(event) => event.currentTarget.select()}
          className="mt-4 h-44 w-full resize-none rounded-xl border border-(--od-border) bg-(--od-bg-secondary) px-4 py-3 text-sm leading-6 text-(--od-text-primary) outline-hidden focus:border-(--od-accent)"
        />
        <div className="mt-6 flex flex-wrap justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg px-4 py-2 text-sm font-medium text-(--od-text-secondary) transition-colors hover:bg-(--od-bg-secondary) hover:text-(--od-text-primary)"
          >
            关闭
          </button>
          <button
            type="button"
            onClick={onCopy}
            className="rounded-lg bg-(--od-accent) px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-(--od-accent-hover)"
          >
            复制文案
          </button>
        </div>
      </div>
    </div>
  );
}
