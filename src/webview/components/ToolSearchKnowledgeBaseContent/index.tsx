import React, { FC } from 'react';
import { ChatMessage } from '@/type/imType/im';
import { DatabaseOutlined } from '@ant-design/icons';
import ContentContainer from '../ContentContainer';
import { getToolStatus, getToolStatusText } from '@/webview/utils/toolStatus';

interface MessageContentProps {
    message: ChatMessage
}

const ToolSearchKnowledgeBaseContent: FC<MessageContentProps> = ({ message }) => {
    const { params } = message.content;
    const toolStatus = getToolStatus(message.status);
    const statusText = getToolStatusText('search_knowledge_base', toolStatus);

    return (
        <ContentContainer title='知识库检索' status={toolStatus} statusText={statusText}>
            <div style={{ padding: '0 12px 8px' }}>
                <div style={{ 
                    display: 'flex', 
                    alignItems: 'flex-start',
                    padding: '8px 12px',
                    background: 'rgba(127, 127, 127, 0.05)',
                    borderRadius: 6,
                    border: '1px solid rgba(127, 127, 127, 0.1)'
                }}>
                    <DatabaseOutlined style={{ 
                        fontSize: 16, 
                        marginRight: 10,
                        marginTop: 2,
                        color: 'var(--vscode-charts-green, #89d185)'
                    }} />
                    <div style={{ flex: 1 }}>
                        <div style={{ marginBottom: 4 }}>
                            <span style={{ opacity: 0.7, marginRight: 8 }}>查询:</span>
                            <span style={{ 
                                fontFamily: 'monospace', 
                                background: 'rgba(127, 127, 127, 0.1)', 
                                padding: '2px 6px', 
                                borderRadius: 3 
                            }}>
                                {params?.query || '...'}
                            </span>
                        </div>
                        {params?.collection && (
                            <div style={{ marginBottom: 4 }}>
                                <span style={{ opacity: 0.7, marginRight: 8 }}>集合:</span>
                                <span style={{ 
                                    fontFamily: 'monospace',
                                    color: 'var(--vscode-textLink-foreground, #3794ff)'
                                }}>
                                    {params.collection}
                                </span>
                            </div>
                        )}
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                            {params?.topk && (
                                <span style={{ 
                                    fontSize: 11, 
                                    opacity: 0.6,
                                    background: 'rgba(127, 127, 127, 0.1)',
                                    padding: '1px 6px',
                                    borderRadius: 3
                                }}>
                                    Top {params.topk}
                                </span>
                            )}
                            {params?.score_threshold && (
                                <span style={{ 
                                    fontSize: 11, 
                                    opacity: 0.6,
                                    background: 'rgba(127, 127, 127, 0.1)',
                                    padding: '1px 6px',
                                    borderRadius: 3
                                }}>
                                    阈值 {params.score_threshold}
                                </span>
                            )}
                            {params?.use_rerank === 'true' && (
                                <span style={{ 
                                    fontSize: 11, 
                                    color: 'var(--vscode-charts-orange, #cca700)',
                                    background: 'rgba(204, 167, 0, 0.1)',
                                    padding: '1px 6px',
                                    borderRadius: 3
                                }}>
                                    Rerank
                                </span>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </ContentContainer>
    );
}

export default ToolSearchKnowledgeBaseContent
