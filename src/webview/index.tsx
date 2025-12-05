import React, { useEffect, useMemo, useState } from 'react';
import ReactDom from 'react-dom';
import { useIMStore } from '@/store/imStore/createStore'
import { ChatMessage, MessageStatus, MessageType } from '@/type/imType/im'
import { transformServerMessage } from '@/utils/llmRequest/transformServerMessage'
import { useAutoScroll } from '@/hooks/useAutoScroll';
import { ChatMessageUtils } from '@/utils/llmUtils/chat/chatMessageUtils';
import { Input } from 'antd';
import { SettingOutlined } from '@ant-design/icons'
import { uniqueId } from 'lodash'
import MessageContent from './components/messageContent'
import SettingsPanel from './components/SettingsPanel'
import TokenProgress from './components/TokenProgress'
import TodoFloatingPanel from './components/TodoFloatingPanel'
import styles from './index.module.scss';

interface ISidebarProps { }

const vscode = (window as any).acquireVsCodeApi();
// 将 vscode 实例挂载到 window 对象，供其他组件使用
(window as any).vscode = vscode;

const SETTINGS_STORAGE_KEY = 'schoober-ai-settings';

type ViewMode = 'chat' | 'settings';

const Sidebar: React.FC<ISidebarProps> = () => {
  const [error, setError] = useState<string>('');
  const [question, setQuestion] = useState<string>('');
  const [ak, setAk] = useState<string>('');
  const [apiUrl, setApiUrl] = useState<string>('');
  const [viewMode, setViewMode] = useState<ViewMode>('chat');
  const [isComposing, setIsComposing] = useState<boolean>(false);
  const { chatMessages, chatLoading, totalTokens, todoList, mergeMessages, getLastMessage } = useIMStore()
  const { containerRef, shouldAutoScroll } = useAutoScroll([chatMessages])
  const lastMessage = getLastMessage()

  // 为当前会话窗口生成唯一的 conversationId，在组件生命周期内保持不变
  const conversationId = useMemo(() => {
    return `conversation_${new Date().getTime()}_${uniqueId()}`
  }, [])
  useEffect(() => {
    window.addEventListener('message', providerMessageHandler);
    return () => {
      window.removeEventListener('message', providerMessageHandler);
    };
  }, []);

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

  /**
   * 处理 provider 发送过来的请求
   * @param event
   * @returns
   */
  const providerMessageHandler = function (event: any) {
    const data = event.data;
    const { type, payload } = data;

    switch (type) {
      case 'stream-data':
        const { serverMessageList } = payload
        mergeMessages(serverMessageList.map(transformServerMessage))
        break;

      case 'update-loading':
        // 更新 loading 状态
        useIMStore.setState({
          chatLoading: payload.chatLoading
        });
        break;

      case 'update-tokens':
        // 更新为最新的 token 数（不是累加）
        const { totalTokens: newTokens } = payload;
        useIMStore.setState({
          totalTokens: newTokens
        });
        break;

      case 'stream-error':
        console.error('Stream error:', payload.error);
        setError(payload.error);
        break;

      case 'update-todo-list':
        // 更新待办事项列表
        console.log('更新待办事项列表 is', todoList)
        useIMStore.setState({
          todoList: payload.todoList || []
        });
        break;
    }
  };
  console.log('todoList is', todoList)
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

  console.log(chatMessages, 'chatMessages666')
  return (
    <>
      <div className={styles.aiLayout}>
        <div className={styles.appHeader}>
          <div className={styles.headerRow}>
            <div>
              <div className={styles.appTitle}>✨ SchooberAi</div>
              <div className={styles.appSubtitle}>智能编程助手，随时为您解答技术问题</div>
            </div>
            <div
              className={styles.setting}
              onClick={() => setViewMode(viewMode === 'chat' ? 'settings' : 'chat')}
            >
              {viewMode === 'chat' ? <SettingOutlined /> : '← 返回'}
            </div>
          </div>
          {viewMode === 'chat' && (
            <>
              <div className={styles.configSummary}>
                {configSummaries.map((item) => (
                  <div key={item.label} className={styles.configSummaryPill}>
                    {item.type === 'progress' ? (
                      <TokenProgress current={totalTokens} limit={TOKEN_LIMIT} />
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
                disabled={chatLoading}
                className={styles.questionInput}
              />
            </div>
          </>
        ) : (
          <SettingsPanel
            ak={ak}
            apiUrl={apiUrl}
            onAkChange={setAk}
            onApiUrlChange={setApiUrl}
            onBack={() => setViewMode('chat')}
          />
        )}
      </div>
    </>
  );
};

ReactDom.render(<Sidebar />, document.getElementById('root'));