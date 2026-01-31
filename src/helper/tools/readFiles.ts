import * as vscode from 'vscode';
import * as path from 'path';
import { TextDecoder } from 'util';
import { addLineNumbers } from '@/utils/llmUtils/path/addLineNumbers';
import { IToolExecutor } from '@/type/tools/msgToolsParse'
import { parseXml } from '@/utils/parse'
const textDecoder = new TextDecoder('utf-8');

interface LineRange {
    start: number;
    end: number;
}

interface FileEntry {
    path?: string;
    lineRanges?: LineRange[];
}

interface FileResult {
    path: string;
    content?: string;
    error?: string;
    lineRanges?: LineRange[];
}

/**
 * 从文件内容中提取指定行范围的内容
 * @param content 完整文件内容
 * @param lineRanges 行范围数组，1-based inclusive
 * @returns 包含行号的内容片段数组
 */
function extractLineRanges(content: string, lineRanges: LineRange[]): string[] {
    const lines = content.split('\n');
    const results: string[] = [];
    
    for (const range of lineRanges) {
        // 验证行范围
        if (range.start > range.end) {
            results.push(`<error>Invalid line range: end line (${range.end}) cannot be less than start line (${range.start})</error>`);
            continue;
        }
        if (range.start < 1) {
            results.push(`<error>Invalid line range: start line must be >= 1</error>`);
            continue;
        }
        
        // 提取指定行范围 (1-based to 0-based)
        const startIdx = range.start - 1;
        const endIdx = Math.min(range.end, lines.length);
        const rangeLines = lines.slice(startIdx, endIdx);
        
        // 添加行号
        const numberedContent = addLineNumbers(rangeLines.join('\n'), range.start);
        results.push(`<content lines="${range.start}-${endIdx}">\n${numberedContent}</content>`);
    }
    
    return results;
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
                
                const fileEntry: FileEntry = {
                    path: file.path,
                    lineRanges: [],
                };

                // 解析 line_range 参数
                if (file.line_range) {
                    const ranges = Array.isArray(file.line_range) ? file.line_range : [file.line_range];
                    for (const range of ranges) {
                        const match = String(range).match(/(\d+)-(\d+)/);
                        if (match) {
                            const [, start, end] = match.map(Number);
                            if (!isNaN(start) && !isNaN(end)) {
                                fileEntry.lineRanges?.push({ start, end });
                            }
                        }
                    }
                }
                
                fileEntries.push(fileEntry);
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
            const fullContent = textDecoder.decode(fileBuffer);
            
            // 检查是否有行范围限制
            if (entry.lineRanges && entry.lineRanges.length > 0) {
                // 按行范围读取
                const rangeContents = extractLineRanges(fullContent, entry.lineRanges);
                fileResults.push({
                    path: originalPath,
                    content: rangeContents.join('\n'),
                    lineRanges: entry.lineRanges
                });
            } else {
                // 读取整个文件
                const content = addLineNumbers(fullContent);
                const totalLines = fullContent.split('\n').length;
                fileResults.push({
                    path: originalPath,
                    content: `<content lines="1-${totalLines}">\n${content}</content>`
                });
            }
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