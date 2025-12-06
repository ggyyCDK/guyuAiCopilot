
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
    onUsage?: (usage: any) => void;
    signal?: AbortSignal;
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

export interface multiRoundTaskParams {
    question: string | any;
    workerId: string;
    conversationId?: string;
    baseUrl: string;
    variableMaps?: Record<string, any>;
    includeFileDetails?: boolean;
}

/**
 * 压缩会话上下文请求参数
 */
export interface CompressSessionContextParams {
    sessionId: string;
    baseUrl?: string;
    apiKey?: string;
}

/**
 * 压缩会话上下文响应数据
 */
export interface CompressSessionContextResult {
    sessionId: string;
    lastMessageId?: string;
    compressedUsage?: {
        prompt_tokens?: number;
        completion_tokens?: number;
        total_tokens?: number;
    };
}

/**
 * 压缩会话上下文响应
 */
export interface CompressSessionContextResponse {
    success: boolean;
    data: {
        compressedUsage: number;
        lastMessageId: string
    } | null;
    message: string;
}