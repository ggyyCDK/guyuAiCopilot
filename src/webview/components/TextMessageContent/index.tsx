import { ChatMessage, MessageType, MessageStatus } from '@/type/imType/im';
import { removeThinkingTags } from '@/utils/llmUtils/chat/chatMessageUtils';
import React, { FC, useEffect, useState } from 'react';
import { ChatMessageUtils } from '@/utils/llmUtils/chat/chatMessageUtils';
import ContentContainer from '../ContentContainer';
import styles from './index.module.scss';

interface MessageContentProps {
    message: ChatMessage
}
const TextMessageContent: FC<MessageContentProps> = ({ message }) => {
    const content = removeThinkingTags(message.content)
    const isUser = ChatMessageUtils.isUserMessage(message)
    return <ContentContainer title={isUser ? '用户：' : 'schooberAi：'}>
        <pre className={styles.pre}>{content}</pre>
    </ContentContainer>
}

export default TextMessageContent

