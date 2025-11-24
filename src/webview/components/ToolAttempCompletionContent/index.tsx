import React, { FC } from 'react';
import { ChatMessage } from '@/type/imType/im';
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

