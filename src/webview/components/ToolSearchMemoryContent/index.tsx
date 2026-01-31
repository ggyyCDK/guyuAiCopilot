import React, { FC } from 'react';
import { ChatMessage } from '@/type/imType/im';
import { HistoryOutlined } from '@ant-design/icons';
import ContentContainer from '../ContentContainer';
import { getToolStatus, getToolStatusText } from '@/webview/utils/toolStatus';

interface MessageContentProps {
    message: ChatMessage
}

const ToolSearchMemoryContent: FC<MessageContentProps> = ({ message }) => {
    const { params } = message.content;
    const toolStatus = getToolStatus(message.status);
    const statusText = getToolStatusText('search_memory', toolStatus);

    return (
        <ContentContainer title='引用记忆' status={toolStatus} statusText={statusText}>
            <div style={{ padding: '0 12px 8px' }}>
                <div style={{ 
                    display: 'flex', 
                    alignItems: 'center',
                    padding: '8px 12px',
                    background: 'rgba(127, 127, 127, 0.05)',
                    borderRadius: 6,
                    border: '1px solid rgba(127, 127, 127, 0.1)'
                }}>
                    <HistoryOutlined style={{ 
                        fontSize: 16, 
                        marginRight: 10,
                        color: 'var(--vscode-charts-blue, #3794ff)'
                    }} />
                    <div>
                        <div style={{ marginBottom: 4 }}>
                            <span style={{ opacity: 0.7, marginRight: 8 }}>关键词:</span>
                            <span style={{ 
                                fontFamily: 'monospace', 
                                background: 'rgba(127, 127, 127, 0.1)', 
                                padding: '2px 6px', 
                                borderRadius: 3 
                            }}>
                                {params?.query || '...'}
                            </span>
                        </div>
                        {params?.limit && (
                            <div>
                                <span style={{ opacity: 0.7, marginRight: 8 }}>数量限制:</span>
                                <span style={{ fontFamily: 'monospace' }}>{params.limit}</span>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </ContentContainer>
    );
}

export default ToolSearchMemoryContent
