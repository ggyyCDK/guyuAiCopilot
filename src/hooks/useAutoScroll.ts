import { useEffect, useRef, useState } from 'react';
import throttle from 'lodash/throttle';

export const useAutoScroll = (dependencies: any[] = []) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [shouldAutoScroll, setShouldAutoScroll] = useState(true);
  const lastScrollTopRef = useRef(0);

  // 滚动事件监听
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const handleScroll = throttle(() => {
      const { scrollTop, scrollHeight, clientHeight } = container;
      const isAtBottom = scrollHeight - scrollTop - clientHeight < 50;
      const isScrollingUp = scrollTop < lastScrollTopRef.current;

      lastScrollTopRef.current = scrollTop;

      setShouldAutoScroll(prev => (isScrollingUp ? false : isAtBottom ? true : prev));
    }, 100);

    container.addEventListener('scroll', handleScroll);

    return () => {
      container.removeEventListener('scroll', handleScroll);
      handleScroll.cancel();
    };
  }, []);

  // 自动滚动
  useEffect(() => {
    const scrollToBottom = () => {
      const container = containerRef.current;
      if (container && shouldAutoScroll) {
        container.scrollTop = container.scrollHeight;
        lastScrollTopRef.current = container.scrollTop;
      }
    };

    // 确保 currentCodeVersion 定位后滚动
    setTimeout(() => {
      scrollToBottom();
    }, 300);
  }, [dependencies, shouldAutoScroll]);

  

  return {
    containerRef,
    shouldAutoScroll,
  };
};