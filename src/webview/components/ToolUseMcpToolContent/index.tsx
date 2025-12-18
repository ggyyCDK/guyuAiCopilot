import React, { FC } from 'react';
import { ChatMessage } from '@/type/imType/im';
import ContentContainer from '../ContentContainer';
import { ApiOutlined, ToolOutlined } from '@ant-design/icons';
import styles from './index.module.scss';

interface MessageContentProps {
    message: ChatMessage
}

const ToolUseMcpToolContent: FC<MessageContentProps> = ({ message }) => {
    const { params } = message.content;
    const { server_name, tool_name, arguments: args } = params;

    let parsedArgs = args;
    if (typeof args === 'string') {
        try {
            parsedArgs = JSON.parse(args);
        } catch (e) { }
    }

    const formattedArgs = JSON.stringify(parsedArgs, null, 2);

    return (
        <ContentContainer title='调用 MCP 工具'>
            <div className={styles.container}>
                <div className={styles.header}>
                    <div className={styles.serverTag}>
                        <ApiOutlined />
                        <span>{server_name}</span>
                    </div>
                    <div className={styles.toolName}>
                        <ToolOutlined style={{ marginRight: 6 }} />
                        {tool_name}
                    </div>
                </div>

                {formattedArgs !== '{}' && (
                    <div className={styles.section}>
                        <div className={styles.sectionTitle}>参数</div>
                        <div className={styles.codeBlock}>
                            <pre>{formattedArgs}</pre>
                        </div>
                    </div>
                )}
            </div>
        </ContentContainer>
    );
}

export default ToolUseMcpToolContent;