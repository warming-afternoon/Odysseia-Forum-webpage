import { DurvisRainOverlay } from '@/features/easter-eggs/components/DurvisRainOverlay';
import { DurvisSpinFollower } from '@/features/easter-eggs/components/DurvisSpinFollower';
import { useEasterEggStore } from '@/features/easter-eggs/store/easterEggStore';

export function GlobalEasterEggLayer() {
  const durvisFollowerActive = useEasterEggStore((state) => state.durvisFollowerActive);
  const durvisRainNonce = useEasterEggStore((state) => state.durvisRainNonce);
  const stopDurvisFollower = useEasterEggStore((state) => state.stopDurvisFollower);

  return (
    <>
      <DurvisRainOverlay nonce={durvisRainNonce} />
      <DurvisSpinFollower active={durvisFollowerActive} onDone={stopDurvisFollower} />
    </>
  );
}
