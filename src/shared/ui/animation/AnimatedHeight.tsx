import { useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { motion, useIsPresent } from 'motion/react';
import { usePrefersReducedMotion } from '@/shared/hooks/usePrefersReducedMotion';
import { motionTransitions } from './variants';

export function AnimatedHeight({ children }: { children: ReactNode }) {
  const contentRef = useRef<HTMLDivElement>(null);
  const [height, setHeight] = useState<number | null>(null);
  const [isAnimating, setIsAnimating] = useState(true);
  const isPresent = useIsPresent();
  const reduceMotion = usePrefersReducedMotion();

  useLayoutEffect(() => {
    const content = contentRef.current!;
    const measure = () => setHeight(content.offsetHeight);
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(content);
    return () => observer.disconnect();
  }, []);

  return (
    <motion.div
      initial={reduceMotion ? false : { height: 0 }}
      animate={{ height: isPresent ? height ?? 'auto' : 0 }}
      transition={{ ...motionTransitions.panel, duration: reduceMotion ? 0 : motionTransitions.panel.duration }}
      onAnimationStart={() => setIsAnimating(true)}
      onAnimationComplete={() => setIsAnimating(false)}
      className={isPresent && !isAnimating ? 'overflow-visible' : 'overflow-hidden'}
    >
      <div ref={contentRef} className="flow-root">{children}</div>
    </motion.div>
  );
}
