import { ChatConversation, ChatMessage } from "@/type/imType/im";
import { TodoItem } from '@/type/tools/todo'

export interface IMState {
    chatMessages: ChatMessage[]; //对话列表
    chatLoading: boolean; //对话是否加载中
    totalTokens: number; //累积的token数
    todoList: TodoItem[],
}

export const initialIMState: IMState = {
    chatMessages: [],
    todoList: [],
    chatLoading: false,
    totalTokens: 0
}