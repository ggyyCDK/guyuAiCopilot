import { useCallback, useEffect } from "react";
import { useIMStore } from "@/store/imStore/createStore";
import { ChatMessageUtils } from "@/utils/llmUtils/chat/chatMessageUtils";
import { ChatMessage } from "@/type/imType/im";
import cloneDeep from 'clone-deep'

export const useSyncChatMessage = (conversationId: string) => {
    const chatMessages = useIMStore(state => state.chatMessages)
    const saveMessages = useCallback(async (currentMessage: ChatMessage) => {
        const clonedMessage = cloneDeep(currentMessage)
        const formattedMessage = {
            ...clonedMessage,
            id: currentMessage.msgId,
            conversationId,
        }
        if (formattedMessage.content && currentMessage.type === 'Text') {
            formattedMessage.content = { text: currentMessage.content }
        }
        (window as any).vscode.postMessage({
            type: 'save-chat-message',
            payload: {
                sessionId: conversationId,
                message: formattedMessage
            }
        })
    }, [conversationId])

    useEffect(() => {
        syncMessage()
    }, [chatMessages])

    const syncMessage = async () => {
        const lastMessage = chatMessages.at(-1);
        if (!lastMessage) return;
        try {
            if (ChatMessageUtils.isCompletedMessage(lastMessage)) {
                await saveMessages(lastMessage)
            }

        } catch (error) {
            console.error(error)
        }
        // console.log('chatMessages save is', chatMessages)
    }
}
