import React, { FC } from 'react';
import { Input } from 'antd';
import styles from './index.module.scss';

interface SettingsPanelProps {
  ak: string;
  apiUrl: string;
  onAkChange: (value: string) => void;
  onApiUrlChange: (value: string) => void;
  onBack: () => void;
}

const SettingsPanel: FC<SettingsPanelProps> = ({
  ak,
  apiUrl,
  onAkChange,
  onApiUrlChange,
  onBack
}) => {
  return (
    <div className={styles.settingsPage}>
      <div className={styles.settingsCard}>
        <h2 className={styles.settingsTitle}>接口配置</h2>
        <p className={styles.settingsDesc}>配置访问密钥以及请求地址后即可返回主界面继续聊天。</p>

        <label className={styles.settingsLabel}>访问密钥 (AK)</label>
        <Input
          placeholder='请输入访问密钥 (AK)'
          value={ak}
          onChange={(e) => onAkChange(e.target.value)}
          className={styles.configInput}
        />

        <label className={styles.settingsLabel}>API 服务地址</label>
        <Input
          placeholder='请输入 API 服务地址'
          value={apiUrl}
          onChange={(e) => onApiUrlChange(e.target.value)}
          className={styles.configInput}
        />

        <div className={styles.settingsActions}>
          <button className={styles.settingsBackButton} onClick={onBack}>
            返回主界面
          </button>
        </div>
      </div>
    </div>
  )
}

export default SettingsPanel;

