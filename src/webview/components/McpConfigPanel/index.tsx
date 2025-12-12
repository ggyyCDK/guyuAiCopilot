import React, { useState } from 'react';
import { Switch } from 'antd';
import styles from './index.module.scss';
import { IMcpServer } from '@/mcp/mcpType';

interface McpConfigPanelProps {
  servers: IMcpServer[];
  onBack: () => void;
  onServerUpdate: (servers: IMcpServer[]) => void;
}

const McpConfigPanel: React.FC<McpConfigPanelProps> = ({ servers, onBack, onServerUpdate }) => {
  const [expandedServer, setExpandedServer] = useState<string | null>(null);

  const toggleServer = (name: string) => {
    setExpandedServer((prev) => (prev === name ? null : name));
  };

  const handleToggleServerStatus = (serverName: string, checked: boolean) => {
    // 阻止事件冒泡，防止触发卡片展开
    event?.stopPropagation();

    // 更新父组件的 mcpServers 状态
    const updatedServers = servers.map(server =>
      server.name === serverName
        ? { ...server, disabled: !checked }
        : server
    );
    onServerUpdate(updatedServers);
  };

  const handleToggleToolStatus = (serverName: string, toolName: string, checked: boolean, e: React.MouseEvent) => {
    // 阻止事件冒泡
    e.stopPropagation();

    // 更新父组件的 mcpServers 状态
    const updatedServers = servers.map(server => {
      if (server.name === serverName) {
        return {
          ...server,
          tools: server.tools?.map(tool =>
            tool.name === toolName
              ? { ...tool, disabled: !checked }
              : tool
          ) || []
        };
      }
      return server;
    });
    onServerUpdate(updatedServers);
  };

  return (
    <div className={styles.mcpPanel}>
      {/* <div className={styles.mcpPanelHeader}>
        <div>
          <div className={styles.mcpPanelTitle}>MCP 配置</div>
          <div className={styles.mcpPanelDesc}>查看已加载的 MCP 服务及其可用工具</div>
        </div>
        <div className={styles.mcpBackButton} onClick={onBack}>← 返回聊天</div>
      </div> */}

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
                  <div className={styles.mcpCardLeft}>
                    <div className={styles.mcpName}>{server.name}</div>
                    <div className={styles.mcpMeta}>
                      {tools.length} 个工具
                    </div>
                  </div>
                  <div className={styles.mcpCardRight}>
                    <Switch
                      checked={!disabled}
                      onChange={(checked) => handleToggleServerStatus(server.name, checked)}
                      onClick={(_, e) => e.stopPropagation()}
                      checkedChildren="启用"
                      unCheckedChildren="禁用"
                      className={styles.mcpSwitch}
                    />
                    <div className={`${styles.mcpStatus} ${disabled ? styles.mcpStatusDisabled : styles.mcpStatusActive}`}>
                      {disabled ? '已关闭' : '运行中'}
                    </div>
                  </div>
                </div>

                {isExpanded && (
                  <div className={styles.mcpTools}>
                    {tools.length === 0 ? (
                      <div className={styles.mcpToolEmpty}>暂无可用工具</div>
                    ) : (
                      tools.map((tool) => {
                        const toolDisabled = !!tool.disabled;
                        return (
                          <div
                            key={tool.name}
                            className={`${styles.mcpToolItem} ${toolDisabled ? styles.mcpToolItemDisabled : ''}`}
                          >
                            <div className={styles.mcpToolLeft}>
                              <div className={styles.mcpToolName}>{tool.name || '未命名工具'}</div>
                              {tool.description && <div className={styles.mcpToolDesc}>{tool.description}</div>}
                            </div>
                            <Switch
                              size="small"
                              checked={!toolDisabled}
                              onChange={(checked, e) => handleToggleToolStatus(server.name, tool.name, checked, e as any)}
                              onClick={(_, e) => e.stopPropagation()}
                              className={styles.mcpToolSwitch}
                            />
                          </div>
                        );
                      })
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