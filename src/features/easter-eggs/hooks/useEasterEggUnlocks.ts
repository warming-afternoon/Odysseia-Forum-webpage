import { useEffect, useState } from 'react';

import {
  getEasterEggUnlockState,
  type EasterEggUnlockState,
} from '@/features/easter-eggs/lib/easterEggStorage';

export function useEasterEggUnlocks() {
  const [unlocks, setUnlocks] = useState<EasterEggUnlockState>(() => getEasterEggUnlockState());

  useEffect(() => {
    const refresh = () => setUnlocks(getEasterEggUnlockState());

    window.addEventListener('storage', refresh);
    window.addEventListener('odysseia-easter-eggs-updated', refresh);

    return () => {
      window.removeEventListener('storage', refresh);
      window.removeEventListener('odysseia-easter-eggs-updated', refresh);
    };
  }, []);

  return unlocks;
}
