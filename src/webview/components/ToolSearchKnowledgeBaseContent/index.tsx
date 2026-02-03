import React, { FC } from 'react';
import { ChatMessage, MessageStatus } from '@/type/imType/im';
import { DatabaseOutlined } from '@ant-design/icons';
import ContentContainer from '../ContentContainer';
import { getToolStatus, getToolStatusText } from '@/webview/utils/toolStatus';

interface RagStats {
    returnRate: number;
    highScoreRate: number;
    avgScore: number;
    rerankBoostRate: number;
    totalResults: number;
    requestedTopk: number;
}

interface MessageContentProps {
    message: ChatMessage
}

/**
 * 获取颜色基于数值
 */
const getScoreColor = (score: number): string => {
    if (score >= 0.8) return 'var(--vscode-charts-green, #89d185)';
    if (score >= 0.6) return 'var(--vscode-charts-yellow, #cca700)';
    return 'var(--vscode-charts-red, #f14c4c)';
};

const ToolSearchKnowledgeBaseContent: FC<MessageContentProps> = ({ message }) => {
    const { params } = message.content;
    const toolStatus = getToolStatus(message.status);
    const statusText = getToolStatusText('search_knowledge_base', toolStatus);
    const ragStats: RagStats | undefined = message.ext?.ragStats;
    const isComplete = message.status === MessageStatus.Complete;

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

                {/* 统计指标展示 */}
                {isComplete && ragStats && (
                    <div style={{ 
                        marginTop: 8,
                        padding: '8px 12px',
                        background: 'rgba(127, 127, 127, 0.03)',
                        borderRadius: 6,
                        border: '1px solid rgba(127, 127, 127, 0.08)'
                    }}>
                        <div style={{ 
                            fontSize: 11, 
                            opacity: 0.6, 
                            marginBottom: 6,
                            fontWeight: 500
                        }}>
                            检索统计
                        </div>
                        <div style={{ 
                            display: 'grid', 
                            gridTemplateColumns: 'repeat(2, 1fr)',
                            gap: '6px 12px',
                            fontSize: 12
                        }}>
                            {/* 返回率 */}
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <span style={{ opacity: 0.7 }}>返回率</span>
                                <span style={{ 
                                    fontFamily: 'monospace',
                                    fontWeight: 500,
                                    color: getScoreColor(ragStats.returnRate)
                                }}>
                                    {ragStats.totalResults}/{ragStats.requestedTopk} ({(ragStats.returnRate * 100).toFixed(0)}%)
                                </span>
                            </div>
                            
                            {/* 平均分数 */}
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <span style={{ opacity: 0.7 }}>平均分数</span>
                                <span style={{ 
                                    fontFamily: 'monospace',
                                    fontWeight: 500,
                                    color: getScoreColor(ragStats.avgScore)
                                }}>
                                    {ragStats.avgScore.toFixed(4)}
                                </span>
                            </div>
                            
                            {/* 高分命中率 */}
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <span style={{ opacity: 0.7 }}>高分命中率</span>
                                <span style={{ 
                                    fontFamily: 'monospace',
                                    fontWeight: 500,
                                    color: getScoreColor(ragStats.highScoreRate)
                                }}>
                                    {(ragStats.highScoreRate * 100).toFixed(0)}%
                                </span>
                            </div>
                            
                            {/* Rerank提升率 */}
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <span style={{ opacity: 0.7 }}>Rerank提升率</span>
                                <span style={{ 
                                    fontFamily: 'monospace',
                                    fontWeight: 500,
                                    color: ragStats.rerankBoostRate >= 0 
                                        ? getScoreColor(ragStats.rerankBoostRate) 
                                        : 'var(--vscode-descriptionForeground, #999)'
                                }}>
                                    {ragStats.rerankBoostRate >= 0 
                                        ? `${(ragStats.rerankBoostRate * 100).toFixed(0)}%` 
                                        : 'N/A'}
                                </span>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </ContentContainer>
    );
}

export default ToolSearchKnowledgeBaseContent
