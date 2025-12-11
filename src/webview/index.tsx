import React, { useEffect, useMemo, useState } from 'react';
import ReactDom from 'react-dom';
import { useIMStore } from '@/store/imStore/createStore'
import { ChatMessage, MessageStatus, MessageType } from '@/type/imType/im'
import { useAutoScroll } from '@/hooks/useAutoScroll';
import { ChatMessageUtils } from '@/utils/llmUtils/chat/chatMessageUtils';
import { Input } from 'antd';
import { SettingOutlined, SendOutlined, PoweroffOutlined, HistoryOutlined, ApiOutlined, MessageOutlined } from '@ant-design/icons'
import { uniqueId } from 'lodash'
import MessageContent from './components/messageContent'
import SettingsPanel from './components/SettingsPanel'
import HistoryPanel from './components/HistoryPanel'
import TokenProgress from './components/TokenProgress'
import TodoFloatingPanel from './components/TodoFloatingPanel'
import styles from './index.module.scss';
import { createProviderMessageHandler } from './providerHandler';
import { useSyncChatMessage } from '@/hooks/useSyncChatMessage'
interface ISidebarProps { }
const vscode = (window as any).acquireVsCodeApi();
// 将 vscode 实例挂载到 window 对象，供其他组件使用
(window as any).vscode = vscode;

const SETTINGS_STORAGE_KEY = 'schoober-ai-settings';

type ViewMode = 'chat' | 'settings' | 'history' | 'mcp';

interface McpToolInfo {
  name?: string;
  description?: string;
}

interface McpServerInfo {
  name: string;
  disabled?: boolean;
  tools?: McpToolInfo[];
}

const McpConfigPanel: React.FC<{
  servers: McpServerInfo[];
  onBack: () => void;
}> = ({ servers, onBack }) => {
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

const Sidebar: React.FC<ISidebarProps> = () => {
  const [error, setError] = useState<string>('');
  const [question, setQuestion] = useState<string>('');
  const [ak, setAk] = useState<string>('');
  const [apiUrl, setApiUrl] = useState<string>('');
  const [viewMode, setViewMode] = useState<ViewMode>('chat');
  const [mcpServers, setMcpServers] = useState<any[]>([]);
  const [isComposing, setIsComposing] = useState<boolean>(false);

  const { chatMessages, chatLoading, compressing, totalTokens, todoList, mergeMessages, getLastMessage, initData, conversationId } = useIMStore()
  const { containerRef } = useAutoScroll([chatMessages])
  const lastMessage = getLastMessage()

  useEffect(() => {
    const providerMessageHandler = createProviderMessageHandler(setError);

    window.addEventListener('message', providerMessageHandler);

    // 监听本地消息用于切换视图
    const handleLocalMessage = (event: MessageEvent) => {
      if (event.data?.type === 'switch-view') {
        const { view } = event.data.payload;
        setViewMode(view);
      }

      if (event.data?.type === 'mcp-tools') {
        setMcpServers(event.data.payload?.servers || []);
      }
    };
    window.addEventListener('message', handleLocalMessage);

    // 请求一次当前 MCP 服务器/工具信息
    vscode.postMessage({ type: 'get-mcp-tools', payload: {} });

    initData();

    return () => {
      window.removeEventListener('message', providerMessageHandler);
      window.removeEventListener('message', handleLocalMessage);
    };
  }, []);
  console.log('mcpServers is:', mcpServers)
  // 同步消息至数据库
  useSyncChatMessage(conversationId)
  console.log('当前会话为：', conversationId)
  useEffect(() => {
    if (!lastMessage) {
      return
    }
    if (ChatMessageUtils.isAttemptCompletionMessage(lastMessage)) {
      useIMStore.setState({ chatLoading: false })
    }
  }, [lastMessage])

  useEffect(() => {
    try {
      const storedConfig = localStorage.getItem(SETTINGS_STORAGE_KEY);
      if (storedConfig) {
        const { ak: savedAk = '', apiUrl: savedApiUrl = '' } = JSON.parse(storedConfig);
        setAk(savedAk);
        setApiUrl(savedApiUrl);
      }
    } catch (error) {
      console.warn('读取本地配置失败', error);
    }
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem(
        SETTINGS_STORAGE_KEY,
        JSON.stringify({ ak, apiUrl })
      );
    } catch (error) {
      console.warn('保存本地配置失败', error);
    }
  }, [ak, apiUrl]);

  const nextId = () => {
    return `${new Date().getTime()}_${uniqueId()}`
  }
  const handleSend = () => {
    if (!question.trim()) return;

    useIMStore.setState({
      chatLoading: true,
    })
    const userMsgId = nextId()
    const userMessage: ChatMessage = {
      msgId: userMsgId,
      sender: {
        targetId: 'user'
      },
      status: MessageStatus.Complete,
      sendTime: new Date().getTime(),
      type: MessageType.Text,
      content: question,
      ext: {}
    }
    mergeMessages([userMessage])

    // 发送消息后立即滚动到底部
    setTimeout(() => {
      if (containerRef.current) {
        containerRef.current.scrollTop = containerRef.current.scrollHeight;
      }
    }, 100);

    vscode.postMessage({
      type: 'stream-chat',
      payload: {
        question,
        conversationId: conversationId,
        workerId: 'guyu',
        variableMaps: {
          llmConfig: {
            ak: ak,
            ApiUrl: apiUrl
          }
        },
        baseUrl: 'http://127.0.0.1:7001',
      }
    });
    setQuestion(''); // 发送后清空输入框
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    // 如果按下 Enter 且没有按住 Shift，且不在输入法组合状态，则发送消息
    if (e.key === 'Enter' && !e.shiftKey && !isComposing) {
      e.preventDefault(); // 阻止换行
      handleSend();
    }
  };

  const handleCompositionStart = () => {
    setIsComposing(true);
  };

  const handleCompositionEnd = () => {
    setIsComposing(false);
  };

  // 处理压缩上下文
  const handleCompressContext = () => {
    console.log('开始压缩上下文，conversationId:', conversationId);

    // 设置压缩状态为 true
    useIMStore.setState({ compressing: true });

    // 添加一条系统消息：上下文压缩中...
    const compressingMsgId = `${new Date().getTime()}_compressing`;

    const compressingMessage: ChatMessage = {
      msgId: compressingMsgId,
      sender: {
        targetId: 'llm'
      },
      status: MessageStatus.Complete,
      sendTime: new Date().getTime(),
      type: MessageType.Text,
      content: '🔄 上下文压缩中...',
      ext: {}
    };
    mergeMessages([compressingMessage]);

    vscode.postMessage({
      type: 'compress-context',
      payload: {
        conversationId: conversationId,
        baseUrl: 'http://127.0.0.1:7001',
        apiKey: ak
      }
    });
  };

  const handleCancel = () => {
    vscode.postMessage({
      type: 'cancel-chat',
      payload: {}
    });
    useIMStore.setState({ chatLoading: false });
  };

  const renderLLMMessage = (message: ChatMessage, index: number) => {
    // const isUserMessage = ChatMessageUtils.isUserMessage(message);

    return <div className={styles.messageWrapper}>
      <MessageContent message={message}></MessageContent>
    </div>
  }

  // Token 限制（128k context window）
  const TOKEN_LIMIT = 128000;

  const configSummaries = useMemo(() => {
    return [
      {
        label: 'AK',
        status: ak ? '已配置' : '未设置',
        type: 'text'
      },
      // {
      //   label: 'API',
      //   status: apiUrl ? '已配置' : '未设置',
      //   type: 'text'
      // },
      {
        label: 'Tokens',
        type: 'progress'
      }
    ]
  }, [ak, apiUrl])
  console.log('chatmessage is:', chatMessages)

  const viewTabs: { key: ViewMode; label: React.ReactNode; title: string }[] = [
    { key: 'chat', label: <MessageOutlined />, title: '聊天' },
    { key: 'history', label: <HistoryOutlined />, title: '历史对话' },
    { key: 'mcp', label: <ApiOutlined />, title: 'MCP 配置' },
    { key: 'settings', label: <SettingOutlined />, title: '设置' },
  ];

  return (
    <>
      <div className={styles.aiLayout}>
        <div className={styles.appHeader}>
          <div className={styles.headerRow}>
            <div>
              <div className={styles.appTitle}>✨ SchooberAi</div>
              <div className={styles.appSubtitle}>智能编程助手，随时为您解答技术问题</div>
            </div>
            <div className={styles.actionButtons}>
              {viewTabs.map((tab) => (
                <div
                  key={tab.key}
                  className={`${styles.viewTab} ${viewMode === tab.key ? styles.activeViewTab : ''}`}
                  onClick={() => setViewMode(tab.key)}
                  title={tab.title}
                >
                  {tab.label}
                </div>
              ))}
            </div>
          </div>
          {viewMode === 'chat' && (
            <>
              <div className={styles.configSummary}>
                {configSummaries.map((item) => (
                  <div key={item.label} className={styles.configSummaryPill}>
                    {item.type === 'progress' ? (
                      <TokenProgress
                        current={totalTokens}
                        limit={TOKEN_LIMIT}
                        conversationId={conversationId}
                        onCompress={handleCompressContext}
                      />
                    ) : (
                      <>
                        <span>{item.label}</span>
                        <strong>{item.status}</strong>
                      </>
                    )}
                  </div>
                ))}
              </div>
              {/* 待办事项组件 - 单独一行 */}
              <TodoFloatingPanel todoList={todoList} />
            </>
          )}
        </div>

        {viewMode === 'chat' ? (
          <>
            {/* 输出内容区域 */}
            <div className={styles.contentArea} ref={containerRef}>
              {error && (
                <div className={styles.errorMessage}>
                  错误: {error}
                </div>
              )}

              {/* 打字机效果的流式文本 */}

              {
                chatMessages?.length > 0 && <div className={styles.streamTextContainer} >
                  <div className={styles.streamTextContent} >
                    {chatMessages.map(renderLLMMessage)}
                  </div>
                  {
                    chatLoading && (
                      <div className={styles.fade}>
                        {lastMessage?.type === MessageType.ToolUse ? 'generating...' : 'thinking...'}
                      </div>
                    )
                  }
                </div>
              }


            </div>

            <div className={styles.inputContainer}>
              <Input.TextArea
                style={{ color: '#fff' }}
                placeholder="请输入你的问题，比如：如何优化这段代码？（按 Enter 发送，Shift+Enter 换行）"
                value={question}
                onChange={(e) => setQuestion(e.target.value)}
                onKeyDown={handleKeyDown}
                onCompositionStart={handleCompositionStart}
                onCompositionEnd={handleCompositionEnd}
                autoSize={{ minRows: 3, maxRows: 6 }}
                disabled={chatLoading || compressing}
                className={styles.questionInput}
              />
              <div
                className={`${styles.sendButton} ${(!chatLoading && !question.trim()) ? styles.sendButtonDisabled : ''}`}
                onClick={chatLoading ? handleCancel : handleSend}
                title={chatLoading ? "停止生成" : "发送消息"}
              >
                {chatLoading ? <PoweroffOutlined /> : <SendOutlined />}
              </div>
            </div>
          </>
        ) : viewMode === 'settings' ? (
          <SettingsPanel
            ak={ak}
            apiUrl={apiUrl}
            onAkChange={setAk}
            onApiUrlChange={setApiUrl}
            onBack={() => setViewMode('chat')}
          />
        ) : viewMode === 'history' ? (
          <HistoryPanel
            conversationId={conversationId}
            onBack={() => setViewMode('chat')}
          />
        ) : (
          <McpConfigPanel
            servers={mcpServers}
            onBack={() => setViewMode('chat')}
          />
        )}
      </div>
    </>
  );
};

ReactDom.render(<Sidebar />, document.getElementById('root'));