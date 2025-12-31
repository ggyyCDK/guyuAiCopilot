import React, { FC } from 'react';
import ReactMarkdown from 'react-markdown';
import MarkdownBlocktoMessage from '@/webview/common/markdownBlocktoMessage';
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
                <MarkdownBlocktoMessage markdown={content} />
            </div>
        </ContentContainer>
    );
};

export default ToolAttempCompletionContent

