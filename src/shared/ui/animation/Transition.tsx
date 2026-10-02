import { useState } from 'react';
import { motion, AnimatePresence, useIsPresent, HTMLMotionProps } from 'motion/react';
import { usePrefersReducedMotion } from '@/shared/hooks/usePrefersReducedMotion';
import { fadeVariants, slideUpVariants, scaleVariants, motionTransitions } from './variants';

interface TransitionProps extends HTMLMotionProps<"div"> {
    children: React.ReactNode;
    type?: 'fade' | 'slide' | 'scale';
    delay?: number;
    className?: string;
    show?: boolean; // 控制 AnimatePresence
}

export function Transition({
    children,
    type = 'fade',
    delay = 0,
    className,
    show = true,
    ...props
}: TransitionProps) {
    const [opening, setOpening] = useState({ show, revision: 0 });
    // 退场期间重开也建立新实例，避免重新使用已放弃的表单草稿。
    if (opening.show !== show) {
        setOpening({ show, revision: opening.revision + (show ? 1 : 0) });
    }
    return (
        <AnimatePresence>
            {show && <TransitionContent key={opening.revision} type={type} delay={delay}
                className={className} {...props}>{children}</TransitionContent>}
        </AnimatePresence>
    );
}

function TransitionContent({ children, type = 'fade', delay = 0, style, ...props }: TransitionProps) {
    const isPresent = useIsPresent();
    const reduceMotion = usePrefersReducedMotion();
    const variants = {
        fade: fadeVariants,
        slide: slideUpVariants,
        scale: scaleVariants,
    };

    return (
        <motion.div
            {...props}
            inert={!isPresent}
            aria-hidden={!isPresent || undefined}
            style={{ ...style, pointerEvents: isPresent ? style?.pointerEvents : 'none' }}
            initial="hidden"
            animate="visible"
            exit="hidden"
            variants={reduceMotion ? fadeVariants : variants[type]}
            transition={{
                ...motionTransitions.panel,
                duration: reduceMotion ? 0 : motionTransitions.panel.duration,
                delay: reduceMotion ? 0 : delay,
            }}
        >
            {children}
        </motion.div>
    );
}
