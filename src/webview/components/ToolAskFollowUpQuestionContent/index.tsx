import React, { FC } from 'react';
import { ChatMessage } from '@/type/imType/im';
import ContentContainer from '../ContentContainer';
import styles from './index.module.scss';

interface MessageContentProps {
    message: ChatMessage
}

const ToolAskFollowUpQuestionContent: FC<MessageContentProps> = ({ message }) => {
    const question = message?.content?.params?.question

    return (
        <ContentContainer
            title='询问'
            titleClassName={styles.title}
            contentClassName={styles.content}
        >
            <div className={styles.question}>{question}</div>
        </ContentContainer>
    );
}

export default ToolAskFollowUpQuestionContent;

