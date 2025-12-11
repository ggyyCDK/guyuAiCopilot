import * as vscode from 'vscode';
import { IToolExecutor } from '@/type/tools/msgToolsParse';
import { McpServerManager } from '@/mcp/McpServerManager';
import { McpToolCallResponse } from '@/mcp/mcpType';

interface McpToolParams {
    server_name?: string;
    tool_name?: string;
    arguments?: string;
}

type ValidationResult =
    | { isValid: false; message: string }
    | {
        isValid: true
        serverName: string
        toolName: string
        parsedArguments?: Record<string, unknown>
    }

/**
 * 获取已初始化的 MCP Hub。
 * 使用 McpServerManager 单例模式获取实例。
 */
function getMcpHub() {
    try {
        return McpServerManager.getInstance();
    } catch (error) {
        console.error('Failed to get MCP Hub:', error);
        return null;
    }
}

async function validateParams(params: McpToolParams): Promise<ValidationResult> {
    if (!params.server_name) {
        return { isValid: false, message: 'Missing "server_name" parameter' }
    }

    if (!params.tool_name) {
        return { isValid: false, message: 'Missing "tool_name" parameter' }
    }

    let parsedArguments: Record<string, unknown> | undefined;

    if (params.arguments) {
        try {
            parsedArguments = JSON.parse(params.arguments);
        } catch (error) {
            return { isValid: false, message: 'Invalid JSON in "arguments"' }
        }
    }

    return {
        isValid: true,
        serverName: params.server_name,
        toolName: params.tool_name,
        parsedArguments,
    }
}

function formatToolResult(result?: McpToolCallResponse): string {
    if (!result || !Array.isArray(result.content) || result.content.length === 0) {
        return '(No response)';
    }

    const parts = result.content
        .map((item) => {
            switch (item.type) {
                case 'text':
                    return item.text;
                case 'resource': {
                    const { blob: _ignored, ...rest } = item.resource;
                    return JSON.stringify(rest, null, 2);
                }
                case 'image':
                case 'audio':
                    return `[${item.type}] ${item.mimeType}`;
                default:
                    return JSON.stringify(item);
            }
        })
        .filter(Boolean);

    const combined = parts.join('\n\n');
    if (!combined) {
        return '(No response)';
    }
    return result.isError ? `Error:\n${combined}` : combined;
}

/**
 * mcp工具调用
 */
export const useMcpTooltoTool: IToolExecutor = async (command) => {
    const { toolUseCommand } = command;
    const params: McpToolParams = {
        server_name: toolUseCommand.params.server_name,
        tool_name: toolUseCommand.params.tool_name,
        arguments: toolUseCommand.params.arguments,
    }

    const validation = await validateParams(params);
    if (!validation.isValid) {
        return {
            toolResult: validation.message,
        }
    }

    const mcpHub = getMcpHub();
    if (!mcpHub) {
        return {
            toolResult: 'MCP hub is not initialized. Please ensure the extension has created a hub instance.',
        }
    }

    try {
        const result = await mcpHub.callTool(validation.serverName, validation.toolName, validation.parsedArguments);
        return {
            toolResult: formatToolResult(result),
        }
    } catch (error: any) {
        const message = error instanceof Error ? error.message : String(error);
        return {
            toolResult: `Failed to execute MCP tool: ${message}`,
        }
    }
};