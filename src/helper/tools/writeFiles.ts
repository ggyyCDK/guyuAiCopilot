import * as vscode from 'vscode';
import * as path from 'path';
import { TextEncoder } from 'util';
import { IToolExecutor } from '@/type/tools/msgToolsParse';

const textEncoder = new TextEncoder();
const textDecoder = new TextDecoder('utf-8');

/**
 * 应用模型特定的内容修复
 * 移除可能由弱模型添加的伪影，如 markdown 代码块标记
 */
function applyModelContentFixes(content: string): string {
    let processedContent = content;

    // 移除开头的 markdown 代码块标记（如 ```python, ```js 等）
    if (processedContent.startsWith('```')) {
        const lines = processedContent.split('\n');
        // 跳过第一行（代码块标记）
        processedContent = lines.slice(1).join('\n').trim();
    }

    // 移除结尾的 markdown 代码块标记
    if (processedContent.endsWith('```')) {
        const lines = processedContent.split('\n');
        // 移除最后一行（代码块标记）
        processedContent = lines.slice(0, -1).join('\n').trim();
    }

    return processedContent;
}

/**
 * 写入文件工具
 * 创建新文件或完全重写现有文件
 * 
 * @param command 工具命令，包含 path (文件路径) 和 content (文件内容) 参数
 */
export const writeFile: IToolExecutor = async (command) => {
    const { toolUseCommand } = command;
    const originalPath = toolUseCommand.params.path?.trim();
    const rawContent = toolUseCommand.params.content;

    // 验证必需参数
    if (!originalPath) {
        throw new Error('write_to_file tool requires a valid "path" parameter.');
    }

    if (!rawContent) {
        throw new Error('write_to_file tool requires a valid "content" parameter.');
    }

    // 解析工作区路径
    const workspaceFolders = vscode.workspace.workspaceFolders;
    const workspaceRoot = workspaceFolders && workspaceFolders.length > 0 ? workspaceFolders[0].uri.fsPath : undefined;

    if (!path.isAbsolute(originalPath) && !workspaceRoot) {
        throw new Error('Cannot resolve relative path because no workspace folder is open.');
    }

    const resolvedPath = path.isAbsolute(originalPath)
        ? originalPath
        : path.join(workspaceRoot as string, originalPath);

    // 处理内容：移除可能的 markdown 代码块标记
    let processedContent = applyModelContentFixes(rawContent);

    // 移除尾随换行符（编辑器会自动插入）
    processedContent = processedContent.trimEnd();

    try {
        const fileUri = vscode.Uri.file(resolvedPath);

        // 检查文件是否存在
        let fileExists = false;
        try {
            await vscode.workspace.fs.stat(fileUri);
            fileExists = true;
        } catch {
            // 文件不存在
            fileExists = false;
        }

        // 确保目录存在
        const dirPath = path.dirname(resolvedPath);
        const dirUri = vscode.Uri.file(dirPath);
        try {
            await vscode.workspace.fs.createDirectory(dirUri);
        } catch {
            // 目录可能已存在，忽略错误
        }

        // 写入文件
        const contentBuffer = textEncoder.encode(processedContent);
        await vscode.workspace.fs.writeFile(fileUri, contentBuffer);

        // 返回成功消息
        const operation = fileExists ? '更新' : '创建';
        return {
            toolResult: `成功${operation}文件: ${originalPath}\n文件内容已写入 ${textDecoder.decode(contentBuffer)})`,
        };
    } catch (error: any) {
        const message = error instanceof Error ? error.message : String(error);
        throw new Error(`写入文件 "${resolvedPath}" 失败: ${message}`);
    }
};