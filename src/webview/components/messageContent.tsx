import { ChatMessage, MessageType, MessageStatus } from '@/type/imType/im';
import React, { FC, useEffect, useState } from 'react';
import TextMessageContent from './TextMessageContent'
import ToolAttempCompletionContent from './ToolAttempCompletionContent';
import ToolReadFileContent from './ToolReadFileContent';
import ToolWriteFileContent from './ToolWriteFileContent';
import ToolReplaceInFileContent from './ToolReplaceInFileContent';
import ToolListFilesContent from './ToolListFilesContent';
import ToolAskFollowUpQuestionContent from './ToolAskFollowUpQuestionContent';

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
                case 'list_files':
                    return <ToolListFilesContent message={message}></ToolListFilesContent>
                case 'attempt_completion':
                    return <ToolAttempCompletionContent message={message}></ToolAttempCompletionContent>
                case 'ask_followup_question':
                    return <ToolAskFollowUpQuestionContent message={message}></ToolAskFollowUpQuestionContent>
            }
        }

        default:
            return <div>{typeof message.content === 'string' ? message.content : JSON.stringify(message.content)}</div>
    }
}

export default MessageContent