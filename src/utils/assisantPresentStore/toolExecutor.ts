import { ToolParamName, ToolUse } from "@/type/tools/msgToolsParse";
import { multiRoundSharedState } from "./multiRoundSharedState";
import { formatResponse } from "@/helper/responsePrompt/responseFormatter";
import { pushToolResult } from "@/utils/assisantPresentStore/toolUtils/pushToolResult";
import { getToolDescription } from "@/utils/assisantPresentStore/toolUtils/getToolDescription";
import { readFile } from "@/helper/tools/readFiles";

import { getEnvironmentDetails } from "@/helper/environment/getEnvironmentDetails";

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

    const visibleFiles = '';
    const openTabs = '';
    switch (block.name) {
        case 'read_file':
            if (block.partial) {
                console.log('read_file is partial')
                break
            }
            const { toolResult } = await readFile({
                toolUseCommand: block,
            })

            pushToolResult({ block, content: toolResult + getEnvironmentDetails(visibleFiles, openTabs) })
            break
    }
};
