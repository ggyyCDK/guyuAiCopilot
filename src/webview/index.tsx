import React, { useEffect, useState } from 'react';
import ReactDom from 'react-dom';

import { Button, Input } from 'antd';
import '@arco-design/web-react/dist/css/arco.css';
import './index.css';

interface ISidebarProps { }

const vscode = (window as any).acquireVsCodeApi();

const Sidebar: React.FC<ISidebarProps> = () => {
  const [streamingText, setStreamingText] = useState<string>('');
  const [displayedText, setDisplayedText] = useState<string>('');
  const [targetText, setTargetText] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>('');
  const [question, setQuestion] = useState<string>('');
  const [ak, setAk] = useState<string>('');
  const [apiUrl, setApiUrl] = useState<string>('');
  
  // 打字机效果：逐渐显示文本
  useEffect(() => {
    if (displayedText.length < targetText.length) {
      const timer = setTimeout(() => {
        const nextChar = targetText[displayedText.length];
        setDisplayedText(prev => prev + nextChar);
      }, 20); // 每个字符间隔 20ms，可以根据需要调整速度
      
      return () => clearTimeout(timer);
    }
  }, [displayedText, targetText]);

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
    console.log('payload is:', payload)
    switch (type) {
      case 'stream-start':
        console.log('Stream started');
        // setStreamingText('');
        // setDisplayedText('');
        // setTargetText('');
        // setError('');
        setLoading(true);
        break;

      case 'stream-data':
        if (payload.segmentContent) {
          setStreamingText(prev => {
            const newText = prev + payload.segmentContent;
            setTargetText(newText); // 更新目标文本，打字机效果会自动跟上
            return newText;
          });
        }
        break;

      case 'stream-end':
        console.log('Stream ended');
        // 确保所有文本都显示完毕
        // 优先使用 payload.content（完整内容），否则使用函数式更新获取最新的 streamingText
        if (payload?.content) {
          const finalText = payload.content;
          setDisplayedText(finalText);
          setTargetText(finalText);
          setStreamingText(finalText);
        } else {
          // 使用函数式更新确保获取到最新的 streamingText
          setStreamingText(prev => {
            setDisplayedText(prev);
            setTargetText(prev);
            return prev;
          });
        }
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
    setDisplayedText('');
    setTargetText('');
    setError('');
  };

  const handleSend = () => {
    if (!question.trim() || loading) return;
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
          {displayedText && (
            <div className="stream-text-container">
              <div className="stream-text-content">
                {displayedText}
                {loading && displayedText.length < targetText.length && (
                  <span className="typing-cursor">|</span>
                )}
              </div>
            </div>
          )}
        </div>

        <div className="input-container">
          <div className="config-inputs">
            <Input
              placeholder="请输入访问密钥 (AK)"
              value={ak}
              onChange={(e) => setAk(e.target.value)}
              disabled={loading}
              className="config-input"
            />
            <Input
              placeholder="请输入 API 服务地址"
              value={apiUrl}
              onChange={(e) => setApiUrl(e.target.value)}
              disabled={loading}
              className="config-input"
            />
          </div>
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
