import { ChatConversation, ChatMessage } from "@/type/imType/im";

export interface IMState {
    chatMessages: ChatMessage[]; //对话列表
    chatLoading: boolean; //对话是否加载中
}

export const initialIMState: IMState = {
    chatMessages: [],
    chatLoading: false
}