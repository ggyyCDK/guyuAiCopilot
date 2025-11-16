
export interface IMessageResult {
    content: string; //完整内容
    segmentContent: string; //分片内容
}

export interface ApiRequestParams {
    question: string | any;
    conversationId?: string;
    baseUrl: string;
    workerId: string;
    variableMaps?: Record<string, any>;
    onMessage?: (message: IMessageResult) => void;
    onIntervalMessage?: (message: IMessageResult) => void;
    onComplete?: (message: IMessageResult) => void;
    onError?: (error: any) => void;
}

export enum EventType {
    Message = 'message',
    Complete = 'complete',
    MessageError = 'error',
    Usage = 'usage',
    Null = 'null'
}

export interface ParseResult {
    eventType: EventType;
    content: string;
}