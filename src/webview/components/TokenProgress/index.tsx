import React from 'react';
import { VerticalAlignMiddleOutlined } from '@ant-design/icons';
import styles from './index.module.scss';

interface TokenProgressProps {
  current: number;
  limit: number;
  onReset?: () => void;
  onCompress?: () => void;
  conversationId?: string;
}

const TokenProgress: React.FC<TokenProgressProps> = ({
  current,
  limit,
  onReset,
  onCompress,
  conversationId
}) => {
  const formatLargeNumber = (num: number): string => {
    if (num >= 1e9) {
      return (num / 1e9).toFixed(1) + 'b';
    }
    if (num >= 1e6) {
      return (num / 1e6).toFixed(1) + 'm';
    }
    if (num >= 1e3) {
      return (num / 1e3).toFixed(1) + 'k';
    }
    return num.toString();
  };

  const handleIconClick = () => {
    // 优先调用压缩方法
    if (onCompress && conversationId) {
      onCompress();
    } else if (onReset) {
      onReset();
    }
  };

  const safeTokens = Math.max(0, current);
  const safeLimit = Math.max(0, limit);

  const tokenPercentage = safeLimit > 0 ? Math.min((safeTokens / safeLimit) * 100, 100) : 0;

  return (
    <div className={styles.tokenProgressContainer}>
      <div className={styles.tokenProgress}>
        <div className={styles.tokenInfo}>
          <span className={styles.tokenCurrent}>{formatLargeNumber(safeTokens)}</span>
          <span className={styles.tokenSeparator}>/</span>
          <span className={styles.tokenLimit}>{formatLargeNumber(safeLimit)}</span>
        </div>
        <div className={styles.progressBarWrapper}>
          <div
            className={styles.progressBarFill}
            style={{ width: `${tokenPercentage}%` }}
          />
        </div>
      </div>
      <div className={styles.resetButton} title="压缩上下文">
        <VerticalAlignMiddleOutlined onClick={handleIconClick} />
      </div>
    </div>
  );
};

export default TokenProgress;