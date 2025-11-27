import { AssistantMessageContent } from "../../type/tools/msgToolsParse";
import * as vscode from 'vscode';

interface MultiRoundSharedState {
    userMessageContentReady: boolean;
    currentStreamingContentIndex: number;
    presentAssistantMessageLocked: boolean;
    presentAssistantMessageHasPendingUpdates: boolean;
    abort: boolean;
    didCompleteReadingStream: boolean;
    didAlreadyUseTool: boolean;
    didRejectTool: boolean;
    assistantMessageContent: AssistantMessageContent[];
    userMessageContent: any[];

    // 纯问答类的其实不需要生成版本，只有当修改了文件、新增了文件的时候才需要
    needGenerateNewVersion: boolean;

    lastMessageTs?: number;
    askResponseText?: string;
    askResponse?: any;

    // webview 引用，用于向前端发送消息
    webviewView?: vscode.WebviewView;
}


let multiRoundSharedState: MultiRoundSharedState = {
    userMessageContentReady: false,
    currentStreamingContentIndex: 0,
    presentAssistantMessageLocked: false,
    presentAssistantMessageHasPendingUpdates: false,
    abort: false,
    needGenerateNewVersion: false,
    assistantMessageContent: [],
    didAlreadyUseTool: false,
    didRejectTool: false,
    didCompleteReadingStream: false,
    userMessageContent: [],
    askResponseText: '',
};

// @ts-ignore
// window.multiRoundSharedState = multiRoundSharedState;

export { multiRoundSharedState };