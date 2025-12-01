import React, { FC } from 'react';
import ReactMarkdown from 'react-markdown';
import { ChatMessage } from '@/type/imType/im';
import ContentContainer from '../ContentContainer';
import styles from './index.module.scss';

interface MessageContentProps {
    message: ChatMessage
}
const ToolAttempCompletionContent: FC<MessageContentProps> = ({ message }) => {
    const content = message?.content?.params?.result ?? '';

    return (
        <ContentContainer
            title='SchooberAi:'
            titleClassName={styles.attemptCompletionTitle}
            contentClassName={styles.attemptCompletionContent}
        >
            <div className={styles.pre}>
                <ReactMarkdown>
                    {content}
                </ReactMarkdown>
            </div>
        </ContentContainer>
    );
};

export default ToolAttempCompletionContent

