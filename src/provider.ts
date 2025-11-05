import * as vscode from 'vscode';
import { getHtmlForWebview } from './utils';
import { test } from './handler';

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
      const { type, question, payload } = options;

      switch (type) {
        case 'test': {
          try {
            const questionText = question || '你可以为我做什么';

            // 发送开始消息
            webviewView.webview.postMessage({
              type: 'stream-start',
              payload: {},
            });

            // 执行流式请求
            await test(questionText, (data: any) => {
              // 每次收到数据就发送到 webview
              webviewView.webview.postMessage({
                type: 'stream-data',
                payload: {
                  data: data,
                },
              });
            });

            // 发送完成消息
            webviewView.webview.postMessage({
              type: 'stream-end',
              payload: {},
            });
          } catch (error) {
            // 发送错误消息
            webviewView.webview.postMessage({
              type: 'stream-error',
              payload: {
                error: error instanceof Error ? error.message : String(error),
              },
            });
          }
          break;
        }
      }
    });
  }
}
