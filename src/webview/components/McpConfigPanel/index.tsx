import React, { useState } from 'react';
import styles from './index.module.scss';

interface McpToolInfo {
  name?: string;
  description?: string;
}

interface McpServerInfo {
  name: string;
  disabled?: boolean;
  tools?: McpToolInfo[];
}

interface McpConfigPanelProps {
  servers: McpServerInfo[];
  onBack: () => void;
}

const McpConfigPanel: React.FC<McpConfigPanelProps> = ({ servers, onBack }) => {
  const [expandedServer, setExpandedServer] = useState<string | null>(null);

  const toggleServer = (name: string) => {
    setExpandedServer((prev) => (prev === name ? null : name));
  };

  return (
    <div className={styles.mcpPanel}>
      <div className={styles.mcpPanelHeader}>
        <div>
          <div className={styles.mcpPanelTitle}>MCP 配置</div>
          <div className={styles.mcpPanelDesc}>查看已加载的 MCP 服务及其可用工具</div>
        </div>
        <div className={styles.mcpBackButton} onClick={onBack}>← 返回聊天</div>
      </div>

      {servers.length === 0 ? (
        <div className={styles.mcpEmpty}>暂无 MCP 服务，检查 .schoober/mcp.json 配置</div>
      ) : (
        <div className={styles.mcpList}>
          {servers.map((server) => {
            const disabled = !!server.disabled;
            const isExpanded = expandedServer === server.name;
            const tools = server.tools || [];
            return (
              <div
                key={server.name}
                className={`${styles.mcpCard} ${disabled ? styles.mcpCardDisabled : ''}`}
                onClick={() => toggleServer(server.name)}
              >
                <div className={styles.mcpCardHeader}>
                  <div>
                    <div className={styles.mcpName}>{server.name}</div>
                    <div className={styles.mcpMeta}>
                      {disabled ? '已关闭' : '已开启'} · {tools.length} 个工具
                    </div>
                  </div>
                  <div className={`${styles.mcpStatus} ${disabled ? styles.mcpStatusDisabled : styles.mcpStatusActive}`}>
                    {disabled ? '已关闭' : '运行中'}
                  </div>
                </div>

                {isExpanded && (
                  <div className={styles.mcpTools}>
                    {tools.length === 0 ? (
                      <div className={styles.mcpToolEmpty}>暂无可用工具</div>
                    ) : (
                      tools.map((tool) => (
                        <div key={tool.name} className={styles.mcpToolItem}>
                          <div className={styles.mcpToolName}>{tool.name || '未命名工具'}</div>
                          {tool.description && <div className={styles.mcpToolDesc}>{tool.description}</div>}
                        </div>
                      ))
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default McpConfigPanel;