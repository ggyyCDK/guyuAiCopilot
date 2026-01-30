import { useEffect, useRef } from 'react';

export const useAutoScroll = (dependencies: any[] = []) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const shouldAutoScrollRef = useRef(true);

  // 监听用户滚动行为
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    let lastScrollTop = container.scrollTop;
    let ticking = false;

    const updateScrollState = () => {
      const { scrollTop, scrollHeight, clientHeight } = container;
      const isAtBottom = scrollHeight - scrollTop - clientHeight < 50;
      const isScrollingUp = scrollTop < lastScrollTop;

      if (isScrollingUp) {
        // 用户向上滚动，停止自动滚动
        shouldAutoScrollRef.current = false;
      } else if (isAtBottom) {
        // 滚动到底部，恢复自动滚动
        shouldAutoScrollRef.current = true;
      }

      lastScrollTop = scrollTop;
      ticking = false;
    };

    const handleScroll = () => {
      if (!ticking) {
        requestAnimationFrame(updateScrollState);
        ticking = true;
      }
    };

    container.addEventListener('scroll', handleScroll, { passive: true });
    return () => container.removeEventListener('scroll', handleScroll);
  }, []);

  // 自动滚动到底部
  useEffect(() => {
    const container = containerRef.current;
    if (!container || !shouldAutoScrollRef.current) return;

    requestAnimationFrame(() => {
      container.scrollTop = container.scrollHeight;
    });
  }, [dependencies]);

  return {
    containerRef,
    shouldAutoScroll: shouldAutoScrollRef.current,
  };
};