import { attemptApiRequestTypeWriter } from '@/handler';
import { wrapUserMessage } from '@/utils/llmRequest/wrapUserMessage'
import { parseOriginAssistantMessage } from '@/utils/llmRequest/parseAssisantMessage'
import { formatResponse } from '@/helper/responsePrompt/responseFormatter'
import { multiRoundTaskParams } from '@/type/imType/aiRequest'
import { multiRoundSharedState } from '../assisantPresentStore/multiRoundSharedState';
import { presentAssistantMessage, resetMultiRoundSharedState } from '../assisantPresentStore/presentAssistantMessage';
import * as vscode from 'vscode'
import pWaitFor from 'p-wait-for';
export const recursivelyMakeRequests = async function (command: multiRoundTaskParams, webviewView: vscode.WebviewView) {

    const { question, workerId, conversationId, baseUrl, variableMaps, includeFileDetails = false } = command;
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


    //每次新的递归重置状态
    // resetMultiRoundSharedState()
    multiRoundSharedState.currentStreamingContentIndex = 0;
    multiRoundSharedState.assistantMessageContent = [];
    multiRoundSharedState.didCompleteReadingStream = false;
    multiRoundSharedState.userMessageContentReady = false;
    multiRoundSharedState.userMessageContent = [];
    multiRoundSharedState.didAlreadyUseTool = false;
    multiRoundSharedState.presentAssistantMessageLocked = false;
    multiRoundSharedState.presentAssistantMessageHasPendingUpdates = false;

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
        console.log('assistantMessage is', assistantMessage)
        const previousLength = multiRoundSharedState.assistantMessageContent.length;
        const serverMessageList = parseOriginAssistantMessage(assistantMessage)
        multiRoundSharedState.assistantMessageContent = serverMessageList


        webviewView.webview.postMessage({
            type: 'stream-data',
            payload: { serverMessageList },
        });
        // console.log('serverMessageList is :', serverMessageList)

        if (multiRoundSharedState.assistantMessageContent.length > previousLength) {
            multiRoundSharedState.userMessageContentReady = false;
        }
        //助手消息处理
        presentAssistantMessage();
    }
    console.log('助手消息处理完毕', multiRoundSharedState.assistantMessageContent)
    multiRoundSharedState.didCompleteReadingStream = true;
    // set any blocks to be complete to allow presentAssistantMessage to finish and set userMessageContentReady to true
    // (could be a text block that had no subsequent tool uses, or a text block at the very end, or an invalid tool use, etc. whatever the case, presentAssistantMessage relies on these blocks either to be completed or the user to reject a block in order to proceed and eventually set userMessageContentReady to true)
    const partialBlocks = multiRoundSharedState.assistantMessageContent.filter((block) => block.partial)
    partialBlocks.forEach((block) => {
        block.partial = false
    })
    // this.assistantMessageContent.forEach((e) => (e.partial = false)) // can't just do this bc a tool could be in the middle of executing ()
    if (partialBlocks.length > 0) {
        presentAssistantMessage() // if there is content to update then it will complete and update this.userMessageContentReady to true, which we pwaitfor before making the next request. all this is really doing is presenting the last partial message that we just set to complete
    }

    let didEndLoop = false
    if (assistantMessage.length > 0) {
        // NOTE: this comment is here for future reference - this was a workaround for userMessageContent not getting set to true. It was due to it not recursively calling for partial blocks when didRejectTool, so it would get stuck waiting for a partial block to complete before it could continue.
        // in case the content blocks finished
        // it may be the api stream finished after the last parsed content block was executed, so  we are able to detect out of bounds and set userMessageContentReady to true (note you should not call presentAssistantMessage since if the last block is completed it will be presented again)
        // const completeBlocks = this.assistantMessageContent.filter((block) => !block.partial) // if there are any partial blocks after the stream ended we can consider them invalid
        // if (this.currentStreamingContentIndex >= completeBlocks.length) {
        // 	this.userMessageContentReady = true
        // }

        await pWaitFor(() => multiRoundSharedState.userMessageContentReady)

        // if the model did not tool use, then we need to tell it to either use a tool or attempt_completion
        const didToolUse = multiRoundSharedState.assistantMessageContent.some((block) => block.type === "tool_use")

        if (!didToolUse) {
            // normal request where tool use is required
            multiRoundSharedState.userMessageContent.push({
                type: "text",
                text: formatResponse.noToolsUsed(true),
            })
        }
        const recDidEndLoop = await recursivelyMakeRequests({ ...command, question: multiRoundSharedState.userMessageContent }, webviewView)
        didEndLoop = recDidEndLoop
    }


    return didEndLoop
}