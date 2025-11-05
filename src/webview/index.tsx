import React, { useEffect, useState } from 'react';
import ReactDom from 'react-dom';

import { Button, Input } from 'antd';
import '@arco-design/web-react/dist/css/arco.css';
import './index.css';

interface ISidebarProps { }

const vscode = (window as any).acquireVsCodeApi();

const Sidebar: React.FC<ISidebarProps> = () => {
  const [streamingText, setStreamingText] = useState<string>('');
  const [otherMessages, setOtherMessages] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>('');
  const [question, setQuestion] = useState<string>('');

  useEffect(() => {
    window.addEventListener('message', providerMessageHandler);
    return () => {
      window.removeEventListener('message', providerMessageHandler);
    };
  }, []);

  /**
   * 处理 provider 发送过来的请求
   * @param event
   * @returns
   */
  const providerMessageHandler = function (event: any) {
    const data = event.data;
    const { type, payload } = data;

    switch (type) {
      case 'stream-start':
        console.log('Stream started');
        setStreamingText('');
        setOtherMessages([]);
        setError('');
        setLoading(true);
        break;

      case 'stream-data':
        console.log('Stream data:', payload.data);

        // 解析数据
        let messageData = payload.data;
        if (typeof messageData === 'string') {
          try {
            messageData = JSON.parse(messageData);
          } catch (e) {
            // 如果无法解析为 JSON，作为其他消息处理
            setOtherMessages(prev => [...prev, messageData]);
            return;
          }
        }

        // 处理 text-delta 类型的消息 - 打字机效果
        if (messageData.type === 'text-delta' && messageData.payload?.text) {
          setStreamingText(prev => prev + messageData.payload.text);
        } else {
          // 其他类型的消息
          setOtherMessages(prev => [...prev, JSON.stringify(messageData)]);
        }
        break;

      case 'stream-end':
        console.log('Stream ended');
        setLoading(false);
        break;

      case 'stream-error':
        console.error('Stream error:', payload.error);
        setError(payload.error);
        setLoading(false);
        break;
    }
  };

  const handleReset = () => {
    setStreamingText('');
    setOtherMessages([]);
    setError('');
  };

  const handleSend = () => {
    if (!question.trim() || loading) return;
    vscode.postMessage({ type: 'test', question });
    setQuestion(''); // 发送后清空输入框
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    // 如果按下 Enter 且没有按住 Shift，则发送消息
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault(); // 阻止换行
      handleSend();
    }
  };

  return (
    <>
      <div className='aiLayout'>
        <div className="app-header">
          <div className="app-title">✨ SchooberAi 助手</div>
          <div className="app-subtitle">智能编程助手，随时为您解答技术问题</div>
        </div>

        {/* 输出内容区域 */}
        <div className="content-area">
          {error && (
            <div className="error-message">
              错误: {error}
            </div>
          )}

          {/* 打字机效果的流式文本 */}
          {streamingText && (
            <div className="stream-text-container">
              <div className="stream-text-content">
                {streamingText}
              </div>
            </div>
          )}
        </div>

        <div className="input-container">
          <Input.TextArea
            style={{ color: '#fff' }}
            placeholder="请输入你的问题，比如：如何优化这段代码？（按 Enter 发送，Shift+Enter 换行）"
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            onKeyDown={handleKeyDown}
            autoSize={{ minRows: 3, maxRows: 6 }}
            disabled={loading}
            className="question-input"
          />
        </div>
      </div>
    </>
  );
};

ReactDom.render(<Sidebar />, document.getElementById('root'));
