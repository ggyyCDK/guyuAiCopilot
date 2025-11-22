import { AssistantMessageContent, TextContent, toolUseNames, ToolUseName, toolParamNames, ToolParamName, ToolUse } from '@/type/tools/msgToolsParse'

export function parseOriginAssistantMessage(command: { assistantMessage: string, requestId: string }): AssistantMessageContent[] {
    const { assistantMessage, requestId } = command
    const contentBlocks: AssistantMessageContent[] = []
    let currentTextContent: TextContent | undefined = undefined
    let currentTextContentStartIndex = 0
    let currentToolUse: ToolUse | undefined = undefined
    let currentToolUseStartIndex = 0
    let currentParamName: ToolParamName | undefined = undefined
    let currentParamValueStartIndex = 0
    let accumulator = ""
    console.log('parseOriginAssistantMessage is:', assistantMessage)
    for (let i = 0; i < assistantMessage.length; i++) {
        const char = assistantMessage[i]
        accumulator += char

        // --- 状态：解析工具参数 ---
        // 不应该存在没有工具使用的参数
        if (currentToolUse && currentParamName) {
            const currentParamValue = accumulator.slice(currentParamValueStartIndex)
            const paramClosingTag = `</${currentParamName}>`
            if (currentParamValue.endsWith(paramClosingTag)) {
                // 找到参数值的结束标签
                currentToolUse.params[currentParamName] = currentParamValue.slice(0, -paramClosingTag.length).trim()
                currentParamName = undefined // 返回解析工具内容或查找下一个参数
                continue // 移动到下一个字符
            } else {
                // 部分参数值正在累积
                continue // 移动到下一个字符
            }
        }

        // --- 状态：解析工具使用（但不是特定参数）---
        // 没有 currentParamName
        if (currentToolUse) {
            const currentToolValue = accumulator.slice(currentToolUseStartIndex)
            const toolUseClosingTag = `</${currentToolUse.name}>`

            if (currentToolValue.endsWith(toolUseClosingTag)) {
                // 找到工具使用的结束标签
                currentToolUse.partial = false
                contentBlocks.push(currentToolUse)
                currentToolUse = undefined // 返回解析文本或查找下一个工具
                // 重置文本起始索引，以防文本紧随其后
                currentTextContentStartIndex = i + 1
                continue // 移动到下一个字符
            } else {
                // 检查是否在当前工具使用中开始新参数
                const possibleParamOpeningTags = toolParamNames.map((name) => `<${name}>`)
                let foundParamStart = false
                for (const paramOpeningTag of possibleParamOpeningTags) {
                    if (accumulator.endsWith(paramOpeningTag)) {
                        // 找到新参数的开始标签
                        currentParamName = paramOpeningTag.slice(1, -1) as ToolParamName
                        currentParamValueStartIndex = accumulator.length
                        foundParamStart = true
                        break
                    }
                }
                if (foundParamStart) {
                    continue // 移动到下一个字符
                }

                // write_to_file/new_rule 内容参数的特殊情况，允许嵌套标签
                // 检查是否出现 </content> 标签，可能表示内容参数的结束
                // 即使尚未看到主工具关闭标签
                const contentParamName: ToolParamName = "content"
                if (
                    (currentToolUse.name === "write_to_file" || currentToolUse.name === "new_rule") &&
                    accumulator.endsWith(`</${contentParamName}>`)
                ) {
                    const toolContent = accumulator.slice(currentToolUseStartIndex)
                    const contentStartTag = `<${contentParamName}>`
                    const contentEndTag = `</${contentParamName}>`
                    const contentStartIndex = toolContent.indexOf(contentStartTag) + contentStartTag.length
                    // 使用 lastIndexOf 处理 </content> 可能出现在内容本身中的情况
                    const contentEndIndex = toolContent.lastIndexOf(contentEndTag)

                    // 确保找到有效的开始/结束标签，并且结束标签在开始标签之后
                    if (
                        contentStartIndex !== -1 &&
                        contentEndIndex !== -1 &&
                        contentEndIndex > contentStartIndex - contentStartTag.length // 确保结束标签在开始标签之后
                    ) {
                        // 检查此内容参数是否已被解析。如果是，则更新它。
                        // 如果不是，并且我们刚刚找到关闭标签，则分配它。
                        // 这处理了 </content> 检测可能在 <content> 标签检测逻辑之前触发的情况，或者内容非常短的情况。
                        if (currentParamName === contentParamName) {
                            // 已经在解析内容，现在找到了结束标签
                            currentToolUse.params[contentParamName] = toolContent.slice(contentStartIndex, contentEndIndex).trim()
                            currentParamName = undefined // 完成此参数
                        } else if (currentParamName === undefined) {
                            // 未解析参数，但找到了 </content>。假设它关闭了内容块。
                            currentToolUse.params[contentParamName] = toolContent.slice(contentStartIndex, contentEndIndex).trim()
                            // 我们保持在"解析工具使用"状态，寻找更多参数或工具结束标签。
                        }
                    }
                }

                // 如果以上都不是，部分工具值正在累积
                continue // 移动到下一个字符
            }
        }

        // --- 状态：解析文本（或寻找工具使用的开始）---
        // 没有 currentToolUse
        let didStartToolUse = false
        const possibleToolUseOpeningTags = toolUseNames.map((name) => `<${name}>`)
        for (const toolUseOpeningTag of possibleToolUseOpeningTags) {
            if (accumulator.endsWith(toolUseOpeningTag)) {
                // 找到新工具使用的开始标签
                const toolName = toolUseOpeningTag.slice(1, -1) as ToolUseName
                currentToolUse = {
                    id: '',
                    cid: '',
                    type: "tool_use",
                    name: toolName,
                    params: {},
                    partial: true,
                }
                currentToolUseStartIndex = accumulator.length

                // 这也表示当前文本内容块的结束（如果有）
                if (currentTextContent) {
                    currentTextContent.partial = false
                    // 提取文本内容，删除形成工具开始标签的部分
                    const textEndIndex = accumulator.length - toolUseOpeningTag.length
                    currentTextContent.content.text = accumulator.slice(currentTextContentStartIndex, textEndIndex).trim()
                    // 仅在有实际内容时添加
                    if (currentTextContent.content.text.length > 0) {
                        contentBlocks.push(currentTextContent)
                    }
                    currentTextContent = undefined
                } else {
                    // 检查在此工具使用开始之前是否有文本
                    const textEndIndex = accumulator.length - toolUseOpeningTag.length
                    const potentialText = accumulator.slice(currentTextContentStartIndex, textEndIndex).trim()
                    if (potentialText.length > 0) {
                        contentBlocks.push({
                            id: '',
                            cid: '',
                            type: "text",
                            content: {
                                text: potentialText
                            },
                            partial: false, // 因为工具使用开始而结束
                        })
                    }
                }

                didStartToolUse = true
                break // 找到工具开始，停止检查其他
            }
        }

        if (!didStartToolUse) {
            // 没有工具使用开始，所以必须是文本内容正在累积
            // （或在关闭的工具使用后继续）
            if (currentTextContent === undefined) {
                // 新文本块的开始
                currentTextContentStartIndex = i - (accumulator.length - currentTextContentStartIndex - 1) // 根据自上一个块结束或开始以来累积的量调整起始索引
                // 如果累加器从 0 开始，起始索引为 i
                if (contentBlocks.length === 0 && currentToolUse === undefined) {
                    currentTextContentStartIndex = accumulator.length - 1 // i
                } else {
                    // 根据当前文本段的实际开始重新计算
                    // 找到最后一个块的结束位置
                    let lastBlockEndIndex = 0
                    if (contentBlocks.length > 0) {
                        const lastBlock = contentBlocks[contentBlocks.length - 1]
                        // 近似：找到累加器与最后一个块的消息字符串表示的结尾匹配的位置。这很复杂。
                        // 更简单：假设文本在最后一个块在索引 i 处隐式结束后立即开始。
                        lastBlockEndIndex = i // 最后一个块完成处理时循环所在的位置
                        // 需要一种更可靠的方法来跟踪与最后一个块对应的*原始字符串*的结束索引。
                        // 为了简单起见，让我们在此版本中坚持使用累加器切片方法。
                        // 起始索引应该是当前*未匹配*文本开始的位置。
                        let lastProcessedIndex = -1
                        if (contentBlocks.length > 0) {
                            // 这需要知道前一个块的原始字符串长度，V1 不容易明确跟踪。
                            // 我们将根据当前累加器和起始索引逻辑进行近似。
                            // 如果刚刚关闭了工具标签，就会出现问题。累加器包含直到 i 的所有内容。
                            // lastBlockEndIndex 应该指向最后一个块的关闭标签*之后*的字符。
                        }
                        // 将起始索引重置为*当前*潜在文本块的开头
                        currentTextContentStartIndex = accumulator.length - 1 // 从当前字符 `i` 开始累积
                    }

                    // 如果我们刚刚关闭了一个工具，文本在其关闭标签*之后*开始
                    // 这里的逻辑需要改进，以便在工具关闭后获得准确的起始索引。
                    // 现在让我们假设循环内的起始索引逻辑通过切片来处理它。
                }

                currentTextContent = {
                    id: '',
                    cid: '',
                    type: "text",
                    content: {
                        text: ''
                    }, // 内容将通过切片累加器填充
                    partial: true,
                }
            }
            // 根据累加器从其起始索引更新文本内容
            currentTextContent.content.text = accumulator.slice(currentTextContentStartIndex).trimStart() // 修剪开头以避免文本跟随工具时的前导空格
        }
    } // 循环结束

    // --- 循环后的最终处理 ---

    // 如果在结束时工具使用处于打开状态
    if (currentToolUse) {
        // 如果该工具使用中有参数处于打开状态
        if (currentParamName) {
            // 剩余的累加器内容属于此部分参数
            currentToolUse.params[currentParamName] = accumulator.slice(currentParamValueStartIndex).trim()
        }
        // 添加可能部分的工具使用块
        contentBlocks.push(currentToolUse)
    }
    // 如果在结束时正在累积文本内容
    // 注意：这里只能定义 currentToolUse 或 currentTextContent 之一，
    // 因为开始工具使用会完成前面的文本块。
    else if (currentTextContent) {
        // 最后一次更新内容
        currentTextContent.content.text = accumulator.slice(currentTextContentStartIndex).trim()
        // 仅在包含内容时添加可能部分的文本块
        if (currentTextContent.content.text.length > 0) {
            contentBlocks.push(currentTextContent)
        }
    }
    //为每条信息添加唯一id
    contentBlocks.forEach((block, index) => {
        block.id = requestId + '_' + index
    })
    console.log('contentBlocks is:', contentBlocks)
    return contentBlocks
}