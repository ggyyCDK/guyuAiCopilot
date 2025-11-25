import * as vscode from 'vscode';
import * as path from 'path';

const DIFF_VIEW_URI_SCHEME = 'guyuai-diff';

class ReplaceToolDiffContentProvider implements vscode.TextDocumentContentProvider {
    provideTextDocumentContent(uri: vscode.Uri): string | Thenable<string> {
        if (!uri.query) {
            return '';
        }
        return Buffer.from(uri.query, 'base64').toString('utf8');
    }
}

let providerRegistration: vscode.Disposable | undefined;
const providerInstance = new ReplaceToolDiffContentProvider();

function ensureProviderRegistered() {
    if (!providerRegistration) {
        providerRegistration = vscode.workspace.registerTextDocumentContentProvider(
            DIFF_VIEW_URI_SCHEME,
            providerInstance,
        );
    }
}

let currentAutoCloseTimer: NodeJS.Timeout | null = null;
let currentDiffEditor: vscode.TextEditor | null = null;

async function closeOldDiffViews() {
    try {
        const visibleEditors = vscode.window.visibleTextEditors;
        for (const editor of visibleEditors) {
            if (editor.document.uri.scheme === DIFF_VIEW_URI_SCHEME) {
                await vscode.window.showTextDocument(editor.document, {
                    viewColumn: editor.viewColumn,
                    preserveFocus: true,
                });
                await vscode.commands.executeCommand('workbench.action.closeActiveEditor');
                console.log('Closed old diff view');
            }
        }
    } catch (error) {
        console.warn('Failed to close old diff views:', error);
    }
}

export async function openDiffViewWithOriginalContent(originalContent: string, targetUri: vscode.Uri) {
    ensureProviderRegistered();

    // 取消之前的自动关闭定时器
    if (currentAutoCloseTimer) {
        clearTimeout(currentAutoCloseTimer);
        currentAutoCloseTimer = null;
        console.log('Cancelled previous auto-close timer');
    }

    // 关闭所有旧的 diff view
    await closeOldDiffViews();

    const encodedOriginal = Buffer.from(originalContent, 'utf8').toString('base64');
    const virtualUri = targetUri.with({
        scheme: DIFF_VIEW_URI_SCHEME,
        query: encodedOriginal,
    });
    const title = `${path.basename(targetUri.fsPath)}: 原始 ↔ 修改`;

    // 计算第一个差异的位置
    let firstDiffLine = 0;
    try {
        const targetDocument = await vscode.workspace.openTextDocument(targetUri);
        const targetContent = targetDocument.getText();

        const originalLines = originalContent.replace(/\r\n/g, '\n').split('\n');
        const targetLines = targetContent.replace(/\r\n/g, '\n').split('\n');
        const minLines = Math.min(originalLines.length, targetLines.length);

        for (let i = 0; i < minLines; i++) {
            if (originalLines[i] !== targetLines[i]) {
                firstDiffLine = i;
                break;
            }
        }

        if (firstDiffLine === 0 && originalLines.length !== targetLines.length) {
            firstDiffLine = minLines;
        }

        console.log(`First diff found at line: ${firstDiffLine}`);
    } catch (error) {
        console.warn('Failed to calculate diff position:', error);
        firstDiffLine = 0;
    }

    // 打开新的 diff view
    await vscode.commands.executeCommand(
        'vscode.diff',
        virtualUri,
        targetUri,
        title,
        {
            preview: false,
            viewColumn: vscode.ViewColumn.Active,
        },
    );

    // 🔧 关键改进：定位到改动位置
    // 方案1：使用命令跳转到第一个变更（推荐）
    setTimeout(async () => {
        try {
            // 先跳到文件开头
            await vscode.commands.executeCommand('cursorTop');

            // 然后跳到第一个变更
            await vscode.commands.executeCommand('workbench.action.compareEditor.nextChange');

            console.log('Jumped to first change using command');
        } catch (error) {
            console.warn('Failed to jump using command, trying manual scroll:', error);

            // 方案2：手动滚动（备用方案）
            manualScrollToDiff(firstDiffLine, targetUri);
        }
    }, 350); // 增加延迟确保 diff view 完全加载

    // 保存当前的 diff editor
    currentDiffEditor = vscode.window.activeTextEditor || null;

    // 设置 3 秒自动关闭定时器
    currentAutoCloseTimer = setTimeout(async () => {
        try {
            const activeEditor = vscode.window.activeTextEditor;

            if (activeEditor && activeEditor.document.uri.scheme === DIFF_VIEW_URI_SCHEME) {
                await vscode.commands.executeCommand('workbench.action.closeActiveEditor');

                const document = await vscode.workspace.openTextDocument(targetUri);
                await vscode.window.showTextDocument(document, {
                    preview: false,
                    viewColumn: vscode.ViewColumn.Active,
                });

                console.log('Diff view closed automatically after 3 seconds');
            }

            currentAutoCloseTimer = null;
            currentDiffEditor = null;
        } catch (error) {
            console.warn('Failed to auto-close diff view:', error);
        }
    }, 3000);

    console.log('New diff view opened with 3-second auto-close timer');
}

/**
 * 手动滚动到差异位置（备用方案）
 */
function manualScrollToDiff(firstDiffLine: number, targetUri: vscode.Uri) {
    const position = new vscode.Position(firstDiffLine, 0);
    const range = new vscode.Range(position, position);

    // 查找 diff view 中的编辑器
    const visibleEditors = vscode.window.visibleTextEditors;

    // 过滤出 diff view 中的两个编辑器
    const diffEditors = visibleEditors.filter(editor =>
        editor.document.uri.scheme === DIFF_VIEW_URI_SCHEME ||
        editor.document.uri.toString() === targetUri.toString()
    );

    console.log(`Found ${diffEditors.length} editors to scroll`);

    if (diffEditors.length > 0) {
        // 同时滚动两侧编辑器
        for (const editor of diffEditors) {
            // 设置光标位置
            editor.selection = new vscode.Selection(position, position);

            // 滚动到视图中心
            editor.revealRange(range, vscode.TextEditorRevealType.InCenter);

            console.log(`Scrolled editor: ${editor.document.uri.toString()}`);
        }
    } else {
        console.warn('No diff editors found for scrolling');
    }
}
