import { useState } from 'react';
import { ShieldCheck } from 'lucide-react';

import { FakeCaptchaModal } from '@/features/easter-eggs/components/FakeCaptchaModal';

export function FakeCaptchaEntry() {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        className="inline-flex items-center gap-2 rounded-full border border-(--od-shell-line) bg-[color-mix(in_srgb,var(--od-surface-input)_76%,transparent)] px-4 py-2 text-xs font-semibold text-(--od-text-secondary) transition-colors hover:text-(--od-text-primary)"
      >
        <ShieldCheck className="h-4 w-4" />
        验证我是真人
      </button>
      <FakeCaptchaModal isOpen={isOpen} onClose={() => setIsOpen(false)} />
    </>
  );
}
