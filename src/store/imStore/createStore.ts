import { createWithEqualityFn } from 'zustand/traditional'
import { shallow } from 'zustand/shallow'
import { IMState, initialIMState } from './initalState'
import { ChatMessage, AiSession } from "@/type/imType/im";
import { TodoItem } from '@/type/tools/todo'
import { merge } from 'lodash'


interface Action {
    //合并消息
    mergeMessages: (newMessages: Array<ChatMessage>) => void
    //获取最后一条消息
    getLastMessage: () => ChatMessage | undefined
    //更新待办事项列表
    //更新待办事项列表
    setTodoList: (todoList: TodoItem[]) => void
    //设置当前工作区路径
    setPwd: (pwd: string) => void
    //设置会话列表
    setSessionList: (sessionList: AiSession[]) => void
    //初始化数据
    initData: () => void
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
            // console.log('Array.from(messagesMap.values())', Array.from(messagesMap.values()))
            return { chatMessages: Array.from(messagesMap.values()) }
        })

    },
    getLastMessage: () => {
        return get().chatMessages[get().chatMessages.length - 1]
    },
    setTodoList: (todoList: TodoItem[]) => {
        set({ todoList });
    },
    setPwd: (pwd: string) => {
        set({ pwd });
    },
    setSessionList: (sessionList: AiSession[]) => {
        set({ sessionList });
    },
    initData: () => {

    },
    shallow
}))