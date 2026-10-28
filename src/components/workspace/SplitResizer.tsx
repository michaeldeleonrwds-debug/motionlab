import React, { useCallback, useEffect, useRef, useState } from 'react';

interface SplitResizerProps {
  direction: 'horizontal' | 'vertical'; // 'horizontal' divides left/right (resizes width), 'vertical' divides top/bottom (resizes height)
  onResize: (delta: number) => void;
  onReset?: () => void;
  className?: string;
}

export const SplitResizer: React.FC<SplitResizerProps> = ({
  direction,
  onResize,
  onReset,
  className = '',
}) => {
  const [isDragging, setIsDragging] = useState(false);
  const startPosRef = useRef<number>(0);

  const handleMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    setIsDragging(true);
    startPosRef.current = direction === 'horizontal' ? e.clientX : e.clientY;
  };

  const handleDoubleClick = (e: React.MouseEvent) => {
    e.preventDefault();
    if (onReset) {
      onReset();
    }
  };

  const handleMouseMove = useCallback(
    (e: MouseEvent) => {
      if (!isDragging) return;
      const currentPos = direction === 'horizontal' ? e.clientX : e.clientY;
      const delta = currentPos - startPosRef.current;
      startPosRef.current = currentPos;
      onResize(delta);
    },
    [direction, isDragging, onResize]
  );

  const handleMouseUp = useCallback(() => {
    setIsDragging(false);
  }, []);

  useEffect(() => {
    if (isDragging) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
      document.body.style.userSelect = 'none';
      document.body.style.cursor =
        direction === 'horizontal' ? 'col-resize' : 'row-resize';
    } else {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
      document.body.style.userSelect = '';
      document.body.style.cursor = '';
    }

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
      document.body.style.userSelect = '';
      document.body.style.cursor = '';
    };
  }, [direction, handleMouseMove, handleMouseUp, isDragging]);

  const isH = direction === 'horizontal';

  return (
    <div
      role="separator"
      aria-orientation={isH ? 'vertical' : 'horizontal'}
      data-testid={`split-resizer-${direction}`}
      onMouseDown={handleMouseDown}
      onDoubleClick={handleDoubleClick}
      title="Drag to resize panel, double-click to reset"
      className={`relative select-none z-20 group transition-colors flex items-center justify-center shrink-0 ${
        isH
          ? 'w-[5px] -mx-[2px] cursor-col-resize hover:bg-[#8B82F6]/50 active:bg-[#8B82F6]'
          : 'h-[5px] -my-[2px] cursor-row-resize hover:bg-[#8B82F6]/50 active:bg-[#8B82F6]'
      } ${isDragging ? 'bg-[#8B82F6]' : 'bg-transparent'} ${className}`}
    >
      {/* Subtle grip line */}
      <div
        className={`pointer-events-none rounded-full transition-colors ${
          isH
            ? 'w-[1px] h-6 group-hover:h-10 group-hover:w-[2px] group-hover:bg-[#8B82F6]'
            : 'h-[1px] w-6 group-hover:w-10 group-hover:h-[2px] group-hover:bg-[#8B82F6]'
        } ${isDragging ? 'bg-[#8B82F6]' : 'bg-[#2A3341]/60'}`}
      />
    </div>
  );
};
