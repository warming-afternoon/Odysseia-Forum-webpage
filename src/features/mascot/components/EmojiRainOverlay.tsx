import { useEffect, useMemo } from 'react';

interface EmojiRainOverlayProps {
  emoji: string;
  nonce: number;
  count?: number;
  durationMs?: number;
  onDone: (nonce: number) => void;
}

interface EmojiDrop {
  id: number;
  left: number;
  delayMs: number;
  durationMs: number;
  fontSize: number;
  rotate: number;
}

function createDrops(count: number, durationMs: number): EmojiDrop[] {
  return Array.from({ length: count }, (_, id) => ({
    id,
    left: Math.random() * 100,
    delayMs: Math.random() * Math.min(900, durationMs * 0.28),
    durationMs: durationMs * (0.72 + Math.random() * 0.36),
    fontSize: 22 + Math.random() * 22,
    rotate: -35 + Math.random() * 70,
  }));
}

export function EmojiRainOverlay({
  emoji,
  nonce,
  count = 48,
  durationMs = 3600,
  onDone,
}: EmojiRainOverlayProps) {
  const drops = useMemo(() => createDrops(count, durationMs), [count, durationMs, nonce]);

  useEffect(() => {
    const timer = window.setTimeout(() => onDone(nonce), durationMs + 1200);
    return () => window.clearTimeout(timer);
  }, [durationMs, nonce, onDone]);

  return (
    <div className="pointer-events-none fixed inset-0 z-[10000] overflow-hidden" aria-hidden="true">
      <style>
        {`@keyframes od-emoji-rain-fall {
          0% { transform: translate3d(0, -14vh, 0) rotate(var(--od-rain-rotate-start)); opacity: 0; }
          8% { opacity: 1; }
          92% { opacity: 1; }
          100% { transform: translate3d(0, 112vh, 0) rotate(calc(var(--od-rain-rotate-start) + 160deg)); opacity: 0; }
        }`}
      </style>
      {drops.map((drop) => (
        <span
          key={`${nonce}-${drop.id}`}
          className="absolute top-0 select-none will-change-transform"
          style={{
            left: `${drop.left}%`,
            fontSize: `${drop.fontSize}px`,
            animation: `od-emoji-rain-fall ${drop.durationMs}ms linear ${drop.delayMs}ms forwards`,
            ['--od-rain-rotate-start' as string]: `${drop.rotate}deg`,
          }}
        >
          {emoji}
        </span>
      ))}
    </div>
  );
}
