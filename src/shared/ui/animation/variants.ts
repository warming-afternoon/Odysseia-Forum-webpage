import { Variants } from 'motion/react';

export const motionTransitions = {
    fast: { duration: 0.12, ease: [0.2, 0, 0, 1] },
    panel: { duration: 0.18, ease: [0.2, 0, 0, 1] },
    layout: { duration: 0.2, ease: [0.2, 0, 0, 1] },
} as const;

// 弹簧物理配置
export const springs = {
    stiff: { type: "spring", stiffness: 300, damping: 20 } as const, // 硬朗，适合小元素
    soft: { type: "spring", stiffness: 100, damping: 20 } as const,  // 柔和，适合大布局
    bouncy: { type: "spring", stiffness: 400, damping: 10 } as const, // Q弹，适合强调
    gentle: { type: "spring", stiffness: 120, damping: 14 } as const, // 温和，通用
};

// 通用变体
export const fadeVariants: Variants = {
    hidden: { opacity: 0 },
    visible: { opacity: 1 },
};

export const slideUpVariants: Variants = {
    hidden: { opacity: 0, y: 8 },
    visible: { opacity: 1, y: 0 },
};

export const scaleVariants: Variants = {
    hidden: { opacity: 0, scale: 0.98, y: 6 },
    visible: { opacity: 1, scale: 1, y: 0 },
};

// 列表容器变体（用于子元素交错动画）
