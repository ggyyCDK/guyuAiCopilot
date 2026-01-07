import * as vscode from 'vscode';
import { SidebarProvider } from './provider';
import { McpServerManager } from './mcp/McpServerManager';
import { SkillsManager } from './skills/skillsManager';
import * as path from 'path';

/**
 * entry -> register webview
 */
export async function activate(context: vscode.ExtensionContext) {
  // 初始化 MCP Server Manager (单例模式)
  try {
    await McpServerManager.getInstance()
  } catch (error) {
    console.log('服务器初始化失败')
  }

  // 注册到 context.subscriptions 以便在扩展停用时自动清理
  context.subscriptions.push({
    dispose: async () => {
      await McpServerManager.cleanup();
    }
  });

  // 初始化 SkillsManager
  let skillsManager: SkillsManager | undefined;
  if (vscode.workspace.workspaceFolders && vscode.workspace.workspaceFolders.length > 0) {
    const workspaceRoot = vscode.workspace.workspaceFolders[0].uri.fsPath;
    skillsManager = new SkillsManager(workspaceRoot);
    skillsManager.initialize().catch(err => console.error('Failed to initialize SkillsManager:', err));
  }

  // 注册侧边栏视图
  const sidebarPanel = new SidebarProvider(context, skillsManager);
  context.subscriptions.push(
    vscode.window.registerWebviewViewProvider('vs-sidebar-view', sidebarPanel, {
      webviewOptions: {
        retainContextWhenHidden: true,
      },
    })
  );
}

// this method is called when your extension is deactivated
export function deactivate() {
  // 清理 MCP Server Manager
  McpServerManager.cleanup().catch((error) => {
    console.error('Error during MCP Server Manager cleanup:', error);
  });
}
