import React from 'react';
import { VerticalAlignMiddleOutlined } from '@ant-design/icons';
import styles from './index.module.scss';

interface TokenProgressProps {
  current: number;
  limit: number;
  onReset?: () => void;
}

/**
 * Token 进度条组件
 * 显示当前使用的 token 数量和总限制，以及进度条
 */
const TokenProgress: React.FC<TokenProgressProps> = ({ current, limit, onReset }) => {
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
      <div className={styles.resetButton}>
        <VerticalAlignMiddleOutlined onClick={onReset} /></div>
    </div>
  );
};

export default TokenProgress;