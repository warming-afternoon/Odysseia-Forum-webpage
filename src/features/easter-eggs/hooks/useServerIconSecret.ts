import { useRef } from 'react';

import { useEasterEggStore } from '@/features/easter-eggs/store/easterEggStore';
import { showMascotToast } from '@/features/mascot/lib/mascotToast';

const REQUIRED_CLICKS = 7;
const CLICK_WINDOW_MS = 2200;

export function useServerIconSecret() {
  const clickTimesRef = useRef<number[]>([]);
  const toggleDurvisFollower = useEasterEggStore((state) => state.toggleDurvisFollower);

  return () => {
    const now = Date.now();
    clickTimesRef.current = [...clickTimesRef.current.filter((time) => now - time <= CLICK_WINDOW_MS), now];

    if (clickTimesRef.current.length < REQUIRED_CLICKS) return;

    clickTimesRef.current = [];
    const active = toggleDurvisFollower();

    showMascotToast({
      id: 'server-icon-durvis-secret',
      emotion: active ? 'durvis' : 'sleep',
      eyebrow: 'Hidden Signal',
      title: active ? 'Durvis 已唤醒' : 'Durvis 已返回待机状态',
      message: active ? '转圈巡游开始。' : '隐藏巡游结束。',
      duration: 3200,
    });
  };
}
