import { ToolUse } from "@/type/tools/msgToolsParse";

export const getToolDescription = (block: ToolUse) => {
    const toolName = block.name
    switch (toolName) {
        case "read_file":
            return `[${toolName} for ${block.params.path}]`
        case "write_to_file":
            return `[${toolName} for ${block.params.path}]`
        case "replace_in_file":
            return `[${toolName} for ${block.params.path}]`
        case 'attempt_completion':
            return `[${toolName}]`
    }
    return `[${toolName}]`

}