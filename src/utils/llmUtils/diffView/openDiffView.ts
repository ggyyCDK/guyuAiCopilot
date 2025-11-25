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

export async function openDiffViewWithOriginalContent(originalContent: string, targetUri: vscode.Uri) {
    ensureProviderRegistered();
    const encodedOriginal = Buffer.from(originalContent, 'utf8').toString('base64');
    const virtualUri = targetUri.with({
        scheme: DIFF_VIEW_URI_SCHEME,
        query: encodedOriginal,
    });
    const title = `${path.basename(targetUri.fsPath)}: 原始 ↔ 修改`;

    await vscode.commands.executeCommand(
        'vscode.diff',
        virtualUri,
        targetUri,
        title,
        { preview: false, viewColumn: vscode.ViewColumn.Active },
    );
}

