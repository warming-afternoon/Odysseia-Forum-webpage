import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { MASCOT_IMAGES } from '@/features/mascot/assets';
import { useOnboardingStore } from '../store/useOnboardingStore';

export function OnboardingBalloon() {
  const { activeTutorial, stepIndex, nextStep, skipTutorial } = useOnboardingStore();
  const [coords, setCoords] = useState<{ top: number; left: number; width: number; height: number } | null>(null);
  const [windowSize, setWindowSize] = useState({ width: window.innerWidth, height: window.innerHeight });
  const step = activeTutorial?.steps[stepIndex];

  useEffect(() => {
    const handleResize = () => {
      setWindowSize({ width: window.innerWidth, height: window.innerHeight });
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => {
    if (!step?.target) {
      setCoords(null);
      return;
    }

    const updateCoords = () => {
      const el = document.querySelector(step.target!);
      if (el) {
        const rect = el.getBoundingClientRect();
        setCoords({
          top: rect.top,
          left: rect.left,
          width: rect.width,
          height: rect.height,
        });
        // 自动滚动到目标，稍微偏移一点点
        el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      } else {
        // 如果元素没找到，清除坐标，气泡会降级到居中显示
        setCoords(null);
      }
    };

    // 初始执行
    updateCoords();
    
    // 定时轮询，防止某些动态渲染的组件还没加载出来
    const timer = setInterval(updateCoords, 500);
    
    return () => clearInterval(timer);
  }, [step, windowSize]);

  if (!activeTutorial || !step) return null;

  const imageSrc = MASCOT_IMAGES[step.emotion || 'hi'] || MASCOT_IMAGES.hi;

  const isMobile = windowSize.width < 640;
  
  // 计算实际方位
  let effectivePlacement = step.placement;
  if (isMobile) {
    effectivePlacement = 'bottom'; // 移动端固定逻辑
  } else if (coords) {
    // 桌面端智能避障：如果顶部空间不足则翻转到下方，反之亦然
    const balloonHeightEstimate = 250; // 预估气泡高度
    if (effectivePlacement === 'top' && coords.top < balloonHeightEstimate) {
      effectivePlacement = 'bottom';
    } else if (effectivePlacement === 'bottom' && coords.top + coords.height + balloonHeightEstimate > windowSize.height) {
      effectivePlacement = 'top';
    }
  }

  // 计算气泡位置逻辑
  const getBalloonStyle = () => {
    const balloonWidth = isMobile ? Math.min(windowSize.width - 48, 300) : Math.min(windowSize.width - 32, 340);
    
    // 移动端：固定在中上方
    if (isMobile) {
      return {
        top: '80px', // TopBar 下方
        left: '50%',
      };
    }

    if (!coords || step.placement === 'center') {
      return {
        top: '50%',
        left: '50%',
      };
    }

    const margin = 24;
    
    // 计算理想中心位置
    const targetCenterX = coords.left + coords.width / 2;
    
    const calculateClampedLeft = (idealLeft: number) => {
      return Math.max(16, Math.min(idealLeft, windowSize.width - balloonWidth - 16));
    };

    switch (effectivePlacement) {
      case 'right': {
        const left = coords.left + coords.width + margin;
        const clampedLeft = Math.min(left, windowSize.width - balloonWidth - 16);
        return { top: coords.top + coords.height / 2, left: clampedLeft };
      }
      case 'left': {
        const left = coords.left - balloonWidth - margin;
        const clampedLeft = Math.max(16, left);
        return { top: coords.top + coords.height / 2, left: clampedLeft };
      }
      case 'top': {
        const left = calculateClampedLeft(targetCenterX - balloonWidth / 2);
        return { top: coords.top - margin, left };
      }
      case 'bottom':
      default: {
        const left = calculateClampedLeft(targetCenterX - balloonWidth / 2);
        return { top: coords.top + coords.height + margin, left };
      }
    }
  };

  const balloonStyle = getBalloonStyle();
  const balloonWidth = isMobile ? Math.min(windowSize.width - 48, 300) : Math.min(windowSize.width - 32, 340);
  const isCenter = !coords || step.placement === 'center';

  // 计算小尖角的横向位置（当气泡在上下方时）
  const getArrowLeft = () => {
    if (!coords || isCenter) return '50%';
    const targetCenterX = coords.left + coords.width / 2;
    const balloonLeft = typeof balloonStyle.left === 'number' ? balloonStyle.left : 0;
    // 限制在气泡范围内，且避开圆角
    const arrowPos = targetCenterX - balloonLeft;
    return Math.max(32, Math.min(arrowPos, balloonWidth - 32));
  };

  const mascotOnLeft = step.id.includes('filter');

  return (
    <div className="fixed inset-0 z-[9999] pointer-events-none">
      {/* 遮罩层 (SVG Mask 实现高亮) */}
      <AnimatePresence>
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ 
            opacity: 1,
            clipPath: coords && !isCenter
              ? `path('M0,0 H${windowSize.width} V${windowSize.height} H0 Z M${coords.left - 6},${coords.top - 6} V${coords.top + coords.height + 6} H${coords.left + coords.width + 6} V${coords.top - 6} Z')`
              : 'none'
          }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.25, ease: 'easeOut' }}
          className={`absolute inset-0 bg-black/65 transition-opacity duration-300 ${coords ? 'pointer-events-auto' : 'pointer-events-none opacity-0'} backdrop-blur-[2px]`}
          onClick={() => !coords && skipTutorial()}
        />
      </AnimatePresence>

      {/* 引导内容容器 */}
      <motion.div
        key={step.id}
        initial={{ opacity: 0, scale: 0.95, y: 15, x: (isMobile || isCenter) ? '-50%' : '0%' }}
        animate={{ 
          opacity: 1, 
          scale: 1, 
          y: isMobile ? 0 : (effectivePlacement === 'top' ? '-100%' : (effectivePlacement === 'left' || effectivePlacement === 'right' ? '-50%' : 0)), 
          x: (isMobile || isCenter) ? '-50%' : '0%',
          transformOrigin: isMobile ? 'center top' : (effectivePlacement === 'top' ? 'center bottom' : (effectivePlacement === 'bottom' ? 'center top' : 'center center'))
        }}
        exit={{ opacity: 0, scale: 0.95, y: 15, x: (isMobile || isCenter) ? '-50%' : '0%' }}
        transition={{ type: 'spring', damping: 30, stiffness: 450, mass: 0.8 }}
        className={`absolute pointer-events-auto flex ${isMobile ? 'flex-col' : 'flex-col-reverse'} items-center w-[calc(100vw-2rem)] max-w-[340px] sm:max-w-[340px] ${isMobile ? 'max-w-[300px]' : ''}`}
        style={{
          ...balloonStyle,
          viewTransitionName: 'onboarding-balloon'
        } as any}
      >
        <div className="relative group w-full">
          {/* 看板娘图片 (探头动效) */}
          <motion.div
            initial={{ 
              x: isMobile ? 0 : (mascotOnLeft ? -15 : 15), 
              y: isMobile ? 15 : 0, 
              opacity: 0, 
              rotate: isMobile ? 0 : (mascotOnLeft ? -8 : 8) 
            }}
            animate={{ x: 0, y: 0, opacity: 1, rotate: 0 }}
            transition={{ duration: 0.2, delay: 0.1 }}
            className={`absolute ${
              isMobile 
                ? 'left-1/2 -translate-x-1/2 -bottom-16 w-20 h-20' 
                : (mascotOnLeft ? '-left-12 sm:-left-40' : '-right-12 sm:-right-40') + ' top-1/2 -translate-y-1/2 w-24 h-24 sm:w-48 sm:h-48'
            } pointer-events-none z-20`}
          >
            <img
              src={imageSrc}
              alt="Mascot"
              className={`w-full h-full object-contain drop-shadow-[0_20px_50px_rgba(0,0,0,0.3)] ${isMobile ? '' : 'animate-bounce-slow'}`}
            />
          </motion.div>

          {/* 气泡对话框 */}
          <div className={`od-floating-panel-solid relative w-full rounded-3xl ${isMobile ? 'p-4' : 'p-5 sm:p-6'} border border-white/20 shadow-[0_32px_64px_-16px_rgba(0,0,0,0.5)] z-10 bg-(--od-bg-secondary)`}>
            <div className="flex items-center gap-2 mb-3">
               <span className="px-2 py-0.5 rounded-full bg-(--od-accent)/20 text-(--od-accent) text-[10px] font-bold uppercase tracking-wider">
                 Step {stepIndex + 1}/{activeTutorial.steps.length}
               </span>
               <h3 className={`text-(--od-text-primary) font-bold ${isMobile ? 'text-sm' : 'text-base sm:text-lg'}`}>{step.title}</h3>
            </div>

            <p className={`text-(--od-text-secondary) ${isMobile ? 'text-[11px]' : 'text-xs sm:text-sm'} leading-relaxed mb-6 sm:mb-8`}>
              {step.content}
            </p>

            <div className="flex items-center justify-between gap-4 sm:gap-6">
              <button
                onClick={skipTutorial}
                className="text-[10px] sm:text-xs text-(--od-text-tertiary) hover:text-(--od-text-primary) transition-colors px-2 py-1"
              >
                结束引导
              </button>
              <button
                onClick={nextStep}
                className={`od-button-primary flex-1 sm:flex-none ${isMobile ? 'min-w-[70px] px-3 py-1.5 text-[11px]' : 'min-w-[80px] sm:min-w-[100px] px-4 sm:px-6 py-2 sm:py-2.5 text-xs sm:text-sm'} rounded-xl sm:rounded-2xl font-bold shadow-xl shadow-(--od-accent)/25 active:scale-95 transition-transform`}
              >
                {stepIndex === activeTutorial.steps.length - 1 ? '我知道啦！' : '下一步'}
              </button>
            </div>
          </div>

          {/* 气泡小尖角 (仅桌面端显示) */}
          {!isCenter && !isMobile && (
            <div 
              className="absolute w-4 h-4 sm:w-5 sm:h-5 bg-(--od-bg-secondary) rotate-45 z-10 border border-white/15" 
              style={{
                bottom: step.placement === 'top' ? '-8px' : 'auto',
                top: step.placement === 'bottom' ? '-8px' : 'auto',
                left: (effectivePlacement === 'bottom' || effectivePlacement === 'top') 
                  ? getArrowLeft() 
                  : (effectivePlacement === 'right' ? '-8px' : 'auto'),
                right: effectivePlacement === 'left' ? '-8px' : 'auto',
                transform: (effectivePlacement === 'bottom' || effectivePlacement === 'top') 
                  ? 'translateX(-50%) rotate(45deg)' 
                  : 'rotate(45deg)',
                visibility: coords ? 'visible' : 'hidden'
              }} 
            />
          )}
        </div>
      </motion.div>
    </div>
  );
}
