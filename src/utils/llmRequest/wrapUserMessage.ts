
export interface TextBlockParam {
    text: string;

    type: 'text';
}

export interface ToolUseBlockParam {
    id: string;

    input: unknown;

    name: string;

    type: 'tool_use';
}
export interface ToolResultBlockParam {
    tool_use_id: string;

    type: 'tool_result';

    content?: string | Array<TextBlockParam>;

    is_error?: boolean;
}
export type UserContent = Array<TextBlockParam | ToolUseBlockParam | ToolResultBlockParam>;

const isUserMessage = (text: string) => text.includes('<feedback>') || text.includes('<answer>');
export const wrapUserMessage = async function (command: { userContent: UserContent }) {
    const { userContent } = command;//获取用户输入，也可能是大模型拼接后的输入
    const parsedUserContentList = await Promise.all(
        userContent.map(async block => {
            //文字解析
            if (block.type === 'text') {
                if (isUserMessage(block.text)) {
                    return {
                        ...block,
                        text: block.text
                    }
                }
            } else if (block.type === 'tool_result') {
                //递归输入的工具解析
                if (typeof block.content === 'string' && isUserMessage(block.content)) {
                    return {
                        ...block,
                        content: block.content
                    }
                } else if (Array.isArray(block.content)) {
                    const parsedContent = await Promise.all(
                        block.content.map(async contentBlock => {
                            if (contentBlock.type === 'text' && isUserMessage(contentBlock.text)) {
                                return {
                                    ...contentBlock,
                                    text: contentBlock.text
                                }
                            }
                            return contentBlock
                        })
                    )
                    return {
                        ...block,
                        content: parsedContent
                    }
                }
            }
            return block
        })
    )

    //TODO 这里要构建环境信息给大模型
    const environmentDetails = {};
    return {
        parsedUserContentList,
        environmentDetails
    }
}