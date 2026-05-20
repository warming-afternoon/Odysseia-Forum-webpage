import { useEffect, useRef, useState } from 'react';

import { MASCOT_IMAGES } from '@/features/mascot/assets';

const FOLLOWER_DURATION_MS = 15000;

interface DurvisSpinFollowerProps {
  active: boolean;
  onDone: () => void;
}

export function DurvisSpinFollower({ active, onDone }: DurvisSpinFollowerProps) {
  const targetRef = useRef({ x: 96, y: 96 });
  const positionRef = useRef({ x: 96, y: 96 });
  const frameRef = useRef<number | null>(null);
  const [position, setPosition] = useState(positionRef.current);

  useEffect(() => {
    if (!active) return;

    const handlePointerMove = (event: PointerEvent) => {
      targetRef.current = {
        x: event.clientX + 22,
        y: event.clientY + 22,
      };
    };

    const tick = () => {
      const current = positionRef.current;
      const target = targetRef.current;
      const next = {
        x: current.x + (target.x - current.x) * 0.13,
        y: current.y + (target.y - current.y) * 0.13,
      };

      positionRef.current = next;
      setPosition(next);
      frameRef.current = window.requestAnimationFrame(tick);
    };

    window.addEventListener('pointermove', handlePointerMove);
    frameRef.current = window.requestAnimationFrame(tick);
    const timer = window.setTimeout(onDone, FOLLOWER_DURATION_MS);

    return () => {
      window.removeEventListener('pointermove', handlePointerMove);
      window.clearTimeout(timer);
      if (frameRef.current !== null) {
        window.cancelAnimationFrame(frameRef.current);
      }
    };
  }, [active, onDone]);

  if (!active || !MASCOT_IMAGES.durvis_spin) return null;

  return (
    <img
      src={MASCOT_IMAGES.durvis_spin}
      alt=""
      aria-hidden="true"
      className="pointer-events-none fixed z-[95] h-16 w-16 select-none drop-shadow-[0_10px_22px_rgba(0,0,0,0.38)]"
      style={{
        left: 0,
        top: 0,
        transform: `translate3d(${position.x}px, ${position.y}px, 0)`,
      }}
    />
  );
}
