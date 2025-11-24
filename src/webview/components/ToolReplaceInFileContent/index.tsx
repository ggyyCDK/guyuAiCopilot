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
    return <ContentContainer title='编辑文件'>
        <PathCard path={params.path} icon={<SwapOutlined />}></PathCard>
    </ContentContainer>
}

export default ToolReplaceInFileContent