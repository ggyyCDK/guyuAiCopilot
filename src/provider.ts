import * as vscode from 'vscode';
import { getHtmlForWebview } from './webViewutils';
import { useIMStore } from './store/imStore/createStore';
import { StartMultiRoundTask } from '@/utils/llmRequest/multiRoundTask'
import { multiRoundTaskParams } from '@/type/imType/aiRequest'

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
          //发送之后，收取消息，发起多轮对话
          StartMultiRoundTask({
            ...payload as multiRoundTaskParams
          }, webviewView)
          break;
        }
      }
    });
  }
}
