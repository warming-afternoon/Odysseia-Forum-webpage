import { EmojiRainOverlay } from '@/features/mascot/components/EmojiRainOverlay';
import { useMascotStore } from '@/features/mascot/store/mascotStore';

export function EasterEggLayer() {
  const activeEasterEgg = useMascotStore((state) => state.activeEasterEgg);
  const clearEasterEgg = useMascotStore((state) => state.clearEasterEgg);

  if (!activeEasterEgg) return null;

  return (
    <>
      {activeEasterEgg.effects.map((effect, index) => {
        if (effect.kind !== 'emoji-rain') return null;

        return (
          <EmojiRainOverlay
            key={`${activeEasterEgg.nonce}-${index}`}
            emoji={effect.emoji}
            nonce={activeEasterEgg.nonce}
            count={effect.count}
            durationMs={effect.durationMs}
            onDone={clearEasterEgg}
          />
        );
      })}
    </>
  );
}
