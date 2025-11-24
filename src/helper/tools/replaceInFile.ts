import * as vscode from 'vscode';
import * as path from 'path';
import { TextEncoder, TextDecoder } from 'util';
import { IToolExecutor } from '@/type/tools/msgToolsParse';
import { constructNewFileContent } from '@/utils/llmUtils/diff/diff';

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
 * 替换文件内容工具
 * 使用 SEARCH/REPLACE 块进行精确编辑
 * 
 * @param command 工具命令，包含 path (文件路径) 和 diff (SEARCH/REPLACE 块) 参数
 */
export const replaceInFile: IToolExecutor = async (command) => {
    const { toolUseCommand } = command;
    const originalPath = toolUseCommand.params.path?.trim();
    const rawDiff = toolUseCommand.params.diff;

    // 验证必需参数
    if (!originalPath) {
        throw new Error('replace_in_file tool requires a valid "path" parameter.');
    }

    if (!rawDiff) {
        throw new Error('replace_in_file tool requires a valid "diff" parameter.');
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

    try {
        const fileUri = vscode.Uri.file(resolvedPath);

        // 读取原始文件内容
        let originalContent = '';
        try {
            const fileBuffer = await vscode.workspace.fs.readFile(fileUri);
            originalContent = textDecoder.decode(fileBuffer);
        } catch (error) {
            throw new Error(`无法读取文件 "${resolvedPath}": 文件不存在或无法访问`);
        }

        // 处理 diff 内容：移除可能的 markdown 代码块标记
        let processedDiff = applyModelContentFixes(rawDiff);

        // 使用 diff 算法构造新文件内容
        let newContent: string;
        try {
            newContent = await constructNewFileContent(
                processedDiff,
                originalContent,
                true, // isFinal = true，表示这是完整的 diff
                'v1' // 使用 v1 版本的算法
            );
        } catch (error: any) {
            const message = error instanceof Error ? error.message : String(error);
            throw new Error(`应用 diff 失败: ${message}\n\n请确保 SEARCH 块与文件内容完全匹配。`);
        }

        // 移除尾随换行符（编辑器会自动插入）
        newContent = newContent.trimEnd();

        // 写入新内容
        const contentBuffer = textEncoder.encode(newContent);
        await vscode.workspace.fs.writeFile(fileUri, contentBuffer);

        // 计算变更统计
        const originalLines = originalContent.split('\n').length;
        const newLines = newContent.split('\n').length;
        const linesDiff = newLines - originalLines;
        const diffSign = linesDiff > 0 ? '+' : '';

        return {
            toolResult: `成功编辑文件内容: ${originalPath}\n` +
                `原始行数: ${originalLines}\n` +
                `新行数: ${newLines} (${diffSign}${linesDiff})\n` +
                `改动内容:\n${textDecoder.decode(contentBuffer)}\n` +
                `文件已更新`,
        };
    } catch (error: any) {
        const message = error instanceof Error ? error.message : String(error);
        throw new Error(`替换文件 "${resolvedPath}" 失败: ${message}`);
    }
};