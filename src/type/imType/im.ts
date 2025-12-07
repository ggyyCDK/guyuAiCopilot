export interface ChatConversation {
    conversationId: string;
}

export interface Target {
    targetId: 'llm' | 'user'
}

export enum MessageStatus {
    Init = 'init',
    Sending = 'sending',
    Waiting = 'waiting',
    Complete = 'complete',
    Delete = 'delete',
    INVALID = 'invalid'
}

export enum MessageType {
    Text = 'Text',
    ToolUse = 'ToolUse',
    Notice = 'Notice'
}
export interface ChatMessage<T = any> {
    conversationId?: string;
    msgId: string;
    sender: Target;
    sendTime: number;
    status: MessageStatus;
    type: MessageType;
    content: T;
    workerId?: number;
    ext: any
}

export interface AiSession {
    id: string;
    workerId: string;
    businessType?: string;
    name?: string;
    curPwd?: string;
    createDate: string;
    ext?: any;
}