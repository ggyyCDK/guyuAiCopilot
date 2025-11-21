import { AssistantMessageContent, TextContent, toolUseNames, ToolUseName, toolParamNames, ToolParamName, ToolUse } from '@/type/tools/msgToolsParse'

export function parseOriginAssistantMessage(assistantMessage: string): AssistantMessageContent[] {

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

        // --- State: Parsing a Tool Parameter ---
        // there should not be a param without a tool use
        if (currentToolUse && currentParamName) {
            const currentParamValue = accumulator.slice(currentParamValueStartIndex)
            const paramClosingTag = `</${currentParamName}>`
            if (currentParamValue.endsWith(paramClosingTag)) {
                // End of param value found
                currentToolUse.params[currentParamName] = currentParamValue.slice(0, -paramClosingTag.length).trim()
                currentParamName = undefined // Go back to parsing tool content or looking for next param
                continue // Move to next character
            } else {
                // Partial param value is accumulating
                continue // Move to next character
            }
        }

        // --- State: Parsing a Tool Use (but not a specific parameter) ---
        // no currentParamName
        if (currentToolUse) {
            const currentToolValue = accumulator.slice(currentToolUseStartIndex)
            const toolUseClosingTag = `</${currentToolUse.name}>`

            if (currentToolValue.endsWith(toolUseClosingTag)) {
                // End of a tool use found
                currentToolUse.partial = false
                contentBlocks.push(currentToolUse)
                currentToolUse = undefined // Go back to parsing text or looking for next tool
                // Reset text start index in case text follows immediately
                currentTextContentStartIndex = i + 1
                continue // Move to next character
            } else {
                // Check if starting a new parameter within the current tool use
                const possibleParamOpeningTags = toolParamNames.map((name) => `<${name}>`)
                let foundParamStart = false
                for (const paramOpeningTag of possibleParamOpeningTags) {
                    if (accumulator.endsWith(paramOpeningTag)) {
                        // Start of a new parameter found
                        currentParamName = paramOpeningTag.slice(1, -1) as ToolParamName
                        currentParamValueStartIndex = accumulator.length
                        foundParamStart = true
                        break
                    }
                }
                if (foundParamStart) {
                    continue // Move to next character
                }

                // Special case for write_to_file/new_rule content param allowing nested tags
                // Check if a </content> tag appears, potentially indicating the end of the content param
                // even if the main tool closing tag hasn't been seen yet.
                const contentParamName: ToolParamName = "content"
                if (
                    (currentToolUse.name === "write_to_file" || currentToolUse.name === "new_rule") &&
                    accumulator.endsWith(`</${contentParamName}>`)
                ) {
                    const toolContent = accumulator.slice(currentToolUseStartIndex)
                    const contentStartTag = `<${contentParamName}>`
                    const contentEndTag = `</${contentParamName}>`
                    const contentStartIndex = toolContent.indexOf(contentStartTag) + contentStartTag.length
                    // Use lastIndexOf to handle cases where </content> might appear within the content itself
                    const contentEndIndex = toolContent.lastIndexOf(contentEndTag)

                    // Ensure we found valid start/end tags and end is after start
                    if (
                        contentStartIndex !== -1 &&
                        contentEndIndex !== -1 &&
                        contentEndIndex > contentStartIndex - contentStartTag.length // Ensure end tag is after start tag begins
                    ) {
                        // Check if this content param was already being parsed. If so, update it.
                        // If not, and we just found the closing tag, assign it.
                        // This handles cases where the </content> detection might fire before
                        // the <content> tag detection logic, or if the content is very short.
                        if (currentParamName === contentParamName) {
                            // Already parsing content, now we found the end tag
                            currentToolUse.params[contentParamName] = toolContent.slice(contentStartIndex, contentEndIndex).trim()
                            currentParamName = undefined // Finished with this param
                        } else if (currentParamName === undefined) {
                            // Not parsing a param, but found </content>. Assume it closes the content block.
                            currentToolUse.params[contentParamName] = toolContent.slice(contentStartIndex, contentEndIndex).trim()
                            // We stay in the "parsing tool use" state, looking for more params or the tool end tag.
                        }
                    }
                }

                // If none of the above, partial tool value is accumulating
                continue // Move to next character
            }
        }

        // --- State: Parsing Text (or looking for start of a tool use) ---
        // no currentToolUse
        let didStartToolUse = false
        const possibleToolUseOpeningTags = toolUseNames.map((name) => `<${name}>`)
        for (const toolUseOpeningTag of possibleToolUseOpeningTags) {
            if (accumulator.endsWith(toolUseOpeningTag)) {
                // Start of a new tool use found
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

                // This also indicates the end of the current text content block (if any)
                if (currentTextContent) {
                    currentTextContent.partial = false
                    // Extract text content, removing the part that formed the tool opening tag
                    const textEndIndex = accumulator.length - toolUseOpeningTag.length
                    currentTextContent.content.text = accumulator.slice(currentTextContentStartIndex, textEndIndex).trim()
                    // Only add if there's actual content
                    if (currentTextContent.content.text.length > 0) {
                        contentBlocks.push(currentTextContent)
                    }
                    currentTextContent = undefined
                } else {
                    // Check if there was text before this tool use started
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
                            partial: false, // Ended because tool use started
                        })
                    }
                }

                didStartToolUse = true
                break // Found tool start, stop checking for others
            }
        }

        if (!didStartToolUse) {
            // No tool use started, so it must be text content accumulating
            // (or continuing after a closed tool use)
            if (currentTextContent === undefined) {
                // Start of a new text block
                currentTextContentStartIndex = i - (accumulator.length - currentTextContentStartIndex - 1) // Adjust start index based on how much we've accumulated since the last block ended or the beginning
                // If accumulator starts from 0, start index is i
                if (contentBlocks.length === 0 && currentToolUse === undefined) {
                    currentTextContentStartIndex = accumulator.length - 1 // i
                } else {
                    // Re-calculate based on the actual start of the current text segment
                    // Find the end of the last block
                    let lastBlockEndIndex = 0
                    if (contentBlocks.length > 0) {
                        const lastBlock = contentBlocks[contentBlocks.length - 1]
                        // Approximation: find where the accumulator matches the end of the message string representation of the last block. This is complex.
                        // Simpler: Assume text starts right after the last block ended implicitly at index i.
                        lastBlockEndIndex = i // Where the loop *was* when the last block finished processing
                        // Need a more robust way to track the end index of the *raw string* corresponding to the last block.
                        // Let's stick to the accumulator slice approach for simplicity in this version.
                        // The start index should be where the current *unmatched* text began.
                        let lastProcessedIndex = -1
                        if (contentBlocks.length > 0) {
                            // This requires knowing the raw string length of the previous block, which V1 doesn't explicitly track easily.
                            // We'll approximate based on the current accumulator and start index logic.
                            // The issue arises if a tool tag was just closed. accumulator contains everything up to i.
                            // lastBlockEndIndex should point to the character *after* the closing tag of the last block.
                        }
                        // Reset start index to the beginning of the *current* potential text block
                        currentTextContentStartIndex = accumulator.length - 1 // Start accumulating from the current character `i`
                    }

                    // If we just closed a tool, text starts *after* its closing tag
                    // The logic needs refinement here for accurate start index after a tool closure.
                    // Let's assume for now the start index logic inside the loop handles it via slicing.
                }

                currentTextContent = {
                    id: '',
                    cid: '',
                    type: "text",
                    content: {
                        text: ''
                    }, // Content will be filled by slicing accumulator
                    partial: true,
                }
            }
            // Update text content based on the accumulator from its start index
            currentTextContent.content.text = accumulator.slice(currentTextContentStartIndex).trimStart() // Trim start to avoid leading space if text follows tool
        }
    } // End of loop

    // --- Finalization after loop ---

    // If a tool use was open at the end
    if (currentToolUse) {
        // If a parameter was open within that tool use
        if (currentParamName) {
            // The remaining accumulator content belongs to this partial parameter
            currentToolUse.params[currentParamName] = accumulator.slice(currentParamValueStartIndex).trim()
        }
        // Add the potentially partial tool use block
        contentBlocks.push(currentToolUse)
    }
    // If text content was being accumulated at the end
    // Note: Only one of currentToolUse or currentTextContent can be defined here,
    // as starting a tool use finalizes the preceding text block.
    else if (currentTextContent) {
        // Update content one last time
        currentTextContent.content.text = accumulator.slice(currentTextContentStartIndex).trim()
        // Add the potentially partial text block only if it contains content
        if (currentTextContent.content.text.length > 0) {
            contentBlocks.push(currentTextContent)
        }
    }
    console.log('contentBlocks is:', contentBlocks)
    return contentBlocks
}