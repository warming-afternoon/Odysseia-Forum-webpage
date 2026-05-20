import { useEffect, useRef } from 'react';

import { useEasterEggStore } from '@/features/easter-eggs/store/easterEggStore';

const DURVIS_TRIGGERS = new Set(['durvis', ':durvis:', '转圈durvis']);
const TRIGGER_COOLDOWN_MS = 5000;

export function useSearchWhisper(query: string) {
  const triggerDurvisRain = useEasterEggStore((state) => state.triggerDurvisRain);
  const lastTriggerRef = useRef({ key: '', time: 0 });

  useEffect(() => {
    const normalized = query.trim().toLowerCase();
    if (!DURVIS_TRIGGERS.has(normalized)) return;

    const now = Date.now();
    if (
      lastTriggerRef.current.key === normalized &&
      now - lastTriggerRef.current.time < TRIGGER_COOLDOWN_MS
    ) {
      return;
    }

    lastTriggerRef.current = { key: normalized, time: now };
    triggerDurvisRain();
  }, [query, triggerDurvisRain]);
}
