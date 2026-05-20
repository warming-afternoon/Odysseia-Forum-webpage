import { useState } from 'react';

import { unlockDangerPinkTheme } from '@/features/easter-eggs/lib/easterEggStorage';
import { showMascotToast } from '@/features/mascot/lib/mascotToast';

const REQUIRED_PRESSES = 3;

export function DangerousThemeUnlockButton() {
  const [pressCount, setPressCount] = useState(0);

  const handlePress = () => {
    const nextCount = pressCount + 1;

    if (nextCount >= REQUIRED_PRESSES) {
      unlockDangerPinkTheme();
      setPressCount(0);
      showMascotToast({
        id: 'danger-pink-theme-unlocked',
        emotion: 'surprise',
        eyebrow: 'Danger Zone',
        title: '危险主题已加入主题列表',
        message: '红粉警戒解除。',
        duration: 4200,
      });
      return;
    }

    setPressCount(nextCount);
    showMascotToast({
      id: 'danger-button-progress',
      emotion: 'confused',
      eyebrow: 'Danger Zone',
      title: `危险操作计数：${nextCount} / ${REQUIRED_PRESSES}`,
      message: '继续按下将解锁视觉实验主题。',
      duration: 2600,
    });
  };

  return (
    <button
      type="button"
      onClick={handlePress}
      className="w-full rounded-[1.1rem] border border-(--od-border) bg-(--od-card) p-4 text-left transition-colors hover:bg-(--od-card-hover)"
    >
      <div className="text-sm font-medium text-(--od-text-primary)">不要按</div>
      <div className="mt-1 text-xs text-(--od-text-tertiary)">隐藏视觉实验入口</div>
    </button>
  );
}
