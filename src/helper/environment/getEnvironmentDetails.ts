//获取vscode环境信息
import * as vscode from 'vscode';

export const getEnvironmentDetails = (visibleFiles, openTabs) => {
    let details = '';
    details += `\n\n VSCode Visible Files`
    if (visibleFiles) {
        details += `\n${visibleFiles}`;
    } else {
        details += `\n no visible files`;
    }
    details += `\n\n VSCode Open Tabs`
    if (openTabs) {
        details += `\n${openTabs}`;
    } else {
        details += `\n no open tabs`;
    }
    return `\n<environment_details>${details.trim()}\n</environment_details>`
}

export const getVisibleFiles = (): string => {
    const activeEditor = vscode.window.activeTextEditor;
    if (activeEditor) {
        const currentFile = activeEditor.document.uri.fsPath;
        // console.log('当前打开的文件:', currentFile);
        return currentFile;
    }

    // 如果没有打开的文件，返回工作区根路径
    const folders = vscode.workspace.workspaceFolders;
    if (folders && folders.length > 0) {
        return folders[0].uri.fsPath;
    }
    return '';
};

export const getOpenTabs = (): string => {
    const tabGroupsApi = (vscode.window as any).tabGroups;
    if (!tabGroupsApi?.all) {
        return '';
    }

    const tabs = tabGroupsApi.all.flatMap((group: any) => group.tabs ?? []);
    const paths = Array.from(
        new Set(
            tabs
                .map((tab: any) => {
                    const input = tab?.input;
                    if (!input) return undefined;
                    if (input.uri) {
                        return input.uri.fsPath;
                    }
                    if (input.modifiedUri) {
                        return input.modifiedUri.fsPath;
                    }
                    return undefined;
                })
                .filter((filePath): filePath is string => Boolean(filePath)),
        ),
    );
    return paths.join('\n');
};