import { ChatMessage, MessageType, MessageStatus } from '@/type/imType/im';
import { removeThinkingTags } from '@/utils/llmUtils/chat/chatMessageUtils';
import React, { FC, useEffect, useState } from 'react';
import ContentContainer from '../ContentContainer';
import styles from './index.module.scss';

interface MessageContentProps {
    message: ChatMessage
}
const ToolAttempCompletionContent: FC<MessageContentProps> = ({ message }) => {
    return <ContentContainer title='回答问题' titleClassName={styles.attemptCompletionTitle} contentClassName={styles.attemptCompletionContent}>
        <div className={styles.pre}>{message?.content?.params?.result}</div>
    </ContentContainer>
}

export default ToolAttempCompletionContent

