import * as path from "path"
import * as vscode from "vscode"
// Safe path comparison that works across different platforms
export function arePathsEqual(path1?: string, path2?: string): boolean {
    if (!path1 && !path2) {
        return true
    }
    if (!path1 || !path2) {
        return false
    }

    path1 = normalizePath(path1)
    path2 = normalizePath(path2)

    if (process.platform === "win32") {
        return path1.toLowerCase() === path2.toLowerCase()
    }
    return path1 === path2
}

function normalizePath(p: string): string {
    // normalize resolve ./.. segments, removes duplicate slashes, and standardizes path separators
    let normalized = path.normalize(p)
    // however it doesn't remove trailing slashes
    // remove trailing slash, except for root paths
    if (normalized.length > 1 && (normalized.endsWith("/") || normalized.endsWith("\\"))) {
        normalized = normalized.slice(0, -1)
    }
    return normalized
}

export const getWorkspacePath = (defaultCwdPath = "") => {
	const cwdPath = vscode.workspace.workspaceFolders?.map((folder) => folder.uri.fsPath).at(0) || defaultCwdPath
	const currentFileUri = vscode.window.activeTextEditor?.document.uri
	if (currentFileUri) {
		const workspaceFolder = vscode.workspace.getWorkspaceFolder(currentFileUri)
		return workspaceFolder?.uri.fsPath || cwdPath
	}
	return cwdPath
}