import React, { useEffect, useRef, useState } from 'react';
import { motion, animate, AnimatePresence } from 'motion/react';

interface AnimatedWalletBalanceProps {
  balance: number;
  className?: string;
  showDiffBadge?: boolean;
}

export const AnimatedWalletBalance: React.FC<AnimatedWalletBalanceProps> = ({
  balance,
  className = '',
  showDiffBadge = true,
}) => {
  const safeBalance = typeof balance === 'number' && !isNaN(balance) ? balance : 0;

  // Real-time displayed numerical value for the smooth animation frames
  const [displayValue, setDisplayValue] = useState<number>(safeBalance);
  const currentValRef = useRef<number>(safeBalance);

  // Directional update tracker for up/down badges and color highlights
  const [diffInfo, setDiffInfo] = useState<{
    amount: number;
    type: 'up' | 'down';
    id: number;
  } | null>(null);

  // Guard against initial mount counting from 0
  const isFirstMountRef = useRef<boolean>(true);

  useEffect(() => {
    if (isFirstMountRef.current) {
      isFirstMountRef.current = false;
      currentValRef.current = safeBalance;
      setDisplayValue(safeBalance);
      return;
    }

    const from = currentValRef.current;
    const to = safeBalance;

    // Negligible difference - ignore
    if (Math.abs(from - to) < 0.005) {
      currentValRef.current = to;
      setDisplayValue(to);
      return;
    }

    const diff = to - from;
    const isUp = diff > 0;

    if (showDiffBadge) {
      setDiffInfo({
        amount: Math.abs(diff),
        type: isUp ? 'up' : 'down',
        id: Date.now(),
      });
    }

    // Smooth count up / down animation via motion's animate
    const controls = animate(from, to, {
      duration: 0.85,
      ease: [0.16, 1, 0.3, 1], // easeOutExpo
      onUpdate: (latest) => {
        currentValRef.current = latest;
        setDisplayValue(latest);
      },
      onComplete: () => {
        currentValRef.current = to;
        setDisplayValue(to);
      },
    });

    // Auto-dismiss the transient difference pill
    const timer = setTimeout(() => {
      setDiffInfo(null);
    }, 1800);

    return () => {
      controls.stop();
      clearTimeout(timer);
    };
  }, [safeBalance, showDiffBadge]);

  return (
    <div className={`relative inline-flex items-center ${className}`}>
      {/* Floating diff bubble (+ $10.00 or - $5.00) */}
      <AnimatePresence>
        {diffInfo && showDiffBadge && (
          <motion.div
            key={diffInfo.id}
            initial={{ opacity: 0, y: diffInfo.type === 'up' ? 6 : -6, scale: 0.8 }}
            animate={{ opacity: 1, y: diffInfo.type === 'up' ? -20 : 20, scale: 1 }}
            exit={{ opacity: 0, y: diffInfo.type === 'up' ? -28 : 28, scale: 0.7 }}
            transition={{ duration: 0.35, ease: 'easeOut' }}
            className={`absolute right-0 pointer-events-none text-[9px] sm:text-[10px] font-price font-extrabold px-1.5 py-0.5 rounded-full shadow-lg border whitespace-nowrap z-30 flex items-center gap-0.5 ${
              diffInfo.type === 'up'
                ? 'bg-[#11131A] text-[#3ECF8E] border-[#3ECF8E]/50 shadow-[0_0_12px_rgba(62,207,142,0.4)]'
                : 'bg-[#11131A] text-[#E8433F] border-[#E8433F]/50 shadow-[0_0_12px_rgba(232,67,63,0.4)]'
            }`}
          >
            <span>{diffInfo.type === 'up' ? '+' : '-'}</span>
            <span>${diffInfo.amount.toFixed(2)}</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Numerical counter with reactive color pulse & spring scaling */}
      <motion.span
        key={diffInfo ? `diff-${diffInfo.type}-${diffInfo.id}` : 'stable-num'}
        animate={
          diffInfo
            ? {
                scale: [1, 1.15, 1],
                color:
                  diffInfo.type === 'up'
                    ? ['#ffb230', '#3ECF8E', '#ffd7a1']
                    : ['#ffb230', '#ff8e8b', '#ffd7a1'],
              }
            : {
                scale: 1,
                color: '#ffd7a1',
              }
        }
        transition={{ duration: 0.6, ease: 'easeOut' }}
        className="font-bold text-xs sm:text-sm tabular-nums tracking-tight select-none inline-block"
      >
        ${displayValue.toFixed(2)}
      </motion.span>
    </div>
  );
};
