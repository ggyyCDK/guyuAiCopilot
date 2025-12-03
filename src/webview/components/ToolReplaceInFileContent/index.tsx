import { ChatMessage, MessageType, MessageStatus } from '@/type/imType/im';
import { removeThinkingTags } from '@/utils/llmUtils/chat/chatMessageUtils';
import React, { FC, useEffect, useState } from 'react';
import {
    SwapOutlined
} from '@ant-design/icons';
import ContentContainer from '../ContentContainer';
import PathCard from '../PathCard'

interface MessageContentProps {
    message: ChatMessage
}
const ToolReplaceInFileContent: FC<MessageContentProps> = ({ message }) => {
    const { params } = message.content

    const handleFileClick = (path: string) => {
        const vscode = (window as any).vscode;
        if (vscode) {
            vscode.postMessage({
                type: 'open-file',
                payload: { path }
            });
        }
    };

    return <ContentContainer title='编辑文件'>
        <PathCard 
            path={params.path} 
            icon={<SwapOutlined />}
            onClick={() => handleFileClick(params.path)}
        />
    </ContentContainer>
}

export default ToolReplaceInFileContent