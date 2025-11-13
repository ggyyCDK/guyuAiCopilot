import * as vscode from 'vscode';
import { getHtmlForWebview } from './utils';
import { streamAgentChat } from './handler';

export interface Message {
  type: string;
  question?: string;
  payload?: Record<string, any>;
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

      switch (type) {
        case 'stream-chat': {
          const questionText = payload?.question?.trim() || '';
          const ak = payload?.ak?.trim();
          const apiUrl = payload?.apiUrl?.trim();
          const conversationId = payload?.conversationId || 'GUYUTEST1';

          if (!questionText) {
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
            await streamAgentChat({
              userContent: questionText,
              conversationId,
              ak,
              ApiUrl: apiUrl,
              // onMessage: (data) => {
              //   webviewView.webview.postMessage({
              //     type: 'stream-data',
              //     payload: data,
              //   });
              // },
              onIntervalMessage: (data) => {
                webviewView.webview.postMessage({
                  type: 'stream-data',
                  payload: data,
                });
              },
              onComplete: (data) => {
                isCompleted = true;
                webviewView.webview.postMessage({
                  type: 'stream-end',
                  payload: data,
                });
              },
              onError: (error) => {
                const message = error instanceof Error ? error.message : (typeof error === 'string' ? error : '未知错误');
                webviewView.webview.postMessage({
                  type: 'stream-error',
                  payload: { error: message },
                });
              }
            });
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
