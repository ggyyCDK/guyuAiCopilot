import * as vscode from 'vscode';
import { getHtmlForWebview } from './webViewutils';
import { useIMStore } from './store/imStore/createStore';
import { StartMultiRoundTask } from '@/utils/llmRequest/multiRoundTask'
import { multiRoundTaskParams } from '@/type/imType/aiRequest'
import { compressSessionContext } from '@/handler'
import { multiRoundSharedState } from '@/utils/assisantPresentStore/multiRoundSharedState';

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
      switch (type) {
        case 'stream-chat': {
          //发送之后，收取消息，发起多轮对话
          StartMultiRoundTask({
            ...payload as multiRoundTaskParams,
          }, webviewView)
          break;
        }
        case 'open-file': {
          // 打开文件
          const { path } = payload;
          if (path) {
            try {
              const workspaceFolders = vscode.workspace.workspaceFolders;
              if (workspaceFolders && workspaceFolders.length > 0) {
                const workspaceRoot = workspaceFolders[0].uri.fsPath;
                const fullPath = vscode.Uri.file(
                  path.startsWith('/') ? path : `${workspaceRoot}/${path}`
                );
                const document = await vscode.workspace.openTextDocument(fullPath);
                await vscode.window.showTextDocument(document, {
                  preview: false,
                  preserveFocus: false
                });
              }
            } catch (error) {
              vscode.window.showErrorMessage(`无法打开文件: ${path}`);
              console.error('Error opening file:', error);
            }
          }
          break;
        }
        case 'compress-context': {
          // 压缩会话上下文
          const { conversationId, baseUrl, apiKey } = payload;
          if (conversationId) {
            try {
              vscode.window.showInformationMessage('正在压缩会话上下文...');

              const result = await compressSessionContext({
                sessionId: conversationId,
                baseUrl: baseUrl || 'http://127.0.0.1:7001',
                apiKey
              });
              if (result.success && result.data) {
                const usage = result.data;
                const compressedUsage = usage?.compressedUsage || 0;

                // 向 webview 发送更新 tokens 的消息
                if (this._view) {
                  this._view.webview.postMessage({
                    type: 'update-tokens',
                    payload: {
                      totalTokens: compressedUsage
                    }
                  });

                  // 发送压缩完成消息
                  this._view.webview.postMessage({
                    type: 'compress-complete',
                    payload: {}
                  });
                }

                vscode.window.showInformationMessage(
                  `压缩成功！压缩后的token大小: ${compressedUsage}`
                );
                console.log('压缩结果:', result.data);
              } else {
                vscode.window.showWarningMessage(`压缩失败: ${result.message}`);

                // 压缩失败也要重置状态
                if (this._view) {
                  this._view.webview.postMessage({
                    type: 'compress-complete',
                    payload: {}
                  });
                }
              }
            } catch (error: any) {
              vscode.window.showErrorMessage(`压缩上下文失败: ${error.message}`);
              console.error('压缩上下文错误:', error);

              // 压缩失败也要重置状态
              if (this._view) {
                this._view.webview.postMessage({
                  type: 'compress-complete',
                  payload: {}
                });
              }
            }
          }
          break;
        }
        case 'cancel-chat': {
          // 取消对话
          if (multiRoundSharedState.abortController) {
            multiRoundSharedState.abortController.abort();
            multiRoundSharedState.abort = true;
            // vscode.window.showInformationMessage('对话已取消');

            // 通知前端对话已取消
            if (this._view) {
              this._view.webview.postMessage({
                type: 'chat-canceled',
                payload: {}
              });

              this._view.webview.postMessage({
                type: 'update-loading',
                payload: { chatLoading: false }
              });
            }
          }
          break;
        }
      }
    });
  }
}
