import { useEffect, useRef } from 'react';

export const useAutoScroll = (dependencies: any[] = []) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const shouldAutoScrollRef = useRef(true);

  // 监听用户滚轮行为——wheel 事件在 scroll 之前触发，可立即锁定意图
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const handleWheel = (e: WheelEvent) => {
      if (e.deltaY < 0) {
        // 向上滚动：立即停止自动滚动
        shouldAutoScrollRef.current = false;
      }
    };

    let ticking = false;
    const updateScrollState = () => {
      const { scrollTop, scrollHeight, clientHeight } = container;
      const isAtBottom = scrollHeight - scrollTop - clientHeight < 50;
      if (isAtBottom) {
        // 滚动到底部，恢复自动滚动
        shouldAutoScrollRef.current = true;
      }
      ticking = false;
    };

    const handleScroll = () => {
      if (!ticking) {
        requestAnimationFrame(updateScrollState);
        ticking = true;
      }
    };

    container.addEventListener('wheel', handleWheel, { passive: true });
    container.addEventListener('scroll', handleScroll, { passive: true });
    return () => {
      container.removeEventListener('wheel', handleWheel);
      container.removeEventListener('scroll', handleScroll);
    };
  }, []);

  // 自动滚动到底部
  useEffect(() => {
    const container = containerRef.current;
    if (!container || !shouldAutoScrollRef.current) return;

    requestAnimationFrame(() => {
      if (!shouldAutoScrollRef.current) return;
      container.scrollTop = container.scrollHeight;
    });
  }, [dependencies]);

  return {
    containerRef,
    shouldAutoScroll: shouldAutoScrollRef.current,
  };
};