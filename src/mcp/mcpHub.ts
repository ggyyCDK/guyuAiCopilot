/**
 * - 仅监听项目配置文件（.schoober/mcp.json）
 * - 仅初始化项目服务器
 * - 支持 StdioClientTransport 和 SSEClientTransport
 * - 支持文件监听和自动重启
 * - 移除了所有错误处理、验证和 Windows 兼容逻辑
 */

import { Client } from "@modelcontextprotocol/sdk/client/index.js"
import { StdioClientTransport, getDefaultEnvironment } from "@modelcontextprotocol/sdk/client/stdio.js"
import { SSEClientTransport } from "@modelcontextprotocol/sdk/client/sse.js"
import ReconnectingEventSource from "reconnecting-eventsource"
import {
    CallToolResultSchema,
    ListResourcesResultSchema,
    ListResourceTemplatesResultSchema,
    ListToolsResultSchema,
    ReadResourceResultSchema,
} from "@modelcontextprotocol/sdk/types.js"
import chokidar, { FSWatcher } from "chokidar"
import * as fs from "fs/promises"
import * as path from "path"
import * as vscode from "vscode"

import {
    McpResource,
    McpResourceResponse,
    McpResourceTemplate,
    McpServer,
    McpTool,
    McpToolCallResponse,
} from "./mcpType"
import { getWorkspacePath } from "@/utils/llmUtils/path/path"

// ============================================================================
// 类型定义
// ============================================================================

export type ConnectedMcpConnection = {
    type: "connected"
    server: McpServer
    client: Client
    transport: StdioClientTransport | SSEClientTransport
}

export type DisconnectedMcpConnection = {
    type: "disconnected"
    server: McpServer
    client: null
    transport: null
}

export type McpConnection = ConnectedMcpConnection | DisconnectedMcpConnection

// ============================================================================
// McpHubSimple 类
// ============================================================================

export class McpHubSimple {
    // 所有 MCP 服务器连接列表
    connections: McpConnection[] = []

    // 标记是否正在连接服务器
    isConnecting: boolean = false

    // 扩展上下文
    private context: vscode.ExtensionContext

    // 工作区路径
    private workspacePath: string

    // 扩展版本
    private version: string

    // 服务器文件监听器映射表 (服务器名 -> 监听器列表)
    private fileWatchers: Map<string, FSWatcher[]> = new Map()

    // 项目级 MCP 配置文件监听器
    private projectMcpWatcher?: vscode.FileSystemWatcher

    // VSCode 资源清理列表
    private disposables: vscode.Disposable[] = []

    constructor(context: vscode.ExtensionContext) {
        this.context = context
        this.workspacePath = getWorkspacePath()
        this.version = context.extension?.packageJSON?.version ?? "1.0.0"

        this.watchProjectMcpFile()
        this.initializeProjectMcpServers()
    }

    // ========================================================================
    // 初始化方法
    // ========================================================================

    private async initializeProjectMcpServers(): Promise<void> {
        const projectMcpPath = await this.getProjectMcpPath()

        if (!projectMcpPath) {
            return
        }

        const content = await fs.readFile(projectMcpPath, "utf-8")
        const config = JSON.parse(content)
        console.log('mcp project config is', config)
        await this.updateServerConnections(config.mcpServers || {})
    }

    // ========================================================================
    // 配置文件路径方法
    // ========================================================================

    private async getProjectMcpPath(): Promise<string | null> {
        const projectMcpDir = path.join(this.workspacePath, ".schoober")
        const projectMcpPath = path.join(projectMcpDir, "mcp.json")

        try {
            await fs.access(projectMcpPath)
            return projectMcpPath
        } catch {
            return null
        }
    }

    // ========================================================================
    // 文件监听方法
    // ========================================================================

    /**
     * 监听项目级 MCP 配置文件（.schoober/mcp.json）
     */
    private async watchProjectMcpFile(): Promise<void> {
        if (this.projectMcpWatcher) {
            this.projectMcpWatcher.dispose()
            this.projectMcpWatcher = undefined
        }
        const projectMcpPattern = new vscode.RelativePattern(this.workspacePath, ".schoober/mcp.json")
        this.projectMcpWatcher = vscode.workspace.createFileSystemWatcher(projectMcpPattern)

        // 监听文件变化
        const changeDisposable = this.projectMcpWatcher.onDidChange(async () => {
            await this.handleConfigFileChange()
        })

        // 监听文件创建
        const createDisposable = this.projectMcpWatcher.onDidCreate(async () => {
            await this.handleConfigFileChange()
        })

        // 监听文件删除
        const deleteDisposable = this.projectMcpWatcher.onDidDelete(async () => {
            await this.cleanupProjectMcpServers()
        })

        this.disposables.push(
            vscode.Disposable.from(changeDisposable, createDisposable, deleteDisposable, this.projectMcpWatcher),
        )
    }

    /**
     * 处理配置文件变化
     */
    private async handleConfigFileChange(): Promise<void> {
        const projectMcpPath = await this.getProjectMcpPath()

        if (!projectMcpPath) {
            return
        }

        const content = await fs.readFile(projectMcpPath, "utf-8")
        const config = JSON.parse(content)

        await this.updateServerConnections(config.mcpServers || {})
    }

    /**
     * 清理所有项目级 MCP 服务器
     */
    private async cleanupProjectMcpServers(): Promise<void> {
        const projectConnections = this.connections.filter((conn) => conn.server.source === "project")

        for (const conn of projectConnections) {
            await this.deleteConnection(conn.server.name)
        }

        await this.updateServerConnections({})
    }

    /**
     * 设置服务器文件监听器
     */
    private setupFileWatcher(name: string, config: any): void {
        if (!this.fileWatchers.has(name)) {
            this.fileWatchers.set(name, [])
        }

        const watchers = this.fileWatchers.get(name) || []

        // 只有 stdio 类型才有 args
        if (config.command) {
            // 监听自定义 watchPaths
            if (config.watchPaths && config.watchPaths.length > 0) {
                const watchPathsWatcher = chokidar.watch(config.watchPaths, {})

                watchPathsWatcher.on("change", async () => {
                    await this.restartConnection(name)
                })

                watchers.push(watchPathsWatcher)
            }

            // 监听 build/index.js 文件
            const filePath = config.args?.find((arg: string) => arg.includes("build/index.js"))
            if (filePath) {
                const indexJsWatcher = chokidar.watch(filePath, {})

                indexJsWatcher.on("change", async () => {
                    await this.restartConnection(name)
                })

                watchers.push(indexJsWatcher)
            }

            if (watchers.length > 0) {
                this.fileWatchers.set(name, watchers)
            }
        }
    }

    /**
     * 移除所有文件监听器
     */
    private removeAllFileWatchers(): void {
        this.fileWatchers.forEach((watchers) => watchers.forEach((watcher) => watcher.close()))
        this.fileWatchers.clear()
    }

    /**
     * 移除特定服务器的文件监听器
     */
    private removeFileWatchersForServer(serverName: string): void {
        const watchers = this.fileWatchers.get(serverName)
        if (watchers) {
            watchers.forEach((watcher) => watcher.close())
            this.fileWatchers.delete(serverName)
        }
    }

    /**
     * 重启服务器连接
     */
    async restartConnection(serverName: string): Promise<void> {
        this.isConnecting = true

        const connection = this.findConnection(serverName)
        const config = connection?.server.config

        if (config) {
            connection.server.status = "connecting"
            connection.server.error = ""

            await this.deleteConnection(serverName)
            const parsedConfig = JSON.parse(config)
            await this.connectToServer(serverName, parsedConfig)
        }

        this.isConnecting = false
    }

    // ========================================================================
    // 服务器查询方法
    // ========================================================================

    getServers(): McpServer[] {
        return this.connections.filter((conn) => !conn.server.disabled).map((conn) => conn.server)
    }

    getAllServers(): McpServer[] {
        return this.connections.map((conn) => conn.server)
    }

    // ========================================================================
    // 核心连接方法
    // ========================================================================

    private async connectToServer(name: string, config: any): Promise<void> {
        await this.deleteConnection(name)

        if (config.disabled) {
            const connection: DisconnectedMcpConnection = {
                type: "disconnected",
                server: {
                    name,
                    config: JSON.stringify(config),
                    status: "disconnected",
                    disabled: true,
                    source: "project",
                    projectPath: this.workspacePath,
                    errorHistory: [],
                },
                client: null,
                transport: null,
            }
            this.connections.push(connection)
            return
        }

        // 设置文件监听器
        this.setupFileWatcher(name, config)

        const client = new Client(
            {
                name: "Roo Code",
                version: this.version,
            },
            {
                capabilities: {},
            },
        )

        let transport: StdioClientTransport | SSEClientTransport

        if (config.command) {
            // Stdio 配置
            transport = new StdioClientTransport({
                command: config.command,
                args: config.args,
                cwd: config.cwd || this.workspacePath,
                env: {
                    ...getDefaultEnvironment(),
                    ...(config.env || {}),
                },
                stderr: "pipe",
            })
        } else if (config.url && config.type === "sse") {
            // SSE 配置
            const reconnectingEventSourceOptions = {
                max_retry_time: 5000,
                withCredentials: config.headers?.["Authorization"] ? true : false,
                fetch: (url: string | URL, init: RequestInit) => {
                    const headers = new Headers({ ...(init?.headers || {}), ...(config.headers || {}) })
                    return fetch(url, {
                        ...init,
                        headers,
                    })
                },
            }
                ; (global as any).EventSource = ReconnectingEventSource
            transport = new SSEClientTransport(new URL(config.url), {
                requestInit: {
                    headers: config.headers,
                },
                eventSourceInit: reconnectingEventSourceOptions,
            })
        } else {
            throw new Error(`Unsupported server configuration`)
        }

        const connection: ConnectedMcpConnection = {
            type: "connected",
            server: {
                name,
                config: JSON.stringify(config),
                status: "connecting",
                disabled: config.disabled,
                source: "project",
                projectPath: this.workspacePath,
                errorHistory: [],
            },
            client,
            transport,
        }
        this.connections.push(connection)

        await client.connect(transport)
        connection.server.status = "connected"
        connection.server.error = ""
        connection.server.instructions = client.getInstructions()

        connection.server.tools = await this.fetchToolsList(name)
        connection.server.resources = await this.fetchResourcesList(name)
        connection.server.resourceTemplates = await this.fetchResourceTemplatesList(name)
    }

    private findConnection(serverName: string): McpConnection | undefined {
        return this.connections.find((conn) => conn.server.name === serverName)
    }

    // ========================================================================
    // 工具和资源获取方法
    // ========================================================================

    private async fetchToolsList(serverName: string): Promise<McpTool[]> {
        const connection = this.findConnection(serverName)
        if (!connection || connection.type !== "connected") {
            return []
        }

        const response = await connection.client.request({ method: "tools/list" }, ListToolsResultSchema)

        const tools = (response?.tools || []).map((tool: any) => ({
            ...tool,
            alwaysAllow: false,
            enabledForPrompt: true,
        }))

        return tools
    }

    private async fetchResourcesList(serverName: string): Promise<McpResource[]> {
        const connection = this.findConnection(serverName)

        if (!connection || connection.type !== "connected") {
            return []
        }

        const response = await connection.client.request({ method: "resources/list" }, ListResourcesResultSchema)
        return response?.resources || []
    }

    private async fetchResourceTemplatesList(serverName: string): Promise<McpResourceTemplate[]> {
        const connection = this.findConnection(serverName)

        if (!connection || connection.type !== "connected") {
            return []
        }

        const response = await connection.client.request(
            { method: "resources/templates/list" },
            ListResourceTemplatesResultSchema,
        )
        return response?.resourceTemplates || []
    }

    async deleteConnection(name: string): Promise<void> {
        // 清理文件监听器
        this.removeFileWatchersForServer(name)

        const connections = this.connections.filter((conn) => conn.server.name === name)

        for (const connection of connections) {
            if (connection.type === "connected") {
                await connection.transport.close()
                await connection.client.close()
            }
        }

        this.connections = this.connections.filter((conn) => conn.server.name !== name)
    }

    async updateServerConnections(newServers: Record<string, any>): Promise<void> {
        this.isConnecting = true
        this.removeAllFileWatchers()

        const currentNames = new Set(this.connections.map((conn) => conn.server.name))
        const newNames = new Set(Object.keys(newServers))

        // 删除不存在的服务器
        for (const name of currentNames) {
            if (!newNames.has(name)) {
                await this.deleteConnection(name)
            }
        }

        // 更新或添加服务器
        for (const [name, config] of Object.entries(newServers)) {
            const currentConnection = this.findConnection(name)

            if (!currentConnection) {
                // 新服务器
                await this.connectToServer(name, config)
            } else if (JSON.stringify(JSON.parse(currentConnection.server.config)) !== JSON.stringify(config)) {
                // 配置已变化的现有服务器
                await this.deleteConnection(name)
                await this.connectToServer(name, config)
            }
        }

        this.isConnecting = false
    }
    // ========================================================================
    // 核心 API 方法
    // ========================================================================

    /**
     * 调用 MCP 工具
     */
    async callTool(
        serverName: string,
        toolName: string,
        toolArguments?: Record<string, unknown>,
    ): Promise<any> {
        const connection = this.findConnection(serverName)

        if (!connection || connection.type !== "connected") {
            throw new Error(`No connection found for server: ${serverName}`)
        }

        if (connection.server.disabled) {
            throw new Error(`Server "${serverName}" is disabled`)
        }

        return await connection.client.request(
            {
                method: "tools/call",
                params: {
                    name: toolName,
                    arguments: toolArguments,
                },
            },
            CallToolResultSchema,
        )
    }

    /**
     * 读取 MCP 资源
     */
    async readResource(serverName: string, uri: string): Promise<McpResourceResponse> {
        const connection = this.findConnection(serverName)

        if (!connection || connection.type !== "connected") {
            throw new Error(`No connection found for server: ${serverName}`)
        }

        if (connection.server.disabled) {
            throw new Error(`Server "${serverName}" is disabled`)
        }

        return await connection.client.request(
            {
                method: "resources/read",
                params: {
                    uri,
                },
            },
            ReadResourceResultSchema,
        )
    }

    // ========================================================================
    // 清理方法
    // ========================================================================

    async dispose(): Promise<void> {
        this.removeAllFileWatchers()

        for (const connection of this.connections) {
            await this.deleteConnection(connection.server.name)
        }

        this.connections = []

        if (this.projectMcpWatcher) {
            this.projectMcpWatcher.dispose()
            this.projectMcpWatcher = undefined
        }

        this.disposables.forEach((d) => d.dispose())
        this.disposables = []
    }
}