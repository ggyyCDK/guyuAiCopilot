import { multiRoundSharedState } from "../assisantPresentStore/multiRoundSharedState";
import { ChatMessage, MessageStatus, MessageType } from "@/type/imType/im";
import { nextId } from "../llmRequest/recursivelyMakeRequests";
import pWaitFor from "p-wait-for";
export const ask = async (command: {
    type: string;
    text: string;
    partial?: boolean;
}): Promise<{ response: any, text?: string }> => {

    if (multiRoundSharedState.abort) {
        throw new Error(' ask abort')
    }

    const { type, text, partial } = command

    let askTs = Date.now()

    let chatMessage: ChatMessage = {
        msgId: nextId(),
        sender: {
            targetId: 'llm'
        },
        status: partial ? MessageStatus.Waiting : MessageStatus.Complete,
        sendTime: askTs,
        type: MessageType.Notice,
        content: text,
        ext: { type: 'ask', askType: type, partial: partial }
    }

    if (partial === false) {
        await pWaitFor(() =>
            multiRoundSharedState.askResponse !== undefined || multiRoundSharedState.lastMessageTs !== askTs
            , { interval: 100 })

        if (multiRoundSharedState.lastMessageTs !== askTs) {
            throw new Error('ask response timeout')
        }
    }

    const result = {
        response: multiRoundSharedState.askResponse!,
        text: multiRoundSharedState.askResponseText!,
    }
    multiRoundSharedState.askResponse = undefined
    multiRoundSharedState.askResponseText = undefined
    return result
}