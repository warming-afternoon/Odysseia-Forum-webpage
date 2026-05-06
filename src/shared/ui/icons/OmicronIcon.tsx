import { cn } from '@/shared/lib/utils';

interface OmicronIconProps {
  className?: string;
}

/**
 * 静态版 Omicron "O" 图标 —— 与 WordLogoStatic 中第一个字母一致。
 * 带缺口 + 12 点方向能量圆点，无动画。
 */
export function OmicronIcon({ className }: OmicronIconProps) {
  return (
    <svg
      viewBox="0 0 80 80"
      className={cn('overflow-visible', className)}
      fill="none"
      stroke="currentColor"
      strokeWidth="11"
      strokeLinejoin="round"
      strokeLinecap="round"
    >
      {/* 带缺口的 O 环，缺口朝上 (12 点方向) */}
      <g transform="rotate(90 40 40)">
        <path
          d="M 16 40 A 24 24 0 1 0 16 39.99 Z"
          strokeDasharray="113 38"
          strokeDashoffset="132"
        />
      </g>
      {/* 12 点位能量圆点 */}
      <circle cx="40" cy="16" r="6" className="fill-(--od-accent)" stroke="none" />
    </svg>
  );
}
