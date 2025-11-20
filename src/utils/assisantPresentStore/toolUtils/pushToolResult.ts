import { ToolUse } from "@/type/tools/msgToolsParse";
import { multiRoundSharedState } from "@/utils/assisantPresentStore/multiRoundSharedState";
import { getToolDescription } from "@/utils/assisantPresentStore/toolUtils/getToolDescription";
export const pushToolResult = (command: { block: ToolUse; content: string | string[] }) => {
    const { block, content } = command
    multiRoundSharedState.userMessageContent.push({
        type: 'text',
        text: `${getToolDescription(block)} Result:`
    })
    if (typeof content === 'string') {
        multiRoundSharedState.userMessageContent.push({
            type: 'text',
            text: content || (`tool did not return anything`)
        })
    } else {
        multiRoundSharedState.userMessageContent.push(...content)
    }
    multiRoundSharedState.didAlreadyUseTool = true;
}