import * as vscode from 'vscode';
import * as path from 'path';
import { TextDecoder } from 'util';
import { addLineNumbers } from '@/utils/llmUtils/path/addLineNumbers';
import { IToolExecutor } from '@/type/tools/msgToolsParse'

const textDecoder = new TextDecoder('utf-8');

/**
 * 读取指定路径的文件内容。
 * 兼容绝对/相对路径，并确保始终返回字符串结果。
 */
export const readFile: IToolExecutor = async (command) => {
    const { toolUseCommand } = command;
    const originalPath = toolUseCommand.params.path?.trim();

    if (!originalPath) {
        throw new Error('read_file tool requires a valid "path" parameter.');
    }

    const workspaceFolders = vscode.workspace.workspaceFolders;
    const workspaceRoot = workspaceFolders && workspaceFolders.length > 0 ? workspaceFolders[0].uri.fsPath : undefined;

    if (!path.isAbsolute(originalPath) && !workspaceRoot) {
        throw new Error('Cannot resolve relative path because no workspace folder is open.');
    }

    const resolvedPath = path.isAbsolute(originalPath)
        ? originalPath
        : path.join(workspaceRoot as string, originalPath);

    try {
        const fileUri = vscode.Uri.file(resolvedPath);
        const fileBuffer = await vscode.workspace.fs.readFile(fileUri);
        return {
            toolResult: addLineNumbers(textDecoder.decode(fileBuffer)),
        }
    } catch (error: any) {
        const message = error instanceof Error ? error.message : String(error);
        throw new Error(`Failed to read file "${resolvedPath}": ${message}`);
    }
};