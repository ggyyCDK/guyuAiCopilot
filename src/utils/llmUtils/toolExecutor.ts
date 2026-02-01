import { ToolParamName, ToolUse } from "@/type/tools/msgToolsParse";
import { multiRoundSharedState } from "../assisantPresentStore/multiRoundSharedState";
import { formatResponse } from "@/helper/responsePrompt/responseFormatter";
import { pushToolResult } from "@/utils/assisantPresentStore/toolUtils/pushToolResult";
import { getToolDescription } from "@/utils/assisantPresentStore/toolUtils/getToolDescription";
import { readFile } from "@/helper/tools/readFiles";
import { listFiles } from "@/helper/tools/listFiles";
import { attemptCompletion } from "@/helper/tools/attemptCompletion";
import { writeFile } from "@/helper/tools/writeFiles";
import { replaceInFile } from "@/helper/tools/replaceInFile";
import { applyDiff } from "@/helper/tools/applyDiff";
import { updateTodoList } from '@/helper/tools/updateTodoList';
import { useMcpTooltoTool } from "@/helper/tools/useMcpToolTool";
import { searchFiles } from "@/helper/tools/searchFiles";
import { searchMemory } from "@/helper/tools/searchMemory";
import { searchKnowledgeBase } from "@/helper/tools/searchKnowledgeBase";
import { ScanAnimationController } from "@/utils/llmUtils/diffView/ScanAnimationController";
import * as vscode from 'vscode';
import { getEnvironmentDetails, getVisibleFiles, getOpenTabs } from "@/helper/environment/getEnvironmentDetails";
import { executeCommand } from "@/helper/tools/executeCommand";

// 全局变量存储扫描动画控制器实例
let scanAnimationController: ScanAnimationController | null = null;
// 记录当前正在扫描的文件路径，避免重复启动动画
let lastScannedPath: string | null = null;

const createToolRejectionMessage = (block: ToolUse, reason: string): void => {
    multiRoundSharedState.userMessageContent.push({
        type: "text",
        text: `${reason} ${getToolDescription(block)}`,
    })
}

export const parseToolUse = async (block: ToolUse) => {
    if (multiRoundSharedState.didRejectTool) {
        const reason = block.partial
            ? "Tool was interrupted and not executed due to user rejecting a previous tool."
            : "Skipping tool due to user rejecting a previous tool."
        createToolRejectionMessage(block, reason)
        return true
    }

    if (multiRoundSharedState.didAlreadyUseTool) {
        multiRoundSharedState.userMessageContent.push({
            type: "text",
            text: formatResponse.toolAlreadyUsed(block.name),
        })
        return true
    }

    const visibleFiles = getVisibleFiles();
    const openTabs = getOpenTabs();
    switch (block.name) {
        case 'read_file': {
            if (block.partial) {
                console.log('read_file is partial')
                break
            }
            console.log('执行到读文件啦！', block)
            const { toolResult } = await readFile({
                toolUseCommand: block,
            })
            console.log('读完啦', toolResult)
            pushToolResult({ block, content: toolResult + getEnvironmentDetails(visibleFiles, openTabs) })
            break
        }
        case 'list_files': {
            if (block.partial) {
                console.log('list_files is partial')
                break
            }
            console.log('执行到列文件啦！', block)
            const { toolResult } = await listFiles({
                toolUseCommand: block,
            })
            console.log('列完啦', toolResult)
            pushToolResult({ block, content: toolResult + getEnvironmentDetails(visibleFiles, openTabs) })
            break
        }
        case 'write_to_file': {
            if (block.partial) {
                console.log('write_to_file is partial')
                break
            }
            console.log('执行到写文件啦！', block)
            const { toolResult } = await writeFile({
                toolUseCommand: block,
            })
            console.log('写完啦', toolResult)
            pushToolResult({ block, content: toolResult + getEnvironmentDetails(visibleFiles, openTabs) })
            break
        }
        case 'replace_in_file': {
            if (block.partial) {
                console.log('replace_in_file is partial');

                // 获取文件路径
                const originalPath = block.params.path;
                if (originalPath) {
                    try {
                        // 解析文件路径（支持相对路径和绝对路径）
                        const path = await import('path');
                        const workspaceFolders = vscode.workspace.workspaceFolders;
                        const workspaceRoot = workspaceFolders && workspaceFolders.length > 0
                            ? workspaceFolders[0].uri.fsPath
                            : undefined;

                        const resolvedPath = path.isAbsolute(originalPath)
                            ? originalPath
                            : workspaceRoot
                                ? path.join(workspaceRoot, originalPath)
                                : originalPath;

                        // 只在文件路径改变或首次启动时才创建新的扫描动画
                        if (resolvedPath !== lastScannedPath) {
                            // 如果已经有扫描动画在运行，先停止它
                            if (scanAnimationController) {
                                scanAnimationController.stop();
                                scanAnimationController = null;
                            }

                            // 打开文件
                            const fileUri = vscode.Uri.file(resolvedPath);
                            const document = await vscode.workspace.openTextDocument(fileUri);
                            const editor = await vscode.window.showTextDocument(document, {
                                preview: false,
                                viewColumn: vscode.ViewColumn.Active
                            });

                            // 创建新的扫描动画控制器
                            scanAnimationController = new ScanAnimationController(editor);

                            // 根据文件大小估算执行时间，计算合适的扫描速度
                            const totalLines = document.lineCount;
                            // 估算：小文件约2-3秒，大文件约5-10秒
                            const estimatedTime = Math.max(2000, Math.min(10000, 2000 + totalLines * 3));
                            const scanSpeed = estimatedTime / totalLines;

                            scanAnimationController.start(scanSpeed);

                            // 记录当前扫描的文件路径
                            lastScannedPath = resolvedPath;
                        } else {
                            console.log('Scan animation already running for:', resolvedPath);
                        }
                    } catch (error) {
                        console.error('Failed to open file for scan animation:', error);
                    }
                }
                break;
            }

            console.log('执行到替换文件啦！', block);

            // 如果扫描动画正在运行，让它快速完成
            if (scanAnimationController) {
                await scanAnimationController.finishScanning();
                scanAnimationController = null;
            }
            // 重置扫描路径记录
            lastScannedPath = null;

            const { toolResult } = await replaceInFile({
                toolUseCommand: block,
            });
            console.log('替换完啦', toolResult);
            pushToolResult({ block, content: toolResult + getEnvironmentDetails(visibleFiles, openTabs) });
            break;
        }
        case 'apply_diff': {
            if (block.partial) {
                console.log('apply_diff is partial');

                // 获取文件路径，启动扫描动画
                const originalPath = block.params.path;
                if (originalPath) {
                    try {
                        const path = await import('path');
                        const workspaceFolders = vscode.workspace.workspaceFolders;
                        const workspaceRoot = workspaceFolders && workspaceFolders.length > 0
                            ? workspaceFolders[0].uri.fsPath
                            : undefined;

                        const resolvedPath = path.isAbsolute(originalPath)
                            ? originalPath
                            : workspaceRoot
                                ? path.join(workspaceRoot, originalPath)
                                : originalPath;

                        // 只在文件路径改变或首次启动时才创建新的扫描动画
                        if (resolvedPath !== lastScannedPath) {
                            if (scanAnimationController) {
                                scanAnimationController.stop();
                                scanAnimationController = null;
                            }

                            const fileUri = vscode.Uri.file(resolvedPath);
                            const document = await vscode.workspace.openTextDocument(fileUri);
                            const editor = await vscode.window.showTextDocument(document, {
                                preview: false,
                                viewColumn: vscode.ViewColumn.Active
                            });

                            scanAnimationController = new ScanAnimationController(editor);
                            const totalLines = document.lineCount;
                            const estimatedTime = Math.max(2000, Math.min(10000, 2000 + totalLines * 3));
                            const scanSpeed = estimatedTime / totalLines;

                            scanAnimationController.start(scanSpeed);
                            lastScannedPath = resolvedPath;
                        }
                    } catch (error) {
                        console.error('Failed to open file for scan animation:', error);
                    }
                }
                break;
            }

            console.log('执行 apply_diff', block);

            // 如果扫描动画正在运行，让它快速完成
            if (scanAnimationController) {
                await scanAnimationController.finishScanning();
                scanAnimationController = null;
            }
            lastScannedPath = null;

            const { toolResult } = await applyDiff({
                toolUseCommand: block,
            });
            console.log('apply_diff 完成', toolResult);
            pushToolResult({ block, content: toolResult + getEnvironmentDetails(visibleFiles, openTabs) });
            break;
        }
        case 'execute_command': {
            if (block.partial) {
                console.log('execute_command is partial')
                break
            }
            console.log('执行到execute_command啦！', block)
            const { toolResult } = await executeCommand({
                toolUseCommand: block,
            })
            console.log('execute_command result is:', toolResult)
            pushToolResult({ block, content: toolResult })
            break;
        }

        case 'ask_followup_question': {
            if (block.partial) {
                break;
            }
            console.log('到了ask_followup_question')

            // 通过 webview postMessage 通知前端更新 loading 状态
            if (multiRoundSharedState.webviewView) {
                multiRoundSharedState.webviewView.webview.postMessage({
                    type: 'update-loading',
                    payload: { chatLoading: false }
                });
            }
            break;
        }

        case 'update_todo_list': {
            if (block.partial) {
                break;
            }
            console.log('到了update_todo_list', block)
            const { toolResult } = await updateTodoList({
                toolUseCommand: block,
            })
            console.log('todolist result is:', toolResult)
            pushToolResult({ block, content: toolResult + getEnvironmentDetails(visibleFiles, openTabs) })

        }
        case 'attempt_completion': {
            if (block.partial) {
                break;
            }
            const { toolResult } = await attemptCompletion({
                toolUseCommand: block,
            })
            if (toolResult.length > 0) {
                pushToolResult({ block, content: toolResult })
            }
            break;
        }
        case 'search_files': {
            if (block.partial) {
                break;
            }
            console.log('到了search_files', block)
            const { toolResult } = await searchFiles({
                toolUseCommand: block,
            })
            pushToolResult({ block, content: toolResult })
        }
        case 'use_mcp_tool': {
            if (block.partial) {
                break;
            }
            console.log('到了use_mcp_tool', block)
            const { toolResult } = await useMcpTooltoTool({
                toolUseCommand: block,
            })
            pushToolResult({ block, content: toolResult })
        }
        case 'search_memory': {
            if (block.partial) {
                break;
            }
            console.log('到了search_memory', block)
            const { toolResult } = await searchMemory({
                toolUseCommand: block,
            })
            pushToolResult({ block, content: toolResult })
            break;
        }
        case 'search_knowledge_base': {
            if (block.partial) {
                break;
            }
            console.log('到了search_knowledge_base', block)
            const { toolResult } = await searchKnowledgeBase({
                toolUseCommand: block,
            })
            pushToolResult({ block, content: toolResult })
            break;
        }
        // case 'access_mcp_resource': {
        //     if (block.partial) {
        //         break;
        //     }
        //     console.log('到了access_mcp_resource', block)
        //     const { toolResult } = await accessMcpResource({
        //         toolUseCommand: block,
        //     })
        // }
    }
};
