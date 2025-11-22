import { ChatMessage, MessageStatus, MessageType } from "@/type/imType/im";

export class ChatMessageUtils {
    static isUserMessage(message: ChatMessage): boolean {
        return message.sender.targetId === 'user'
    }

    static isToolMessage(message: ChatMessage): boolean {
        return message.type === MessageType.ToolUse
    }
    static isCompletedMessage(message: ChatMessage): boolean {
        return message.status === MessageStatus.Complete
    }

    static isAttemptCompletionMessage(message: ChatMessage): boolean {
        return message.type === MessageType.ToolUse && message.content.toolName === 'attempt_completion' && message.status === MessageStatus.Complete
    }
}

export const removeThinkingTags = (text: string): string => {
    if (!text) return text

    try {
        return text.replace(/<\/?thinking\s*>/g, '').trim()
    } catch (error) {
        return text
    }

}