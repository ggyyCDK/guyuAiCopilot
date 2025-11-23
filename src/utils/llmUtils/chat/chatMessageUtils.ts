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

/**
 * 移除未闭合的标签
 * 对于流式输出中的未完成标签（如 <xxx、<read_file、<attempt_completion 等），
 * 会将其从渲染内容中移除，只有当标签完整（有配对的 >）时才会渲染
 */
export const removeUnclosedTags = (text: string): string => {
    if (!text) return text

    try {
        // 检测开头是否存在未闭合的标签
        const firstOpenBracketIndex = text.indexOf("<")
        if (firstOpenBracketIndex !== -1) {
            // 从第一个 '<' 开始查找到第一个 '>' 或字符串结束
            let closeBracketIndex = text.indexOf(">", firstOpenBracketIndex)
            
            // 如果没有找到 '>'，说明标签未闭合
            if (closeBracketIndex === -1) {
                const possibleTag = text.slice(firstOpenBracketIndex)
                // 提取潜在的标签名称，区分开标签 / 闭标签
                let tagContent: string
                if (possibleTag.startsWith("</")) {
                    tagContent = possibleTag.slice(2).trim()
                } else {
                    tagContent = possibleTag.slice(1).trim()
                }
                // 仅在疑似合法标签名时才进行裁剪（字母、数字、下划线和连字符）
                const isLikelyTagName = /^[a-zA-Z_][\w-]*$/.test(tagContent)
                // 若只是单独的 "<" 或 "</" 也直接清理，避免渲染异常字符
                const isOpeningOrClosing = possibleTag === "<" || possibleTag === "</"
                // 当检测到未完成标签时，移除从标签开始到结尾的所有内容
                if (isOpeningOrClosing || isLikelyTagName) {
                    return text.slice(0, firstOpenBracketIndex).trim()
                }
            }
        }
        return text
    } catch (error) {
        return text
    }
}