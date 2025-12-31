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
            let textValue = accumulator.slice(currentTextContentStartIndex).trimStart()

            const lastOpenBracket = textValue.lastIndexOf('<');
            if (lastOpenBracket !== -1) {
                const potentialTag = textValue.slice(lastOpenBracket);
                if (!potentialTag.includes('>')) {
                    const contentAfterBracket = potentialTag.slice(1);
                    const isPartialTag = toolUseNames.some(name => {
                        if (name.startsWith(contentAfterBracket)) return true;
                        if (contentAfterBracket.startsWith(name + ' ') || contentAfterBracket.startsWith(name + '\n')) return true;
                        return false;
                    });
                    if (potentialTag === '<' || isPartialTag) {
                        textValue = textValue.slice(0, lastOpenBracket);
                    }
                }
            }

            currentTextContent.content.text = textValue
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
        let textValue = accumulator.slice(currentTextContentStartIndex).trim()

        const lastOpenBracket = textValue.lastIndexOf('<');
        if (lastOpenBracket !== -1) {
            const potentialTag = textValue.slice(lastOpenBracket);
            if (!potentialTag.includes('>')) {
                const contentAfterBracket = potentialTag.slice(1);
                const isPartialTag = toolUseNames.some(name => {
                    if (name.startsWith(contentAfterBracket)) return true;
                    if (contentAfterBracket.startsWith(name + ' ') || contentAfterBracket.startsWith(name + '\n')) return true;
                    return false;
                });
                if (potentialTag === '<' || isPartialTag) {
                    textValue = textValue.slice(0, lastOpenBracket);
                }
            }
        }

        currentTextContent.content.text = textValue
        // 仅在包含内容时添加可能部分的文本块
        if (currentTextContent.content.text.length > 0) {
            contentBlocks.push(currentTextContent)
        }
    }
    //为每条信息添加唯一id
    contentBlocks.forEach((block, index) => {
        block.id = requestId + '_' + index
    })
    // console.log('contentBlocks is:', contentBlocks)
    return contentBlocks
}



// export function parseAssistantMessageV2(assistantMessage: string): AssistantMessageContent[] {
// 	const contentBlocks: AssistantMessageContent[] = []

// 	let currentTextContentStart = 0 // Index where the current text block started.
// 	let currentTextContent: TextContent | undefined = undefined
// 	let currentToolUseStart = 0 // Index *after* the opening tag of the current tool use.
// 	let currentToolUse: ToolUse | undefined = undefined
// 	let currentParamValueStart = 0 // Index *after* the opening tag of the current param.
// 	let currentParamName: ToolParamName | undefined = undefined

// 	// Precompute tags for faster lookups.
// 	const toolUseOpenTags = new Map<string, ToolParamName>()
// 	const toolParamOpenTags = new Map<string, ToolParamName>()

// 	for (const name of toolParamNames) {
// 		toolUseOpenTags.set(`<${name}>`, name)
// 	}

// 	for (const name of toolParamNames) {
// 		toolParamOpenTags.set(`<${name}>`, name)
// 	}

// 	const len = assistantMessage.length

// 	for (let i = 0; i < len; i++) {
// 		const currentCharIndex = i

// 		// Parsing a tool parameter
// 		if (currentToolUse && currentParamName) {
// 			const closeTag = `</${currentParamName}>`
// 			// Check if the string *ending* at index `i` matches the closing tag
// 			if (
// 				currentCharIndex >= closeTag.length - 1 &&
// 				assistantMessage.startsWith(
// 					closeTag,
// 					currentCharIndex - closeTag.length + 1, // Start checking from potential start of tag.
// 				)
// 			) {
// 				// Found the closing tag for the parameter.
// 				const value = assistantMessage.slice(
// 					currentParamValueStart, // Start after the opening tag.
// 					currentCharIndex - closeTag.length + 1, // End before the closing tag.
// 				)
// 				// Don't trim content parameters to preserve newlines, but strip first and last newline only
// 				currentToolUse.params[currentParamName] =
// 					currentParamName === "content" ? value.replace(/^\n/, "").replace(/\n$/, "") : value.trim()
// 				currentParamName = undefined // Go back to parsing tool content.
// 				// We don't continue loop here, need to check for tool close or other params at index i.
// 			} else {
// 				continue // Still inside param value, move to next char.
// 			}
// 		}

// 		// Parsing a tool use (but not a specific parameter).
// 		if (currentToolUse && !currentParamName) {
// 			// Ensure we are not inside a parameter already.
// 			// Check if starting a new parameter.
// 			let startedNewParam = false

// 			for (const [tag, paramName] of toolParamOpenTags.entries()) {
// 				if (
// 					currentCharIndex >= tag.length - 1 &&
// 					assistantMessage.startsWith(tag, currentCharIndex - tag.length + 1)
// 				) {
// 					currentParamName = paramName
// 					currentParamValueStart = currentCharIndex + 1 // Value starts after the tag.
// 					startedNewParam = true
// 					break
// 				}
// 			}

// 			if (startedNewParam) {
// 				continue // Handled start of param, move to next char.
// 			}

// 			// Check if closing the current tool use.
// 			const toolCloseTag = `</${currentToolUse.name}>`

// 			if (
// 				currentCharIndex >= toolCloseTag.length - 1 &&
// 				assistantMessage.startsWith(toolCloseTag, currentCharIndex - toolCloseTag.length + 1)
// 			) {
// 				// End of the tool use found.
// 				// Special handling for content params *before* finalizing the
// 				// tool.
// 				const toolContentSlice = assistantMessage.slice(
// 					currentToolUseStart, // From after the tool opening tag.
// 					currentCharIndex - toolCloseTag.length + 1, // To before the tool closing tag.
// 				)

// 				// Check if content parameter needs special handling
// 				// (write_to_file/new_rule).
// 				// This check is important if the closing </content> tag was
// 				// missed by the parameter parsing logic (e.g., if content is
// 				// empty or parsing logic prioritizes tool close).
// 				const contentParamName: ToolParamName = "content"
// 				if (
// 					currentToolUse.name === "write_to_file" /* || currentToolUse.name === "new_rule" */ &&
// 					// !(contentParamName in currentToolUse.params) && // Only if not already parsed.
// 					toolContentSlice.includes(`<${contentParamName}>`) // Check if tag exists.
// 				) {
// 					const contentStartTag = `<${contentParamName}>`
// 					const contentEndTag = `</${contentParamName}>`
// 					const contentStart = toolContentSlice.indexOf(contentStartTag)

// 					// Use `lastIndexOf` for robustness against nested tags.
// 					const contentEnd = toolContentSlice.lastIndexOf(contentEndTag)

// 					if (contentStart !== -1 && contentEnd !== -1 && contentEnd > contentStart) {
// 						// Don't trim content to preserve newlines, but strip first and last newline only
// 						const contentValue = toolContentSlice
// 							.slice(contentStart + contentStartTag.length, contentEnd)
// 							.replace(/^\n/, "")
// 							.replace(/\n$/, "")
// 						currentToolUse.params[contentParamName] = contentValue
// 					}
// 				}

// 				currentToolUse.partial = false // Mark as complete.
// 				contentBlocks.push(currentToolUse)
// 				currentToolUse = undefined // Reset state.
// 				currentTextContentStart = currentCharIndex + 1 // Potential text starts after this tag.
// 				continue // Move to next char.
// 			}

// 			// If not starting a param and not closing the tool, continue
// 			// accumulating tool content implicitly.
// 			continue
// 		}

// 		// Parsing text / looking for tool start.
// 		if (!currentToolUse) {
// 			// Check if starting a new tool use.
// 			let startedNewTool = false

// 			for (const [tag, toolName] of toolUseOpenTags.entries()) {
// 				if (
// 					currentCharIndex >= tag.length - 1 &&
// 					assistantMessage.startsWith(tag, currentCharIndex - tag.length + 1)
// 				) {
// 					// End current text block if one was active.
// 					if (currentTextContent) {
// 						currentTextContent.content = assistantMessage
// 							.slice(
// 								currentTextContentStart, // From where text started.
// 								currentCharIndex - tag.length + 1, // To before the tool tag starts.
// 							)
// 							.trim()

// 						currentTextContent.partial = false // Ended because tool started.

// 						if (currentTextContent.content.length > 0) {
// 							contentBlocks.push(currentTextContent)
// 						}

// 						currentTextContent = undefined
// 					} else {
// 						// Check for any text between the last block and this tag.
// 						const potentialText = assistantMessage
// 							.slice(
// 								currentTextContentStart, // From where text *might* have started.
// 								currentCharIndex - tag.length + 1, // To before the tool tag starts.
// 							)
// 							.trim()

// 						if (potentialText.length > 0) {
// 							contentBlocks.push({
// 								type: "text",
// 								content: potentialText,
// 								partial: false,
// 							})
// 						}
// 					}

// 					// Start the new tool use.
// 					currentToolUse = {
// 						type: "tool_use",
// 						name: toolName,
// 						params: {},
// 						partial: true, // Assume partial until closing tag is found.
// 					}

// 					currentToolUseStart = currentCharIndex + 1 // Tool content starts after the opening tag.
// 					startedNewTool = true

// 					break
// 				}
// 			}

// 			if (startedNewTool) {
// 				continue // Handled start of tool, move to next char.
// 			}

// 			// If not starting a tool, it must be text content.
// 			if (!currentTextContent) {
// 				// Start a new text block if we aren't already in one.
// 				currentTextContentStart = currentCharIndex // Text starts at the current character.

// 				// Check if the current char is the start of potential text *immediately* after a tag.
// 				// This needs the previous state - simpler to let slicing handle it later.
// 				// Resetting start index accurately is key.
// 				// It should be the index *after* the last processed tag.
// 				// The logic managing currentTextContentStart after closing tags handles this.
// 				currentTextContent = {
// 					type: "text",
// 					content: "", // Will be determined by slicing at the end or when a tool starts
// 					partial: true,
// 				}
// 			}
// 			// Continue accumulating text implicitly; content is extracted later.
// 		}
// 	}

// 	// Finalize any open parameter within an open tool use.
// 	if (currentToolUse && currentParamName) {
// 		const value = assistantMessage.slice(currentParamValueStart) // From param start to end of string.
// 		// Don't trim content parameters to preserve newlines, but strip first and last newline only
// 		currentToolUse.params[currentParamName] =
// 			currentParamName === "content" ? value.replace(/^\n/, "").replace(/\n$/, "") : value.trim()
// 		// Tool use remains partial.
// 	}

// 	// Finalize any open tool use (which might contain the finalized partial param).
// 	if (currentToolUse) {
// 		// Tool use is partial because the loop finished before its closing tag.
// 		contentBlocks.push(currentToolUse)
// 	}
// 	// Finalize any trailing text content.
// 	// Only possible if a tool use wasn't open at the very end.
// 	else if (currentTextContent) {
// 		currentTextContent.content = assistantMessage
// 			.slice(currentTextContentStart) // From text start to end of string.
// 			.trim()

// 		// Text is partial because the loop finished.
// 		if (currentTextContent.content.length > 0) {
// 			contentBlocks.push(currentTextContent)
// 		}
// 	}

// 	return contentBlocks
// }
