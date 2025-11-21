import { ToolParamName, ToolUse } from "@/type/tools/msgToolsParse";
import { multiRoundSharedState } from "./multiRoundSharedState";
import { formatResponse } from "@/helper/responsePrompt/responseFormatter";
import { pushToolResult } from "@/utils/assisantPresentStore/toolUtils/pushToolResult";
import { getToolDescription } from "@/utils/assisantPresentStore/toolUtils/getToolDescription";
import { readFile } from "@/helper/tools/readFiles";
import { attemptCompletion } from "@/helper/tools/attemptCompletion";

import { getEnvironmentDetails, getVisibleFiles, getOpenTabs } from "@/helper/environment/getEnvironmentDetails";

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
    }
};
