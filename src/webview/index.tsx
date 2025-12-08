import React, { useEffect, useMemo, useState } from 'react';
import ReactDom from 'react-dom';
import { useIMStore } from '@/store/imStore/createStore'
import { ChatMessage, MessageStatus, MessageType } from '@/type/imType/im'
import { useAutoScroll } from '@/hooks/useAutoScroll';
import { ChatMessageUtils } from '@/utils/llmUtils/chat/chatMessageUtils';
import { Input } from 'antd';
import { SettingOutlined, SendOutlined, PoweroffOutlined, HistoryOutlined } from '@ant-design/icons'
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

type ViewMode = 'chat' | 'settings' | 'history';

const Sidebar: React.FC<ISidebarProps> = () => {
  const [error, setError] = useState<string>('');
  const [question, setQuestion] = useState<string>('');
  const [ak, setAk] = useState<string>('');
  const [apiUrl, setApiUrl] = useState<string>('');
  const [viewMode, setViewMode] = useState<ViewMode>('chat');
  const [isComposing, setIsComposing] = useState<boolean>(false);

  const { chatMessages, chatLoading, compressing, totalTokens, todoList, mergeMessages, getLastMessage, initData, conversationId } = useIMStore()
  const { containerRef } = useAutoScroll([chatMessages])
  const lastMessage = getLastMessage()

  useEffect(() => {
    const providerMessageHandler = createProviderMessageHandler(setError);

    window.addEventListener('message', providerMessageHandler);

    // 监听本地消息用于切换视图
    const handleLocalMessage = (event: MessageEvent) => {
      if (event.data && event.data.type === 'switch-view') {
        const { view, conversationId: newConversationId } = event.data.payload;
        setViewMode(view);
        // 如果需要更新 conversationId，可能需要一种方式来通知组件或者 store
        // 由于 conversationId 是 useMemo 生成的，这里直接修改可能不生效，
        // 除非我们将 conversationId 放入 store 或者 state 中管理
        // 目前简单实现切换视图
      }
    };
    window.addEventListener('message', handleLocalMessage);

    initData();

    return () => {
      window.removeEventListener('message', providerMessageHandler);
      window.removeEventListener('message', handleLocalMessage);
    };
  }, []);

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
              <div
                className={styles.setting}
                onClick={() => setViewMode(viewMode === 'chat' ? 'history' : 'chat')}
                title="历史对话"
                style={{ marginRight: '12px' }}
              >
                {viewMode === 'chat' ? <HistoryOutlined /> : null}
              </div>
              <div
                className={styles.setting}
                onClick={() => setViewMode(viewMode === 'chat' ? 'settings' : 'chat')}
                title="设置"
              >
                {viewMode === 'chat' ? <SettingOutlined /> : '← 返回'}
              </div>
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
        ) : (
          <HistoryPanel
            conversationId={conversationId}
            onBack={() => setViewMode('chat')}
          />
        )}
      </div>
    </>
  );
};

ReactDom.render(<Sidebar />, document.getElementById('root'));