import React, { FC } from 'react';
import { ChatMessage, MessageStatus } from '@/type/imType/im';
import {
    CodeOutlined
} from '@ant-design/icons';
import ContentContainer from '../ContentContainer';
import styles from './index.module.scss';

interface MessageContentProps {
    message: ChatMessage
}

const ToolExecuteCommandContent: FC<MessageContentProps> = ({ message }) => {
    const { params } = message.content

    const command = params.command || '';
    const cwd = params.cwd;

    return <ContentContainer title='执行命令'>
        <div className={styles.commandContainer}>
            <div className={styles.commandHeader}>
                <CodeOutlined />
                <span className={styles.commandText}>{command}</span>
            </div>
            {cwd && (
                <div className={styles.cwdInfo}>
                    <span className={styles.label}>Directory:</span>
                    <span className={styles.path}>{cwd}</span>
                </div>
            )}
            {message.status !== MessageStatus.Complete && (
                <div className={styles.status}>Executing...</div>
            )}
        </div>
    </ContentContainer>
}

export default ToolExecuteCommandContent
