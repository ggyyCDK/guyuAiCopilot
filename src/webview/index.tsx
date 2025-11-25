import React, { useEffect, useState } from 'react';
import ReactDom from 'react-dom';
import { useIMStore } from '@/store/imStore/createStore'
import { ChatMessage, MessageStatus, MessageType } from '@/type/imType/im'
import { transformServerMessage } from '@/utils/llmRequest/transformServerMessage'
import { useAutoScroll } from '@/hooks/useAutoScroll';
import { ChatMessageUtils } from '@/utils/llmUtils/chat/chatMessageUtils';
import { Input } from 'antd';
import { uniqueId } from 'lodash'
import MessageContent from './components/messageContent'
import './index.css';

interface ISidebarProps { }

const vscode = (window as any).acquireVsCodeApi();

const Sidebar: React.FC<ISidebarProps> = () => {
  const [error, setError] = useState<string>('');
  const [question, setQuestion] = useState<string>('');
  const [ak, setAk] = useState<string>('');
  const [apiUrl, setApiUrl] = useState<string>('');
  const { chatMessages, chatLoading, mergeMessages, getLastMessage } = useIMStore()
  const { containerRef } = useAutoScroll([chatMessages])
  const lastMessage = getLastMessage()
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



      case 'stream-error':
        console.error('Stream error:', payload.error);
        setError(payload.error);
        break;
    }
  };
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
    vscode.postMessage({
      type: 'stream-chat',
      payload: {
        question,
        conversationId: 'GUYUTEST1',
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
    // 如果按下 Enter 且没有按住 Shift，则发送消息
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault(); // 阻止换行
      handleSend();
    }
  };

  const renderLLMMessage = (message: ChatMessage, index: number) => {
    // const isUserMessage = ChatMessageUtils.isUserMessage(message);

    return <div className='messageWrapper'>
      <MessageContent message={message}></MessageContent>
    </div>
  }

  console.log(chatMessages, 'chatMessages666')
  return (
    <>
      <div className='aiLayout'>
        <div className="app-header">
          <div className="app-title">✨ SchooberAi 助手</div>
          <div className="app-subtitle">智能编程助手，随时为您解答技术问题</div>
        </div>

        {/* 输出内容区域 */}
        <div className="content-area" ref={containerRef}>
          {error && (
            <div className="error-message">
              错误: {error}
            </div>
          )}

          {/* 打字机效果的流式文本 */}

          {
            chatMessages?.length > 0 && <div className="stream-text-container" >
              <div className="stream-text-content" >
                {chatMessages.map(renderLLMMessage)}
              </div>
              {
                chatLoading && <div className="fade">generating...</div>
              }
            </div>
          }


        </div>

        <div className="input-container">
          <div className="config-inputs">
            {/* <Input
              placeholder="请输入访问密钥 (AK)"
              value={ak}
              onChange={(e) => setAk(e.target.value)}
              className="config-input"
            />
            <Input
              placeholder="请输入 API 服务地址"
              value={apiUrl}
              onChange={(e) => setApiUrl(e.target.value)}
              className="config-input"
            /> */}
          </div>
          <Input.TextArea
            style={{ color: '#fff' }}
            placeholder="请输入你的问题，比如：如何优化这段代码？（按 Enter 发送，Shift+Enter 换行）"
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            onKeyDown={handleKeyDown}
            autoSize={{ minRows: 3, maxRows: 6 }}
            disabled={chatLoading}
            className="question-input"
          />
        </div>
      </div>
    </>
  );
};

ReactDom.render(<Sidebar />, document.getElementById('root'));
