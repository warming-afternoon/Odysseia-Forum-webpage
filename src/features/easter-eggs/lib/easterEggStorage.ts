const EASTER_EGG_STORAGE_KEY = 'odysseia_easter_eggs';

export interface EasterEggUnlockState {
  dangerPinkThemeUnlocked: boolean;
}

const defaultUnlockState: EasterEggUnlockState = {
  dangerPinkThemeUnlocked: false,
};

export function getEasterEggUnlockState(): EasterEggUnlockState {
  try {
    const stored = localStorage.getItem(EASTER_EGG_STORAGE_KEY);
    if (!stored) return defaultUnlockState;

    return {
      ...defaultUnlockState,
      ...(JSON.parse(stored) as Partial<EasterEggUnlockState>),
    };
  } catch {
    return defaultUnlockState;
  }
}

export function saveEasterEggUnlockState(state: EasterEggUnlockState) {
  localStorage.setItem(EASTER_EGG_STORAGE_KEY, JSON.stringify(state));
}

export function unlockDangerPinkTheme() {
  const nextState = {
    ...getEasterEggUnlockState(),
    dangerPinkThemeUnlocked: true,
  };
  saveEasterEggUnlockState(nextState);
  window.dispatchEvent(new Event('odysseia-easter-eggs-updated'));
}
