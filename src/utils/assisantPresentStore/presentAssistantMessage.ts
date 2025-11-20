/**
 * 助手消息处理模块
 * 
 * 该模块负责处理多轮对话中助手消息的展示和解析逻辑，
 * 包括文本内容的解析和工具使用的处理。
 * 
 * 主要功能：
 * - 管理助手消息的流式展示
 * - 处理消息内容的分块解析
 * - 控制消息展示的锁定机制
 * - 处理工具使用和文本内容的不同类型消息
 */

import { multiRoundSharedState } from '@/utils/assisantPresentStore/multiRoundSharedState';
import { parseText } from '@/utils/assisantPresentStore/parseText';
import { parseToolUse } from '@/utils/assisantPresentStore/toolExecutor';
import { cloneDeep } from 'lodash';

/**
 * 展示助手消息的主要函数
 * 
 * 该函数负责管理助手消息的流式展示过程，包括：
 * 1. 检查中止状态和锁定状态
 * 2. 按顺序处理消息内容块
 * 3. 根据内容类型（文本/工具使用）进行相应处理
 * 4. 管理消息展示的状态和流程控制
 * 
 * @throws {Error} 当 Dalaran 实例被中止时抛出错误
 */
export const presentAssistantMessage = async function () {
    // 检查是否已中止操作
    if (multiRoundSharedState.abort) {
        throw new Error('Dalaran instance aborted');
    }

    // 检查是否已被锁定，如果是则标记有待处理的更新并返回
    // 这个锁定机制防止并发调用导致的状态混乱
    if (multiRoundSharedState.presentAssistantMessageLocked) {
        multiRoundSharedState.presentAssistantMessageHasPendingUpdates = true;
        return;
    }

    // 设置锁定状态，防止并发执行
    multiRoundSharedState.presentAssistantMessageLocked = true;
    // 重置待处理更新标志
    multiRoundSharedState.presentAssistantMessageHasPendingUpdates = false;

    // 检查当前流式内容索引是否超出消息内容数组长度
    if (multiRoundSharedState.currentStreamingContentIndex >= multiRoundSharedState.assistantMessageContent.length) {
        // 这种情况可能发生在最后一个内容块在流式传输完成前就已经完成的情况下
        // 如果流式传输已完成，且索引超出范围，说明我们已经展示/执行了最后一个内容块，准备继续下一个请求
        if (multiRoundSharedState.didCompleteReadingStream) {
            multiRoundSharedState.userMessageContentReady = true;
        }
        // console.log("no more content blocks to stream! this shouldn't happen?")

        // 释放锁定状态
        multiRoundSharedState.presentAssistantMessageLocked = false;
        return;
        //throw new Error("No more content blocks to stream! This shouldn't happen...") // remove and just return after testing
    }

    // 深拷贝当前要处理的内容块，避免引用问题
    const block = cloneDeep(
        multiRoundSharedState.assistantMessageContent[multiRoundSharedState.currentStreamingContentIndex],
    );

    // 根据内容块类型进行不同的处理
    switch (block.type) {
        case 'text':
            // 如果工具被拒绝或已经使用过工具，则跳过文本处理
            if (multiRoundSharedState.didRejectTool || multiRoundSharedState.didAlreadyUseTool) {
                break;
            }
            // 解析文本内容
            parseText(block);
            // console.log('presentAssistantMessage text:', result);
            break;

        case 'tool_use':
            // 异步处理工具使用
            await parseToolUse(block);
            // console.log('tool_use:', block);
            break;
    }

    /*
    看到索引超出范围是正常的，这意味着下一个工具调用正在构建并准备添加到 assistantMessageContent 中进行展示。
    当你看到 UI 在此期间处于非活动状态时，这意味着某个工具在没有展示任何 UI 的情况下出现了问题。
    例如，当 relpath 未定义时，write_to_file 工具会出现问题，对于无效的 relpath，它永远不会展示 UI。
    */

    // 释放锁定状态 - 这需要放在这里，否则下面调用 presentAssistantMessage 可能会失败（有时）因为它被锁定了
    multiRoundSharedState.presentAssistantMessageLocked = false;

    // 注意：当工具被拒绝时，迭代器流会被中断，它会等待 userMessageContentReady 为 true。
    // 未来对 present 的调用会跳过执行，因为 didRejectTool，并迭代直到 contentIndex 设置为消息长度，
    // 然后它自己设置 userMessageContentReady 为 true（而不是在迭代器中提前执行）

    // 检查块是否完成流式传输和执行
    if (!block.partial || multiRoundSharedState.didRejectTool || multiRoundSharedState.didAlreadyUseTool) {
        // 块已完成流式传输和执行

        // 检查是否是最后一个内容块
        if (
            multiRoundSharedState.currentStreamingContentIndex ===
            multiRoundSharedState.assistantMessageContent.length - 1
        ) {
            // 即使 !didCompleteReadingStream 时增加索引也是可以的，它只会因为超出范围而返回，
            // 随着流式传输的继续，如果新块准备好了，它会调用 presentAssistantMessage。
            // 如果流式传输完成，那么当超出范围时我们设置 userMessageContentReady 为 true。
            // 这优雅地允许流继续，所有潜在的内容块都被展示。

            // 最后一个块完成且执行完毕
            multiRoundSharedState.userMessageContentReady = true; // 允许 pwaitfor 继续
        }

        // 如果存在下一个块则调用它（如果不存在，读取流会在准备好时调用它）
        multiRoundSharedState.currentStreamingContentIndex++; // 无论如何都需要增加，这样当读取流再次调用此函数时，它将流式传输下一个块

        // 检查是否还有更多内容块需要流式传输
        if (multiRoundSharedState.currentStreamingContentIndex < multiRoundSharedState.assistantMessageContent.length) {
            // 已经有更多内容块要流式传输，所以我们自己调用这个函数
            // await this.presentAssistantContent()

            // 递归调用处理下一个内容块
            void presentAssistantMessage();
            return;
        }
    }

    // 块是部分的，但读取流可能已经完成
    // 如果有待处理的更新，继续处理
    if (multiRoundSharedState.presentAssistantMessageHasPendingUpdates) {
        void presentAssistantMessage();
    }
};


export const resetMultiRoundSharedState = () => {
    // reset streaming state
    multiRoundSharedState.currentStreamingContentIndex = 0;
    multiRoundSharedState.assistantMessageContent = [];
    multiRoundSharedState.didCompleteReadingStream = false;
    multiRoundSharedState.userMessageContentReady = false;
    multiRoundSharedState.userMessageContent = [];
    multiRoundSharedState.didAlreadyUseTool = false;
    multiRoundSharedState.presentAssistantMessageLocked = false;
    multiRoundSharedState.presentAssistantMessageHasPendingUpdates = false;
}