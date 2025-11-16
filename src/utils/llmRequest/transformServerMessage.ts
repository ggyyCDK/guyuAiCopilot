import { ChatMessage, MessageStatus, MessageType } from '@/type/imType/im'
import { AssistantMessageContent, ToolParamName, ToolUseName } from '@/type/tools/msgToolsParse'

export type ChatWithToolMessage = ChatMessage<{ toolName: ToolUseName, params: Partial<Record<ToolParamName, string>> }>
//解析成react中需要的格式
export const transformServerMessage = (serverMessage: AssistantMessageContent): ChatMessage<any> => {
    //纯文本格式内容
    if (serverMessage.type === 'text') {
        //构建文本信息
        let chatMessage: ChatMessage<string> = {
            sender: { targetId: 'llm' },
            msgId: serverMessage.id,
            conversationId: serverMessage.cid,
            sendTime: Date.now(),
            status: MessageStatus.Complete,
            content: serverMessage.content.text,
            type: MessageType.Text,
            ext: {}
        }
        //如果是部分的，需要等待
        if (serverMessage.partial) {
            chatMessage.status = MessageStatus.Waiting
            if (chatMessage.ext) {
                chatMessage.ext.partial = true
            }
        }
        return chatMessage
    }

    //带有工具的内容
    if (serverMessage.type === 'tool_use') {
        let chatMessage: ChatWithToolMessage = {
            sender: { targetId: 'llm' },
            msgId: serverMessage.id,
            conversationId: serverMessage.cid,
            sendTime: Date.now(),
            status: MessageStatus.Complete,
            content: {
                toolName: serverMessage.name,
                params: serverMessage.params
            },
            type: MessageType.ToolUse,
            ext: {
                originMessage: serverMessage
            }
        }
        if (serverMessage.partial !== undefined) {
            if (serverMessage.partial) {
                chatMessage.status = MessageStatus.Waiting
            }
            chatMessage.ext.partial = serverMessage.partial

        }
        return chatMessage
    }
    throw new Error('can not handle serverMessage' + serverMessage)
}