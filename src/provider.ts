import * as vscode from 'vscode';
import { getHtmlForWebview } from './webViewutils';
import { attemptApiRequestTypeWriter } from './handler';
import { parseAssistantMessageV2 } from '@/utils/llmRequest/parseAssisantMessage'
import { useIMStore } from './store/imStore/createStore';

export interface Message {
  type: string;
  question?: string;
  payload: Record<string, any>;
}

export class SidebarProvider implements vscode.WebviewViewProvider {
  private _view?: vscode.WebviewView;

  constructor(protected context: vscode.ExtensionContext) { }

  public resolveWebviewView(webviewView: vscode.WebviewView) {
    this._view = webviewView;

    webviewView.webview.options = {
      enableScripts: true,
      localResourceRoots: [this.context.extensionUri],
    };

    webviewView.webview.html = getHtmlForWebview(
      this.context,
      webviewView,
      'sidebar'
    );

    webviewView.webview.onDidReceiveMessage(async (options: Message) => {
      const { type, payload } = options;
      const { mergeMessages } = useIMStore.getState()
      switch (type) {
        case 'stream-chat': {
          const { question, workerId, conversationId, baseUrl, variableMaps } = payload;

          if (!question) {
            webviewView.webview.postMessage({
              type: 'stream-error',
              payload: { error: '请输入问题后再尝试。' }
            });
            return;
          }

          // 发送开始消息
          webviewView.webview.postMessage({
            type: 'stream-start',
            payload: {},
          });

          let isCompleted = false;

          try {
            const stream = await attemptApiRequestTypeWriter({
              question,
              workerId,
              conversationId,
              variableMaps,
              baseUrl,
            });
            let assistantMessage = '';
            for await (const chunk of stream) {
              console.log(chunk, 'chunk')
              assistantMessage += chunk;
              const serverMessageList = parseAssistantMessageV2(assistantMessage)
              
              webviewView.webview.postMessage({
                type: 'stream-data',
                payload: serverMessageList,
              });
              console.log('serverMessageList is:', serverMessageList)
            }
          } catch (error) {
            const message = error instanceof Error ? error.message : (typeof error === 'string' ? error : '未知错误');
            webviewView.webview.postMessage({
              type: 'stream-error',
              payload: { error: message },
            });
          } finally {
            if (!isCompleted) {
              webviewView.webview.postMessage({
                type: 'stream-end',
                payload: {},
              });
            }
          }
          break;
        }
      }
    });
  }
}
