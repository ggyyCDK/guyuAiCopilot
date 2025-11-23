import { ChatMessage, MessageType, MessageStatus } from '@/type/imType/im';
import { removeThinkingTags } from '@/utils/llmUtils/chat/chatMessageUtils';
import React, { FC, useEffect, useState } from 'react';
import {
    EditOutlined
} from '@ant-design/icons';
import ContentContainer from '../ContentContainer';
import PathCard from '../PathCard'

interface MessageContentProps {
    message: ChatMessage
}
const ToolWriteFileContent: FC<MessageContentProps> = ({ message }) => {
    const { params } = message.content
    return <ContentContainer title='写入文件'>
        <PathCard path={params.path} icon={<EditOutlined />}></PathCard>
    </ContentContainer>
}

export default ToolWriteFileContent