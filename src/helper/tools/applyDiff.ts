import * as vscode from 'vscode';
import * as path from 'path';
import { TextEncoder, TextDecoder } from 'util';
import { IToolExecutor } from '@/type/tools/msgToolsParse';
import { MultiSearchReplaceDiffStrategy } from '@/utils/llmUtils/diff/multiSearchReplaceDiff';
import { openDiffViewWithOriginalContent } from '@/utils/llmUtils/diffView/openDiffView';

const textEncoder = new TextEncoder();
const textDecoder = new TextDecoder('utf-8');

// 创建 diff 策略实例（使用默认的精确匹配阈值）
const diffStrategy = new MultiSearchReplaceDiffStrategy({
    fuzzyThreshold: 1.0, // 100% 精确匹配
    bufferLines: 40,     // 搜索缓冲区行数
});

/**
 * 应用模型特定的内容修复
 * 移除可能由弱模型添加的伪影，如 markdown 代码块标记
 */
function applyModelContentFixes(content: string): string {
    let processedContent = content;

    // 移除开头的 markdown 代码块标记（如 ```diff, ```python 等）
    if (processedContent.startsWith('```')) {
        const lines = processedContent.split('\n');
        // 跳过第一行（代码块标记）
        processedContent = lines.slice(1).join('\n');
    }

    // 移除结尾的 markdown 代码块标记
    if (processedContent.trimEnd().endsWith('```')) {
        const lines = processedContent.split('\n');
        // 找到最后一个非空行
        let lastNonEmptyIndex = lines.length - 1;
        while (lastNonEmptyIndex >= 0 && lines[lastNonEmptyIndex].trim() === '') {
            lastNonEmptyIndex--;
        }
        // 如果最后一个非空行是 ```，移除它
        if (lastNonEmptyIndex >= 0 && lines[lastNonEmptyIndex].trim() === '```') {
            lines.splice(lastNonEmptyIndex, 1);
            processedContent = lines.join('\n');
        }
    }

    return processedContent;
}

/**
 * apply_diff 工具
 * 使用 Roo Code 风格的 SEARCH/REPLACE 块进行精确编辑
 * 
 * 格式：
 * <<<<<<< SEARCH
 * :start_line:1
 * -------
 * [要查找的精确内容]
 * =======
 * [替换后的新内容]
 * >>>>>>> REPLACE
 * 
 * @param command 工具命令，包含 path (文件路径) 和 diff (SEARCH/REPLACE 块) 参数
 */
export const applyDiff: IToolExecutor = async (command) => {
    const { toolUseCommand } = command;
    const originalPath = toolUseCommand.params.path?.trim();
    const rawDiff = toolUseCommand.params.diff;

    // 验证必需参数
    if (!originalPath) {
        throw new Error('apply_diff 工具需要有效的 "path" 参数。');
    }

    if (!rawDiff) {
        throw new Error('apply_diff 工具需要有效的 "diff" 参数。');
    }

    // 解析工作区路径
    const workspaceFolders = vscode.workspace.workspaceFolders;
    const workspaceRoot = workspaceFolders && workspaceFolders.length > 0 ? workspaceFolders[0].uri.fsPath : undefined;

    if (!path.isAbsolute(originalPath) && !workspaceRoot) {
        throw new Error('无法解析相对路径，因为没有打开工作区文件夹。');
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
        const processedDiff = applyModelContentFixes(rawDiff);

        // 使用 MultiSearchReplaceDiff 策略应用 diff
        const diffResult = await diffStrategy.applyDiff(
            originalContent,
            processedDiff
        );

        if (!diffResult.success) {
            // 构建详细的错误信息
            let errorMessage = `应用 diff 失败: ${diffResult.error || '未知错误'}`;
            
            if (diffResult.failParts && diffResult.failParts.length > 0) {
                errorMessage += '\n\n失败的部分:\n';
                for (const failPart of diffResult.failParts) {
                    if (!failPart.success) {
                        errorMessage += `- ${failPart.error}\n`;
                    }
                }
            }

            throw new Error(errorMessage);
        }

        // 获取新内容
        let newContent = diffResult.content!;

        // 移除尾随换行符（编辑器会自动插入）
        newContent = newContent.trimEnd();

        // 写入新内容
        const contentBuffer = textEncoder.encode(newContent);
        await vscode.workspace.fs.writeFile(fileUri, contentBuffer);

        // 打开 diff 视图显示变更
        try {
            await openDiffViewWithOriginalContent(originalContent, fileUri);
        } catch (error) {
            console.warn('打开 diff 视图失败', error);
        }

        // 计算变更统计
        const originalLines = originalContent.split('\n').length;
        const newLines = newContent.split('\n').length;
        const linesDiff = newLines - originalLines;
        const diffSign = linesDiff > 0 ? '+' : '';

        // 统计成功和失败的块数
        const searchBlockCount = (processedDiff.match(/<<<<<<< SEARCH/g) || []).length;
        const failedCount = diffResult.failParts?.filter(p => !p.success).length || 0;
        const successCount = searchBlockCount - failedCount;

        let resultMessage = `成功应用 diff: ${originalPath}\n` +
            `应用块数: ${successCount}/${searchBlockCount}\n` +
            `原始行数: ${originalLines}\n` +
            `新行数: ${newLines} (${diffSign}${linesDiff})\n`;

        // 如果有部分失败，添加警告
        if (failedCount > 0 && diffResult.failParts) {
            resultMessage += `\n警告: ${failedCount} 个块应用失败:\n`;
            for (const failPart of diffResult.failParts) {
                if (!failPart.success) {
                    resultMessage += `- ${failPart.error?.split('\n')[0]}\n`;
                }
            }
            resultMessage += '\n请使用 read_file 检查最新文件内容并重新应用失败的更改。';
        }

        resultMessage += '\n文件已更新';

        return {
            toolResult: resultMessage,
        };
    } catch (error: any) {
        const message = error instanceof Error ? error.message : String(error);
        throw new Error(`应用 diff 到 "${resolvedPath}" 失败: ${message}`);
    }
};
