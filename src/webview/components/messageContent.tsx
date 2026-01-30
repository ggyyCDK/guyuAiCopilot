import { ChatMessage, MessageType, MessageStatus } from '@/type/imType/im';
import React, { FC, useEffect, useState } from 'react';
import TextMessageContent from './TextMessageContent'
import ToolAttempCompletionContent from './ToolAttempCompletionContent';
import ToolReadFileContent from './ToolReadFileContent';
import ToolWriteFileContent from './ToolWriteFileContent';
import ToolReplaceInFileContent from './ToolReplaceInFileContent';
import ToolApplyDiffContent from './ToolApplyDiffContent';
import ToolListFilesContent from './ToolListFilesContent';
import ToolAskFollowUpQuestionContent from './ToolAskFollowUpQuestionContent';
import ToolUpdateTodoListContent from './ToolUpdateTodoListContent';
import ToolUseMcpToolContent from './ToolUseMcpToolContent';
import ToolSearchFilesContent from './ToolSearchFilesContent';
import ToolExecuteCommandContent from './ToolExecuteCommandContent';
interface MessageContentProps {
    message: ChatMessage
}
const MessageContent: FC<MessageContentProps> = ({ message }) => {

    switch (message.type) {

        case MessageType.Text: {
            return <TextMessageContent message={message} />
        }

        case MessageType.ToolUse: {
            const { toolName } = message?.content
            switch (toolName) {
                case 'read_file':
                    return <ToolReadFileContent message={message}></ToolReadFileContent>
                case 'write_to_file':
                    return <ToolWriteFileContent message={message}></ToolWriteFileContent>
                case 'replace_in_file':
                    return <ToolReplaceInFileContent message={message}></ToolReplaceInFileContent>
                case 'apply_diff':
                    return <ToolApplyDiffContent message={message}></ToolApplyDiffContent>
                case 'list_files':
                    return <ToolListFilesContent message={message}></ToolListFilesContent>
                case 'search_files':
                    return <ToolSearchFilesContent message={message}></ToolSearchFilesContent>
                case 'attempt_completion':
                    return <ToolAttempCompletionContent message={message}></ToolAttempCompletionContent>
                case 'update_todo_list':
                    return <ToolUpdateTodoListContent message={message}></ToolUpdateTodoListContent>
                case 'use_mcp_tool':
                    return <ToolUseMcpToolContent message={message}></ToolUseMcpToolContent>
                case 'ask_followup_question':
                    return <ToolAskFollowUpQuestionContent message={message}></ToolAskFollowUpQuestionContent>
                case 'execute_command':
                    return <ToolExecuteCommandContent message={message}></ToolExecuteCommandContent>
            }
        }

        default:
            return <div>{typeof message.content === 'string' ? message.content : JSON.stringify(message.content)}</div>
    }
}

export default MessageContent