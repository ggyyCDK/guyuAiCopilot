import * as path from 'path';
import * as vscode from 'vscode';
import { regexSearchFiles } from '../../utils/ripgrep';

interface SearchFilesProps {
    toolUseCommand: any
}

export const searchFiles = async ({ toolUseCommand }: SearchFilesProps) => {
    const { params } = toolUseCommand
    const relDirPath: string | undefined = params.path
    const regex: string | undefined = params.regex
    const filePattern: string | undefined = params.file_pattern

    // Get the first workspace folder as default CWD
    const cwd = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath || '';
    if (!cwd) {
        return { toolResult: "No workspace folder open" }
    }

    const absolutePath = relDirPath ? path.resolve(cwd, relDirPath) : cwd

    if (!regex) {
        return { toolResult: "Missing regex parameter" }
    }

    try {
        const results = await regexSearchFiles(
            cwd,
            absolutePath,
            regex,
            filePattern
        )
        return { toolResult: results }

    } catch (error: any) {
        return { toolResult: `Error searching files: ${error.message}` }
    }
}
