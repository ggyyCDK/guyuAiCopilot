import { ChatConversation, ChatMessage } from "@/type/imType/im";

export interface IMState {
    chatMessages: ChatMessage[]; //对话列表
    chatLoading: boolean; //对话是否加载中
    totalTokens: number; //累积的token数
}

export const initialIMState: IMState = {
    chatMessages: [],
    chatLoading: false,
    totalTokens: 0
}