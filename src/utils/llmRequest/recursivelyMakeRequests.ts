import { attemptApiRequestTypeWriter } from '@/handler';
import { wrapUserMessage } from '@/utils/llmRequest/wrapUserMessage'
import { parseAssistantMessageV2 } from '@/utils/llmRequest/parseAssisantMessage'
import { multiRoundTaskParams } from '@/type/imType/aiRequest'
import * as vscode from 'vscode'

export const recursivelyMakeRequests = async function (command: multiRoundTaskParams, webviewView: vscode.WebviewView) {

    const { question, workerId, conversationId, baseUrl, variableMaps, includeFileDetails } = command;
    if (!question) {
        webviewView.webview.postMessage({
            type: 'stream-error',
            payload: { error: '请输入问题后再尝试。' }
        });
        return;
    }

    console.log('question is', question)
    //回复的消息，可能是纯文本，也可能是带有工具格式的回复，需要解析
    // 将字符串 question 转换为 UserContent 格式

    const { parsedUserContentList, environmentDetails } = await wrapUserMessage({
        userContent: question as any,
        includeFileDetails
    });
    //如果传入了详情，要加入环境信息给大模型
    if (includeFileDetails) {
        parsedUserContentList.push({ type: 'text', text: environmentDetails })
    }
    try {
        const stream = await attemptApiRequestTypeWriter({
            question: parsedUserContentList,
            workerId,
            conversationId,
            variableMaps,
            baseUrl,
        });
        let assistantMessage = '';
        for await (const chunk of stream) {
            assistantMessage += chunk;
            const serverMessageList = parseAssistantMessageV2(assistantMessage)

            // mergeMessages(serverMessageList.map(transformServerMessage))
            webviewView.webview.postMessage({
                type: 'stream-data',
                payload: { serverMessageList },
            });
        }
    } catch (error) {
        const message = error instanceof Error ? error.message : (typeof error === 'string' ? error : '未知错误');
        webviewView.webview.postMessage({
            type: 'stream-error',
            payload: { error: message },
        });
    }

}