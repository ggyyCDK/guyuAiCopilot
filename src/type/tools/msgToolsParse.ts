export type AssistantMessageContent = TextContent | ToolUse

export interface TextContent {
    id: string;
    cid: string;
    type: "text"
    content: {
        text: string
    }
    partial: boolean
}

export const toolUseNames = [
    "execute_command",
    "read_file",
    "write_to_file",
    "replace_in_file",
    "apply_diff",
    "search_files",
    "list_files",
    "list_code_definition_names",
    "browser_action",
    "use_mcp_tool",
    "access_mcp_resource",
    "ask_followup_question",
    "plan_mode_respond",
    "load_mcp_documentation",
    "update_todo_list",
    "attempt_completion",
    "new_task",
    "condense",
    "report_bug",
    "new_rule",
    "web_fetch",
    "search_memory",
    "search_knowledge_base",
] as const

// Converts array of tool call names into a union type ("execute_command" | "read_file" | ...)
export type ToolUseName = (typeof toolUseNames)[number]

export const toolParamNames = [
    "args",
    "todos",
    "command",
    "requires_approval",
    "path",
    "content",
    "diff",
    "regex",
    "file_pattern",
    "recursive",
    "action",
    "url",
    "coordinate",
    "text",
    "server_name",
    "tool_name",
    "arguments",
    "uri",
    "question",
    "options",
    "response",
    "result",
    "context",
    "title",
    "what_happened",
    "steps_to_reproduce",
    "api_request_output",
    "additional_context",
    "cwd",
    "query",
    "limit",
    "collection",
    "topk",
    "score_threshold",
    "use_rerank",
    "rerank_top_n",
] as const

export type IToolExecutor = (
    command: {
        toolUseCommand: ToolUse
    },
    callBack?: () => Promise<any>
) => Promise<{ toolResult: string }>

export type ToolParamName = (typeof toolParamNames)[number]

export interface ToolUse {
    id: string;
    cid: string;
    type: "tool_use";
    name: ToolUseName;
    // params is a partial record, allowing only some or none of the possible parameters to be used
    params: Partial<Record<ToolParamName, string>>
    partial: boolean
}
