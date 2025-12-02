import * as vscode from 'vscode';
import * as path from 'path';
import { TextDecoder } from 'util';
import { addLineNumbers } from '@/utils/llmUtils/path/addLineNumbers';
import { IToolExecutor } from '@/type/tools/msgToolsParse'
import { parseXml } from '@/utils/parse'
const textDecoder = new TextDecoder('utf-8');

interface FileEntry {
    path?: string;
}

interface FileResult {
    path: string;
    content?: string;
    error?: string;
}

/**
 * 读取指定路径的文件内容。
 * 支持单文件和多文件读取。
 * 兼容绝对/相对路径，并确保始终返回字符串结果。
 */
export const readFile: IToolExecutor = async (command) => {
    const { toolUseCommand } = command;
    console.log(toolUseCommand, 'toolUseCommand')
    
    const argsXmlTag = toolUseCommand.params.args;
    const legacyPath = toolUseCommand.params.path?.trim();

    const workspaceFolders = vscode.workspace.workspaceFolders;
    const workspaceRoot = workspaceFolders && workspaceFolders.length > 0 ? workspaceFolders[0].uri.fsPath : undefined;

    const fileEntries: FileEntry[] = [];

    // 解析新格式：多文件 args 参数
    if (argsXmlTag) {
        try {
            const parsed = parseXml(argsXmlTag) as any;
            const files = Array.isArray(parsed.file) ? parsed.file : [parsed.file].filter(Boolean);

            for (const file of files) {
                if (!file.path) continue;
                fileEntries.push({ path: file.path });
            }
        } catch (error) {
            const errorMessage = `Failed to parse read_file XML args: ${error instanceof Error ? error.message : String(error)}`;
            return {
                toolResult: `<files><error>${errorMessage}</error></files>`
            };
        }
    }
    // 兼容旧格式：单文件 path 参数
    else if (legacyPath) {
        fileEntries.push({ path: legacyPath });
    }

    if (fileEntries.length === 0) {
        return {
            toolResult: '<files><error>No valid file paths provided</error></files>'
        };
    }

    // 处理每个文件
    const fileResults: FileResult[] = [];

    for (const entry of fileEntries) {
        const originalPath = entry.path!;
        
        if (!path.isAbsolute(originalPath) && !workspaceRoot) {
            fileResults.push({
                path: originalPath,
                error: 'Cannot resolve relative path because no workspace folder is open.'
            });
            continue;
        }

        const resolvedPath = path.isAbsolute(originalPath)
            ? originalPath
            : path.join(workspaceRoot as string, originalPath);

        try {
            const fileUri = vscode.Uri.file(resolvedPath);
            const fileBuffer = await vscode.workspace.fs.readFile(fileUri);
            const content = addLineNumbers(textDecoder.decode(fileBuffer));
            
            fileResults.push({
                path: originalPath,
                content: content
            });
        } catch (error: any) {
            const message = error instanceof Error ? error.message : String(error);
            fileResults.push({
                path: originalPath,
                error: `Error reading file: ${message}`
            });
        }
    }

    // 生成 XML 格式的返回结果
    const xmlResults = fileResults.map(result => {
        if (result.error) {
            return `  <file><path>${result.path}</path><error>${result.error}</error></file>`;
        } else {
            return `  <file><path>${result.path}</path>\n${result.content}\n  </file>`;
        }
    });

    return {
        toolResult: `<files>\n${xmlResults.join('\n')}\n</files>`
    };
};