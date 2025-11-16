import { ChatConversation, ChatMessage } from "@/type/imType/im";

export interface IMState {
    chatMessages: ChatMessage[];
}

export const initialIMState: IMState = {
    chatMessages: []
}