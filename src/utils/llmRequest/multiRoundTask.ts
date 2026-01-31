import { recursivelyMakeRequests } from "./recursivelyMakeRequests"
import { multiRoundTaskParams } from "@/type/imType/aiRequest"
import { multiRoundSharedState } from "../assisantPresentStore/multiRoundSharedState"
import { initConversation, writeMemory, incrementTurn } from "@/helper/tools/memoryWriter"
import * as vscode from 'vscode'

export const StartMultiRoundTask = async function (command: multiRoundTaskParams, webview: vscode.WebviewView) {
    //开启一次多轮对话
    multiRoundSharedState.abortController = new AbortController();
    multiRoundSharedState.abort = false;

    // 初始化新的对话记忆
    initConversation();
    incrementTurn();

    // 提取用户消息文本
    const userMessageText = typeof command.question === 'string' 
        ? command.question 
        : Array.isArray(command.question) 
            ? command.question.map(q => typeof q === 'string' ? q : q.text || '').join(' ')
            : '';

    // 写入用户消息到记忆
    if (userMessageText) {
        writeMemory({
            role: 'user',
            content: userMessageText
        });
    }

    const questionContent: any[] = [{ type: "text", text: command.question }];

    if (command.images && command.images.length > 0) {
        command.images.forEach(img => {
            let media_type = 'image/png';
            let data = img;

            if (img.startsWith('data:')) {
                const matches = img.match(/^data:(.+);base64,(.+)$/);
                if (matches) {
                    media_type = matches[1];
                    data = matches[2];
                }
            }

            questionContent.push({
                type: 'image_url',
                image_url: {
                    url: `data:${media_type};base64,${data}`
                }
            });
        });
    }
    console.log('questionContent is', questionContent)
    await recursivelyMakeRequests({
        ...command,
        question: questionContent,
        includeFileDetails: true
    }, webview)
}