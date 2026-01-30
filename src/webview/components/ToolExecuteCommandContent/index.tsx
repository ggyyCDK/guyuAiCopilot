import React, { FC } from 'react';
import { ChatMessage } from '@/type/imType/im';
import { CodeOutlined } from '@ant-design/icons';
import ContentContainer from '../ContentContainer';
import styles from './index.module.scss';
import { getToolStatus, getToolStatusText } from '@/webview/utils/toolStatus';

interface MessageContentProps {
    message: ChatMessage
}

const ToolExecuteCommandContent: FC<MessageContentProps> = ({ message }) => {
    const { params } = message.content;
    const toolStatus = getToolStatus(message.status);
    const statusText = getToolStatusText('execute_command', toolStatus);

    const command = params.command || '';
    const cwd = params.cwd;

    return (
        <ContentContainer title='执行命令' status={toolStatus} statusText={statusText}>
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
            </div>
        </ContentContainer>
    );
}

export default ToolExecuteCommandContent
