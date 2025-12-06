import { attemptApiRequestTypeWriter } from '@/handler';
import { wrapUserMessage } from '@/utils/llmRequest/wrapUserMessage'
import { parseOriginAssistantMessage } from '@/utils/llmRequest/parseAssisantMessage'
import { formatResponse } from '@/helper/responsePrompt/responseFormatter'
import { multiRoundTaskParams } from '@/type/imType/aiRequest'
import { multiRoundSharedState } from '../assisantPresentStore/multiRoundSharedState';
import { presentAssistantMessage, resetMultiRoundSharedState } from '../assisantPresentStore/presentAssistantMessage';
import * as vscode from 'vscode'
import { uniqueId } from 'lodash'
import pWaitFor from 'p-wait-for';

export const nextId = () => {
    return `${new Date().getTime()}_${uniqueId()}`
}

export const recursivelyMakeRequests = async function (command: multiRoundTaskParams, webviewView: vscode.WebviewView) {

    const { question, workerId, conversationId, baseUrl, variableMaps, includeFileDetails = false } = command;

    // 将 webviewView 保存到共享状态中，以便工具执行时可以访问
    multiRoundSharedState.webviewView = webviewView;

    if (question.length < 1) {
        console.log('用户输入为空')
        return true
    }
    if (!question) {
        webviewView.webview.postMessage({
            type: 'stream-error',
            payload: { error: '请输入问题后再尝试。' }
        });
        return;
    }

    if (multiRoundSharedState.abort) {
        throw new Error("Aborted");
    }

    console.log('question is', question)
    // 回复的消息，可能是纯文本，也可能是带有工具格式的回复，需要解析
    // 将字符串 question 转换为 UserContent 格式

    const { parsedUserContentList, environmentDetails } = await wrapUserMessage({
        userContent: question as any,
        includeFileDetails
    });
    // 如果传入了详情，要加入环境信息给大模型
    if (includeFileDetails) {
        parsedUserContentList.push({ type: 'text', text: environmentDetails })
    }


    // 每次新的递归重置状态
    resetMultiRoundSharedState()
    //生成消息id，一个流式输出会经过多次parseOriginAssistantMessage去格式化，保证多次输出消息id是一致的
    const requestId = nextId()
    const stream = await attemptApiRequestTypeWriter({
        question: parsedUserContentList,
        workerId,
        conversationId,
        variableMaps,
        baseUrl,
        signal: multiRoundSharedState.abortController?.signal,
        onUsage: (usage) => {
            // 解析usage数据并发送到webview
            try {
                const usageData = typeof usage === 'string' ? JSON.parse(usage) : usage;
                const totalTokens = usageData.total_tokens || 0;

                webviewView.webview.postMessage({
                    type: 'update-tokens',
                    payload: { totalTokens }
                });
            } catch (error) {
                console.error('解析usage数据失败:', error);
            }
        }
    });
    let assistantMessage = '';

    for await (const chunk of stream) {
        assistantMessage += chunk;
        // console.log('assistantMessage is', assistantMessage)
        const previousLength = multiRoundSharedState.assistantMessageContent.length;
        const serverMessageList = parseOriginAssistantMessage({
            assistantMessage,
            requestId
        })
        multiRoundSharedState.assistantMessageContent = serverMessageList


        webviewView.webview.postMessage({
            type: 'stream-data',
            payload: { serverMessageList },
        });
        // console.log('serverMessageList is :', serverMessageList)

        if (multiRoundSharedState.assistantMessageContent.length > previousLength) {
            multiRoundSharedState.userMessageContentReady = false;
        }
        // 助手消息处理
        presentAssistantMessage();
        // console.log('循环内助手消息处理完毕', multiRoundSharedState.assistantMessageContent)

    }
    if (multiRoundSharedState.abort) {
        return true;
    }

    console.log('助手消息处理完毕', multiRoundSharedState.assistantMessageContent)
    multiRoundSharedState.didCompleteReadingStream = true;
    // 将所有块设置为完成状态，以允许 presentAssistantMessage 完成并将 userMessageContentReady 设置为 true
    // （可能是没有后续工具使用的文本块，或最后的文本块，或无效的工具使用等。无论哪种情况，presentAssistantMessage 都依赖于这些块要么完成，要么用户拒绝某个块，以便继续并最终将 userMessageContentReady 设置为 true）
    const partialBlocks = multiRoundSharedState.assistantMessageContent.filter((block) => block.partial)
    partialBlocks.forEach((block) => {
        block.partial = false
    })
    if (partialBlocks.length > 0) {
        presentAssistantMessage() // 如果有内容需要更新，它将完成并将 this.userMessageContentReady 更新为 true，我们在发出下一个请求之前会等待它。这实际上只是呈现我们刚刚设置为完成的最后一条部分消息
    }

    let didEndLoop = false
    if (assistantMessage.length > 0) {
        // 注意：此注释供将来参考 - 这是 userMessageContent 未设置为 true 的解决方法。这是因为在 didRejectTool 时它没有递归调用部分块，所以它会卡在等待部分块完成后才能继续。
        // 以防内容块完成
        // API 流可能在最后一个解析的内容块执行后完成，因此我们能够检测越界并将 userMessageContentReady 设置为 true（注意不应调用 presentAssistantMessage，因为如果最后一个块已完成，它将再次呈现）
        // const completeBlocks = this.assistantMessageContent.filter((block) => !block.partial) // 如果流结束后有任何部分块，我们可以认为它们无效
        // if (this.currentStreamingContentIndex >= completeBlocks.length) {
        // 	this.userMessageContentReady = true
        // }

        await pWaitFor(() => multiRoundSharedState.userMessageContentReady)

        // 如果模型没有使用工具，那么我们需要告诉它使用工具或尝试完成，因为最终回答肯定要以attempt_completion工具完成
        const didToolUse = multiRoundSharedState.assistantMessageContent.some((block) => block.type === "tool_use")

        if (!didToolUse) {
            // 需要使用工具的正常请求
            multiRoundSharedState.userMessageContent.push({
                type: "text",
                text: formatResponse.noToolsUsed(false),
            })
        }
        const recDidEndLoop = await recursivelyMakeRequests({ ...command, question: multiRoundSharedState.userMessageContent }, webviewView)
        didEndLoop = recDidEndLoop
    }


    return didEndLoop
}