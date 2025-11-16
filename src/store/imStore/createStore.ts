import { createWithEqualityFn } from 'zustand/traditional'
import { shallow } from 'zustand/shallow'
import { IMState, initialIMState } from './initalState'
import { ChatMessage } from "@/type/imType/im";
import { merge } from 'lodash'

interface Action {
    //合并消息
    mergeMessages: (newMessages: Array<ChatMessage>) => void
    //获取最后一条消息
    getLastMessage: () => ChatMessage | undefined

}

export type Store = IMState & Action

export const useIMStore = createWithEqualityFn<Store>((set, get) => ({
    ...initialIMState,
    mergeMessages: (newMessages: Array<ChatMessage>) => {
        set(state => {
            const messagesMap = new Map(state.chatMessages.map(msg => [msg.msgId, msg]))
            newMessages.forEach(newMsg => {
                const existingMsg = messagesMap.get(newMsg.msgId);
                if (existingMsg) {
                    messagesMap.set(newMsg.msgId, Object.assign({}, merge(existingMsg, newMsg)))
                } else {
                    messagesMap.set(newMsg.msgId, newMsg)
                }
            })
            return { chatMessages: Array.from(messagesMap.values()) }
        })

    },
    getLastMessage: () => {
        return get().chatMessages[get().chatMessages.length - 1]
    }

}))