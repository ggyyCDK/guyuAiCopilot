import { ToolUse } from "@/type/tools/msgToolsParse";

export const getToolDescription = (block: ToolUse) => {
    const toolName = block.name
    switch (toolName) {
        case "search_files":
            return `[${toolName} for '${block.params.regex}'${block.params.file_pattern ? ` in '${block.params.file_pattern}'` : ""
                }]`
        case "read_file":
            return `[${toolName} for ${block.params.args}]`
        case "write_to_file":
            return `[${toolName} for ${block.params.path}]`
        case "replace_in_file":
            return `[${toolName} for ${block.params.path}]`
        case "apply_diff":
            return `[${toolName} for ${block.params.path}]`
        case "use_mcp_tool":
            return `[${toolName} for ${block.params.server_name}]`
        case "access_mcp_resource":
            return `[${toolName} for ${block.params.server_name}]`
        case 'attempt_completion':
            return `[${toolName}]`
    }
    return `[${toolName}]`

}