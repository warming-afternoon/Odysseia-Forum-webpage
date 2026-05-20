import { create } from 'zustand';

interface EasterEggState {
  durvisFollowerActive: boolean;
  durvisRainNonce: number;
  triggerDurvisRain: () => void;
  toggleDurvisFollower: () => boolean;
  stopDurvisFollower: () => void;
}

export const useEasterEggStore = create<EasterEggState>()((set, get) => ({
  durvisFollowerActive: false,
  durvisRainNonce: 0,

  triggerDurvisRain: () => {
    set((state) => ({ durvisRainNonce: state.durvisRainNonce + 1 }));
  },

  toggleDurvisFollower: () => {
    const nextActive = !get().durvisFollowerActive;
    set({ durvisFollowerActive: nextActive });
    return nextActive;
  },

  stopDurvisFollower: () => {
    set({ durvisFollowerActive: false });
  },
}));
