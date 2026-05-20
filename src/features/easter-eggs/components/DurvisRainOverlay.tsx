import { useEffect, useMemo, useState } from 'react';

import { MASCOT_IMAGES } from '@/features/mascot/assets';

interface DurvisRainOverlayProps {
  nonce: number;
}

const DURVIS_RAIN_COUNT = 30;
const DURVIS_RAIN_DURATION_MS = 3600;

export function DurvisRainOverlay({ nonce }: DurvisRainOverlayProps) {
  const [visible, setVisible] = useState(false);

  const drops = useMemo(
    () =>
      Array.from({ length: DURVIS_RAIN_COUNT }, (_, index) => ({
        id: `${nonce}-${index}`,
        left: Math.random() * 100,
        size: 34 + Math.random() * 34,
        delay: Math.random() * 900,
        duration: 2100 + Math.random() * 1200,
        rotate: Math.random() * 90 - 45,
      })),
    [nonce],
  );

  useEffect(() => {
    if (nonce <= 0) return;

    setVisible(true);
    const timer = window.setTimeout(() => setVisible(false), DURVIS_RAIN_DURATION_MS);
    return () => window.clearTimeout(timer);
  }, [nonce]);

  if (!visible || !MASCOT_IMAGES.durvis_spin) return null;

  return (
    <div className="pointer-events-none fixed inset-0 z-[90] overflow-hidden" aria-hidden="true">
      <style>{`
        @keyframes od-durvis-rain-fall {
          0% { transform: translate3d(0, -18vh, 0) rotate(var(--od-durvis-rotate)); opacity: 0; }
          12% { opacity: 1; }
          100% { transform: translate3d(0, 112vh, 0) rotate(calc(var(--od-durvis-rotate) + 360deg)); opacity: 0; }
        }
      `}</style>
      {drops.map((drop) => (
        <img
          key={drop.id}
          src={MASCOT_IMAGES.durvis_spin}
          alt=""
          className="absolute top-0 select-none"
          style={{
            left: `${drop.left}%`,
            width: `${drop.size}px`,
            height: `${drop.size}px`,
            animation: `od-durvis-rain-fall ${drop.duration}ms linear ${drop.delay}ms both`,
            ['--od-durvis-rotate' as string]: `${drop.rotate}deg`,
          }}
        />
      ))}
    </div>
  );
}
