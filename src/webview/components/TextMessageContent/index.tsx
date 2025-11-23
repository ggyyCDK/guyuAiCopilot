import { ChatMessage, MessageType, MessageStatus } from '@/type/imType/im';
import { removeThinkingTags, removeUnclosedTags } from '@/utils/llmUtils/chat/chatMessageUtils';
import React, { FC, useEffect, useState } from 'react';
import { ChatMessageUtils } from '@/utils/llmUtils/chat/chatMessageUtils';
import ContentContainer from '../ContentContainer';
import styles from './index.module.scss';

interface MessageContentProps {
    message: ChatMessage
}
const TextMessageContent: FC<MessageContentProps> = ({ message }) => {
    // 先移除思考标签，再移除未闭合的标签
    let content = removeThinkingTags(message.content)
    content = removeUnclosedTags(content)
    const isUser = ChatMessageUtils.isUserMessage(message)
    return <ContentContainer title={isUser ? '用户：' : 'schooberAi：'}>
        <pre className={styles.pre}>{content}</pre>
    </ContentContainer>
}

export default TextMessageContent

